// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IViewPrivacyVerifier} from "../../src/interfaces/IViewPrivacyVerifier.sol";

/**
 * @title MockViewPrivacyVerifier
 * @author Malek Sharabi
 * @notice A privacy verifier test double that returns a configurable verdict, so the economic tests can exercise the
 * oracle's nullifier and proof gating without generating real zero knowledge proofs.
 */
contract MockViewPrivacyVerifier is IViewPrivacyVerifier {
    bool private s_result = true;

    /**
     * @notice Set the verdict this mock returns from verifyView.
     * @param result The verdict to return.
     */
    function setResult(bool result) external {
        s_result = result;
    }

    /**
     * @inheritdoc IViewPrivacyVerifier
     */
    function verifyView(Groth16Proof calldata, uint256, uint256, uint256, uint256) external view returns (bool) {
        return s_result;
    }
}
