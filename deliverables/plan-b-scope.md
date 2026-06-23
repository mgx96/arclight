# Arclight — Plan B Scope: Integrating Circle's Agentic Rails

Goal: make Arclight genuinely *use* Arc's flagship agentic primitives (Agent Wallets +
Nanopayments) rather than promising them, while keeping the deployed contracts load-bearing.

---

## 1. What's confirmed live on Arc testnet (June 2026)

- **Nanopayments** — gasless USDC, sub-cent ($0.000001), available on **Arc testnet**. Mechanics:
  agent signs an **EIP-3009 authorization → Circle Nanopayments API → off-chain ledger → batched
  on-chain settlement** (gas covered by Circle). Built on Circle Gateway's unified USDC balance.
  **Integrated via API, not a Solidity interface.**
- **Agent Wallets** — managed wallets with **time-bound USDC spending limits + allow/blocklists**
  (the exact controls our `AdvertiserAgentRegistry` hand-rolled). API-integrated.
- **Configurable Privacy** — shipped piece is **confidential transfers** (TEE-based, shields amounts,
  view keys for selective disclosure). Institution/transfer-focused; does NOT cover app-specific
  "prove a view without revealing the viewer," so our ZK proof-of-view stays a valid complement.

---

## 2. Target architecture (one sentence)

> Circle **Nanopayments** moves the per-view money; Circle **Agent Wallets** cap the advertiser
> agents; Arclight's **ProofOfView** oracle decides which views are real enough to pay; Arclight's
> **StableFX / USYC / CCTP** modules then convert, yield, and bridge what creators earn.

### End-to-end flow
1. Advertiser funds a **Circle Agent Wallet** (USDC, with spending caps/allowlists).
2. Viewer watches → off-chain **metering service** measures genuine engagement.
3. Metering service is the **ProofOfView attestor**: it builds a `ViewAttestation`
   (`viewId, advertiser, creator, commitment, nullifier, campaignId, weight, epoch, deadline`)
   and EIP-712 signs it (domain `ArclightProofOfView` v1). Viewer is referenced only by a hiding
   `commitment`; optional Groth16 proof + `nullifier` enforce one-pay-per-viewer privately.
4. **Agent service** validates the attestation (signature + `isConsumed(viewId) == false`), then has
   the Agent Wallet sign an **EIP-3009 authorization** and fires a **Nanopayment** to the creator.
5. **Settlement anchor (double-spend safety):** mark the `viewId` consumed on-chain so it can never be
   paid twice (see §4 for the two options).
6. Creator's received USDC flows into existing modules: `StableFxPayoutRouter` (→EURC),
   `CreatorTreasury` (USYC yield), `ArcCctpGateway` (cross-chain cash-out).

---

## 3. Reuse vs. new (grounded in the deployed code)

| Piece | Status | Notes |
|---|---|---|
| **ProofOfView** (deployed) | **Reused, centerpiece** | Same EIP-712 `ViewAttestation`. The attestor key = the off-chain metering service. `isConsumed`/`getAttestationDigest` are the off-chain gate. |
| RevenuePool / RevenueSplitter (deployed) | **Reused for pooled-campaign mode** | Existing on-chain path (`splitter` calls `consume()`, pays from pool) stays valid for advertisers who pre-fund a budget. Nanopayments is the *agentic per-view* mode alongside it. |
| StableFxPayoutRouter / CreatorTreasury / ArcCctpGateway (deployed) | **Reused, untouched** | Pure creator-side; agnostic to how USDC arrived. |
| AdvertiserAgentRegistry (deployed) | **Superseded by Agent Wallets** | Kept as a working demo of the concept; Agent Wallets are the production control plane. |
| **Off-chain agent service** | **NEW** | Holds Agent Wallet, reads ProofOfView attestations, fires Nanopayments. Core of Plan B. |
| **Off-chain metering/attestor service** | **NEW** | Measures engagement, signs `ViewAttestation`, (optionally) generates ZK proof. |
| **Settlement adapter** (optional) | **NEW, thin** | See §4 option B. |

**Net:** 6 of 7 contracts stand; 1 (registry) is superseded into a demo; the real build is two
off-chain services + frontend. No contract rewrites.

---

## 4. The one real design decision: double-spend safety for the nanopayment path

`ProofOfView.consume()` is `onlySplitter` and tied to on-chain payout weighting. The agentic path pays
off-chain via Nanopayments, so we need to decide how `viewId` gets marked consumed:

- **Option A — off-chain gate only (fastest, demo-grade).** Agent service checks
  `isConsumed(viewId)` (always false in agentic mode) and its own ledger before paying. Double-spend
  prevention lives in the agent service. Simple; no new contract. Weakness: the on-chain consumed-set
  isn't updated for nanopayments, so it's not a public audit trail.
- **Option B — thin on-chain settlement anchor (stronger pitch).** Deploy a small
  `ProofOfViewSettler` that ProofOfView authorizes (a second consumer role alongside `splitter`),
  which verifies the attestation and marks `viewId` consumed on-chain when the agent settles via
  Nanopayments. Gives a public, immutable "these views were paid" trail — the anti-fraud story Vertex
  lacks. Requires one new (cheap) contract deploy; ProofOfView already supports rotating roles via
  owner setters, but `consume` is `onlySplitter`, so the anchor either routes through the splitter or
  we deploy a fresh ProofOfView variant exposing a settler role.

**Recommendation:** ship **Option A for the grant demo** (it proves the agentic flow end-to-end on
testnet with the least surface), and put **Option B on the roadmap** (Milestone: on-chain settlement
anchor + public proof-of-view audit log). This keeps the demo honest and the roadmap ambitious.

---

## 5. Revised form milestones (replaces the earlier draft)

1. **Agentic per-view payments (Agent Wallets + Nanopayments).** Off-chain agent service holds a
   Circle Agent Wallet with spending caps, reads ProofOfView attestations from the metering service,
   and fires gasless per-view Nanopayments to creators on Arc testnet. End-to-end demo: fund agent →
   genuine view → attest → nanopay creator.
2. **Production proof-of-view + privacy.** Harden the metering/attestor service and the Groth16
   proof-of-view circuit so a view is provable without revealing watch history; align with Arc native
   confidential transfers for balances.
3. **On-chain settlement anchor + audit log (Option B).** Deploy the settler so paid views are marked
   consumed on-chain, producing a public anti-fraud trail; third-party security review of the oracle,
   splitter, settler, and Circle-product modules before mainnet custody.
4. **Embeddable SDK + reference frontend + Arc mainnet.** Ship the SDK + reference open-video frontend;
   deploy to Arc mainnet at launch; adopt native Configurable Privacy.

---

## 6. Frontend (next deliverable)

A web app that demonstrates the full protocol on Arc testnet and doubles as the video's "Integration
Demonstration." Proposed flow to visualize:
- **Advertiser view:** fund an Agent Wallet, set a per-view budget/cap.
- **Viewer view:** watch a sample video; engagement meter ticks; a genuine view is attested.
- **Live ledger:** show the attestation (viewId, creator, weight) and the Nanopayment firing to the
  creator (gasless, sub-cent), with the running creator balance.
- **Creator view:** received USDC, then one-click "convert to EURC" (StableFX), "earn yield" (USYC),
  "cash out cross-chain" (CCTP) — each calling the deployed, verified contracts.
- **Proof panel:** link each paid view to the on-chain `ViewConsumed` event / verified contract on
  arcscan, making the anti-fraud claim tangible.
