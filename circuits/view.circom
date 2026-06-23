pragma circom 2.1.6;

include "poseidon.circom";

// Proves a genuine unique view without revealing the viewer.
// The prover knows a secret that yields a public commitment (shields identity) and a public nullifier
// (one unforgeable, unlinkable token per viewer per campaign and epoch, so a viewer is counted once).
// commitment and nullifier are outputs, so the circuit computes them and we never reveal the secret.
template ViewProof() {
    // Private witness.
    signal input viewerSecret;
    signal input viewerSalt;

    // Public inputs.
    signal input campaignId;
    signal input epoch;

    // Public outputs.
    signal output commitment;
    signal output nullifier;

    component commitHash = Poseidon(2);
    commitHash.inputs[0] <== viewerSecret;
    commitHash.inputs[1] <== viewerSalt;
    commitment <== commitHash.out;

    component nullHash = Poseidon(3);
    nullHash.inputs[0] <== viewerSecret;
    nullHash.inputs[1] <== campaignId;
    nullHash.inputs[2] <== epoch;
    nullifier <== nullHash.out;
}

// Public signal order is [commitment, nullifier, campaignId, epoch] (outputs first, then public inputs).
component main {public [campaignId, epoch]} = ViewProof();
