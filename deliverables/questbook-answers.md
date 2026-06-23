# Arclight — Questbook Application Answers (Circle 2026 Cohort 2)

Draft answers for the Submit Proposal form. Fields marked **[DECIDE]** need your call; **[PENDING]**
depends on a deliverable not yet produced (video, deck).

---

## Applicant Details

- **Primary contact first name:** Malek
- **Primary contact last name:** Sharabi
- **Email address:** m.malek1996@hotmail.com
- **Company Legal Entity Name:** N/A
- **Company Doing-Business-As (DBA) name:** Arclight
- **Founder names, roles, bios:** Malek Sharabi — Full-Stack & Smart-Contract Developer. Builds in the open-source EVM/Solidity space with a focus on smart-contract security and auditing. Designed and built the entire Arclight system (payout core, proof-of-view oracle, ZK privacy layer, and Circle-product modules) deployed and verified on Arc testnet.
- **Project website:** **[DECIDE]** — none live yet. Options: leave blank, or make the GitHub repo public and use that URL.
- **Project X handle:** @maleksharabi
- **Where are you and your founders located?** Malek Sharabi, Smart Contracts Developer, Stockholm, Sweden
- **Where is your business located?** Sweden
- **Is your business incorporated?** No

---

## Project Abstract

- **Project Name:** Arclight

- **One-liner (≤200 chars):**
  > Stablecoin-native monetization rails for open video on Arc, where a sybil-resistant proof-of-view oracle meters genuine engagement and streams instant USDC payouts to creators.

- **What problem are you solving and why is it important?**
  > Open video has no native way to pay creators or price ads in money. Creators wait weeks for payouts, get paid in volatile points or the wrong currency, and lose 30–45% to intermediaries; advertisers pay for views they can't verify, with a large share of ad spend lost to bot and click fraud. The missing primitive is a way to prove a view actually happened and settle value for it instantly, in a stable currency, without a centralized platform in the middle. This matters because video is the largest category of internet attention, yet its entire monetization layer is opaque, slow, and rent-extracting.

- **What is your solution to that problem?**
  > Arclight is a set of stablecoin-native payment rails for open video, deployed and verified on Arc. Advertiser agents fund a USDC RevenuePool. A sybil-resistant proof-of-view oracle (ProofOfView) accepts signed attestations of genuine engagement from a trusted metering key, and — ahead of Arc's native Configurable Privacy — can verify a view via a Groth16 ZK proof so viewer watch history stays shielded while the payout contract still gets a provable signal. A RevenueSplitter streams payouts to creators using Arc's sub-second finality. Creator-side modules then let earnings auto-convert USDC→EURC via Circle StableFX, earn yield in USYC, and cash out cross-chain via CCTP. Every dollar moves on Arc in USDC; the video itself lives off-chain.

- **Why hasn't this problem been solved yet? What are the barriers?**
  > Three barriers. Technical: proving a genuine view on-chain without doxxing the viewer is a privacy-vs-anti-sybil tension that needs ZK or selective disclosure, which only becomes practical on a chain with cheap stable-denominated gas and sub-second finality. Economic: per-view micropayments are uneconomic where gas is volatile — you need USDC as the gas token to make sub-cent payouts predictable. Infrastructure: instant FX into local stablecoins, yield on idle balances, and cross-chain cash-out previously meant stitching together many providers. Arc collapses these into native primitives (USDC gas, Malachite finality, StableFX, USYC, CCTP, Configurable Privacy), so this design only became buildable now.

- **Why are you and your team uniquely suited to solve this problem?**
  > I'm a full-stack and smart-contract developer who designed Arclight so every Arc primitive is load-bearing, not decorative. I've already built, tested, and deployed the full system to Arc testnet: seven contracts covering the payout core, the proof-of-view oracle with a ZK privacy layer, and Circle-product modules for CCTP, StableFX, and USYC — all source-verified on arcscan, with a Foundry test suite (unit, fuzz, and invariant tests) written to a strict security-first house style. My day-to-day work is in open-source EVM development and Solidity auditing, so the anti-fraud and privacy core is squarely in my wheelhouse.

---

## Product Alignment Track

