// Simulated backend for the static GitHub Pages showcase (NEXT_PUBLIC_SHOWCASE=1). The real backend
// holds testnet keys and the Circle API secret, so it can't be public. This mock makes the deployed
// site fully clickable: it runs the same watch -> attest -> pay -> withdraw -> move -> send -> bridge
// flow against in memory state, with realistic timing and values, and it blocks proof replays the
// same way the real ProofOfView nullifier does. Nothing here touches a chain or moves real USDC.
import type {
  AttestResponse,
  Balances,
  BackendConfig,
  BridgeResult,
  CreatorBalances,
  PayViewResponse,
  Receipt,
  SweepResponse,
  Treasury,
  TreasuryPayoutResponse,
  WithdrawResponse,
} from "./api";

// Minimal shape of the ApiError class, injected so this module never imports from ./api at runtime
// (keeps the dependency one directional: api.ts -> api.mock.ts).
type ApiErrorCtor = new (message: string, status: number, body: unknown) => Error;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function randHex(bytes: number): `0x${string}` {
  let out = "0x";
  for (let i = 0; i < bytes * 2; i++) out += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  return out as `0x${string}`;
}

// Big decimal string, like the uint256 commitments/nullifiers snarkjs emits.
function randBigDecimal(): string {
  let s = "";
  for (let i = 0; i < 76; i++) s += "0123456789"[Math.floor(Math.random() * 10)];
  return s.replace(/^0+/, "") || "0";
}

