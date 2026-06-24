// The creator's Circle-managed treasury wallet, via Circle Programmable Wallets
// (Developer-Controlled Wallets). This is the part of Arclight that talks to Circle's Console API
// with your CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET — an MPC wallet Circle provisions and signs for,
// distinct from the raw-key EOAs used for x402 signing.
//
// Flow it supports:
//   - provision()   idempotently create a wallet set + an EOA wallet on ARC-TESTNET (cached locally)
//   - getBalance()  read the wallet's USDC balance through Circle's API
//   - payout()      move USDC out of the treasury via Circle's createTransaction (Console-signed)
import {
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ENV } from "./env.js";
import { ARC_TESTNET, USDC } from "./config.js";

const ARC_BLOCKCHAIN = "ARC-TESTNET" as const;

const here = dirname(fileURLToPath(import.meta.url));
// Cache the provisioned ids/address so we don't re-create a wallet on every boot. No secrets here —
// just the wallet set id, wallet id, and public address. Gitignored regardless.
const CACHE_PATH = resolve(here, "..", ".circle-treasury.json");

type TreasuryCache = {
  walletSetId: string;
  walletId: string;
  address: `0x${string}`;
  blockchain: string;
};

type Client = ReturnType<typeof initiateDeveloperControlledWalletsClient>;

let client: Client | null = null;
let cache: TreasuryCache | null = null;

function readCache(): TreasuryCache | null {
  if (cache) return cache;
  if (existsSync(CACHE_PATH)) {
    cache = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as TreasuryCache;
    return cache;
  }
  return null;
}

function writeCache(next: TreasuryCache) {
  cache = next;
  writeFileSync(CACHE_PATH, JSON.stringify(next, null, 2));
}

export class TreasuryDisabledError extends Error {
  constructor() {
    super("Circle treasury is not configured — set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env.local.");
    this.name = "TreasuryDisabledError";
  }
}

function getClient(): Client {
  if (!ENV.circleApiKey || !ENV.circleEntitySecret) throw new TreasuryDisabledError();
  if (!client) {
    client = initiateDeveloperControlledWalletsClient({
      apiKey: ENV.circleApiKey,
      entitySecret: ENV.circleEntitySecret,
    });
  }
  return client;
}

// Create (once) a wallet set + an EOA wallet on Arc testnet, or return the cached one.
export async function provision(): Promise<TreasuryCache> {
  const existing = readCache();
  if (existing) return existing;

  const sdk = getClient();
  const walletSet = await sdk.createWalletSet({ name: "Arclight creator treasury" });
  const walletSetId = walletSet.data?.walletSet?.id;
  if (!walletSetId) throw new Error("Circle createWalletSet returned no wallet set id");

  const wallets = await sdk.createWallets({
    walletSetId,
    blockchains: [ARC_BLOCKCHAIN],
    accountType: "EOA",
    count: 1,
  });
  const wallet = wallets.data?.wallets?.[0];
  if (!wallet?.id || !wallet?.address) throw new Error("Circle createWallets returned no wallet");

  const next: TreasuryCache = {
    walletSetId,
    walletId: wallet.id,
    address: wallet.address as `0x${string}`,
    blockchain: ARC_BLOCKCHAIN,
  };
  writeCache(next);
  return next;
}

export async function getInfo(): Promise<{ address: `0x${string}`; walletId: string } | null> {
  const c = readCache();
  return c ? { address: c.address, walletId: c.walletId } : null;
}

type TokenBalance = {
  amount?: string;
  token?: { id?: string; tokenAddress?: string; symbol?: string; isNative?: boolean };
};

// Find the USDC entry in a Circle token-balance list. On Arc, USDC is the native token at the
// precompile address, so match on native flag / symbol / address to be safe across representations.
function findUsdc(tokens: TokenBalance[]): TokenBalance | undefined {
  return tokens.find((t) => {
    const addr = (t.token?.tokenAddress ?? "").toLowerCase();
    const sym = (t.token?.symbol ?? "").toUpperCase();
    return t.token?.isNative === true || sym === "USDC" || addr === USDC.toLowerCase();
  });
}

// Read the treasury's USDC balance through Circle's API (not via on-chain RPC). Also surfaces the
// Circle tokenId, which createTransaction prefers over a raw address.
export async function getBalance(): Promise<{ usdc: string; tokenId: string | null; tokens: TokenBalance[] }> {
  const c = await provision();
  const sdk = getClient();
  const res = await sdk.getWalletTokenBalance({ id: c.walletId });
  const tokens = (res.data?.tokenBalances ?? []) as TokenBalance[];
  const usdc = findUsdc(tokens);
  return { usdc: usdc?.amount ?? "0", tokenId: usdc?.token?.id ?? null, tokens };
}

// Move USDC out of the treasury via Circle's Console-signed createTransaction. Returns the Circle
// transaction id immediately; on-chain settlement is polled separately. Uses the resolved Circle
// tokenId when available (most reliable for native Arc USDC), falling back to the token address.
export async function payout(params: {
  destinationAddress: `0x${string}`;
  amount: string;
}): Promise<{ id: string }> {
  const c = await provision();
  const sdk = getClient();
  const { tokenId } = await getBalance();
  const tokenRef = tokenId ? { tokenId } : { tokenAddress: USDC };
  const res = await sdk.createTransaction({
    walletId: c.walletId,
    ...tokenRef,
    destinationAddress: params.destinationAddress,
    amount: [params.amount],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  } as Parameters<typeof sdk.createTransaction>[0]);
  const id = res.data?.id;
  if (!id) throw new Error("Circle createTransaction returned no id");
  return { id };
}

// Execute an arbitrary smart-contract call FROM the Circle-managed wallet via Circle's Console-signed
// createContractExecutionTransaction. This is how the managed wallet drives on-chain actions (e.g. an
// ERC-20 approve, or CCTP bridgeOut) without exposing a private key. Returns the Circle transaction id.
export async function executeContract(params: {
  contractAddress: `0x${string}`;
  abiFunctionSignature: string;
  abiParameters: unknown[];
}): Promise<{ id: string }> {
  const c = await provision();
  const sdk = getClient();
  const res = await sdk.createContractExecutionTransaction({
    walletId: c.walletId,
    contractAddress: params.contractAddress,
    abiFunctionSignature: params.abiFunctionSignature,
    abiParameters: params.abiParameters,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  } as Parameters<typeof sdk.createContractExecutionTransaction>[0]);
  const id = res.data?.id;
  if (!id) throw new Error("Circle createContractExecutionTransaction returned no id");
  return { id };
}

// Poll a Circle transaction until a terminal state (or timeout). Returns the last state + txHash.
export async function waitForTransaction(
  id: string,
  { timeoutMs = 60_000, intervalMs = 2_500 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<{ state: string; txHash: string | null }> {
  const sdk = getClient();
  const terminal = new Set(["COMPLETE", "FAILED", "DENIED", "CANCELLED"]);
  const deadline = Date.now() + timeoutMs;
  let state = "PENDING";
  let txHash: string | null = null;
  while (Date.now() < deadline) {
    const res = await sdk.getTransaction({ id });
    const tx = res.data?.transaction;
    state = tx?.state ?? state;
    txHash = tx?.txHash ?? txHash;
    if (terminal.has(state)) break;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { state, txHash };
}

export const TREASURY_META = { blockchain: ARC_BLOCKCHAIN, chainName: ARC_TESTNET.x402ChainName };
