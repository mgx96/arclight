// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {CreatorTreasury} from "../../src/treasury/CreatorTreasury.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {MockUsyc} from "../mocks/MockUsyc.sol";
import {MockUsycTeller} from "../mocks/MockUsycTeller.sol";

contract CreatorTreasuryTest is Test {
    CreatorTreasury internal treasury;
    MockUSDC internal usdc;
    MockUsyc internal usyc;
    MockUsycTeller internal teller;

    address internal creatorA = makeAddr("creatorA");
    address internal creatorB = makeAddr("creatorB");
    address internal agent = makeAddr("agent");

    uint256 internal constant FUND = 1000e6;

    event Deposited(address indexed creator, uint256 usdcIn, uint256 usycMinted);
    event Withdrawn(address indexed creator, uint256 usycBurned, uint256 usdcOut);

    function setUp() public {
        usdc = new MockUSDC();
        usyc = new MockUsyc();
        teller = new MockUsycTeller(usdc, usyc);
        treasury = new CreatorTreasury(address(usdc), address(usyc), address(teller));

        usdc.mint(creatorA, FUND);
        usdc.mint(creatorB, FUND);
        usdc.mint(agent, FUND);
    }

    function _depositAs(address payer, address creator, uint256 amount) internal returns (uint256 usycMinted) {
        vm.startPrank(payer);
        usdc.approve(address(treasury), amount);
        if (payer == creator) {
            usycMinted = treasury.deposit(amount, 1);
        } else {
            usycMinted = treasury.depositFor(creator, amount, 1);
        }
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfConstructedWithZeroUsdc() public {
        vm.expectRevert(CreatorTreasury.CreatorTreasury__ZeroAddress.selector);
        new CreatorTreasury(address(0), address(usyc), address(teller));
    }

    function testRevertsIfConstructedWithZeroUsyc() public {
        vm.expectRevert(CreatorTreasury.CreatorTreasury__ZeroAddress.selector);
        new CreatorTreasury(address(usdc), address(0), address(teller));
    }

    function testRevertsIfConstructedWithZeroTeller() public {
        vm.expectRevert(CreatorTreasury.CreatorTreasury__ZeroAddress.selector);
        new CreatorTreasury(address(usdc), address(usyc), address(0));
    }

    function testConstructorWiresDependencies() public view {
        assertEq(treasury.getUsdc(), address(usdc));
        assertEq(treasury.getUsyc(), address(usyc));
        assertEq(treasury.getTeller(), address(teller));
    }

    /*//////////////////////////////////////////////////////////////
                              DEPOSIT TESTS
    //////////////////////////////////////////////////////////////*/

    function testDepositBuysUsycAndCreditsCreator() public {
        vm.startPrank(creatorA);
        usdc.approve(address(treasury), FUND);
        vm.expectEmit(true, false, false, true);
        emit Deposited(creatorA, FUND, FUND); // at par, 1 USDC buys 1 USYC
        uint256 minted = treasury.deposit(FUND, 1);
        vm.stopPrank();

        assertEq(minted, FUND);
        assertEq(treasury.getUsycBalance(creatorA), FUND);
        assertEq(usyc.balanceOf(address(treasury)), FUND);
        assertEq(usdc.balanceOf(creatorA), 0);
    }

    function testDepositMintsLessUsycAbovePar() public {
        // At a 1.25 price, 1000 USDC buys 800 USYC, but that USYC is worth more on the way out.
        teller.setPriceE6(1.25e6);
        uint256 minted = _depositAs(creatorA, creatorA, FUND);
        assertEq(minted, 800e6);
        assertEq(treasury.getUsycBalance(creatorA), 800e6);
    }

    function testRevertsIfDepositZeroAmount() public {
        vm.prank(creatorA);
        vm.expectRevert(CreatorTreasury.CreatorTreasury__AmountZero.selector);
        treasury.deposit(0, 1);
    }

    function testRevertsIfDepositZeroMinOut() public {
        vm.prank(creatorA);
        vm.expectRevert(CreatorTreasury.CreatorTreasury__AmountZero.selector);
        treasury.deposit(FUND, 0);
    }

    function testRevertsIfDepositMintsBelowMinOut() public {
        // The price moved against the depositor so the buy yields less USYC than they demanded.
        teller.setPriceE6(2e6); // 1000 USDC buys only 500 USYC
        vm.startPrank(creatorA);
        usdc.approve(address(treasury), FUND);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorTreasury.CreatorTreasury__InsufficientUsycMinted.selector, 500e6, 600e6)
        );
        treasury.deposit(FUND, 600e6);
        vm.stopPrank();
    }

    function testRevertsIfDepositForZeroCreator() public {
        vm.startPrank(agent);
        usdc.approve(address(treasury), FUND);
        vm.expectRevert(CreatorTreasury.CreatorTreasury__ZeroAddress.selector);
        treasury.depositFor(address(0), FUND, 1);
        vm.stopPrank();
    }

    function testDepositForCreditsNamedCreator() public {
        // An agent funds the creator's treasury, the USYC is credited to the creator, not the agent.
        uint256 minted = _depositAs(agent, creatorA, FUND);

        assertEq(treasury.getUsycBalance(creatorA), minted);
        assertEq(treasury.getUsycBalance(agent), 0);
        assertEq(usdc.balanceOf(agent), 0);
    }

    /*//////////////////////////////////////////////////////////////
                             WITHDRAW TESTS
    //////////////////////////////////////////////////////////////*/

    function testWithdrawRedeemsUsycForUsdc() public {
        _depositAs(creatorA, creatorA, FUND);

        vm.expectEmit(true, false, false, true);
        emit Withdrawn(creatorA, FUND, FUND);
        vm.prank(creatorA);
        uint256 out = treasury.withdraw(FUND, FUND);

        assertEq(out, FUND);
        assertEq(treasury.getUsycBalance(creatorA), 0);
        assertEq(usdc.balanceOf(creatorA), FUND);
        assertEq(usyc.balanceOf(address(treasury)), 0);
    }

    function testWithdrawCapturesYield() public {
        // Deposit at par, the fund appreciates 10 percent, then redeem for more USDC than was put in.
        _depositAs(creatorA, creatorA, FUND);
        teller.setPriceE6(1.1e6);

        vm.prank(creatorA);
        uint256 out = treasury.withdraw(FUND, FUND);

        assertEq(out, 1100e6);
        assertEq(usdc.balanceOf(creatorA), 1100e6);
    }

    function testPartialWithdrawLeavesRemainder() public {
        _depositAs(creatorA, creatorA, FUND);

        vm.prank(creatorA);
        treasury.withdraw(400e6, 400e6);

        assertEq(treasury.getUsycBalance(creatorA), 600e6);
        assertEq(usdc.balanceOf(creatorA), 400e6);
    }

    function testRevertsIfWithdrawZero() public {
        vm.prank(creatorA);
        vm.expectRevert(CreatorTreasury.CreatorTreasury__AmountZero.selector);
        treasury.withdraw(0, 1);
    }

    function testRevertsIfWithdrawMoreThanBalance() public {
        _depositAs(creatorA, creatorA, FUND);
        vm.prank(creatorA);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorTreasury.CreatorTreasury__InsufficientBalance.selector, FUND, FUND + 1)
        );
        treasury.withdraw(FUND + 1, 1);
    }

    function testRevertsIfWithdrawRedeemsBelowMinOut() public {
        _depositAs(creatorA, creatorA, FUND);
        // The price dropped so redemption yields less USDC than the creator demanded.
        teller.setPriceE6(0.9e6);
        vm.prank(creatorA);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorTreasury.CreatorTreasury__InsufficientUsdcRedeemed.selector, 900e6, FUND)
        );
        treasury.withdraw(FUND, FUND);
    }

    function testCreatorsStayIsolated() public {
        _depositAs(creatorA, creatorA, FUND);
        _depositAs(creatorB, creatorB, FUND);

        // Draining creatorA's full balance must not touch creatorB's.
        vm.prank(creatorA);
        treasury.withdraw(FUND, FUND);

        assertEq(treasury.getUsycBalance(creatorA), 0);
        assertEq(treasury.getUsycBalance(creatorB), FUND);

        vm.prank(creatorB);
        treasury.withdraw(FUND, FUND);
        assertEq(treasury.getUsycBalance(creatorB), 0);
    }

    function testRevertsIfWithdrawCrossesCreatorBalances() public {
        _depositAs(creatorA, creatorA, FUND);
        // creatorB never deposited, so redeeming reverts even though the treasury holds creatorA's USYC.
        vm.prank(creatorB);
        vm.expectRevert(abi.encodeWithSelector(CreatorTreasury.CreatorTreasury__InsufficientBalance.selector, 0, 1));
        treasury.withdraw(1, 1);
    }
}
