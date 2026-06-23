// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {AdvertiserAgentRegistry} from "../../src/agents/AdvertiserAgentRegistry.sol";
import {RevenuePool} from "../../src/payments/RevenuePool.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract AdvertiserAgentRegistryFuzzTest is Test {
    AdvertiserAgentRegistry internal registry;
    RevenuePool internal pool;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal advertiser = makeAddr("advertiser");
    address internal agent = makeAddr("agent");

    function setUp() public {
        usdc = new MockUSDC();
        vm.prank(owner);
        pool = new RevenuePool(address(usdc), owner);
        registry = new AdvertiserAgentRegistry(address(usdc), address(pool));

        usdc.mint(agent, type(uint128).max);
        vm.prank(agent);
        usdc.approve(address(registry), type(uint256).max);
    }

    function testFuzzAgentNeverSpendsAboveCap(uint256 cap, uint256 first, uint256 second) public {
        cap = bound(cap, 1, 1e24);
        first = bound(first, 1, 2e24);
        second = bound(second, 1, 2e24);

        vm.prank(advertiser);
        registry.setAgentCap(agent, cap);

        // First top up: it goes through only within the cap, otherwise it reverts and nothing is spent.
        vm.prank(agent);
        if (first > cap) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    AdvertiserAgentRegistry.AdvertiserAgentRegistry__CapExceeded.selector, cap, first
                )
            );
            registry.fundBudget(advertiser, first);
        } else {
            registry.fundBudget(advertiser, first);
        }

        // Second top up against whatever headroom remains.
        uint256 remaining = registry.getRemainingCap(advertiser, agent);
        vm.prank(agent);
        if (second > remaining) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    AdvertiserAgentRegistry.AdvertiserAgentRegistry__CapExceeded.selector, remaining, second
                )
            );
            registry.fundBudget(advertiser, second);
        } else {
            registry.fundBudget(advertiser, second);
        }

        // However the calls landed, total spend and the funded budget can never exceed the cap.
        uint256 spent = registry.getAgentSpent(advertiser, agent);
        assertLe(spent, cap);
        assertEq(pool.getAdvertiserBalance(advertiser), spent);
        assertEq(registry.getRemainingCap(advertiser, agent), cap - spent);
    }
}
