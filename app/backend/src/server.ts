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
import { rateLimit } from "express-rate-limit";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { createPublicClient, createWalletClient, http, defineChain, parseEther, formatEther, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ENV, HAS_CIRCLE_CREDS } from "./env.js";
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
import * as treasury from "./circle-treasury.js";
import { TreasuryDisabledError } from "./circle-treasury.js";
import { bridgeToSepolia, BRIDGE_META } from "./cctp-bridge.js";

// ---- Identities -----------------------------------------------------------------------------
const attestor = new Attestor(ENV.attestorPrivateKey);
const agent = new GatewayClient({
  chain: ARC_TESTNET.x402ChainName,
  privateKey: ENV.agentPrivateKey,
  rpcUrl: ARC_TESTNET.rpcUrl,
});
// The creator (x402 seller) as a Gateway client, so it can read its credited balance and
// withdraw it on-chain. Sub-cent views accrue to the creator's Gateway balance via batching;
// they only become a normal on-chain USDC balance after a same-chain withdraw (instant).
const creator = new GatewayClient({
  chain: ARC_TESTNET.x402ChainName,
  privateKey: ENV.creatorPrivateKey,
  rpcUrl: ARC_TESTNET.rpcUrl,
});

// Raw viem clients for the creator EOA, used to sweep its native-USDC earnings on-chain into the
// Circle-managed treasury wallet. On Arc, USDC IS the native currency (18-dec), so a "sweep" is a
// plain value transfer.
const arc = defineChain({
  id: ARC_TESTNET.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_TESTNET.rpcUrl] } },
});
const creatorAccount = privateKeyToAccount(ENV.creatorPrivateKey);
const arcPublic = createPublicClient({ chain: arc, transport: http(ARC_TESTNET.rpcUrl) });
const creatorWallet = createWalletClient({ account: creatorAccount, chain: arc, transport: http(ARC_TESTNET.rpcUrl) });
// Keep a little native USDC behind for gas when sweeping (Arc gas is paid in USDC).
const SWEEP_GAS_RESERVE = parseEther("0.02");

// Move the creator EOA's spare native USDC into the managed wallet (best-effort). This is the old
// "Deposit" hop, now folded into Bridge and Send so the managed wallet is topped up on demand — the
// user never runs it by hand. Returns the swept transfer, or null when the EOA is at/below the gas
// reserve (nothing to move; the funds are already in the managed wallet).
async function autoSweepToTreasury(): Promise<{ amount: string; to: `0x${string}`; txHash: `0x${string}` } | null> {
  const t = await treasury.provision();
  const bal = await arcPublic.getBalance({ address: creatorAccount.address });
  if (bal <= SWEEP_GAS_RESERVE) return null;
  const value = bal - SWEEP_GAS_RESERVE;
  const txHash = await creatorWallet.sendTransaction({ to: t.address as `0x${string}`, value });
  await arcPublic.waitForTransactionReceipt({ hash: txHash });
  return { amount: formatEther(value), to: t.address as `0x${string}`, txHash };
}

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

// Behind a hosting proxy (Render/Railway/etc.) the client IP is in X-Forwarded-For; trust one hop so
// the rate limiter keys on the real caller rather than the proxy. Safe for a single reverse proxy.
app.set("trust proxy", 1);

// CORS: when ALLOWED_ORIGINS is set, only those browser origins may call the API; otherwise allow all
// (local-dev convenience). Requests with no Origin header (curl, server-to-server, health checks) are
// always allowed since they aren't subject to the browser same-origin policy.
const allowlist = ENV.allowedOrigins;
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowlist.length === 0 || allowlist.includes(origin)) return cb(null, true);
      cb(new Error(`origin not allowed: ${origin}`));
    },
  })
);
app.use(express.json());

// Rate limiting (per client IP, fixed window). A generous global limit protects read endpoints; a
// tighter limit guards the money-moving writes so a single visitor cannot drain the shared testnet
// wallets or exhaust the Circle API quota.
const readLimiter = rateLimit({
  windowMs: ENV.rateWindowMs,
  max: ENV.rateMaxRead,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate limit exceeded — slow down" },
});
const writeLimiter = rateLimit({
  windowMs: ENV.rateWindowMs,
  max: ENV.rateMaxWrite,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate limit exceeded — too many actions, try again shortly" },
});
app.use(readLimiter); // baseline for every request
// writeLimiter is attached per-route below, only to the external money-moving POST endpoints. It is
// deliberately NOT applied to GET /creator/view: that endpoint is called server-to-server by the
// agent during payment (from this same host), so an IP-based cap there would throttle the demo's own
// settlement flow. Gating /attest and /agent/pay-view already bounds how often views can be paid.

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

