// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {AdvertiserAgentRegistry} from "../../src/agents/AdvertiserAgentRegistry.sol";
import {RevenuePool} from "../../src/payments/RevenuePool.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract AdvertiserAgentRegistryTest is Test {
    AdvertiserAgentRegistry internal registry;
    RevenuePool internal pool;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal advertiser = makeAddr("advertiser");
    address internal agent = makeAddr("agent");
    address internal rogue = makeAddr("rogue");

    uint256 internal constant CAP = 1000e6;

    event AgentCapSet(address indexed advertiser, address indexed agent, uint256 cap);
    event AgentFunded(address indexed advertiser, address indexed agent, uint256 amount);

    function setUp() public {
        usdc = new MockUSDC();
        vm.prank(owner);
        pool = new RevenuePool(address(usdc), owner);
        registry = new AdvertiserAgentRegistry(address(usdc), address(pool));

        usdc.mint(agent, 10_000e6);
        usdc.mint(rogue, 10_000e6);
        vm.prank(agent);
        usdc.approve(address(registry), type(uint256).max);
        vm.prank(rogue);
        usdc.approve(address(registry), type(uint256).max);
    }

    function _authorize(address theAgent, uint256 cap) internal {
        vm.prank(advertiser);
        registry.setAgentCap(theAgent, cap);
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfConstructedWithZeroUsdc() public {
        vm.expectRevert(AdvertiserAgentRegistry.AdvertiserAgentRegistry__ZeroAddress.selector);
        new AdvertiserAgentRegistry(address(0), address(pool));
    }

    function testRevertsIfConstructedWithZeroPool() public {
        vm.expectRevert(AdvertiserAgentRegistry.AdvertiserAgentRegistry__ZeroAddress.selector);
        new AdvertiserAgentRegistry(address(usdc), address(0));
    }

    function testConstructorWiresDependencies() public view {
        assertEq(registry.getUsdc(), address(usdc));
        assertEq(registry.getPool(), address(pool));
    }

    /*//////////////////////////////////////////////////////////////
                            SET AGENT CAP TESTS
    //////////////////////////////////////////////////////////////*/

    function testSetAgentCapStoresAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit AgentCapSet(advertiser, agent, CAP);
        vm.prank(advertiser);
        registry.setAgentCap(agent, CAP);

        assertEq(registry.getAgentCap(advertiser, agent), CAP);
        assertEq(registry.getRemainingCap(advertiser, agent), CAP);
    }

    function testRevertsIfSetCapForZeroAgent() public {
        vm.prank(advertiser);
        vm.expectRevert(AdvertiserAgentRegistry.AdvertiserAgentRegistry__ZeroAddress.selector);
        registry.setAgentCap(address(0), CAP);
    }

    function testCapsAreScopedToTheSettingAdvertiser() public {
        // A different advertiser authorizing the same agent does not grant headroom against our budget.
        _authorize(agent, CAP);
        assertEq(registry.getRemainingCap(makeAddr("otherAdvertiser"), agent), 0);
    }

    /*//////////////////////////////////////////////////////////////
                            FUND BUDGET TESTS
    //////////////////////////////////////////////////////////////*/

    function testFundBudgetCreditsPoolAndDecrementsCap() public {
        _authorize(agent, CAP);

        vm.expectEmit(true, true, false, true);
        emit AgentFunded(advertiser, agent, 400e6);
        vm.prank(agent);
        registry.fundBudget(advertiser, 400e6);

        assertEq(pool.getAdvertiserBalance(advertiser), 400e6);
        assertEq(usdc.balanceOf(address(pool)), 400e6);
        assertEq(registry.getAgentSpent(advertiser, agent), 400e6);
        assertEq(registry.getRemainingCap(advertiser, agent), 600e6);
        // The registry never retains USDC.
        assertEq(usdc.balanceOf(address(registry)), 0);
    }

    function testFundBudgetCanBeCalledUpToTheCap() public {
        _authorize(agent, CAP);

        vm.startPrank(agent);
        registry.fundBudget(advertiser, 600e6);
        registry.fundBudget(advertiser, 400e6);
        vm.stopPrank();

        assertEq(pool.getAdvertiserBalance(advertiser), CAP);
        assertEq(registry.getRemainingCap(advertiser, agent), 0);
    }

    function testRevertsIfAgentFundsZero() public {
        _authorize(agent, CAP);
        vm.prank(agent);
        vm.expectRevert(AdvertiserAgentRegistry.AdvertiserAgentRegistry__AmountZero.selector);
        registry.fundBudget(advertiser, 0);
    }

    function testRevertsIfFundForZeroAdvertiser() public {
        vm.prank(agent);
        vm.expectRevert(AdvertiserAgentRegistry.AdvertiserAgentRegistry__ZeroAddress.selector);
        registry.fundBudget(address(0), 100e6);
    }

    function testRevertsIfUnauthorizedAgentFunds() public {
        // The rogue was never granted a cap, so its remaining headroom is zero.
        vm.prank(rogue);
        vm.expectRevert(
            abi.encodeWithSelector(AdvertiserAgentRegistry.AdvertiserAgentRegistry__CapExceeded.selector, 0, 100e6)
        );
        registry.fundBudget(advertiser, 100e6);
    }

    function testRevertsIfFundExceedsCap() public {
        _authorize(agent, CAP);
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(AdvertiserAgentRegistry.AdvertiserAgentRegistry__CapExceeded.selector, CAP, CAP + 1)
        );
        registry.fundBudget(advertiser, CAP + 1);
    }

    function testRevertsIfFundExceedsRemainingAfterPriorSpend() public {
        _authorize(agent, CAP);
        vm.prank(agent);
        registry.fundBudget(advertiser, 700e6);

        // Only 300e6 of headroom is left, so a 400e6 top up reverts.
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(AdvertiserAgentRegistry.AdvertiserAgentRegistry__CapExceeded.selector, 300e6, 400e6)
        );
        registry.fundBudget(advertiser, 400e6);
    }

    function testRevokingCapBlocksFurtherFunding() public {
        _authorize(agent, CAP);
        vm.prank(agent);
        registry.fundBudget(advertiser, 200e6);

        // The advertiser revokes the agent by setting the cap to zero.
        _authorize(agent, 0);
        assertEq(registry.getRemainingCap(advertiser, agent), 0);

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(AdvertiserAgentRegistry.AdvertiserAgentRegistry__CapExceeded.selector, 0, 1)
        );
        registry.fundBudget(advertiser, 1);
    }

    function testRaisingCapGrantsMoreHeadroom() public {
        _authorize(agent, CAP);
        vm.prank(agent);
        registry.fundBudget(advertiser, CAP);
        assertEq(registry.getRemainingCap(advertiser, agent), 0);

        // The advertiser raises the lifetime cap, which reopens headroom against the prior spend.
        _authorize(agent, CAP + 500e6);
        assertEq(registry.getRemainingCap(advertiser, agent), 500e6);

        vm.prank(agent);
        registry.fundBudget(advertiser, 500e6);
        assertEq(pool.getAdvertiserBalance(advertiser), CAP + 500e6);
    }

    function testAgentsAreTrackedIndependently() public {
        address agentB = makeAddr("agentB");
        usdc.mint(agentB, 10_000e6);
        vm.prank(agentB);
        usdc.approve(address(registry), type(uint256).max);

        _authorize(agent, CAP);
        _authorize(agentB, 200e6);

        vm.prank(agent);
        registry.fundBudget(advertiser, 800e6);
        vm.prank(agentB);
        registry.fundBudget(advertiser, 200e6);

        assertEq(registry.getRemainingCap(advertiser, agent), 200e6);
        assertEq(registry.getRemainingCap(advertiser, agentB), 0);
        assertEq(pool.getAdvertiserBalance(advertiser), 1000e6);
    }
}
