// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ProofOfView} from "../../src/oracle/ProofOfView.sol";
import {IProofOfView} from "../../src/interfaces/IProofOfView.sol";
import {IViewPrivacyVerifier} from "../../src/interfaces/IViewPrivacyVerifier.sol";
import {MockViewPrivacyVerifier} from "../mocks/MockViewPrivacyVerifier.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ProofOfViewTest is Test {
    ProofOfView internal oracle;

    address internal owner = makeAddr("owner");
    address internal splitter = makeAddr("splitter");
    address internal advertiser = makeAddr("advertiser");
    address internal creator = makeAddr("creator");

    address internal attestor;
    uint256 internal attestorKey;

    event AttestorUpdated(address indexed attestor);
    event SplitterUpdated(address indexed splitter);
    event PrivacyVerifierUpdated(address indexed privacyVerifier);
    event ViewConsumed(bytes32 indexed viewId, address indexed advertiser, address indexed creator, uint256 weight);

    function setUp() public {
        (attestor, attestorKey) = makeAddrAndKey("attestor");

        vm.prank(owner);
        oracle = new ProofOfView(owner);

        vm.startPrank(owner);
        oracle.setAttestor(attestor);
        oracle.setSplitter(splitter);
        vm.stopPrank();
    }

    function _attestation() internal view returns (IProofOfView.ViewAttestation memory) {
        return IProofOfView.ViewAttestation({
            viewId: keccak256("view-1"),
            advertiser: advertiser,
            creator: creator,
            commitment: uint256(keccak256("commitment")),
            nullifier: uint256(keccak256("nullifier")),
            campaignId: 42,
            weight: 5e18,
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

    function _consume(IProofOfView.ViewAttestation memory a, bytes memory sig) internal returns (uint256) {
        vm.prank(splitter);
        return oracle.consume(a, sig, _emptyProof());
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testConstructorSetsOwner() public view {
        assertEq(oracle.owner(), owner);
    }

    /*//////////////////////////////////////////////////////////////
                              SETTER TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfNonOwnerSetsAttestor() public {
        vm.prank(advertiser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, advertiser));
        oracle.setAttestor(attestor);
    }

    function testRevertsIfAttestorSetToZero() public {
        vm.prank(owner);
        vm.expectRevert(ProofOfView.ProofOfView__ZeroAddress.selector);
        oracle.setAttestor(address(0));
    }

    function testRevertsIfNonOwnerSetsSplitter() public {
        vm.prank(advertiser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, advertiser));
        oracle.setSplitter(splitter);
    }

    function testRevertsIfSplitterSetToZero() public {
        vm.prank(owner);
        vm.expectRevert(ProofOfView.ProofOfView__ZeroAddress.selector);
        oracle.setSplitter(address(0));
    }

    function testSettersUpdateAndExposeAttestorAndSplitter() public {
        address newAttestor = makeAddr("newAttestor");
        address newSplitter = makeAddr("newSplitter");

        vm.expectEmit(true, false, false, false);
        emit AttestorUpdated(newAttestor);
        vm.prank(owner);
        oracle.setAttestor(newAttestor);

        vm.expectEmit(true, false, false, false);
        emit SplitterUpdated(newSplitter);
        vm.prank(owner);
        oracle.setSplitter(newSplitter);

        assertEq(oracle.getAttestor(), newAttestor);
        assertEq(oracle.getSplitter(), newSplitter);
    }

    /*//////////////////////////////////////////////////////////////
                              CONSUME TESTS
    //////////////////////////////////////////////////////////////*/

    function testConsumeVerifiesAndMarksConsumed() public {
        IProofOfView.ViewAttestation memory a = _attestation();
        bytes memory sig = _sign(a, attestorKey);

        vm.expectEmit(true, true, true, true);
        emit ViewConsumed(a.viewId, a.advertiser, a.creator, a.weight);
        uint256 weight = _consume(a, sig);

        assertEq(weight, a.weight);
        assertTrue(oracle.isConsumed(a.viewId));
    }

    function testRevertsIfNonSplitterConsumes() public {
        IProofOfView.ViewAttestation memory a = _attestation();
        bytes memory sig = _sign(a, attestorKey);
        vm.prank(advertiser);
        vm.expectRevert(ProofOfView.ProofOfView__NotSplitter.selector);
        oracle.consume(a, sig, _emptyProof());
    }

    function testRevertsIfViewReplayed() public {
        IProofOfView.ViewAttestation memory a = _attestation();
        bytes memory sig = _sign(a, attestorKey);
        _consume(a, sig);

        vm.prank(splitter);
        vm.expectRevert(abi.encodeWithSelector(ProofOfView.ProofOfView__AlreadyConsumed.selector, a.viewId));
        oracle.consume(a, sig, _emptyProof());
    }

    function testRevertsIfSignedByWrongAttestor() public {
        (, uint256 attackerKey) = makeAddrAndKey("attacker");
        IProofOfView.ViewAttestation memory a = _attestation();
        bytes memory sig = _sign(a, attackerKey);

        vm.prank(splitter);
        vm.expectRevert(ProofOfView.ProofOfView__InvalidAttestor.selector);
        oracle.consume(a, sig, _emptyProof());
    }

    function testRevertsIfAttestationFieldTampered() public {
        IProofOfView.ViewAttestation memory a = _attestation();
        bytes memory sig = _sign(a, attestorKey);
        // Inflate the weight after signing; the digest no longer matches so recovery fails.
        a.weight = 1000e18;

        vm.prank(splitter);
        vm.expectRevert(ProofOfView.ProofOfView__InvalidAttestor.selector);
        oracle.consume(a, sig, _emptyProof());
    }

    function testRevertsIfAttestationExpired() public {
        IProofOfView.ViewAttestation memory a = _attestation();
        bytes memory sig = _sign(a, attestorKey);
        vm.warp(uint256(a.deadline) + 1);

        vm.prank(splitter);
        vm.expectRevert(ProofOfView.ProofOfView__AttestationExpired.selector);
        oracle.consume(a, sig, _emptyProof());
    }

    function testRevertsIfViewIdZero() public {
        IProofOfView.ViewAttestation memory a = _attestation();
        a.viewId = bytes32(0);
        bytes memory sig = _sign(a, attestorKey);

        vm.prank(splitter);
        vm.expectRevert(ProofOfView.ProofOfView__InvalidViewId.selector);
        oracle.consume(a, sig, _emptyProof());
    }

    function testRevertsIfAdvertiserZero() public {
        IProofOfView.ViewAttestation memory a = _attestation();
        a.advertiser = address(0);
        bytes memory sig = _sign(a, attestorKey);

        vm.prank(splitter);
        vm.expectRevert(ProofOfView.ProofOfView__InvalidAdvertiser.selector);
        oracle.consume(a, sig, _emptyProof());
    }

    function testRevertsIfCreatorZero() public {
        IProofOfView.ViewAttestation memory a = _attestation();
        a.creator = address(0);
        bytes memory sig = _sign(a, attestorKey);

        vm.prank(splitter);
        vm.expectRevert(ProofOfView.ProofOfView__InvalidCreator.selector);
        oracle.consume(a, sig, _emptyProof());
    }

    function testRevertsIfWeightZero() public {
        IProofOfView.ViewAttestation memory a = _attestation();
        a.weight = 0;
        bytes memory sig = _sign(a, attestorKey);

        vm.prank(splitter);
        vm.expectRevert(ProofOfView.ProofOfView__WeightZero.selector);
        oracle.consume(a, sig, _emptyProof());
    }

    /*//////////////////////////////////////////////////////////////
                           PRIVACY GATE TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfNonOwnerSetsPrivacyVerifier() public {
        vm.prank(advertiser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, advertiser));
        oracle.setPrivacyVerifier(makeAddr("verifier"));
    }

    function testSetPrivacyVerifierUpdatesAndExposes() public {
        address verifier = address(new MockViewPrivacyVerifier());

        vm.expectEmit(true, false, false, false);
        emit PrivacyVerifierUpdated(verifier);
        vm.prank(owner);
        oracle.setPrivacyVerifier(verifier);

        assertEq(oracle.getPrivacyVerifier(), verifier);
    }

    function testConsumeWithPrivacyGateSpendsNullifier() public {
        MockViewPrivacyVerifier verifier = new MockViewPrivacyVerifier();
        vm.prank(owner);
        oracle.setPrivacyVerifier(address(verifier));

        IProofOfView.ViewAttestation memory a = _attestation();
        bytes memory sig = _sign(a, attestorKey);
        _consume(a, sig);

        assertTrue(oracle.isConsumed(a.viewId));
        assertTrue(oracle.isNullifierSpent(a.nullifier));
    }

    function testRevertsIfNullifierReused() public {
        MockViewPrivacyVerifier verifier = new MockViewPrivacyVerifier();
        vm.prank(owner);
        oracle.setPrivacyVerifier(address(verifier));

        IProofOfView.ViewAttestation memory a = _attestation();
        _consume(a, _sign(a, attestorKey));

        // A second genuine view from the same viewer in the same campaign and epoch reuses the nullifier, even though
        // the view id is fresh, so the sybil gate has to reject it.
        IProofOfView.ViewAttestation memory b = _attestation();
        b.viewId = keccak256("view-2");
        bytes memory sigB = _sign(b, attestorKey);

        vm.prank(splitter);
        vm.expectRevert(abi.encodeWithSelector(ProofOfView.ProofOfView__NullifierUsed.selector, b.nullifier));
        oracle.consume(b, sigB, _emptyProof());
    }

    function testRevertsIfProofInvalid() public {
        MockViewPrivacyVerifier verifier = new MockViewPrivacyVerifier();
        verifier.setResult(false);
        vm.prank(owner);
        oracle.setPrivacyVerifier(address(verifier));

        IProofOfView.ViewAttestation memory a = _attestation();
        bytes memory sig = _sign(a, attestorKey);

        vm.prank(splitter);
        vm.expectRevert(ProofOfView.ProofOfView__InvalidProof.selector);
        oracle.consume(a, sig, _emptyProof());
    }

    function testRejectedProofConsumesNothing() public {
        MockViewPrivacyVerifier verifier = new MockViewPrivacyVerifier();
        verifier.setResult(false);
        vm.prank(owner);
        oracle.setPrivacyVerifier(address(verifier));

        IProofOfView.ViewAttestation memory a = _attestation();
        bytes memory sig = _sign(a, attestorKey);

        vm.prank(splitter);
        vm.expectRevert(ProofOfView.ProofOfView__InvalidProof.selector);
        oracle.consume(a, sig, _emptyProof());

        // A reverted proof must leave nothing behind so the same view can still be paid once the proof is valid.
        assertFalse(oracle.isConsumed(a.viewId));
        assertFalse(oracle.isNullifierSpent(a.nullifier));
    }
}
