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
- **Project website:** Link to the deployed frontend hosted on GitHub. **[PENDING]** — final URL once the frontend is published.
- **Project X handle:** @maleksharabi
- **Where are you and your founders located?** Malek Sharabi, Smart Contracts Developer, Stockholm, Sweden
- **Where is your business located?** Sweden
- **Is your business incorporated?** No

---

## Project Abstract

- **Project Name:** Arclight

- **One-liner (≤200 chars):**
  > Embeddable, stablecoin-native monetization rails for open video on Arc, where a sybil-resistant proof-of-view oracle meters genuine engagement and streams instant USDC payouts to creators.

- **What problem are you solving and why is it important?**
  > Open video has no native way to pay creators or price ads in money. Creators wait weeks for payouts, get paid in volatile points or the wrong currency, and lose 30–45% to intermediaries; advertisers pay for views they can't verify, with a large share of ad spend lost to bot and click fraud. The missing primitive is a way to prove a view actually happened and settle value for it instantly, in a stable currency, without a centralized platform in the middle. This matters because video is the largest category of internet attention, yet its entire monetization layer is opaque, slow, and rent-extracting.

- **What is your solution to that problem?**
  > Arclight is a set of stablecoin-native payment rails for open video, deployed and verified on Arc. Advertiser agents fund a USDC RevenuePool. A sybil-resistant proof-of-view oracle (ProofOfView) accepts signed attestations of genuine engagement from a trusted metering key, and verifies each view with a Groth16 ZK proof that hides the viewer's identity and binds an unlinkable nullifier — so payouts are sybil-resistant and no watch history can be reconstructed, without ever revealing who watched. This layer is complementary to Arc's Configurable Privacy, not replaced by it: Arc's Configurable Privacy is TEE-backed confidential transfer that hides the *amounts* of USDC payouts at settlement, while our ZK keeps *who watched* private and unforgeable — together, who watched stays private and how much a creator earns can be confidential. A RevenueSplitter streams payouts to creators using Arc's sub-second finality. Creator-side modules then let earnings auto-convert USDC→EURC via Circle StableFX, earn yield in USYC, and cash out cross-chain via CCTP. Every dollar moves on Arc in USDC; the video itself lives off-chain. Arclight is infrastructure, not a content platform — it ships as an embeddable SDK that any open-video platform integrates to pay creators per real view, so we power the rails rather than competing with the platforms on top of them.

- **Why hasn't this problem been solved yet? What are the barriers?**
  > Three barriers. Technical: proving a genuine view on-chain without doxxing the viewer is a privacy-vs-anti-sybil tension that needs ZK or selective disclosure, which only becomes practical on a chain with cheap stable-denominated gas and sub-second finality. Economic: per-view micropayments are uneconomic where gas is volatile — you need USDC as the gas token to make sub-cent payouts predictable. Infrastructure: instant FX into local stablecoins, yield on idle balances, and cross-chain cash-out previously meant stitching together many providers. Arc collapses these into native primitives (USDC gas, Malachite finality, StableFX, USYC, CCTP, Configurable Privacy), so this design only became buildable now.

- **Why are you and your team uniquely suited to solve this problem?**
  > I'm a full-stack and smart-contract developer who designed Arclight so every Arc primitive is load-bearing, not decorative. I've already built, tested, and deployed the full system to Arc testnet: seven contracts covering the payout core, the proof-of-view oracle with a ZK privacy layer, and Circle-product modules for CCTP, StableFX, and USYC — all source-verified on arcscan, with a Foundry test suite (unit, fuzz, and invariant tests) written to a strict security-first house style. My day-to-day work is in open-source EVM development and Solidity auditing, so the anti-fraud and privacy core is squarely in my wheelhouse.

---

## Product Alignment Track

