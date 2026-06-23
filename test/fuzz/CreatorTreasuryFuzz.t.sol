// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {CreatorTreasury} from "../../src/treasury/CreatorTreasury.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {MockUsyc} from "../mocks/MockUsyc.sol";
import {MockUsycTeller} from "../mocks/MockUsycTeller.sol";

contract CreatorTreasuryFuzzTest is Test {
    CreatorTreasury internal treasury;
    MockUSDC internal usdc;
    MockUsyc internal usyc;
    MockUsycTeller internal teller;

    function setUp() public {
        usdc = new MockUSDC();
        usyc = new MockUsyc();
        teller = new MockUsycTeller(usdc, usyc);
        treasury = new CreatorTreasury(address(usdc), address(usyc), address(teller));
    }

    function testFuzzDepositThenWithdrawAtParIsWhole(address creator, uint256 amount) public {
        vm.assume(creator != address(0) && creator != address(treasury) && creator != address(teller));
        amount = bound(amount, 1, 1e18);

        usdc.mint(creator, amount);
        vm.startPrank(creator);
        usdc.approve(address(treasury), amount);
        uint256 minted = treasury.deposit(amount, 1);
        // At par a full round trip returns exactly what went in, the treasury keeps nothing.
        uint256 out = treasury.withdraw(minted, 1);
        vm.stopPrank();

        assertEq(out, amount);
        assertEq(usdc.balanceOf(creator), amount);
        assertEq(treasury.getUsycBalance(creator), 0);
        assertEq(usyc.balanceOf(address(treasury)), 0);
    }

    function testFuzzYieldAccruesToHolder(address creator, uint256 amount, uint256 priceE6) public {
        vm.assume(creator != address(0) && creator != address(treasury) && creator != address(teller));
        amount = bound(amount, 1e6, 1e18);
        // A non decreasing price models USYC accruing yield, never losing principal.
        priceE6 = bound(priceE6, 1e6, 100e6);

        usdc.mint(creator, amount);
        vm.startPrank(creator);
        usdc.approve(address(treasury), amount);
        uint256 minted = treasury.deposit(amount, 1);
        vm.stopPrank();

        teller.setPriceE6(priceE6);

        vm.prank(creator);
        uint256 out = treasury.withdraw(minted, 1);

        // Redeeming after appreciation never returns less than was deposited.
        assertGe(out, amount);
    }
}
