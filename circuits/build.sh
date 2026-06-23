#!/usr/bin/env bash
# Builds the Arclight proof of view circuit and exports the on-chain Groth16 verifier.
# This is a demo trusted setup. A production deployment needs a real multi party ceremony.
# The random entropy below is throwaway toxic waste, never a secret we keep.
set -euo pipefail

cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"

POT_POWER=14
BUILD=build
mkdir -p "$BUILD" ../src/zk

echo "==> compiling circuit"
circom view.circom --r1cs --wasm --sym -l node_modules/circomlib/circuits -o "$BUILD"

echo "==> powers of tau (phase 1)"
npx snarkjs powersoftau new bn128 "$POT_POWER" "$BUILD/pot_0000.ptau" -v
npx snarkjs powersoftau contribute "$BUILD/pot_0000.ptau" "$BUILD/pot_0001.ptau" \
    --name="arclight phase1" -v -e="$(head -c 64 /dev/urandom | xxd -p | tr -d '\n')"
npx snarkjs powersoftau prepare phase2 "$BUILD/pot_0001.ptau" "$BUILD/pot_final.ptau" -v

echo "==> groth16 setup (phase 2)"
npx snarkjs groth16 setup "$BUILD/view.r1cs" "$BUILD/pot_final.ptau" "$BUILD/view_0000.zkey"
npx snarkjs zkey contribute "$BUILD/view_0000.zkey" "$BUILD/view_final.zkey" \
    --name="arclight phase2" -v -e="$(head -c 64 /dev/urandom | xxd -p | tr -d '\n')"
npx snarkjs zkey export verificationkey "$BUILD/view_final.zkey" "$BUILD/verification_key.json"

echo "==> exporting solidity verifier"
npx snarkjs zkey export solidityverifier "$BUILD/view_final.zkey" ../src/zk/Groth16Verifier.sol

echo "==> done"
