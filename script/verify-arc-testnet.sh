#!/usr/bin/env bash
# Verify all Arclight contracts deployed to Arc testnet (chainId 5042002) on Blockscout.
# Constructor args are ABI-encoded to match the on-chain bytecode exactly (pulled from
# broadcast/DeployArclight.s.sol/5042002/run-latest.json). Run from the repo root.
set -euo pipefail

RPC="https://testnet.arcscan.app/api/eth-rpc"
VERIFIER_URL="https://testnet.arcscan.app/api/"
COMMON=(--rpc-url "$RPC" --verifier blockscout --verifier-url "$VERIFIER_URL" --watch)

# RevenuePool(address usdc, address initialOwner)
forge verify-contract "${COMMON[@]}" \
  --constructor-args 0x00000000000000000000000036000000000000000000000000000000000000000000000000000000000000007fe819050290f176c479225812d749cbb5842f6b \
  0xF848889d955bb1a59325Db91Fc1d52152E17A946 \
  src/payments/RevenuePool.sol:RevenuePool

# ProofOfView(address initialOwner)
forge verify-contract "${COMMON[@]}" \
  --constructor-args 0x0000000000000000000000007fe819050290f176c479225812d749cbb5842f6b \
  0x1bE08B8DfB8e87F7b30315afE1d367780b0AF3Ec \
  src/oracle/ProofOfView.sol:ProofOfView

# RevenueSplitter(address pool, address oracle)
forge verify-contract "${COMMON[@]}" \
  --constructor-args 0x000000000000000000000000f848889d955bb1a59325db91fc1d52152e17a9460000000000000000000000001be08b8dfb8e87f7b30315afe1d367780b0af3ec \
  0x707Ed9d732779a204E6C4C448B4E9930cB1ab8C5 \
  src/payments/RevenueSplitter.sol:RevenueSplitter

# ArcCctpGateway(address usdc, address tokenMessenger, address messageTransmitter, address pool)
forge verify-contract "${COMMON[@]}" \
  --constructor-args 0x00000000000000000000000036000000000000000000000000000000000000000000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa000000000000000000000000e737e5cebeeba77efe34d4aa090756590b1ce275000000000000000000000000f848889d955bb1a59325db91fc1d52152e17a946 \
  0x4A0Fb26B9e774d85aA0D4E3C3D077ebcc3E0572a \
  src/cctp/ArcCctpGateway.sol:ArcCctpGateway

# StableFxPayoutRouter(address usdc, address eurc, address escrow)
forge verify-contract "${COMMON[@]}" \
  --constructor-args 0x000000000000000000000000360000000000000000000000000000000000000000000000000000000000000089b50855aa3be2f677cd6303cec089b5f319d72a000000000000000000000000867650f5eae8df91445971f14d89fd84f0c9a9f8 \
  0xEf70f1ABb1581845F9812511a774F65F0724dABc \
  src/stablefx/StableFxPayoutRouter.sol:StableFxPayoutRouter

# CreatorTreasury(address usdc, address usyc, address teller)
forge verify-contract "${COMMON[@]}" \
  --constructor-args 0x0000000000000000000000003600000000000000000000000000000000000000000000000000000000000000e9185f0c5f296ed1797aae4238d26ccabeadb86c0000000000000000000000009fdf14c5b14173d74c08af27aebff39240dc105a \
  0xF8D996fEa13184b440b36454418FF40556F1c88D \
  src/treasury/CreatorTreasury.sol:CreatorTreasury

# AdvertiserAgentRegistry(address usdc, address pool)
forge verify-contract "${COMMON[@]}" \
  --constructor-args 0x0000000000000000000000003600000000000000000000000000000000000000000000000000000000000000f848889d955bb1a59325db91fc1d52152e17a946 \
  0xa6A2B86f8ff81bA2237991F4Aa8Da3a3428E88F9 \
  src/agents/AdvertiserAgentRegistry.sol:AdvertiserAgentRegistry

echo "All verification requests submitted."
