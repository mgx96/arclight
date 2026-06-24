// Cross-chain USDC bridge: Arc testnet -> Ethereum Sepolia, via Circle CCTP V2, driven end-to-end by
// the creator's Circle Programmable Wallet (Developer-Controlled).
//
// Full round-trip, all real Circle infrastructure:
//   1. The Circle-managed wallet `approve`s the ArcCctpGateway to spend its USDC  (Circle Wallets API)
//   2. The Circle-managed wallet calls `bridgeOut`, which burns the USDC via CCTP  (Circle Wallets API + CCTP)
//   3. We read the `MessageSent` bytes from the burn receipt and poll Circle's Iris attestation service
//   4. The creator EOA relays `receiveMessage` on Sepolia, minting native USDC there  (CCTP)
//
// Amounts are handled in 6-dec USDC base units — on Arc, USDC is an 18-dec native gas token but its
// ERC-20 interface (which CCTP uses) is 6-dec, so we stay on the 6-dec side throughout.
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseUnits,
  pad,
  keccak256,
  decodeEventLog,
  parseAbiItem,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ENV } from "./env.js";
import { ARC_TESTNET, CONTRACTS, USDC } from "./config.js";
import * as treasury from "./circle-treasury.js";

// CCTP V2 testnet contracts share one deterministic address across every supported testnet chain,
// so the same MessageTransmitter answers on both Arc and Sepolia.
const CCTP_MESSAGE_TRANSMITTER = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as const;
// CCTP domain id for Ethereum (Sepolia shares Ethereum's domain).
const ETHEREUM_DOMAIN = 0;
// Circle's testnet attestation service.
const IRIS_BASE = "https://iris-api-sandbox.circle.com";
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

const MESSAGE_SENT_EVENT = parseAbiItem("event MessageSent(bytes message)");
const RECEIVE_MESSAGE_FN = parseAbiItem("function receiveMessage(bytes message, bytes attestation)");
const TERMINAL_OK = new Set(["COMPLETE", "CONFIRMED"]);

const arc = defineChain({
  id: ARC_TESTNET.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_TESTNET.rpcUrl] } },
});
const arcPublic = createPublicClient({ chain: arc, transport: http(ARC_TESTNET.rpcUrl) });

const creatorAccount = privateKeyToAccount(ENV.creatorPrivateKey);
const sepoliaPublic = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC) });
const sepoliaWallet = createWalletClient({ account: creatorAccount, chain: sepolia, transport: http(SEPOLIA_RPC) });

export type BridgeStep =
  | "approving"
  | "burning"
  | "attesting"
  | "minting"
  | "done";

export type BridgeResult = {
  amount: string;                 // human USDC, e.g. "0.10"
  recipient: `0x${string}`;       // mint recipient on Sepolia
  destinationChain: "Ethereum Sepolia";
  sourceDomain: number;           // parsed from the CCTP message (Arc's domain)
  approveTxId: string;            // Circle transaction id
  burnTxHash: Hex;                // on-chain Arc burn tx
  messageHash: Hex;               // keccak256 of the CCTP message
  mintTxHash: Hex;                // on-chain Sepolia mint tx
};

// Pull the CCTP `MessageSent(bytes)` payload out of a burn receipt. CCTP's TokenMessenger routes the
// burn through the MessageTransmitter, which emits this event; the bytes are what Circle attests over.
function extractMessage(logs: { address: string; data: Hex; topics: Hex[] }[]): Hex {
  const transmitter = CCTP_MESSAGE_TRANSMITTER.toLowerCase();
  for (const log of logs) {
    if (log.address.toLowerCase() !== transmitter) continue;
    try {
      const decoded = decodeEventLog({
        abi: [MESSAGE_SENT_EVENT],
        data: log.data,
        topics: log.topics as [signature: Hex, ...args: Hex[]],
      });
      return (decoded.args as { message: Hex }).message;
    } catch {
      /* not the MessageSent log — keep scanning */
    }
  }
  throw new Error("no CCTP MessageSent event found in burn receipt");
}

// The CCTP message header is: version(4) | sourceDomain(4) | destinationDomain(4) | ... — so the
// source domain is the 4 bytes at offset 4. Parsing it from the message means we never hardcode Arc's
// domain id; we read whatever the burn actually emitted.
function sourceDomainOf(message: Hex): number {
  const hex = message.slice(2);
  return parseInt(hex.slice(8, 16), 16);
}

type IrisMessage = { status: string; attestation: string; message: Hex };

