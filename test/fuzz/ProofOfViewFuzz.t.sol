// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ProofOfView} from "../../src/oracle/ProofOfView.sol";
import {IProofOfView} from "../../src/interfaces/IProofOfView.sol";
import {IViewPrivacyVerifier} from "../../src/interfaces/IViewPrivacyVerifier.sol";

contract ProofOfViewFuzzTest is Test {
    ProofOfView internal oracle;

    address internal owner = makeAddr("owner");
    address internal splitter = makeAddr("splitter");
    address internal advertiser = makeAddr("advertiser");
    address internal creator = makeAddr("creator");

    address internal attestor;
    uint256 internal attestorKey;

    // The order of the secp256k1 curve; valid private keys live in [1, N-1]
    uint256 internal constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function setUp() public {
        (attestor, attestorKey) = makeAddrAndKey("attestor");
        vm.prank(owner);
        oracle = new ProofOfView(owner);
        vm.startPrank(owner);
        oracle.setAttestor(attestor);
        oracle.setSplitter(splitter);
        vm.stopPrank();
    }

    function _attestation(bytes32 viewId, uint256 weight) internal view returns (IProofOfView.ViewAttestation memory) {
        return IProofOfView.ViewAttestation({
            viewId: viewId,
            advertiser: advertiser,
            creator: creator,
            commitment: uint256(keccak256("commitment")),
            nullifier: uint256(keccak256(abi.encode("nullifier", viewId))),
            campaignId: 42,
            weight: weight,
            epoch: 7,
            deadline: uint64(block.timestamp + 1 hours)
        });
    }

    function _emptyProof() internal pure returns (IViewPrivacyVerifier.Groth16Proof memory) {
        return IViewPrivacyVerifier.Groth16Proof({
            a: [uint256(0), 0], b: [[uint256(0), 0], [uint256(0), 0]], c: [uint256(0), 0]
        });
    }

    function _sign(IProofOfView.ViewAttestation memory a, uint256 key) internal view returns (bytes memory) {
        bytes32 digest = oracle.getAttestationDigest(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    /*//////////////////////////////////////////////////////////////
                               FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzzConsumeReturnsAttestedWeight(bytes32 viewId, uint256 weight) public {
        vm.assume(viewId != bytes32(0));
        weight = bound(weight, 1, type(uint256).max);

        IProofOfView.ViewAttestation memory a = _attestation(viewId, weight);
        bytes memory sig = _sign(a, attestorKey);

        vm.prank(splitter);
        uint256 returned = oracle.consume(a, sig, _emptyProof());

        assertEq(returned, weight);
        assertTrue(oracle.isConsumed(viewId));
    }

    function testFuzzWrongSignerAlwaysReverts(uint256 badKey, bytes32 viewId, uint256 weight) public {
        vm.assume(viewId != bytes32(0));
        weight = bound(weight, 1, type(uint256).max);
        badKey = bound(badKey, 1, SECP256K1_N - 1);
        vm.assume(badKey != attestorKey);

        IProofOfView.ViewAttestation memory a = _attestation(viewId, weight);
        bytes memory sig = _sign(a, badKey);

        vm.prank(splitter);
        vm.expectRevert(ProofOfView.ProofOfView__InvalidAttestor.selector);
        oracle.consume(a, sig, _emptyProof());
    }

    function testFuzzReplayAlwaysReverts(bytes32 viewId, uint256 weight) public {
        vm.assume(viewId != bytes32(0));
        weight = bound(weight, 1, type(uint256).max);

        IProofOfView.ViewAttestation memory a = _attestation(viewId, weight);
        bytes memory sig = _sign(a, attestorKey);

        vm.prank(splitter);
        oracle.consume(a, sig, _emptyProof());

        vm.prank(splitter);
        vm.expectRevert(abi.encodeWithSelector(ProofOfView.ProofOfView__AlreadyConsumed.selector, viewId));
        oracle.consume(a, sig, _emptyProof());
    }

    function testFuzzExpiredAttestationReverts(bytes32 viewId, uint256 weight, uint256 warpBy) public {
        vm.assume(viewId != bytes32(0));
        weight = bound(weight, 1, type(uint256).max);

        IProofOfView.ViewAttestation memory a = _attestation(viewId, weight);
        bytes memory sig = _sign(a, attestorKey);

        warpBy = bound(warpBy, 1, 3650 days);
        vm.warp(uint256(a.deadline) + warpBy);

        vm.prank(splitter);
        vm.expectRevert(ProofOfView.ProofOfView__AttestationExpired.selector);
        oracle.consume(a, sig, _emptyProof());
    }

    function testFuzzNonSplitterAlwaysReverts(address caller, bytes32 viewId, uint256 weight) public {
        vm.assume(caller != splitter);
        vm.assume(viewId != bytes32(0));
        weight = bound(weight, 1, type(uint256).max);

        IProofOfView.ViewAttestation memory a = _attestation(viewId, weight);
        bytes memory sig = _sign(a, attestorKey);

        vm.prank(caller);
        vm.expectRevert(ProofOfView.ProofOfView__NotSplitter.selector);
        oracle.consume(a, sig, _emptyProof());
    }
}
