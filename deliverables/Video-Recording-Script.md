# Arclight — Technical Demo Video Script

**Target length:** 4:50 (hard cap 5:00) · **Narration:** word-for-word voiceover · **Live demo:** Gateway per-view loop runs live; CCTP bridge is a pre-recorded/sped-up clip.

This script satisfies the two required sections: **Codebase Walkthrough** (0:25–2:25) and **Integration Demonstration** (2:25–4:25), wrapped by a 25s open and 25s close.

> Read the **quoted** lines aloud. The **bold** lines are screen actions — what to have on screen / click while you read. File paths and line ranges are exact so you can pre-open the tabs.

---

## Before you hit record (setup checklist)

1. **Run the LIVE backend, not the showcase mock.** The GitHub Pages build (`NEXT_PUBLIC_SHOWCASE=1`) simulates everything in memory — do **not** record that; it won't move real USDC. Record the local backend on `:8787`.
   ```bash
   # terminal A — backend
   cd app/backend
   pnpm install
   pnpm keygen          # throwaway testnet keys -> gitignored .env.local
   pnpm deposit 5       # funds the agent's Gateway balance with test USDC
   pnpm dev             # attestor + agent + creator seller on :8787
   ```
   ```bash
   # terminal B — frontend
   cd app/frontend
   pnpm install
   pnpm dev             # dashboard on :3000, talks to the live :8787 backend
   ```
2. For the treasury + bridge code to be *runnable* you need `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET` in `.env.local` and a little Sepolia ETH for the mint relay. **Pre-record** that bridge run separately (it can take several minutes for CCTP attestation) and trim/speed it to ~20s.
3. **Pre-open these editor tabs in order** so the walkthrough is just tab-switching:
   - `app/backend/src/config.ts`
   - `app/backend/src/server.ts`
   - `app/backend/src/circle-treasury.ts`
   - `app/backend/src/cctp-bridge.ts`
   - `src/cctp/ArcCctpGateway.sol`
   - `src/stablefx/StableFxPayoutRouter.sol` and `src/treasury/CreatorTreasury.sol`
