// Typed client for the Arclight backend (attestor + Circle Gateway nanopayment agent).
const BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "http://localhost:8787";

export type BackendConfig = {
  chain: { id: number; caip2: string; rpcUrl: string };
  usdc: string;
  contracts: Record<string, string>;
  viewPrice: string;
  addresses: { attestor: string; agent: string; creator: string };
};

export type Balances = {
  address: string;
  wallet: { formatted: string; raw: string };
  gateway: { available: string; total: string; withdrawable: string };
};

export type CreatorBalances = {
  address: string;
  wallet: { formatted: string; raw: string };
  gateway: { available: string; total: string; withdrawing: string; withdrawable: string };
};

export type WithdrawResponse = {
  withdrawn: boolean;
  amount: string;
  mintTxHash: string;
  recipient: string;
};

// Creator's Circle Programmable Wallet (Developer-Controlled) treasury. `configured:false` when the
// backend has no Circle Console credentials, so the UI can show a dormant state instead of erroring.
export type Treasury =
  | { configured: false }
  | { configured: true; address: string; walletId: string; blockchain: string; usdc: string };

export type SweepResponse = { swept: boolean; amount: string; to: string; txHash: string };

export type TreasuryPayoutResponse = {
  paidOut: boolean;
  circleTxId: string;
  state: string;
  txHash: string | null;
  amount: string;
  destination: string;
};

// Full CCTP round-trip result: USDC bridged from the managed Circle wallet on Arc to Ethereum Sepolia.
export type BridgeResult = {
  bridged: boolean;
  amount: string;
  recipient: string;
  destinationChain: string;
  sourceDomain: number;
  approveTxId: string;
  burnTxHash: string;
  messageHash: string;
  mintTxHash: string;
};

export type AttestationJson = {
  viewId: `0x${string}`;
  advertiser: `0x${string}`;
  creator: `0x${string}`;
  commitment: string;
  nullifier: string;
  campaignId: string;
  weight: string;
  epoch: string;
  deadline: string;
};

export type AttestResponse = {
  attestation: AttestationJson;
  signature: `0x${string}`;
  attestor: `0x${string}`;
};

export type Receipt = {
  viewId: `0x${string}`;
  campaignId: string;
  creator: `0x${string}`;
  amount: string;
  formattedAmount: string;
  transaction: string;
  paidAt: string;
};

export type PayViewResponse = {
  paid: boolean;
  receipt: Receipt;
  resource: {
    served: boolean;
    payment: { verified: boolean; payer: string; amount: string; network: string; transaction: string };
  };
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body?.error ?? `${path} failed (${res.status})`, res.status, body);
  }
  return body as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = {
  base: BASE,
  health: () => req<{ ok: boolean }>("/health"),
  config: () => req<BackendConfig>("/config"),
  balances: () => req<Balances>("/balances"),
  creatorBalances: () => req<CreatorBalances>("/creator/balances"),
  creatorWithdraw: (amount?: string, recipient?: string) =>
    req<WithdrawResponse>("/creator/withdraw", {
      method: "POST",
      body: JSON.stringify({ ...(amount ? { amount } : {}), ...(recipient ? { recipient } : {}) }),
    }),
  receipts: () => req<{ receipts: Receipt[] }>("/receipts"),
  treasury: () => req<Treasury>("/creator/treasury"),
  sweepToTreasury: (amount?: string) =>
    req<SweepResponse>("/creator/sweep-to-treasury", {
      method: "POST",
      body: JSON.stringify(amount ? { amount } : {}),
    }),
  treasuryPayout: (body?: { amount?: string; destination?: string }) =>
    req<TreasuryPayoutResponse>("/creator/treasury/payout", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  bridge: (body?: { amount?: string; recipient?: string }) =>
    req<BridgeResult>("/creator/bridge", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  attest: (input: {
    advertiser: string;
    creator: string;
    campaignId: number | string;
    weight: number | string;
    viewerSecret: string;
  }) => req<AttestResponse>("/attest", { method: "POST", body: JSON.stringify(input) }),
  payView: (proof: { attestation: AttestationJson; signature: string }) =>
    req<PayViewResponse>("/agent/pay-view", { method: "POST", body: JSON.stringify(proof) }),
};