// Creator's view of its own money: USDC already settled in its wallet, plus what is still
// credited inside Circle Gateway (earned via batched nanopayments, awaiting withdrawal).
app.get("/creator/balances", async (_req, res) => {
  try {
    const b = await creator.getBalances();
    res.json({
      address: creator.address,
      wallet: { formatted: b.wallet.formatted, raw: b.wallet.balance.toString() },
      gateway: {
        available: b.gateway.formattedAvailable,
        total: b.gateway.formattedTotal,
        withdrawing: b.gateway.formattedWithdrawing,
        withdrawable: b.gateway.formattedWithdrawable,
      },
    });
  } catch (err) {
    res.status(502).json({ error: "failed to read creator balances", detail: String(err) });
  }
});

// Settle the creator's Gateway-credited earnings to its on-chain wallet. Same-chain withdraw is
// instant (no 7-day delay). Defaults to the full available balance.
app.post("/creator/withdraw", writeLimiter, async (req, res) => {
  try {
    const balances = await creator.getBalances();
    const available = Number(balances.gateway.formattedAvailable);
    if (!(available > 0)) {
      return res.status(400).json({ error: "nothing to withdraw — creator Gateway balance is 0" });
    }
    const explicit = req.body?.amount !== undefined;
    const requested = explicit ? Number(req.body.amount) : available;

    // Settle straight to the caller's connected wallet when supplied — Gateway's same-chain
    // withdraw honors an arbitrary recipient, so this is one instant hop (one fee). With no
    // recipient it falls back to the creator EOA (today's behavior).
    let recipient: `0x${string}` | undefined;
    if (req.body?.recipient !== undefined) {
      if (typeof req.body.recipient !== "string" || !isAddress(req.body.recipient)) {
        return res.status(400).json({ error: `invalid recipient address: ${req.body.recipient}` });
      }
      recipient = req.body.recipient as `0x${string}`;
    }

    const doWithdraw = (amt: number) =>
      creator.withdraw(amt.toFixed(6), recipient ? { recipient } : undefined); // same chain → instant mint

    let result;
    try {
      result = await doWithdraw(requested);
    } catch (err) {
      // Same-chain instant withdrawal takes a small fee on top of the amount, so asking for the full
      // available balance (e.g. the "ALL" button) overshoots by the fee. Net out the fee the Gateway
      // API reported and retry once — this applies whether or not the caller pinned an amount, since
      // even an explicit "withdraw everything" can't cover its own fee.
      const m = String(err).match(/available ([\d.]+), required ([\d.]+)/);
      if (m) {
        const fee = Number(m[2]) - requested;
        const net = Math.floor((available - fee - 0.000001) * 1e6) / 1e6;
        if (!(net > 0)) throw err;
        result = await doWithdraw(net);
      } else {
        throw err;
      }
    }

    res.json({
      withdrawn: true,
      amount: result.formattedAmount,
      mintTxHash: result.mintTxHash,
      recipient: result.recipient,
    });
  } catch (err) {
    res.status(502).json({ error: "withdraw failed", detail: String(err) });
  }
});

app.get("/receipts", (_req, res) => res.json({ receipts }));

// ---- Creator's Circle Programmable Wallet (Developer-Controlled) treasury -------------------
// This is the part of Arclight that uses the Circle Console API key. The treasury is an MPC wallet
// Circle provisions and signs for on Arc — distinct from the raw-key EOAs above. Earnings are swept
// in on-chain, then paid out via Circle's Console-signed createTransaction.

// Address + USDC balance, read through Circle's API. `configured:false` keeps the UI graceful when
// the Console credentials aren't set, instead of erroring.
app.get("/creator/treasury", async (_req, res) => {
  if (!HAS_CIRCLE_CREDS) return res.json({ configured: false });
  try {
    const info = await treasury.provision();
    const bal = await treasury.getBalance();
    res.json({
      configured: true,
      address: info.address,
      walletId: info.walletId,
      blockchain: info.blockchain,
      usdc: bal.usdc,
    });
  } catch (err) {
    if (err instanceof TreasuryDisabledError) return res.json({ configured: false });
    res.status(502).json({ error: "failed to read Circle treasury", detail: String(err) });
  }
});

// Sweep the creator EOA's native-USDC earnings into the Circle treasury wallet (on-chain transfer).
// Defaults to the full balance minus a small gas reserve.
app.post("/creator/sweep-to-treasury", writeLimiter, async (req, res) => {
  if (!HAS_CIRCLE_CREDS) return res.status(503).json({ error: "Circle treasury not configured" });
  try {
    const t = await treasury.provision();
    const bal = await arcPublic.getBalance({ address: creatorAccount.address });
    const explicit = req.body?.amount !== undefined;
    const value = explicit
      ? parseEther(String(req.body.amount))
      : bal > SWEEP_GAS_RESERVE
        ? bal - SWEEP_GAS_RESERVE
        : 0n;
    if (!(value > 0n)) {
      return res.status(400).json({ error: "nothing to sweep — creator wallet balance is below the gas reserve" });
    }
    if (bal < value) {
      return res.status(400).json({ error: `creator balance ${formatEther(bal)} < requested ${formatEther(value)}` });
    }
    const txHash = await creatorWallet.sendTransaction({ to: t.address, value });
    await arcPublic.waitForTransactionReceipt({ hash: txHash });
    res.json({ swept: true, amount: formatEther(value), to: t.address, txHash });
  } catch (err) {
    res.status(502).json({ error: "sweep failed", detail: String(err) });
  }
});

