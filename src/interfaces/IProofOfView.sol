// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IViewPrivacyVerifier} from "./IViewPrivacyVerifier.sol";

/**
 * @title IProofOfView
 * @author Malek Sharabi
 * @notice Interface for the Arclight proof of view oracle that the distributor consults before paying a creator.
 */
interface IProofOfView {
    /**
     * @notice A signed claim from the metering service that a single genuine view happened.
     * @param viewId Unique id for this view event, used so the same view can never be paid twice.
     * @param advertiser The advertiser whose budget should pay for this view.
     * @param creator The creator that earned the view.
     * @param commitment A hiding commitment to the viewer so their identity stays off the public chain.
     * @param nullifier The one per viewer per campaign and epoch token that gives us sybil resistance without identity.
     * @param campaignId The campaign this view belongs to, bound into the nullifier.
     * @param weight The payout weight of the view, for example attested watch units.
     * @param epoch The epoch this view belongs to, bound into the nullifier.
     * @param deadline The unix timestamp after which the attestation is no longer valid.
     */
    struct ViewAttestation {
        bytes32 viewId;
        address advertiser;
        address creator;
        uint256 commitment;
        uint256 nullifier;
        uint256 campaignId;
        uint256 weight;
        uint64 epoch;
        uint64 deadline;
    }

    /**
     * @notice Verify an attestation and mark its view as paid so it can never be reused.
     * @param attestation The signed view attestation.
     * @param signature The attestor's signature over the attestation.
     * @param proof The viewer privacy proof, verified only when a privacy verifier is configured.
     * @return weight The verified payout weight the distributor should use.
     */
    function consume(
        ViewAttestation calldata attestation,
        bytes calldata signature,
        IViewPrivacyVerifier.Groth16Proof calldata proof
    ) external returns (uint256 weight);

    /**
     * @notice Check whether a view id has already been consumed.
     * @param viewId The view id to check.
     * @return True if the view was already paid out.
     */
    function isConsumed(bytes32 viewId) external view returns (bool);
}
