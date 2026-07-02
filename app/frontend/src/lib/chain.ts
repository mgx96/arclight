// Arc testnet chain definition + a read-only viem client, so the UI can independently verify
// on-chain truth (e.g. who the trusted ProofOfView attestor is) without trusting the backend.
import { createPublicClient, defineChain, http, type Abi } from "viem";

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  // On Arc, USDC is the native gas token and is 18-decimal at the EVM level (eth_getBalance returns
  // 18-dec base units), even though the ERC-20 USDC interface is 6-dec. wagmi's useBalance formats the
  // native balance with these decimals, so this must be 18 for a connected wallet's balance to read right.
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

// Read the Arc RPC through the same-origin proxy (/api/rpc, see next.config.ts) by default so
// browser ad/privacy blockers can't block the on-chain attestor read. Local dev or an alternate
// keyed RPC can override with NEXT_PUBLIC_RPC_URL.
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "/api/rpc";

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(RPC_URL),
});

// Deployed + verified Arclight contracts on Arc testnet.
export const CONTRACTS = {
  RevenuePool: "0xF848889d955bb1a59325Db91Fc1d52152E17A946",
  ProofOfView: "0x1bE08B8DfB8e87F7b30315afE1d367780b0AF3Ec",
  RevenueSplitter: "0x707Ed9d732779a204E6C4C448B4E9930cB1ab8C5",
  ArcCctpGateway: "0x4A0Fb26B9e774d85aA0D4E3C3D077ebcc3E0572a",
  StableFxPayoutRouter: "0xEf70f1ABb1581845F9812511a774F65F0724dABc",
  CreatorTreasury: "0xF8D996fEa13184b440b36454418FF40556F1c88D",
  AdvertiserAgentRegistry: "0xa6A2B86f8ff81bA2237991F4Aa8Da3a3428E88F9",
} as const;

// Minimal ABI: just the getter the Proof panel uses to confirm the signer is the on-chain oracle.
export const PROOF_OF_VIEW_ABI = [
  {
    type: "function",
    name: "getAttestor",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const satisfies Abi;

export function explorerAddress(addr: string): string {
  return `${arcTestnet.blockExplorers.default.url}/address/${addr}`;
}

// Block-explorer transaction links, so any settled transfer can be opened and inspected.
export function explorerTx(hash: string): string {
  return `${arcTestnet.blockExplorers.default.url}/tx/${hash}`;
}

export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

export function sepoliaTx(hash: string): string {
  return `${SEPOLIA_EXPLORER}/tx/${hash}`;
}
