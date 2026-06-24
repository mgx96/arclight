// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IViewPrivacyVerifier
 * @author Malek Sharabi
 * @notice The viewer anonymity and anti sybil layer of Arclight. It proves a genuine unique viewer stands behind a
 * payout without revealing who they are, and binds an unlinkable nullifier so the same viewer is counted at most once.
 * We back it with an application level zero knowledge proof.
 * @dev The commitment hides the viewer identity and the nullifier is a one per viewer per campaign and epoch token that
 * gives us sybil resistance without surveillance. Because campaignId is mixed into the nullifier, the tokens a single
 * viewer produces across different videos are uncorrelatable, so no on chain watch history can be reconstructed. The
 * public signal order is [commitment, nullifier, campaignId, epoch].
 */
interface IViewPrivacyVerifier {
    struct Groth16Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    /**
     * @notice Verify that a proof attests to a genuine viewer for a campaign and epoch.
     * @param proof The Groth16 proof produced by the viewer.
     * @param commitment The hiding commitment to the viewer identity.
     * @param nullifier The unlinkable one per viewer per campaign and epoch token.
     * @param campaignId The campaign the view belongs to.
     * @param epoch The epoch the view belongs to.
     * @return True if the proof is valid for these public signals.
     */
    function verifyView(
        Groth16Proof calldata proof,
        uint256 commitment,
        uint256 nullifier,
        uint256 campaignId,
        uint256 epoch
    ) external view returns (bool);
}
