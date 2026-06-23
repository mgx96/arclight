// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IViewPrivacyVerifier} from "../interfaces/IViewPrivacyVerifier.sol";
import {IGroth16Verifier} from "../interfaces/IGroth16Verifier.sol";

/**
 * @title ZkViewPrivacyVerifier
 * @author Malek Sharabi
 * @notice The zero knowledge backend of the Arclight privacy layer. It adapts our snarkjs Groth16 verifier to the
 * IViewPrivacyVerifier interface the oracle consumes, so the rest of the system stays agnostic to how privacy is proven.
 * @dev This is the application level demonstration of Configurable Privacy. When Arc ships the native feature we swap
 * this implementation for one backed by the chain and nothing above the interface changes. We assemble the public
 * signals in the exact order the circuit fixes them, [commitment, nullifier, campaignId, epoch].
 */
contract ZkViewPrivacyVerifier is IViewPrivacyVerifier {
    error ZkViewPrivacyVerifier__ZeroAddress();

    IGroth16Verifier private immutable i_verifier;

    /**
     * @notice Deploys the privacy verifier wired to a generated Groth16 verifier.
     * @param verifier The snarkjs generated Groth16 verifier for the proof of view circuit.
     */
    constructor(address verifier) {
        if (verifier == address(0)) {
            revert ZkViewPrivacyVerifier__ZeroAddress();
        }
        i_verifier = IGroth16Verifier(verifier);
    }

    /**
     * @inheritdoc IViewPrivacyVerifier
     * @dev We forward the proof to the Groth16 verifier with the public signals in circuit order. The call is view only
     * so it can never mutate state or reenter the oracle.
     */
    function verifyView(
        Groth16Proof calldata proof,
        uint256 commitment,
        uint256 nullifier,
        uint256 campaignId,
        uint256 epoch
    ) external view returns (bool) {
        uint256[4] memory publicSignals = [commitment, nullifier, campaignId, epoch];
        return i_verifier.verifyProof(proof.a, proof.b, proof.c, publicSignals);
    }

    /**
     * @notice Get the underlying Groth16 verifier.
     * @return The Groth16 verifier address.
     */
    function getVerifier() external view returns (address) {
        return address(i_verifier);
    }
}
