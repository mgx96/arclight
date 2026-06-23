// Arclight demo backend.
//
// Three on-chain identities, one HTTP service that ties Arclight's proof-of-view to a REAL
// Circle Gateway nanopayment:
//
//   - ATTESTOR  signs EIP-712 ViewAttestation messages for genuine, metered views.
//   - AGENT     (advertiser) holds USDC in its Circle Gateway balance and pays per view.
//   - CREATOR   is the x402 seller that receives the gasless sub-cent USDC payment.
//
// The proof-of-view gate is enforced off-chain here (Plan B, Option A): the agent only releases a
// nanopayment after a fresh attestation verifies to the trusted attestor and its nullifier has not
// already been paid. This mirrors what ProofOfView.consume() enforces on-chain for the splitter path.
import express from "express";
import cors from "cors";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { ENV } from "./env.js";
import {
  ARC_TESTNET,
  CONTRACTS,
  USDC,
  GATEWAY_TESTNET_FACILITATOR_URL,
} from "./config.js";
import {
  Attestor,
  toJson,
  type ViewAttestation,
  type ViewAttestationJson,
} from "./attestor.js";

// ---- Identities -----------------------------------------------------------------------------
const attestor = new Attestor(ENV.attestorPrivateKey);
const agent = new GatewayClient({
  chain: ARC_TESTNET.x402ChainName,
  privateKey: ENV.agentPrivateKey,
  rpcUrl: ARC_TESTNET.rpcUrl,
});

// ---- Anti-double-pay ledger (in-memory; the demo's stand-in for the on-chain nullifier set) ---
const consumedNullifiers = new Set<string>();
type Receipt = {
  viewId: `0x${string}`;
  campaignId: string;
  creator: `0x${string}`;
  amount: string;
  formattedAmount: string;
  transaction: string;
  paidAt: string;
};
const receipts: Receipt[] = [];

// ---- Creator x402 seller endpoint -----------------------------------------------------------
// Payment is required and settled by Circle Gateway before the handler runs. We restrict to Arc
// testnet so the demo always settles on the chain the contracts live on.
const gateway = createGatewayMiddleware({
  sellerAddress: ENV.creatorAddress,
  networks: [ARC_TESTNET.caip2],
  facilitatorUrl: GATEWAY_TESTNET_FACILITATOR_URL,
  description: "Arclight metered video view",
});

const app = express();
app.use(cors());
app.use(express.json());

// The paid resource. Reaching the handler body means Circle settled the nanopayment to the creator.
app.get("/creator/view", gateway.require(ENV.viewPrice), (req, res) => {
  const payment = (req as express.Request & { payment?: Record<string, unknown> }).payment;
  res.json({
    served: true,
    creator: ENV.creatorAddress,
    viewId: typeof req.query.viewId === "string" ? req.query.viewId : null,
    payment: payment ?? null,
    servedAt: new Date().toISOString(),
  });
});

// ---- Read endpoints (frontend wiring) -------------------------------------------------------
app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/config", (_req, res) => {
  res.json({
    chain: { id: ARC_TESTNET.chainId, caip2: ARC_TESTNET.caip2, rpcUrl: ARC_TESTNET.rpcUrl },
    usdc: USDC,
    contracts: CONTRACTS,
    viewPrice: ENV.viewPrice,
    addresses: {
      attestor: attestor.address,
      agent: agent.address,
      creator: ENV.creatorAddress,
    },
  });
});

app.get("/balances", async (_req, res) => {
  try {
    const balances = await agent.getBalances();
    res.json({
      address: agent.address,
      wallet: { formatted: balances.wallet.formatted, raw: balances.wallet.balance.toString() },
      gateway: {
        available: balances.gateway.formattedAvailable,
        total: balances.gateway.formattedTotal,
        withdrawable: balances.gateway.formattedWithdrawable,
      },
    });
  } catch (err) {
    res.status(502).json({ error: "failed to read balances", detail: String(err) });
  }
});

