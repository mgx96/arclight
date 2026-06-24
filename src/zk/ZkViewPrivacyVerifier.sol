// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IViewPrivacyVerifier} from "../interfaces/IViewPrivacyVerifier.sol";
import {IGroth16Verifier} from "../interfaces/IGroth16Verifier.sol";

/**
 * @title ZkViewPrivacyVerifier
 * @author Malek Sharabi
 * @notice The zero knowledge backend of the Arclight viewer anonymity and anti sybil layer. It adapts our snarkjs
 * Groth16 verifier to the IViewPrivacyVerifier interface the oracle consumes, so the rest of the system stays agnostic
 * to how the proof is produced.
 * @dev This proves a unique anonymous viewer and binds a nullifier for sybil resistance. It is not Arc Configurable
 * Privacy and is not replaced by it: Arc Configurable Privacy hides transfer amounts at settlement, whereas this hides
 * viewer identity and proves a uniqueness predicate, which a confidential transfer feature does not express. The two are
 * complementary layers. If a future on chain primitive can verify the same commitment, nullifier and uniqueness
 * semantics, only this adapter is swapped and nothing above the interface changes. We assemble the public signals in the
 * exact order the circuit fixes them, [commitment, nullifier, campaignId, epoch].
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