- **Is your project currently live in production?** No
- **Are you live on Arc?** **[DECIDE]** Recommended: **Yes** — deployed and source-verified on Arc testnet (Arc mainnet hasn't launched yet, so testnet is the only live environment available). If you'd rather be conservative, answer No and explain testnet status in the traction field.
- **Which other chain(s) are you currently live on?** None — Arclight is deployed only on Arc (testnet).
- **Which Circle products are currently integrated? (video must validate)**
  - ☑ USDC
  - ☑ EURC
  - ☑ USYC
  - ☑ CCTP
  - ☑ Contracts
  - ☑ StableFX
  - *(leave unchecked: Agent Stack, App Kits, cirBTC, Circle Mint, Gateway, Paymaster, Wallets)*
- **Email used for the Circle Developer Console:** m.malek1996@hotmail.com
- **Which Circle products do you plan to integrate?**
  - ☑ Wallets (advertiser/creator agent wallets with spending caps)
  - ☑ Paymaster (gasless viewer onboarding)
  - ☑ Agent Stack (autonomous two-sided ad market)
  - ☑ Gateway (cross-chain capital-in alongside CCTP)

---

## Milestones and Timelines

**01 — Production proof-of-view: off-chain attestor service + ZK proving**
> Build the off-chain metering service that signs genuine-view attestations consumed by ProofOfView, and productionize the Groth16 proof-of-view circuit so a view can be proven without revealing viewer watch history. Deliver an end-to-end testnet demo: an advertiser agent funds the USDC RevenuePool, a metered view is attested (optionally ZK-proven), and the RevenueSplitter streams a payout — all on Arc.

**02 — Agent wallets + gasless onboarding (Circle Wallets + Paymaster)**
> Integrate Circle Wallets for advertiser and creator agent wallets with spending caps, and Circle Paymaster so viewers onboard and interact gaslessly. Wire these into the existing AdvertiserAgentRegistry funding flow and demonstrate a gasless viewer-to-payout path on Arc testnet.

**03 — Security review of the payout core and Circle-product modules**
> Commission a third-party security review/audit of ProofOfView, RevenueSplitter, RevenuePool, and the CCTP/StableFX/USYC modules before they custody real USDC, and remediate findings. Publish the report alongside the existing Foundry unit/fuzz/invariant suite.

**04 — Embeddable SDK, reference frontend, and Arc mainnet deployment**
> Ship an SDK and reference open-video frontend so third-party platforms can embed Arclight's rails, then deploy to Arc mainnet at launch — replacing the interim ZK privacy layer with Arc's native Configurable Privacy — and onboard the first creators and advertisers.

---

## Project Traction and Roadmap

- **Current traction / success already achieved:**
  > Pre-launch (testnet). What exists today is a complete, working system rather than usage metrics: all seven Arclight contracts are deployed and source-verified on Arc testnet, bound to the real testnet addresses for USDC, EURC, USYC, the CCTP TokenMessenger/MessageTransmitter, and the StableFX FxEscrow. The repo includes a full Foundry test suite (unit, stateless fuzz, and stateful invariant tests) plus deploy and on-chain smoke-test scripts. No production users or transaction volume yet — the grant takes this from a verified testnet deployment to a live product.

- **Dune Analytics / public dashboard link:** N/A — no public dashboard yet (pre-launch, no on-chain user activity to chart).

- **Are you funded?** No

- **Technical Roadmap (timeline + grant milestones, incl. Circle integration timelines):**
  > Phase 1 (done): core payout rails + proof-of-view oracle + ZK privacy layer + CCTP/StableFX/USYC modules built, tested, and verified on Arc testnet.
  > Phase 2 (weeks 1–6): harden the off-chain attestor/metering service and the ZK proof-of-view circuit; integrate Circle Wallets (agent wallets) and Paymaster (gasless onboarding); end-to-end testnet demo of fund→view→attest→split→payout.
  > Phase 3 (weeks 6–12): production FX via live StableFX RFQ quotes and USYC treasury flows; third-party security review of the oracle and splitter; embeddable SDK for open-video frontends.
  > Phase 4 (Arc mainnet, ~Summer 2026): mainnet deployment, adopt native Configurable Privacy in place of the interim ZK layer, onboard first creators and advertisers.

- **How will this grant support your technical roadmap?**
  > It funds the path from a verified testnet deployment to a live, audited product: (1) engineering time to build the off-chain attestor/metering service and production ZK proving for proof-of-view; (2) a third-party security review of the oracle, splitter, and Circle-product modules before they custody real USDC; (3) integration of Circle Wallets and Paymaster for agent wallets and gasless onboarding; (4) the embeddable SDK and reference frontend that let open-video platforms adopt the rails. In short, it converts a finished contract layer into a usable, audited, end-to-end product on Arc.

---

## Deck and Demo

- **Video demo of the product:** **[PENDING]** — ≤5-min video still to record (codebase walkthrough showing where USDC/CCTP/StableFX/USYC are implemented + integration demo).
- **Investor deck:** **[PENDING]** — deck still to produce.

---

## Conflict of Interest

- **Conflict of interest:** No
