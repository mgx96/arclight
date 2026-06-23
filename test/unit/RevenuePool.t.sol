// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {RevenuePool} from "../../src/payments/RevenuePool.sol";
import {IRevenuePool} from "../../src/interfaces/IRevenuePool.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RevenuePoolTest is Test {
    RevenuePool internal pool;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal distributor = makeAddr("distributor");
    address internal adA = makeAddr("advertiserA");
    address internal adB = makeAddr("advertiserB");
    address internal creator = makeAddr("creator");

    uint256 internal constant FUND = 1000e6;

    event Deposited(address indexed advertiser, uint256 amount);
    event Withdrawn(address indexed advertiser, uint256 amount);
    event Spent(address indexed advertiser, address indexed recipient, uint256 amount);
    event DistributorUpdated(address indexed distributor);

    function setUp() public {
        usdc = new MockUSDC();
        vm.prank(owner);
        pool = new RevenuePool(address(usdc), owner);

        usdc.mint(adA, FUND);
        usdc.mint(adB, FUND);
    }

    modifier distributorSet() {
        vm.prank(owner);
        pool.setDistributor(distributor);
        _;
    }

    function _depositAs(address advertiser, uint256 amount) internal {
        vm.startPrank(advertiser);
        usdc.approve(address(pool), amount);
        pool.deposit(amount);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfConstructedWithZeroUsdc() public {
        vm.expectRevert(RevenuePool.RevenuePool__ZeroAddress.selector);
        new RevenuePool(address(0), owner);
    }

    function testConstructorSetsUsdcAndOwner() public view {
        assertEq(pool.getUsdc(), address(usdc));
        assertEq(pool.owner(), owner);
    }

    /*//////////////////////////////////////////////////////////////
                          SET DISTRIBUTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfNonOwnerSetsDistributor() public {
        vm.prank(adA);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, adA));
        pool.setDistributor(distributor);
    }

    function testRevertsIfDistributorSetToZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(RevenuePool.RevenuePool__ZeroAddress.selector);
        pool.setDistributor(address(0));
    }

    function testSetDistributorSetsAndEmits() public {
        vm.expectEmit(true, false, false, false);
        emit DistributorUpdated(distributor);
        vm.prank(owner);
        pool.setDistributor(distributor);
        assertEq(pool.getDistributor(), distributor);
    }

    /*//////////////////////////////////////////////////////////////
                              DEPOSIT TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfDepositZero() public {
        vm.prank(adA);
        vm.expectRevert(RevenuePool.RevenuePool__AmountZero.selector);
        pool.deposit(0);
    }

    function testRevertsIfDepositWithoutApproval() public {
        vm.prank(adA);
        vm.expectRevert();
        pool.deposit(FUND);
    }

    function testDepositCreditsBalanceAndEmits() public {
        vm.startPrank(adA);
        usdc.approve(address(pool), FUND);
        vm.expectEmit(true, false, false, true);
        emit Deposited(adA, FUND);
        pool.deposit(FUND);
        vm.stopPrank();

        assertEq(pool.getAdvertiserBalance(adA), FUND);
        assertEq(usdc.balanceOf(address(pool)), FUND);
    }

    /*//////////////////////////////////////////////////////////////
                            DEPOSIT FOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfDepositForZeroAdvertiser() public {
        vm.startPrank(adA);
        usdc.approve(address(pool), FUND);
        vm.expectRevert(RevenuePool.RevenuePool__ZeroAddress.selector);
        pool.depositFor(address(0), FUND);
        vm.stopPrank();
    }

    function testRevertsIfDepositForZeroAmount() public {
        vm.prank(adA);
        vm.expectRevert(RevenuePool.RevenuePool__AmountZero.selector);
        pool.depositFor(adB, 0);
    }

    function testDepositForCreditsNamedAdvertiserAndEmits() public {
        // adA pays, but the budget is credited to adB, which is exactly what the CCTP gateway does.
        vm.startPrank(adA);
        usdc.approve(address(pool), FUND);
        vm.expectEmit(true, false, false, true);
        emit Deposited(adB, FUND);
        pool.depositFor(adB, FUND);
        vm.stopPrank();

        assertEq(pool.getAdvertiserBalance(adB), FUND);
        assertEq(pool.getAdvertiserBalance(adA), 0);
        assertEq(usdc.balanceOf(address(pool)), FUND);
    }

    function testDepositForIsAdditive() public {
        _depositAs(adB, FUND);

        vm.startPrank(adA);
        usdc.approve(address(pool), FUND);
        pool.depositFor(adB, FUND);
        vm.stopPrank();

        assertEq(pool.getAdvertiserBalance(adB), 2 * FUND);
    }

    /*//////////////////////////////////////////////////////////////
                             WITHDRAW TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfWithdrawZero() public {
        vm.prank(adA);
        vm.expectRevert(RevenuePool.RevenuePool__AmountZero.selector);
        pool.withdraw(0);
    }

    function testRevertsIfWithdrawMoreThanBalance() public {
        _depositAs(adA, FUND);
        vm.prank(adA);
        vm.expectRevert(abi.encodeWithSelector(RevenuePool.RevenuePool__InsufficientBalance.selector, FUND, FUND + 1));
        pool.withdraw(FUND + 1);
    }

    function testWithdrawDebitsAndTransfers() public {
        _depositAs(adA, FUND);
        uint256 balBefore = usdc.balanceOf(adA);

        vm.expectEmit(true, false, false, true);
        emit Withdrawn(adA, 400e6);
        vm.prank(adA);
        pool.withdraw(400e6);

        assertEq(pool.getAdvertiserBalance(adA), 600e6);
        assertEq(usdc.balanceOf(adA), balBefore + 400e6);
    }

    /*//////////////////////////////////////////////////////////////
                               SPEND TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfNonDistributorSpends() public {
        _depositAs(adA, FUND);
        vm.prank(adA);
        vm.expectRevert(RevenuePool.RevenuePool__NotDistributor.selector);
        pool.spend(adA, creator, 100e6);
    }

    function testRevertsIfSpendZeroAmount() public distributorSet {
        _depositAs(adA, FUND);
        vm.prank(distributor);
        vm.expectRevert(RevenuePool.RevenuePool__AmountZero.selector);
        pool.spend(adA, creator, 0);
    }

    function testRevertsIfSpendToZeroRecipient() public distributorSet {
        _depositAs(adA, FUND);
        vm.prank(distributor);
        vm.expectRevert(RevenuePool.RevenuePool__ZeroAddress.selector);
        pool.spend(adA, address(0), 100e6);
    }

    function testRevertsIfSpendMoreThanBalance() public distributorSet {
        _depositAs(adA, 50e6);
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(RevenuePool.RevenuePool__InsufficientBalance.selector, 50e6, 100e6));
        pool.spend(adA, creator, 100e6);
    }

    function testSpendDebitsAndTransfersAndEmits() public distributorSet {
        _depositAs(adA, FUND);

        vm.expectEmit(true, true, false, true);
        emit Spent(adA, creator, 250e6);
        vm.prank(distributor);
        pool.spend(adA, creator, 250e6);

        assertEq(pool.getAdvertiserBalance(adA), FUND - 250e6);
        assertEq(usdc.balanceOf(creator), 250e6);
    }

    function testSpendKeepsAdvertisersIsolated() public distributorSet {
        _depositAs(adA, FUND);
        _depositAs(adB, FUND);

        // Draining adA's full budget must not touch adB's escrow.
        vm.prank(distributor);
        pool.spend(adA, creator, FUND);

        assertEq(pool.getAdvertiserBalance(adA), 0);
        assertEq(pool.getAdvertiserBalance(adB), FUND);

        // adB can still be spent independently.
        vm.prank(distributor);
        pool.spend(adB, creator, FUND);
        assertEq(pool.getAdvertiserBalance(adB), 0);
    }

    function testRevertsIfSpendCrossesAdvertiserBudgets() public distributorSet {
        _depositAs(adA, FUND);
        // adB never deposited, so spending its (empty) budget reverts even though the pool holds adA's tokens.
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(RevenuePool.RevenuePool__InsufficientBalance.selector, 0, 1));
        pool.spend(adB, creator, 1);
    }
}