// Poll Circle's Iris attestation service until the message is signed. Standard (non-fast) CCTP waits
// for source-chain finality, so this can take a few minutes.
async function waitForAttestation(
  sourceDomain: number,
  burnTxHash: Hex,
  onStep?: (s: BridgeStep) => void,
  { timeoutMs = 12 * 60_000, intervalMs = 6_000 } = {}
): Promise<{ message: Hex; attestation: Hex }> {
  onStep?.("attesting");
  const url = `${IRIS_BASE}/v2/messages/${sourceDomain}?transactionHash=${burnTxHash}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(url);
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { messages?: IrisMessage[] };
      const m = body.messages?.[0];
      if (m && m.status === "complete" && m.attestation && m.attestation !== "PENDING") {
        return { message: m.message, attestation: m.attestation as Hex };
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("timed out waiting for Circle attestation");
}

// Run the whole Arc -> Sepolia round-trip. `amountUsdc` is a human decimal string ("0.1").
// `recipient` is where the freshly minted USDC lands on Sepolia; defaults to the creator EOA (which
// also relays the mint). Any address works as the mint recipient — the relayer just needs Sepolia ETH.
export async function bridgeToSepolia(
  amountUsdc: string,
  recipient: `0x${string}` = ENV.creatorAddress,
  onStep?: (s: BridgeStep) => void
): Promise<BridgeResult> {
  const amount6 = parseUnits(amountUsdc, 6); // CCTP uses the 6-dec ERC-20 view of Arc USDC
  const amountStr = amount6.toString();
  const mintRecipient = pad(recipient, { size: 32 }); // bytes32, left-padded address

  // 1. Managed wallet approves the gateway to pull its USDC (Circle Wallets API).
  onStep?.("approving");
  const approve = await treasury.executeContract({
    contractAddress: USDC as `0x${string}`,
    abiFunctionSignature: "approve(address,uint256)",
    abiParameters: [CONTRACTS.ArcCctpGateway, amountStr],
  });
  const approveSettled = await treasury.waitForTransaction(approve.id);
  if (!TERMINAL_OK.has(approveSettled.state)) {
    throw new Error(`Circle approve did not complete (state ${approveSettled.state})`);
  }

  // 2. Managed wallet calls bridgeOut -> CCTP depositForBurn burns the USDC on Arc.
  onStep?.("burning");
  const burn = await treasury.executeContract({
    contractAddress: CONTRACTS.ArcCctpGateway as `0x${string}`,
    abiFunctionSignature: "bridgeOut(uint256,uint32,bytes32)",
    abiParameters: [amountStr, ETHEREUM_DOMAIN, mintRecipient],
  });
  const burnSettled = await treasury.waitForTransaction(burn.id);
  if (!burnSettled.txHash || !TERMINAL_OK.has(burnSettled.state)) {
    throw new Error(`Circle bridgeOut did not complete (state ${burnSettled.state})`);
  }
  const burnTxHash = burnSettled.txHash as Hex;

  // 3. Read the CCTP message from the burn receipt and wait for Circle's attestation.
  const receipt = await arcPublic.waitForTransactionReceipt({ hash: burnTxHash });
  const rawMessage = extractMessage(receipt.logs as { address: string; data: Hex; topics: Hex[] }[]);
  const sourceDomain = sourceDomainOf(rawMessage);
  const { message, attestation } = await waitForAttestation(sourceDomain, burnTxHash, onStep);

  // 4. Relay the attested message on Sepolia -> CCTP mints native USDC to the recipient.
  onStep?.("minting");
  const mintTxHash = await sepoliaWallet.writeContract({
    address: CCTP_MESSAGE_TRANSMITTER,
    abi: [RECEIVE_MESSAGE_FN],
    functionName: "receiveMessage",
    args: [message, attestation],
  });
  await sepoliaPublic.waitForTransactionReceipt({ hash: mintTxHash });

  onStep?.("done");
  return {
    amount: amountUsdc,
    recipient,
    destinationChain: "Ethereum Sepolia",
    sourceDomain,
    approveTxId: approve.id,
    burnTxHash,
    messageHash: keccak256(rawMessage),
    mintTxHash,
  };
}

export const BRIDGE_META = {
  destinationChain: "Ethereum Sepolia" as const,
  destinationDomain: ETHEREUM_DOMAIN,
  recipient: ENV.creatorAddress,
  messageTransmitter: CCTP_MESSAGE_TRANSMITTER,
};
