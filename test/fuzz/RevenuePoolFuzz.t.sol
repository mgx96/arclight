// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {RevenuePool} from "../../src/payments/RevenuePool.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract RevenuePoolFuzzTest is Test {
    RevenuePool internal pool;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal distributor = makeAddr("distributor");
    address internal advertiser = makeAddr("advertiser");
    address internal creator = makeAddr("creator");

    uint256 internal constant MAX = 1e30;

    function setUp() public {
        usdc = new MockUSDC();
        vm.prank(owner);
        pool = new RevenuePool(address(usdc), owner);
        vm.prank(owner);
        pool.setDistributor(distributor);
    }

    function _deposit(uint256 amount) internal {
        usdc.mint(advertiser, amount);
        vm.startPrank(advertiser);
        usdc.approve(address(pool), amount);
        pool.deposit(amount);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                               FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzzDepositCreditsExactAmount(uint256 amount) public {
        amount = bound(amount, 1, MAX);
        _deposit(amount);
        assertEq(pool.getAdvertiserBalance(advertiser), amount);
        assertEq(usdc.balanceOf(address(pool)), amount);
    }

    function testFuzzWithdrawNeverExceedsDeposit(uint256 depositAmount, uint256 withdrawAmount) public {
        depositAmount = bound(depositAmount, 1, MAX);
        _deposit(depositAmount);

        withdrawAmount = bound(withdrawAmount, 1, depositAmount);
        vm.prank(advertiser);
        pool.withdraw(withdrawAmount);

        assertEq(pool.getAdvertiserBalance(advertiser), depositAmount - withdrawAmount);
        assertEq(usdc.balanceOf(advertiser), withdrawAmount);
    }

    function testFuzzWithdrawAboveBalanceReverts(uint256 depositAmount, uint256 excess) public {
        depositAmount = bound(depositAmount, 1, MAX);
        _deposit(depositAmount);

        excess = bound(excess, 1, MAX);
        uint256 withdrawAmount = depositAmount + excess;
        vm.prank(advertiser);
        vm.expectRevert(
            abi.encodeWithSelector(RevenuePool.RevenuePool__InsufficientBalance.selector, depositAmount, withdrawAmount)
        );
        pool.withdraw(withdrawAmount);
    }

    function testFuzzSpendNeverExceedsBalance(uint256 depositAmount, uint256 spendAmount) public {
        depositAmount = bound(depositAmount, 1, MAX);
        _deposit(depositAmount);

        spendAmount = bound(spendAmount, 1, depositAmount);
        vm.prank(distributor);
        pool.spend(advertiser, creator, spendAmount);

        assertEq(pool.getAdvertiserBalance(advertiser), depositAmount - spendAmount);
        assertEq(usdc.balanceOf(creator), spendAmount);
        // The pool can never pay out more than it still holds.
        assertEq(usdc.balanceOf(address(pool)), pool.getAdvertiserBalance(advertiser));
    }

    function testFuzzDepositWithdrawRoundTripsToZero(uint256 amount) public {
        amount = bound(amount, 1, MAX);
        _deposit(amount);
        vm.prank(advertiser);
        pool.withdraw(amount);
        assertEq(pool.getAdvertiserBalance(advertiser), 0);
        assertEq(usdc.balanceOf(address(pool)), 0);
        assertEq(usdc.balanceOf(advertiser), amount);
    }
}