- **Is your project currently live in production?** No
- **Are you live on Arc?** Yes — deployed and source-verified on Arc testnet (Arc mainnet hasn't launched yet, so testnet is the only live environment available).
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

> The ordering here is deliberate. We build every feature and every contract change first, and we run the whole security journey last, under a hard feature freeze. The audited contracts are exactly what we deploy to mainnet, byte for byte. We do not touch anything once the audit is done, because the moment you add a feature on top of audited code you are back to unaudited code and the audit stops meaning anything. So security is the final gate, not a checkpoint somewhere in the middle.

**Milestone 01: Production proof of view, client side proving and real sybil resistance (weeks 1 to 6)**
> Today the metering service builds and signs the view proof itself, which means the platform sees the raw viewer secret and could in theory rebuild who watched what. We do not want that power, so we move the Groth16 proving onto the viewer's own device. The browser generates the proof locally and sends up only the proof and its public signals, the secret never leaves the viewer, and we can honestly say the viewer is private even from us.
> The bigger piece is sybil resistance, which decides whether a flat instant rate survives the real internet. Right now a script can spin up a fresh viewer identity on every watch and farm the per view payout forever. The nullifier already guarantees one payout per viewer per campaign per epoch, but that only bites if the identity is hard to mint in bulk, so we add a proof of personhood binding. One human resolves to one eligible viewer, and because the campaign id is mixed into the nullifier the tokens one person produces across different videos still cannot be linked. We also harden the metering so a view only counts after real watch time, not a single ping.
> We deliver one clean testnet run start to finish, plus the bot attack failing where minting fresh identities still earns only one honest payout.

**Milestone 02: Circle Wallets and Paymaster, agent wallets and gasless onboarding (weeks 4 to 9)**
> Right now the agents in our demo run off raw private keys in a local env file. That proves the flow, but it is not how you run an advertiser agent that holds real campaign money, and no brand would trust it. So we move the advertiser and creator agents onto Circle Wallets. Each agent gets a policy bound wallet with real spending caps, so an advertiser agent can only ever commit the budget it was given, and a creator agent receives payouts into a wallet whose rules are enforced by Circle instead of us hoping the key never leaks.
> The second piece is Circle Paymaster, and it is about the viewer. The whole premise of Arclight is that a person lands on a video, watches, and a real payout fires without friction. That breaks the instant the viewer has to hold a gas token or even know what gas is. Paymaster removes that completely. The viewer never touches gas and never sees any chain plumbing, which means a creator's audience is not filtered down to the few people who already own crypto.
> We deliver one continuous gasless path on testnet, from a brand new viewer who has never touched a wallet to a creator getting paid in USDC, with the agent wallets enforcing their caps the whole way.

**Milestone 03: Configurable Privacy at settlement (weeks 8 to 12, depends on Arc shipping the feature)**
> This is where we use Arc Configurable Privacy for exactly what it does, which is hide the amounts moving in a transfer while keeping addresses visible so compliance still works. We turn it on at the settlement layer so a creator can keep their per view earnings confidential, opt in. Today every payout amount is public, so anyone can point an explorer at a creator and read exactly how much they earn, which is income data most people would never agree to publish. Configurable Privacy closes that without going fully dark, because addresses stay visible and a creator can hand a view key to an auditor when they actually need to disclose.
> This layer sits next to our proof of view privacy, it does not replace it. Who watched stays private because of our ZK, which hides viewer identity and proves uniqueness so the same person cannot farm a campaign. How much a creator earns stays private because of Arc, which hides amounts. Two different problems, two layers, both switched on.
> One honest dependency. This needs Arc's Configurable Privacy primitive to be live, and it has to land before our security freeze so it goes through the audit with everything else. If Arc ships it later, we treat it as a separate addition after launch with its own security pass rather than slipping new code in after the audit.

**Milestone 04: Embeddable SDK and reference open video frontend (weeks 6 to 14)**
> This is the product, so I want to be precise about what we are. We are not building a video platform and we are not a decentralized YouTube. We are building the rails that any open video platform drops in to pay creators per real view, which means the deliverable that matters is the SDK. It is a clean, documented package a platform integrates to fund campaigns, meter and attest views, and settle USDC payouts, and it hides all the hard parts. A platform that integrates it never has to understand the proof of view oracle, the nullifier logic, or the Circle plumbing underneath. They call the SDK and the rails just work.
> The reason this is the right shape is leverage. If we ship our own video site, we are one more platform competing for attention. If we ship rails, every open video platform that adopts them becomes a place creators get paid per real view, and we power all of them without running any of them.
> Next to the SDK we ship a reference frontend with creator, advertiser, and viewer surfaces that shows the whole flow in the open. It is a showcase and a living integration example, not a platform we run. It exists so an integrating team can watch the rails work end to end and copy the integration straight off it.

**Milestone 05: Security journey, production rewrite, full internal review, independent audit (weeks 14 to 22, feature freeze)**
> Now everything is built and we freeze it. I want to be honest about what is on testnet today, because it matters for how the money gets spent. The contracts deployed right now are a feature validation build. Their job was to prove every Circle integration works end to end, and they do, but they were never written to custody real money and they have not been audited. They even carry an early framing mistake in their NatSpec, where some comments say our zero knowledge layer will be replaced by Arc Configurable Privacy. That is wrong, the two are complementary and neither replaces the other, and the rewrite corrects that wording so the deployed code finally matches how the system actually works. Shipping these contracts as they are would be reckless, so we rewrite them properly to our security first house standard.
> Then we go hard on internal review before anyone outside sees them. That means an expanded Foundry suite with unit tests, stateless fuzzing, and stateful invariant testing, plus property tests on the invariants that actually decide whether this is safe. Money in equals money out. A view pays exactly once and can never be replayed. A nullifier can never be spent twice. We write a threat model that assumes flash loans, account abstraction, selectively reverting actors, and sybil swarms, and we review gas, griefing, and denial of service with that mindset.
> Only then do we hand it to an independent third party auditor and fix every finding before we go near mainnet. This is the last milestone for a reason. After this gate nothing changes, because any feature or tweak puts unaudited code back into a system we just certified. The audited contracts are exactly what goes to mainnet, byte for byte.

**Milestone 06: Arc mainnet launch and first creators and advertisers (at Arc mainnet launch)**
> This is where it becomes real. We deploy the audited, frozen contracts to Arc mainnet exactly as they were certified, with no changes between the version the auditor signed off on and the version that holds real money. That continuity is the whole reason we ran security last.
> Then we bring the first real creators and advertisers onto the rails. We onboard a starting set of creators who want to get paid per genuine view in USDC, and advertisers who want to fund campaigns and only pay for views that actually happened and can be proven. We watch the first real USDC move through the oracle, the splitter, and out to creator wallets, and we use that early cohort to find the rough edges in onboarding and the SDK that only show up once real people and real money are involved. This is where the testnet build stops being a demo and becomes a live product.

---

## Project Traction and Roadmap

- **Current traction / success already achieved:**
  > Pre-launch (testnet). What exists today is a complete, working system rather than usage metrics — an unaudited feature-validation build that proves every Circle integration end-to-end: all seven Arclight contracts are deployed and source-verified on Arc testnet, bound to the real testnet addresses for USDC, EURC, USYC, the CCTP TokenMessenger/MessageTransmitter, and the StableFX FxEscrow. The repo includes a full Foundry test suite (unit, stateless fuzz, and stateful invariant tests) plus deploy and on-chain smoke-test scripts. No production users or transaction volume yet — the grant takes this from a verified testnet feature-build to a live, audited product.

- **Dune Analytics / public dashboard link:** N/A — no public dashboard yet (pre-launch, no on-chain user activity to chart).

- **Are you funded?** No

- **Technical Roadmap (timeline + grant milestones, incl. Circle integration timelines):**
  > Phase 1 (done): core payout rails + proof-of-view oracle + ZK privacy layer + CCTP/StableFX/USYC modules built, tested, and verified on Arc testnet as a feature-validation build.
  > Phase 2 (weeks 1–12): productionize proof-of-view (client-side ZK proving + sybil-resistant proof-of-personhood); integrate Circle Wallets and Paymaster; wire Arc Configurable Privacy for confidential payout amounts at settlement as the primitive becomes available.
  > Phase 3 (weeks 6–14): ship the embeddable SDK that open-video platforms integrate, plus a reference creator/advertiser/viewer frontend that showcases the rails.
  > Phase 4 (weeks 14–22, feature-frozen): production rewrite + comprehensive internal security review (fuzz/invariant/property + threat model), then an independent third-party audit and remediation before any real USDC is custodied — the security journey runs last, with no feature changes after it.
  > Phase 5 (at Arc mainnet launch): deploy the audited, frozen contracts to mainnet and onboard the first creators and advertisers.

- **How will this grant support your technical roadmap?**
  > It funds the path from a verified testnet feature-build to a live, audited product, in that order: (1) productionizing proof-of-view — client-side ZK proving so the platform can't see watch history, plus sybil-resistant proof-of-personhood; (2) integrating Circle Wallets and Paymaster for agent wallets and gasless onboarding, and wiring Arc Configurable Privacy for confidential settlement; (3) the embeddable SDK and reference frontend that let open-video platforms adopt the rails; (4) and finally — with features frozen — a production rewrite, comprehensive internal security review (expanded fuzz/invariant/property tests + threat model), and an independent third-party audit with remediation before any real USDC is custodied. The security journey runs last so nothing ever ships unaudited. In short, it converts a finished, feature-validated contract layer into an audited, end-to-end product on Arc.

---

## Deck and Demo

- **Video demo of the product:** **[PENDING]** — ≤5-min video still to record (codebase walkthrough showing where USDC/CCTP/StableFX/USYC are implemented + integration demo).
- **Investor deck:** **[PENDING]** — deck still to produce.

---

## Conflict of Interest

- **Conflict of interest:** No
