// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {RevenuePool} from "../../src/payments/RevenuePool.sol";
import {ProofOfView} from "../../src/oracle/ProofOfView.sol";
import {RevenueSplitter} from "../../src/payments/RevenueSplitter.sol";
import {IProofOfView} from "../../src/interfaces/IProofOfView.sol";
import {IViewPrivacyVerifier} from "../../src/interfaces/IViewPrivacyVerifier.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract RevenueSplitterTest is Test {
    RevenuePool internal pool;
    ProofOfView internal oracle;
    RevenueSplitter internal splitter;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal advertiser = makeAddr("advertiser");
    address internal creator = makeAddr("creator");
    address internal payee1 = makeAddr("payee1");
    address internal payee2 = makeAddr("payee2");
    address internal payee3 = makeAddr("payee3");

    address internal attestor;
    uint256 internal attestorKey;

    uint256 internal constant FUND = 1000e6;
    uint256 internal constant PRECISION = 1e18;
    // 1 USDC (1e6) per 1 unit of weight (1e18).
    uint256 internal constant RATE = 1e6;

    event Distributed(bytes32 indexed viewId, address indexed advertiser, address indexed creator, uint256 amount);

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

        usdc.mint(advertiser, FUND);
        vm.startPrank(advertiser);
        usdc.approve(address(pool), FUND);
        pool.deposit(FUND);
        splitter.setRate(RATE);
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

    function _setSplit(uint16 s1, uint16 s2, uint16 s3) internal {
        address[] memory accounts = new address[](3);
        accounts[0] = payee1;
        accounts[1] = payee2;
        accounts[2] = payee3;
        uint16[] memory shares = new uint16[](3);
        shares[0] = s1;
        shares[1] = s2;
        shares[2] = s3;
        vm.prank(creator);
        splitter.setSplit(accounts, shares);
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfConstructedWithZeroPool() public {
        vm.expectRevert(RevenueSplitter.RevenueSplitter__ZeroAddress.selector);
        new RevenueSplitter(address(0), address(oracle));
    }

    function testRevertsIfConstructedWithZeroOracle() public {
        vm.expectRevert(RevenueSplitter.RevenueSplitter__ZeroAddress.selector);
        new RevenueSplitter(address(pool), address(0));
    }

    function testConstructorWiresPoolAndOracle() public view {
        assertEq(splitter.getPool(), address(pool));
        assertEq(splitter.getOracle(), address(oracle));
    }

    /*//////////////////////////////////////////////////////////////
                             SET RATE TESTS
    //////////////////////////////////////////////////////////////*/

    function testSetRateUpdatesRate() public {
        vm.prank(advertiser);
        splitter.setRate(2e6);
        assertEq(splitter.getRatePerWeight(advertiser), 2e6);
    }

    /*//////////////////////////////////////////////////////////////
                            SET SPLIT TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfSplitLengthMismatch() public {
        address[] memory accounts = new address[](2);
        accounts[0] = payee1;
        accounts[1] = payee2;
        uint16[] memory shares = new uint16[](1);
        shares[0] = 10_000;
        vm.prank(creator);
        vm.expectRevert(RevenueSplitter.RevenueSplitter__LengthMismatch.selector);
        splitter.setSplit(accounts, shares);
    }

    function testRevertsIfSplitEmpty() public {
        address[] memory accounts = new address[](0);
        uint16[] memory shares = new uint16[](0);
        vm.prank(creator);
        vm.expectRevert(RevenueSplitter.RevenueSplitter__EmptySplit.selector);
        splitter.setSplit(accounts, shares);
    }

    function testRevertsIfTooManyPayees() public {
        uint256 n = 21;
        address[] memory accounts = new address[](n);
        uint16[] memory shares = new uint16[](n);
        for (uint256 i = 0; i < n; i++) {
            accounts[i] = address(uint160(i + 1));
            shares[i] = 1;
        }
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(RevenueSplitter.RevenueSplitter__TooManyPayees.selector, n, 20));
        splitter.setSplit(accounts, shares);
    }

    function testRevertsIfPayeeIsZeroAddress() public {
        address[] memory accounts = new address[](2);
        accounts[0] = payee1;
        accounts[1] = address(0);
        uint16[] memory shares = new uint16[](2);
        shares[0] = 5000;
        shares[1] = 5000;
        vm.prank(creator);
        vm.expectRevert(RevenueSplitter.RevenueSplitter__ZeroAddress.selector);
        splitter.setSplit(accounts, shares);
    }

    function testRevertsIfShareIsZero() public {
        address[] memory accounts = new address[](2);
        accounts[0] = payee1;
        accounts[1] = payee2;
        uint16[] memory shares = new uint16[](2);
        shares[0] = 10_000;
        shares[1] = 0;
        vm.prank(creator);
        vm.expectRevert(RevenueSplitter.RevenueSplitter__ZeroShare.selector);
        splitter.setSplit(accounts, shares);
    }

    function testRevertsIfSharesDoNotSumToFull() public {
        address[] memory accounts = new address[](2);
        accounts[0] = payee1;
        accounts[1] = payee2;
        uint16[] memory shares = new uint16[](2);
        shares[0] = 5000;
        shares[1] = 4000;
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(RevenueSplitter.RevenueSplitter__SharesNotFull.selector, 9000));
        splitter.setSplit(accounts, shares);
    }

    function testRemoveSplitRevertsToDirectPayout() public {
        address[] memory accounts = new address[](1);
        accounts[0] = payee1;
        uint16[] memory shares = new uint16[](1);
        shares[0] = 10_000;
        vm.startPrank(creator);
        splitter.setSplit(accounts, shares);
        splitter.removeSplit();
        vm.stopPrank();

        assertEq(splitter.getSplit(creator).length, 0);

        IProofOfView.ViewAttestation memory a = _attestation(keccak256("v1"), 5e18);
        bytes memory sig = _sign(a);
        splitter.distribute(a, sig, _emptyProof());
        assertEq(usdc.balanceOf(creator), 5e6);
        assertEq(usdc.balanceOf(payee1), 0);
    }

    /*//////////////////////////////////////////////////////////////
                            DISTRIBUTE TESTS
    //////////////////////////////////////////////////////////////*/

    function testDistributePaysCreatorDirectly() public {
        IProofOfView.ViewAttestation memory a = _attestation(keccak256("v1"), 5e18);
        bytes memory sig = _sign(a);

        vm.expectEmit(true, true, true, true);
        emit Distributed(a.viewId, advertiser, creator, 5e6);
        splitter.distribute(a, sig, _emptyProof());

        assertEq(usdc.balanceOf(creator), 5e6);
        assertEq(pool.getAdvertiserBalance(advertiser), FUND - 5e6);
        assertTrue(oracle.isConsumed(a.viewId));
    }

    function testDistributeIsPermissionless() public {
        IProofOfView.ViewAttestation memory a = _attestation(keccak256("v1"), 5e18);
        bytes memory sig = _sign(a);
        // Any relayer (eg an advertiser agent) can submit a valid attestation.
        vm.prank(makeAddr("randomRelayer"));
        splitter.distribute(a, sig, _emptyProof());
        assertEq(usdc.balanceOf(creator), 5e6);
    }

    function testDistributeAcrossSplit() public {
        _setSplit(5000, 3000, 2000);

        IProofOfView.ViewAttestation memory a = _attestation(keccak256("v1"), 100e18);
        bytes memory sig = _sign(a);
        splitter.distribute(a, sig, _emptyProof());

        // 100 weight * 1 USDC = 100e6 total split 50/30/20.
        assertEq(usdc.balanceOf(payee1), 50e6);
        assertEq(usdc.balanceOf(payee2), 30e6);
        assertEq(usdc.balanceOf(payee3), 20e6);
        assertEq(usdc.balanceOf(creator), 0);
    }

    function testDistributeGivesSplitDustToLastPayee() public {
        _setSplit(3333, 3333, 3334);

        // 1 weight => 1e6 USDC, which does not divide cleanly by the bps.
        IProofOfView.ViewAttestation memory a = _attestation(keccak256("v1"), 1e18);
        bytes memory sig = _sign(a);
        splitter.distribute(a, sig, _emptyProof());

        uint256 total = usdc.balanceOf(payee1) + usdc.balanceOf(payee2) + usdc.balanceOf(payee3);
        assertEq(total, 1e6);
        // first two floor, remainder lands on the last payee.
        assertEq(usdc.balanceOf(payee1), 333_300);
        assertEq(usdc.balanceOf(payee2), 333_300);
        assertEq(usdc.balanceOf(payee3), 1e6 - 333_300 - 333_300);
    }

    function testRevertsIfViewReplayed() public {
        IProofOfView.ViewAttestation memory a = _attestation(keccak256("v1"), 5e18);
        bytes memory sig = _sign(a);
        splitter.distribute(a, sig, _emptyProof());

        vm.expectRevert(abi.encodeWithSelector(ProofOfView.ProofOfView__AlreadyConsumed.selector, a.viewId));
        splitter.distribute(a, sig, _emptyProof());
    }

    function testRevertsIfRateNotSet() public {
        address ad2 = makeAddr("advertiser2");
        IProofOfView.ViewAttestation memory a = _attestation(keccak256("v1"), 5e18);
        a.advertiser = ad2;
        bytes memory sig = _sign(a);

        vm.expectRevert(RevenueSplitter.RevenueSplitter__RateNotSet.selector);
        splitter.distribute(a, sig, _emptyProof());
    }

    function testRevertsIfPayoutRoundsToZero() public {
        // weight so small that weight * RATE / PRECISION truncates to 0.
        IProofOfView.ViewAttestation memory a = _attestation(keccak256("v1"), 1);
        bytes memory sig = _sign(a);
        vm.expectRevert(RevenueSplitter.RevenueSplitter__PayoutZero.selector);
        splitter.distribute(a, sig, _emptyProof());
    }

    function testRevertsIfPoolUnderfunded() public {
        // weight => 2000 USDC owed but advertiser only escrowed 1000.
        IProofOfView.ViewAttestation memory a = _attestation(keccak256("v1"), 2000e18);
        bytes memory sig = _sign(a);
        vm.expectRevert(
            abi.encodeWithSelector(RevenueSplitter.RevenueSplitter__InsufficientPoolBalance.selector, FUND, 2000e6)
        );
        splitter.distribute(a, sig, _emptyProof());
    }
}