app.get("/receipts", (_req, res) => res.json({ receipts }));

// ---- Attestor: mint a signed proof for a (claimed) genuine view -----------------------------
app.post("/attest", async (req, res) => {
  try {
    const { advertiser, creator, campaignId, weight, viewerSecret, ttlSeconds } = req.body ?? {};
    if (!advertiser || !creator || campaignId === undefined || weight === undefined || !viewerSecret) {
      return res.status(400).json({
        error: "advertiser, creator, campaignId, weight, viewerSecret are required",
      });
    }
    const attestation = attestor.build({
      advertiser,
      creator,
      campaignId: BigInt(campaignId),
      weight: BigInt(weight),
      viewerSecret: String(viewerSecret),
      ttlSeconds: ttlSeconds === undefined ? undefined : Number(ttlSeconds),
    });
    const signature = await attestor.sign(attestation);
    res.json({ attestation: toJson(attestation), signature, attestor: attestor.address });
  } catch (err) {
    res.status(500).json({ error: "failed to build attestation", detail: String(err) });
  }
});

// ---- Agent: verify proof, then pay the creator via a real nanopayment ------------------------
app.post("/agent/pay-view", async (req, res) => {
  const { attestation: aJson, signature } = (req.body ?? {}) as {
    attestation?: ViewAttestationJson;
    signature?: `0x${string}`;
  };
  if (!aJson || !signature) {
    return res.status(400).json({ error: "attestation and signature are required" });
  }

  // Rehydrate bigints for EIP-712 recovery.
  const attestation: ViewAttestation = {
    viewId: aJson.viewId,
    advertiser: aJson.advertiser,
    creator: aJson.creator,
    commitment: BigInt(aJson.commitment),
    nullifier: BigInt(aJson.nullifier),
    campaignId: BigInt(aJson.campaignId),
    weight: BigInt(aJson.weight),
    epoch: BigInt(aJson.epoch),
    deadline: BigInt(aJson.deadline),
  };

  // 1. Proof must verify to the trusted attestor.
  const valid = await Attestor.verify(attestation, signature, attestor.address);
  if (!valid) return res.status(401).json({ error: "attestation signature does not match attestor" });

  // 2. Proof must not be expired.
  if (attestation.deadline < BigInt(Math.floor(Date.now() / 1000))) {
    return res.status(410).json({ error: "attestation expired" });
  }

  // 3. One pay per nullifier (one viewer, one campaign, one epoch).
  const nk = attestation.nullifier.toString();
  if (consumedNullifiers.has(nk)) {
    return res.status(409).json({ error: "view already paid (nullifier consumed)" });
  }
  consumedNullifiers.add(nk); // reserve before paying so concurrent calls cannot double-spend

  // 4. Pay the creator's x402 endpoint. Gateway settles the gasless sub-cent USDC transfer.
  try {
    const url = `${ENV.selfUrl}/creator/view?viewId=${attestation.viewId}`;
    const result = await agent.pay<{ served: boolean }>(url);
    const receipt: Receipt = {
      viewId: attestation.viewId,
      campaignId: attestation.campaignId.toString(),
      creator: attestation.creator,
      amount: result.amount.toString(),
      formattedAmount: result.formattedAmount,
      transaction: result.transaction,
      paidAt: new Date().toISOString(),
    };
    receipts.push(receipt);
    res.json({ paid: true, receipt, resource: result.data });
  } catch (err) {
    consumedNullifiers.delete(nk); // payment failed — release the nullifier so it can be retried
    res.status(502).json({ error: "nanopayment failed", detail: String(err) });
  }
});

app.listen(ENV.port, () => {
  console.log(`Arclight backend on http://localhost:${ENV.port}`);
  console.log(`  attestor ${attestor.address}`);
  console.log(`  agent    ${agent.address} (Gateway buyer)`);
  console.log(`  creator  ${ENV.creatorAddress} (x402 seller)`);
  console.log(`  price    ${ENV.viewPrice} per view on ${ARC_TESTNET.caip2}`);
});
