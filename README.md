# Arclight

Stablecoin native monetization for open video. Creators get paid real sub cent USDC per genuine view, gated by a sybil resistant proof of view on Circle's Arc L1.

Live on Arc testnet. Contracts are source verified on Arcscan. Built for the Circle Arc Builders Fund.

## The problem

Open video has no good way to make money. Ads need a platform that owns the audience and takes a cut. Subscriptions and tips ask the viewer to pull out a card for every creator they like. Neither pays a creator for the one thing that actually happened: somebody watched.

The reason nobody pays per view is that a per view payment is tiny and a genuine view is hard to prove. Card rails can't move a fraction of a cent without the fees eating it, and any naive view counter gets farmed by bots in a day.

## What Arclight does

Arclight pays a creator the moment a real view happens, in USDC, with no platform in the middle.

Two pieces make that work:

1. **Proof of view.** A metering service watches the playback and, when a view is genuine, signs a one off attestation for it. The attestation carries a hiding commitment to the viewer and a nullifier that pins the payout to one viewer, one campaign, one epoch. Replay the same proof and the nullifier kills it. No viewer identity ever leaves the metering service.

2. **Nanopayment.** An advertiser agent verifies the signed proof, then sends the creator a sub cent USDC payment over Circle Gateway. It is gasless and it settles in real time. The payment only goes through if the proof checks out and the nullifier is fresh.

Put together: a bot can't farm payouts, a viewer stays private, and a creator gets paid per real view straight to their wallet.

## How the money flows

```
Advertiser agent  ──signs + verifies proof──▶  ProofOfView  ──nanopayment──▶  Creator
   Gateway balance        sybil resistance         onchain trust          USDC in wallet
```

Once the USDC lands, the creator can route it through Circle's stablecoin rails without leaving Arc:

- **Convert to EURC** through StableFX, maker settled.
- **Earn yield** on idle balance through USYC.
- **Bridge out** to another chain through CCTP V2.

## Why Arc

Arc is built for stablecoin payments, so the things that make per view payouts impossible everywhere else just work here:

- **Gas in USDC.** No separate gas token to hold or top up.
- **Circle Gateway.** Gasless, sub cent, real time settlement, which is the only way a fraction of a cent payment makes sense.
- **Native USDC, EURC, USYC, CCTP.** The payout rails are first class onchain, not bolted on.

## Repo layout

```
src/            Solidity contracts (RevenuePool, ProofOfView, RevenueSplitter, Circle modules)
circuits/       The zero knowledge proof of view circuit
test/           Foundry test suite
script/         Deploy and wiring scripts
app/backend/    Metering attestor, x402 creator payout, and the Gateway agent
app/frontend/   Live demo dashboard (advertiser, viewer, creator, proof panels)
deployments/    Live Arc testnet addresses
deliverables/   Grant materials
```

## Live on Arc testnet

Chain id `5042002`. Explorer: https://testnet.arcscan.app

| Contract | Address |
| --- | --- |
| RevenuePool | `0xF848889d955bb1a59325Db91Fc1d52152E17A946` |
| ProofOfView | `0x1bE08B8DfB8e87F7b30315afE1d367780b0AF3Ec` |
| RevenueSplitter | `0x707Ed9d732779a204E6C4C448B4E9930cB1ab8C5` |
| ArcCctpGateway | `0x4A0Fb26B9e774d85aA0D4E3C3D077ebcc3E0572a` |
| StableFxPayoutRouter | `0xEf70f1ABb1581845F9812511a774F65F0724dABc` |
| CreatorTreasury | `0xF8D996fEa13184b440b36454418FF40556F1c88D` |
| AdvertiserAgentRegistry | `0xa6A2B86f8ff81bA2237991F4Aa8Da3a3428E88F9` |

Full record, including the Circle dependency addresses, lives in `deployments/arc-testnet.json`.

## Run the demo

You need Node, pnpm, and Foundry.

**Contracts**

```bash
forge build
forge test
```

**Backend** (`app/backend`)

```bash
pnpm install
pnpm keygen        # generates throwaway testnet keys into a gitignored .env.local
pnpm deposit 5     # funds the agent's Gateway balance with test USDC
pnpm dev           # starts the attestor + agent on :8787
```

**Frontend** (`app/frontend`)

```bash
pnpm install
pnpm dev           # open the dashboard, play the video, watch a real nanopayment land
```

Hit play and a metered view fires a signed proof, the agent pays the creator in USDC over Gateway, and the receipt shows up live. Replay the same proof and the nullifier blocks it.

## Security note

All keys in the demo are throwaway testnet keys. They live in a gitignored `.env.local` and never touch the repo. Never put a real private key anywhere in here.

## License

MIT. See [LICENSE](./LICENSE).