// Deterministic nullifier per (viewer, campaign, epoch) so replaying the same view is detectable,
// exactly like the real circuit where the nullifier is Poseidon(viewerSecret, campaignId, epoch). A
// small seeded PRNG expands the key into a stable ~76 digit decimal (no BigInt, to match the TS target).
function nullifierFor(viewerSecret: string, campaignId: string, epoch: string): string {
  const key = `${viewerSecret}:${campaignId}:${epoch}`;
  let seed = 2166136261;
  for (let i = 0; i < key.length; i++) {
    seed ^= key.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  let t = seed;
  const rand = () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  let s = String(1 + Math.floor(rand() * 9)); // leading non zero digit
  for (let i = 0; i < 75; i++) s += String(Math.floor(rand() * 10));
  return s;
}

const usdc = (n: number) => n.toFixed(6);
const fmt = (n: number) => n.toFixed(6);
const raw = (n: number) => String(Math.round(n * 1e6)) + "000000000000"; // 18-dec-ish, no BigInt

export function createMockApi(ApiError: ApiErrorCtor) {
  // Plausible looking demo addresses. They only ever render truncated, nothing validates them.
  const addresses = {
    attestor: "0x9D2bE7a4C1f60358B9e2D5a8C0f3B6e1A4d7C2F0",
    agent: "0xAbF7c19E5d2A4b8C6e1F0a3D5b7C9e2F4a6D8b0C",
    creator: "0xCe14D7b9a2F6038c5E1b4A7d0C9f2E5b8A3d6C1F",
  };
  const VIEW_PRICE = 0.0008;

  // In memory state, seeded so the panels look alive on first load (a funded campaign, a creator who
  // has already accrued a little, a couple of past receipts).
  const state = {
    advertiserGateway: 5,
    creatorWallet: 0,
    creatorGatewayAvailable: 0.024, // ~30 prior views
    treasuryUsdc: 0.5,
    receipts: [] as Receipt[],
    spentNullifiers: new Set<string>(),
  };

  // Seed a few historical receipts.
  const seedEpoch = String(Math.floor(Date.now() / 3_600_000));
  for (let i = 3; i >= 1; i--) {
    state.receipts.push({
      viewId: randHex(32),
      campaignId: "1",
      creator: addresses.creator as `0x${string}`,
      amount: usdc(VIEW_PRICE),
      formattedAmount: VIEW_PRICE.toFixed(4),
      transaction: randHex(32),
      paidAt: new Date(Date.now() - i * 47_000).toISOString(),
    });
    state.spentNullifiers.add(nullifierFor(`seed-${i}`, "1", seedEpoch));
  }

  const config: BackendConfig = {
    chain: { id: 5042002, caip2: "eip155:5042002", rpcUrl: "https://rpc.testnet.arc.network" },
    usdc: "0x4D2C8a1bF6e90357C8b2A4d7E0f3C6b9A2e5D8c1",
    contracts: {
      RevenuePool: "0xF848889d955bb1a59325Db91Fc1d52152E17A946",
      ProofOfView: "0x1bE08B8DfB8e87F7b30315afE1d367780b0AF3Ec",
      RevenueSplitter: "0x707Ed9d732779a204E6C4C448B4E9930cB1ab8C5",
    },
    viewPrice: VIEW_PRICE.toFixed(4),
    addresses,
  };

  const balances = (): Balances => ({
    address: addresses.agent,
    wallet: { formatted: "0.000000", raw: "0" },
    gateway: {
      available: usdc(state.advertiserGateway),
      total: usdc(state.advertiserGateway),
      withdrawable: usdc(state.advertiserGateway),
    },
  });

  const creatorBalances = (): CreatorBalances => ({
    address: addresses.creator,
    wallet: { formatted: fmt(state.creatorWallet), raw: raw(state.creatorWallet) },
    gateway: {
      available: usdc(state.creatorGatewayAvailable),
      total: usdc(state.creatorGatewayAvailable),
      withdrawing: "0.000000",
      withdrawable: usdc(state.creatorGatewayAvailable),
    },
  });

  const treasury = (): Treasury => ({
    configured: true,
    address: "0xB3a9E7c2F1d40568A9b2C5e8D0f3A6b1E4c7D2a9",
    walletId: "demo-wallet-01",
    blockchain: "ARC-TESTNET",
    usdc: usdc(state.treasuryUsdc),
  });

  return {
    base: "demo",
    health: async () => {
      await delay(300);
      return { ok: true };
    },
    config: async () => {
      await delay(150);
      return config;
    },
    balances: async () => {
      await delay(120);
      return balances();
    },
    creatorBalances: async () => {
      await delay(120);
      return creatorBalances();
    },
    receipts: async () => {
      await delay(120);
      return { receipts: [...state.receipts] };
    },
    treasury: async () => {
      await delay(120);
      return treasury();
    },
    attest: async (input: {
      advertiser: string;
      creator: string;
      campaignId: number | string;
      weight: number | string;
      viewerSecret: string;
    }): Promise<AttestResponse> => {
      await delay(650);
      const epoch = String(Math.floor(Date.now() / 3_600_000));
      const campaignId = String(input.campaignId);
      const nullifier = nullifierFor(input.viewerSecret, campaignId, epoch);
      return {
        attestation: {
          viewId: randHex(32),
          advertiser: addresses.agent as `0x${string}`,
          creator: addresses.creator as `0x${string}`,
          commitment: randBigDecimal(),
          nullifier,
          campaignId,
          weight: String(input.weight),
          epoch,
          deadline: String(Math.floor(Date.now() / 1000) + 3600),
        },
        signature: randHex(65),
        attestor: addresses.attestor as `0x${string}`,
      };
    },
    payView: async (proof: {
      attestation: { nullifier: string; campaignId: string; creator: `0x${string}` };
      signature: string;
    }): Promise<PayViewResponse> => {
      await delay(900);
      const n = proof.attestation.nullifier;
      if (state.spentNullifiers.has(n)) {
        // Same shape the real ProofOfView gate returns on a replay.
        throw new ApiError("nullifier already consumed", 409, { nullifier: n });
      }
      state.spentNullifiers.add(n);
      state.creatorGatewayAvailable += VIEW_PRICE;
      const receipt: Receipt = {
        viewId: randHex(32),
        campaignId: proof.attestation.campaignId,
        creator: proof.attestation.creator,
        amount: usdc(VIEW_PRICE),
        formattedAmount: VIEW_PRICE.toFixed(4),
        transaction: randHex(32),
        paidAt: new Date().toISOString(),
      };
      state.receipts.unshift(receipt);
      return {
        paid: true,
        receipt,
        resource: {
          served: true,
          payment: {
            verified: true,
            payer: addresses.agent,
            amount: usdc(VIEW_PRICE),
            network: "arc-testnet",
            transaction: receipt.transaction,
          },
        },
      };
    },
    creatorWithdraw: async (amount?: string, recipient?: string): Promise<WithdrawResponse> => {
      await delay(1200);
      const moving = amount ? Number(amount) : state.creatorGatewayAvailable;
      state.creatorGatewayAvailable = Math.max(0, state.creatorGatewayAvailable - moving);
      state.creatorWallet += moving;
      return {
        withdrawn: true,
        amount: usdc(moving),
        mintTxHash: randHex(32),
        recipient: recipient ?? addresses.creator,
      };
    },
    sweepToTreasury: async (amount?: string): Promise<SweepResponse> => {
      await delay(1100);
      const moving = amount ? Number(amount) : state.creatorWallet;
      state.creatorWallet = Math.max(0, state.creatorWallet - moving);
      state.treasuryUsdc += moving;
      return { swept: true, amount: usdc(moving), to: treasury().configured ? (treasury() as { address: string }).address : "", txHash: randHex(32) };
    },
    treasuryPayout: async (body?: { amount?: string; destination?: string }): Promise<TreasuryPayoutResponse> => {
      await delay(1300);
      const moving = body?.amount ? Number(body.amount) : state.treasuryUsdc;
      state.treasuryUsdc = Math.max(0, state.treasuryUsdc - moving);
      return {
        paidOut: true,
        circleTxId: randHex(16).slice(2),
        state: "COMPLETE",
        txHash: randHex(32),
        amount: usdc(moving),
        destination: body?.destination ?? "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      };
    },
    bridge: async (body?: { amount?: string; recipient?: string }): Promise<BridgeResult> => {
      await delay(2600);
      const moving = body?.amount ? Number(body.amount) : state.treasuryUsdc;
      state.treasuryUsdc = Math.max(0, state.treasuryUsdc - moving);
      return {
        bridged: true,
        amount: usdc(moving),
        recipient: body?.recipient ?? "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
        destinationChain: "Ethereum Sepolia",
        sourceDomain: 13,
        approveTxId: randHex(16).slice(2),
        burnTxHash: randHex(32),
        messageHash: randHex(32),
        mintTxHash: randHex(32),
      };
    },
  };
}
