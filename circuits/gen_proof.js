#!/usr/bin/env node
// Generates a Groth16 proof fixture for the Arclight proof of view circuit.
// We feed the circuit a viewer secret and salt plus the public campaign and epoch, then export the
// proof and public signals as Solidity calldata so the Foundry test can replay a real on-chain verification.
// The public signal order is [commitment, nullifier, campaignId, epoch], matching the verifier.
const path = require("path");
const snarkjs = require("snarkjs");

async function main() {
    const build = path.join(__dirname, "build");
    const wasm = path.join(build, "view_js", "view.wasm");
    const zkey = path.join(build, "view_final.zkey");

    // A throwaway viewer identity. These never leave the prover in a real flow.
    const input = {
        viewerSecret: "111111111111111111111111111111111111111111",
        viewerSalt: "222222222222222222222222222222222222222222",
        campaignId: "42",
        epoch: "7"
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);

    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    console.log("publicSignals:", JSON.stringify(publicSignals));
    console.log("calldata:", calldata);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
