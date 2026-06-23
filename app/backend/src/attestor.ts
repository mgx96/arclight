// The off-chain metering attestor. It builds and EIP-712 signs ViewAttestation messages that the
// on-chain ProofOfView trusts. The viewer is referenced only by a hiding commitment, so no viewer
// identity ever leaves this service.
import { privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress, keccak256, toHex, type Hex } from "viem";
import { EIP712_DOMAIN, EIP712_TYPES } from "./config.js";

export type ViewAttestation = {
  viewId: Hex;
  advertiser: `0x${string}`;
  creator: `0x${string}`;
  commitment: bigint;
  nullifier: bigint;
  campaignId: bigint;
  weight: bigint;
  epoch: bigint;
  deadline: bigint;
};

// JSON-safe form (bigints as strings) for the HTTP API.
export type ViewAttestationJson = {
  viewId: Hex;
  advertiser: `0x${string}`;
  creator: `0x${string}`;
  commitment: string;
  nullifier: string;
  campaignId: string;
  weight: string;
  epoch: string;
  deadline: string;
};

export function toJson(a: ViewAttestation): ViewAttestationJson {
  return {
    viewId: a.viewId,
    advertiser: a.advertiser,
    creator: a.creator,
    commitment: a.commitment.toString(),
    nullifier: a.nullifier.toString(),
    campaignId: a.campaignId.toString(),
    weight: a.weight.toString(),
    epoch: a.epoch.toString(),
    deadline: a.deadline.toString(),
  };
}

export class Attestor {
  private readonly account: ReturnType<typeof privateKeyToAccount>;

  constructor(privateKey: Hex) {
    this.account = privateKeyToAccount(privateKey);
  }

  get address(): `0x${string}` {
    return this.account.address;
  }

  // Build a fresh attestation for a measured genuine view. The commitment hides the viewer; the
  // nullifier enforces one-pay-per-viewer-per-campaign when the privacy gate is enabled on-chain.
  build(params: {
    advertiser: `0x${string}`;
    creator: `0x${string}`;
    campaignId: bigint;
    weight: bigint;
    viewerSecret: string;
    ttlSeconds?: number;
  }): ViewAttestation {
    const epoch = BigInt(Math.floor(Date.now() / 1000 / 3600)); // hourly epoch
    const commitment = BigInt(keccak256(toHex(`${params.viewerSecret}:${params.campaignId}`)));
    const nullifier = BigInt(keccak256(toHex(`${params.viewerSecret}:${params.campaignId}:${epoch}`)));
    const viewId = keccak256(
      toHex(`${params.advertiser}:${params.creator}:${params.viewerSecret}:${Date.now()}:${Math.random()}`)
    );
    const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? 3600));
    return {
      viewId,
      advertiser: params.advertiser,
      creator: params.creator,
      commitment,
      nullifier,
      campaignId: params.campaignId,
      weight: params.weight,
      epoch,
      deadline,
    };
  }

  async sign(attestation: ViewAttestation): Promise<Hex> {
    return this.account.signTypedData({
      domain: EIP712_DOMAIN,
      types: EIP712_TYPES,
      primaryType: "ViewAttestation",
      message: attestation,
    });
  }

  // Verify a signature recovers to the expected attestor address — the same check the agent runs
  // before paying, mirroring what ProofOfView.consume does on-chain.
  static async verify(attestation: ViewAttestation, signature: Hex, expected: `0x${string}`): Promise<boolean> {
    const recovered = await recoverTypedDataAddress({
      domain: EIP712_DOMAIN,
      types: EIP712_TYPES,
      primaryType: "ViewAttestation",
      message: attestation,
      signature,
    });
    return recovered.toLowerCase() === expected.toLowerCase();
  }
}
