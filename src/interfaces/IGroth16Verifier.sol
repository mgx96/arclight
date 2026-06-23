// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IGroth16Verifier
 * @author Malek Sharabi
 * @notice Minimal interface for the snarkjs generated Groth16 verifier so we can call it from typed Solidity. The public
 * signal order is fixed by the circuit as [commitment, nullifier, campaignId, epoch].
 */
interface IGroth16Verifier {
    /**
     * @notice Verify a Groth16 proof against the four public signals of the proof of view circuit.
     * @param _pA The proof A point.
     * @param _pB The proof B point.
     * @param _pC The proof C point.
     * @param _pubSignals The public signals in the order [commitment, nullifier, campaignId, epoch].
     * @return True if the proof is valid for these public signals.
     */
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[4] calldata _pubSignals
    ) external view returns (bool);
}
