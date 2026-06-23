// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {RevenuePool} from "../../src/payments/RevenuePool.sol";
import {ProofOfView} from "../../src/oracle/ProofOfView.sol";
import {RevenueSplitter} from "../../src/payments/RevenueSplitter.sol";
import {IProofOfView} from "../../src/interfaces/IProofOfView.sol";
import {IViewPrivacyVerifier} from "../../src/interfaces/IViewPrivacyVerifier.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract RevenueSplitterFuzzTest is Test {
    RevenuePool internal pool;
    ProofOfView internal oracle;
    RevenueSplitter internal splitter;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal advertiser = makeAddr("advertiser");
    address internal creator = makeAddr("creator");

    address internal attestor;
    uint256 internal attestorKey;

    uint256 internal constant PRECISION = 1e18;

    function setUp() public {
        (attestor, attestorKey) = makeAddrAndKey("attestor");
        usdc = new MockUSDC();

        vm.startPrank(owner);
        pool = new RevenuePool(address(usdc), owner);
        oracle = new ProofOfView(owner);
        splitter = new RevenueSplitter(address(pool), address(oracle));
        pool.setDistributor(address(splitter));
        oracle.setAttestor(attestor);
        oracle.setSplitter(address(splitter));
        vm.stopPrank();
    }

    function _fund(uint256 amount) internal {
        usdc.mint(advertiser, amount);
        vm.startPrank(advertiser);
        usdc.approve(address(pool), amount);
        pool.deposit(amount);
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

    function _sign(IProofOfView.ViewAttestation memory a) internal view returns (bytes memory) {
        bytes32 digest = oracle.getAttestationDigest(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorKey, digest);
        return abi.encodePacked(r, s, v);
    }

    /*//////////////////////////////////////////////////////////////
                               FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzzPayoutMatchesRate(uint256 weight, uint256 rate) public {
        weight = bound(weight, 1, 1e30);
        rate = bound(rate, 1, 1e18);
        uint256 expected = (weight * rate) / PRECISION;
        vm.assume(expected > 0);

        _fund(expected);
        vm.prank(advertiser);
        splitter.setRate(rate);

        IProofOfView.ViewAttestation memory a = _attestation(keccak256("fuzz"), weight);
        splitter.distribute(a, _sign(a), _emptyProof());

        assertEq(usdc.balanceOf(creator), expected);
        assertEq(pool.getAdvertiserBalance(advertiser), 0);
    }

    function testFuzzUnderfundedAlwaysReverts(uint256 weight, uint256 rate, uint256 shortfall) public {
        weight = bound(weight, 1, 1e30);
        rate = bound(rate, 1, 1e18);
        uint256 owed = (weight * rate) / PRECISION;
        vm.assume(owed > 1);

        // Fund strictly less than what the view owes.
        shortfall = bound(shortfall, 1, owed - 1);
        uint256 funded = owed - shortfall;
        _fund(funded);
        vm.prank(advertiser);
        splitter.setRate(rate);

        IProofOfView.ViewAttestation memory a = _attestation(keccak256("fuzz"), weight);
        bytes memory sig = _sign(a);
        vm.expectRevert(
            abi.encodeWithSelector(RevenueSplitter.RevenueSplitter__InsufficientPoolBalance.selector, funded, owed)
        );
        splitter.distribute(a, sig, _emptyProof());
    }

    function testFuzzSplitConservesTotalPayout(uint256 weight, uint16 share1) public {
        // Two payees whose shares always sum to 10000, so the whole payout is conserved.
        share1 = uint16(bound(share1, 1, 9999));
        uint16 share2 = uint16(10_000 - share1);

        weight = bound(weight, 1e18, 1e30);
        uint256 rate = 1e6;
        uint256 expected = (weight * rate) / PRECISION;
        vm.assume(expected > 0);

        _fund(expected);
        vm.prank(advertiser);
        splitter.setRate(rate);

        address payee1 = makeAddr("payee1");
        address payee2 = makeAddr("payee2");
        address[] memory accounts = new address[](2);
        accounts[0] = payee1;
        accounts[1] = payee2;
        uint16[] memory shares = new uint16[](2);
        shares[0] = share1;
        shares[1] = share2;
        vm.prank(creator);
        splitter.setSplit(accounts, shares);

        IProofOfView.ViewAttestation memory a = _attestation(keccak256("fuzz"), weight);
        splitter.distribute(a, _sign(a), _emptyProof());

        // No dust is lost or minted: the payees together receive exactly the payout.
        assertEq(usdc.balanceOf(payee1) + usdc.balanceOf(payee2), expected);
        assertEq(usdc.balanceOf(creator), 0);
        assertEq(pool.getAdvertiserBalance(advertiser), 0);
    }
}