// Pay USDC out of the Circle treasury via Circle's Console-signed createTransaction. Defaults to
// sending the full treasury balance back to the creator's operating EOA.
app.post("/creator/treasury/payout", writeLimiter, async (req, res) => {
  if (!HAS_CIRCLE_CREDS) return res.status(503).json({ error: "Circle treasury not configured" });
  try {
    const destination = (typeof req.body?.destination === "string" ? req.body.destination : ENV.creatorAddress) as `0x${string}`;
    // Top the managed wallet up from the creator EOA first (the old Deposit step, folded in).
    const swept = await autoSweepToTreasury();
    const bal = await treasury.getBalance();
    const explicit = req.body?.amount !== undefined;
    const amount = explicit ? String(req.body.amount) : bal.usdc;
    if (!(Number(amount) > 0)) {
      return res.status(400).json({ error: "nothing to pay out — treasury USDC balance is 0" });
    }
    const { id } = await treasury.payout({ destinationAddress: destination, amount });
    const settled = await treasury.waitForTransaction(id);
    res.json({ paidOut: true, swept, circleTxId: id, state: settled.state, txHash: settled.txHash, amount, destination });
  } catch (err) {
    if (err instanceof TreasuryDisabledError) return res.status(503).json({ error: "Circle treasury not configured" });
    res.status(502).json({ error: "treasury payout failed", detail: String(err) });
  }
});

// Bridge USDC out of the Circle-managed wallet to Ethereum Sepolia via CCTP, driven by Circle's
// Programmable Wallets API. Full round-trip: burn on Arc, Circle attestation, mint on Sepolia.
// Leave a little USDC behind in the managed wallet to cover Arc gas (gas is paid in USDC on Arc).
const BRIDGE_GAS_RESERVE = 0.02;
app.post("/creator/bridge", writeLimiter, async (req, res) => {
  if (!HAS_CIRCLE_CREDS) return res.status(503).json({ error: "Circle treasury not configured" });
  try {
    // Top the managed wallet up from the creator EOA first (the old Deposit step, folded in).
    const swept = await autoSweepToTreasury();
    const bal = Number((await treasury.getBalance()).usdc);
    const spendable = Math.floor((bal - BRIDGE_GAS_RESERVE) * 1e6) / 1e6;
    const requested = req.body?.amount !== undefined ? Number(req.body.amount) : Math.min(0.1, spendable);
    if (!(requested > 0)) {
      return res.status(400).json({
        error: `nothing to bridge — managed wallet holds ${bal} USDC (need > ${BRIDGE_GAS_RESERVE} for gas)`,
      });
    }
    if (requested > spendable) {
      return res.status(400).json({
        error: `requested ${requested} exceeds spendable ${spendable} USDC (keeping ${BRIDGE_GAS_RESERVE} for gas)`,
      });
    }
    let recipient: `0x${string}` | undefined;
    if (req.body?.recipient !== undefined) {
      if (typeof req.body.recipient !== "string" || !isAddress(req.body.recipient)) {
        return res.status(400).json({ error: `invalid recipient address: ${req.body.recipient}` });
      }
      recipient = req.body.recipient as `0x${string}`;
    }
    const result = await bridgeToSepolia(requested.toFixed(6), recipient);
    res.json({ bridged: true, swept, ...result });
  } catch (err) {
    if (err instanceof TreasuryDisabledError) return res.status(503).json({ error: "Circle treasury not configured" });
    res.status(502).json({ error: "bridge failed", detail: String(err) });
  }
});

// Static metadata so the frontend can label the bridge destination without guessing.
app.get("/creator/bridge/meta", (_req, res) => {
  res.json({ configured: HAS_CIRCLE_CREDS, ...BRIDGE_META });
});

// ---- Attestor: mint a signed proof for a (claimed) genuine view -----------------------------
app.post("/attest", writeLimiter, async (req, res) => {
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
app.post("/agent/pay-view", writeLimiter, async (req, res) => {
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

// Final error handler. Keeps rejected-CORS and other thrown errors from leaking a stack trace to
// the client; returns a clean JSON status instead. Must be last, with the 4-arg signature Express
// recognizes as an error handler.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.message?.startsWith("origin not allowed")) {
    return res.status(403).json({ error: "origin not allowed" });
  }
  console.error("unhandled error:", err);
  res.status(500).json({ error: "internal error" });
});

app.listen(ENV.port, () => {
  console.log(`Arclight backend on http://localhost:${ENV.port}`);
  console.log(`  attestor ${attestor.address}`);
  console.log(`  agent    ${agent.address} (Gateway buyer)`);
  console.log(`  creator  ${ENV.creatorAddress} (x402 seller)`);
  console.log(`  price    ${ENV.viewPrice} per view on ${ARC_TESTNET.caip2}`);
});
