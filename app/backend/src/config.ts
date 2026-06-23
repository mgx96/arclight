// Shared Arc testnet config for the Arclight demo backend.
// Addresses are the real, source-verified deployments on Arc testnet (chainId 5042002).

export const ARC_TESTNET = {
  chainId: 5_042_002,
  rpcUrl: process.env.ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network",
  // The Circle x402 SDK identifies the chain by this name.
  x402ChainName: "arcTestnet" as const,
  // CAIP-2 network id the x402 facilitator advertises Arc testnet under.
  caip2: "eip155:5042002" as const,
};

// Circle Gateway testnet facilitator — verifies + settles the batched nanopayments.
// (The client auto-selects this for testnet chains; the seller middleware needs it explicitly.)
export const GATEWAY_TESTNET_FACILITATOR_URL = "https://gateway-api-testnet.circle.com";

// Deployed + verified Arclight contracts (see deployments/arc-testnet.json).
export const CONTRACTS = {
  RevenuePool: "0xF848889d955bb1a59325Db91Fc1d52152E17A946",
  ProofOfView: "0x1bE08B8DfB8e87F7b30315afE1d367780b0AF3Ec",
  RevenueSplitter: "0x707Ed9d732779a204E6C4C448B4E9930cB1ab8C5",
  ArcCctpGateway: "0x4A0Fb26B9e774d85aA0D4E3C3D077ebcc3E0572a",
  StableFxPayoutRouter: "0xEf70f1ABb1581845F9812511a774F65F0724dABc",
  CreatorTreasury: "0xF8D996fEa13184b440b36454418FF40556F1c88D",
  AdvertiserAgentRegistry: "0xa6A2B86f8ff81bA2237991F4Aa8Da3a3428E88F9",
} as const;

export const USDC = "0x3600000000000000000000000000000000000000";

// EIP-712 domain and types that the deployed ProofOfView verifies. These MUST match the contract:
// EIP712("ArclightProofOfView", "1") and the VIEW_ATTESTATION_TYPEHASH field order.
export const EIP712_DOMAIN = {
  name: "ArclightProofOfView",
  version: "1",
  chainId: ARC_TESTNET.chainId,
  verifyingContract: CONTRACTS.ProofOfView as `0x${string}`,
} as const;

export const EIP712_TYPES = {
  ViewAttestation: [
    { name: "viewId", type: "bytes32" },
    { name: "advertiser", type: "address" },
    { name: "creator", type: "address" },
    { name: "commitment", type: "uint256" },
    { name: "nullifier", type: "uint256" },
    { name: "campaignId", type: "uint256" },
    { name: "weight", type: "uint256" },
    { name: "epoch", type: "uint64" },
    { name: "deadline", type: "uint64" },
  ],
} as const;