4. Have an **Arcscan tab** open at `https://testnet.arcscan.app` (you'll show a verified contract).
5. Zoom your editor font to ~16–18pt so code is readable at 1080p.

---

## 0:00 – 0:25 — Cold open (25s)

**On screen:** Arclight dashboard home (or deck title slide) for 3s, then the dashboard with the video player visible.

> "This is Arclight — stablecoin-native, per-view payments for open video, built end-to-end on Circle's Arc. Every genuine view pays the creator a sub-cent USDC nanopayment, settled by Circle Gateway, with no platform middleman taking a cut. Under the hood we use USDC as the native token, Circle Gateway and x402 for the per-view payments, Circle Programmable Wallets for the creator's treasury, and CCTP to cash out cross-chain. Let me show you the code, then run it live."

---

## 0:25 – 2:25 — Codebase Walkthrough (REQUIRED · 2:00)

### 0:25 – 0:45 — USDC + deployed addresses (20s)
**On screen:** `app/backend/src/config.ts`, scroll to lines 18–28.

> "Everything points at real, source-verified deployments on Arc testnet. Here are our seven contracts and the USDC address. On Arc, USDC isn't a side token — it's the native gas currency, so micropayouts and the gas to move them are the same asset. We never mock these addresses; the backend talks to the live chain."

### 0:45 – 1:20 — Circle Gateway + x402 (the per-view rail) (35s)
**On screen:** `app/backend/src/server.ts`. Show lines 38–50 (the two `GatewayClient`s), then 97–119 (`createGatewayMiddleware` + the `/creator/view` seller endpoint), then scroll to `/agent/pay-view` at 374–432.

> "The core money rail is Circle Gateway with x402 batching. The advertiser's agent is a Gateway buyer holding USDC; the creator is the x402 seller. This middleware marks the creator's view endpoint as paid — Circle's facilitator settles the USDC transfer before our handler ever runs, gasless to the creator and batched so it works at sub-cent amounts.
> When a view happens, `pay-view` does four checks then pays: it verifies the metering proof, checks it hasn't expired, burns a one-time nullifier so the same view can't be paid twice, and then calls `agent.pay` on the creator's endpoint. That single call is Circle Gateway moving real USDC from advertiser to creator."

### 1:20 – 1:48 — Circle Programmable Wallets (treasury) (28s)
**On screen:** `app/backend/src/circle-treasury.ts`. Show the client init (lines 59–68), `createWallets` on `ARC-TESTNET` (71–97), and `executeContract` → `createContractExecutionTransaction` (the function near lines 154–173).

> "Once a creator has earned, the money lands in a Circle Programmable Wallet — a Developer-Controlled MPC wallet. We initialize the SDK with our Circle API key and entity secret, and provision an EOA wallet on Arc. There's no private key anywhere in our code — Circle holds the keys and signs. This `createContractExecutionTransaction` call is the important one: it lets the managed wallet drive arbitrary on-chain calls — an ERC-20 approve, or the CCTP burn we're about to see — all Console-signed by Circle."

### 1:48 – 2:12 — CCTP V2 cross-chain cash-out (24s)
**On screen:** `app/backend/src/cctp-bridge.ts` — show `bridgeToSepolia` (131–192): the approve (142–146), `bridgeOut` (154–158), the Iris attestation poll (105–126), and `receiveMessage` mint (173–178). Then flip to `src/cctp/ArcCctpGateway.sol` lines 93–103.

> "To cash out, we use CCTP V2. The managed wallet approves our gateway and calls `bridgeOut`, which burns the USDC on Arc. We pull the CCTP message from the burn receipt, poll Circle's attestation service until it's signed, then relay it on Ethereum Sepolia where native USDC is minted — a real burn-and-mint, no wrapped tokens. On-chain, our `ArcCctpGateway` calls Circle's TokenMessenger `depositForBurn` directly."

### 2:12 – 2:25 — StableFX + USYC (on-chain, deployed) (13s)
**On screen:** `src/stablefx/StableFxPayoutRouter.sol` (`convertAndPay`, line 61), then `src/treasury/CreatorTreasury.sol` (`deposit`/`withdraw`, lines 59/87).

> "Two more Circle-native pieces are deployed and verified on Arc: a StableFX router that converts a creator's USDC into EURC through Arc's built-in FX engine, and a USYC treasury that earns yield on idle balances. Wiring these into the automatic payout loop is our next step."

---

## 2:25 – 4:25 — Integration Demonstration (REQUIRED · 2:00)

### 2:25 – 2:45 — Backend boot (20s)
**On screen:** terminal running `pnpm dev`, showing the printed attestor / agent / creator addresses.

> "Here's the live backend. On boot it prints the attestor that signs view proofs, the advertiser agent that pays over Gateway, and the creator seller that receives. The agent's Gateway balance is already funded with test USDC. Now to the dashboard."

### 2:45 – 3:25 — A real per-view nanopayment (40s)
**On screen:** Viewer panel — press play on the video. Watch the event log: proof signed → `/agent/pay-view` → Gateway settles → receipt appears. Zoom the receipt showing the sub-cent USDC amount + transaction.

> "I'll play the video. The moment a genuine view is metered, the attestor signs an EIP-712 proof, the agent submits it, and Circle Gateway settles the payment to the creator. Watch the log — proof, payment, and here's the live receipt: a sub-cent USDC nanopayment to the creator, settled on Arc. That's the whole product in one motion — a view becomes money, instantly, in stablecoins."

### 3:25 – 3:45 — Anti-fraud: replay is blocked (20s)
**On screen:** Re-submit the same proof (replay button / replay the same view). Show the `409 — nullifier consumed` error in the log.

> "Genuine engagement only. If I replay that exact same view proof, the nullifier is already spent, and the payment is rejected. One viewer, one campaign, one payment — that's the sybil-resistance that ad fraud usually defeats."

### 3:45 – 4:25 — Treasury + CCTP cash-out (40s)
**On screen:** Creator panel — show the Gateway-credited balance, click **Withdraw** to settle it on-chain (live). Then cut to your **pre-recorded** bridge clip: Bridge to Sepolia → Circle transaction IDs → Arcscan burn → Sepolia mint tx. End on the Arcscan verified-contract page.

> "On the creator side, earnings credited inside Gateway withdraw to an on-chain USDC balance with one click. From there the Programmable Wallet bridges USDC to Ethereum via CCTP — here's a burn on Arc, Circle's attestation, and the matching mint on Sepolia, all driven by the managed wallet. And every contract you've seen is deployed and verified on Arcscan."

---

## 4:25 – 4:50 — Close (25s)

**On screen:** deck slide (architecture or the "what's live" summary), or the Arcscan deployments page.

> "To sum up what's live today: USDC, Circle Gateway and x402, and Programmable Wallets power the full earn-and-cash-out loop right now, with CCTP bridging cross-chain. StableFX and USYC are deployed on-chain and next to be wired into automatic payouts, and Arc's configurable privacy is on our roadmap for shielding payout amounts. Arclight makes every view payable in stablecoins — the deck has the market and the ask. Thanks for watching."

---

## Supporting material to attach with the video

- `deliverables/Arclight-Investor-Deck.pptx` — investor deck
- `deployments/arc-testnet.json` — live addresses + Circle dependency addresses
- Arcscan links for the 7 verified contracts (testnet.arcscan.app)
- Optional: a one-page architecture diagram (advertiser agent → attestor → Gateway → creator → Programmable Wallet → CCTP/StableFX/USYC)

## Upload
- Export at 1080p. Upload to **YouTube unlisted** or **Google Drive (link-sharing on)** and paste the private link into the Questbook submission.

## Timing summary
| Segment | Window | Length |
|---|---|---|
| Cold open | 0:00–0:25 | 0:25 |
| Codebase walkthrough | 0:25–2:25 | 2:00 |
| Integration demonstration | 2:25–4:25 | 2:00 |
| Close | 4:25–4:50 | 0:25 |
| **Total** | | **4:50** |
