// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {StableFxPayoutRouter} from "../../src/stablefx/StableFxPayoutRouter.sol";
import {IFxEscrow} from "../../src/interfaces/IFxEscrow.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {MockEURC} from "../mocks/MockEURC.sol";
import {MockFxEscrow} from "../mocks/MockFxEscrow.sol";

contract StableFxPayoutRouterTest is Test {
    StableFxPayoutRouter internal router;
    MockUSDC internal usdc;
    MockEURC internal eurc;
    MockFxEscrow internal escrow;

    address internal creator = makeAddr("creator");
    address internal maker = makeAddr("maker");

    uint256 internal constant SELL_USDC = 100e6;
    uint256 internal constant BUY_EURC = 92e6;

    event ConvertedToEurc(address indexed payer, address indexed recipient, uint256 usdcIn, uint256 eurcOut);

    function setUp() public {
        usdc = new MockUSDC();
        eurc = new MockEURC();
        escrow = new MockFxEscrow(eurc);
        router = new StableFxPayoutRouter(address(usdc), address(eurc), address(escrow));
    }

    function _quote(uint256 sellAmount, uint256 buyAmount) internal view returns (IFxEscrow.FxQuote memory) {
        return IFxEscrow.FxQuote({
            maker: maker,
            taker: address(router),
            sellToken: address(usdc),
            buyToken: address(eurc),
            sellAmount: sellAmount,
            buyAmount: buyAmount,
            deadline: block.timestamp + 1 hours,
            nonce: 1
        });
    }

    function _fundAndApprove(address payer, uint256 amount) internal {
        usdc.mint(payer, amount);
        vm.prank(payer);
        usdc.approve(address(router), amount);
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfConstructedWithZeroUsdc() public {
        vm.expectRevert(StableFxPayoutRouter.StableFxPayoutRouter__ZeroAddress.selector);
        new StableFxPayoutRouter(address(0), address(eurc), address(escrow));
    }

    function testRevertsIfConstructedWithZeroEurc() public {
        vm.expectRevert(StableFxPayoutRouter.StableFxPayoutRouter__ZeroAddress.selector);
        new StableFxPayoutRouter(address(usdc), address(0), address(escrow));
    }

    function testRevertsIfConstructedWithZeroEscrow() public {
        vm.expectRevert(StableFxPayoutRouter.StableFxPayoutRouter__ZeroAddress.selector);
        new StableFxPayoutRouter(address(usdc), address(eurc), address(0));
    }

    function testConstructorWiresDependencies() public view {
        assertEq(router.getUsdc(), address(usdc));
        assertEq(router.getEurc(), address(eurc));
        assertEq(router.getEscrow(), address(escrow));
    }

    /*//////////////////////////////////////////////////////////////
                          CONVERT AND PAY TESTS
    //////////////////////////////////////////////////////////////*/

    function testConvertAndPayDeliversEurcToRecipient() public {
        _fundAndApprove(creator, SELL_USDC);
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);

        vm.expectEmit(true, true, false, true);
        emit ConvertedToEurc(creator, creator, SELL_USDC, BUY_EURC);
        vm.prank(creator);
        uint256 eurcOut = router.convertAndPay(quote, "", BUY_EURC, creator);

        assertEq(eurcOut, BUY_EURC);
        assertEq(eurc.balanceOf(creator), BUY_EURC);
        assertEq(usdc.balanceOf(creator), 0);
        assertEq(usdc.balanceOf(address(escrow)), SELL_USDC);
        // The router never retains either token.
        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(eurc.balanceOf(address(router)), 0);
    }

    function testConvertAndPayCanRouteToAThirdParty() public {
        // A treasury agent can pay USDC and have the EURC land with the creator.
        address agent = makeAddr("agent");
        _fundAndApprove(agent, SELL_USDC);
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);

        vm.prank(agent);
        router.convertAndPay(quote, "", BUY_EURC, creator);

        assertEq(eurc.balanceOf(creator), BUY_EURC);
        assertEq(eurc.balanceOf(agent), 0);
    }

    function testRevertsIfRecipientZero() public {
        _fundAndApprove(creator, SELL_USDC);
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);
        vm.prank(creator);
        vm.expectRevert(StableFxPayoutRouter.StableFxPayoutRouter__ZeroAddress.selector);
        router.convertAndPay(quote, "", BUY_EURC, address(0));
    }

    function testRevertsIfMinOutZero() public {
        _fundAndApprove(creator, SELL_USDC);
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);
        vm.prank(creator);
        vm.expectRevert(StableFxPayoutRouter.StableFxPayoutRouter__AmountZero.selector);
        router.convertAndPay(quote, "", 0, creator);
    }

    function testRevertsIfSellAmountZero() public {
        IFxEscrow.FxQuote memory quote = _quote(0, BUY_EURC);
        vm.prank(creator);
        vm.expectRevert(StableFxPayoutRouter.StableFxPayoutRouter__AmountZero.selector);
        router.convertAndPay(quote, "", BUY_EURC, creator);
    }

    function testRevertsIfWrongSellToken() public {
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);
        quote.sellToken = address(eurc);
        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(StableFxPayoutRouter.StableFxPayoutRouter__WrongSellToken.selector, address(eurc))
        );
        router.convertAndPay(quote, "", BUY_EURC, creator);
    }

    function testRevertsIfWrongBuyToken() public {
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);
        quote.buyToken = address(usdc);
        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(StableFxPayoutRouter.StableFxPayoutRouter__WrongBuyToken.selector, address(usdc))
        );
        router.convertAndPay(quote, "", BUY_EURC, creator);
    }

    function testRevertsIfTakerNotRouter() public {
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);
        quote.taker = creator;
        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(StableFxPayoutRouter.StableFxPayoutRouter__TakerNotRouter.selector, creator)
        );
        router.convertAndPay(quote, "", BUY_EURC, creator);
    }

    function testRevertsIfOutputBelowMinOut() public {
        // The escrow only delivers 90% of the quoted buy amount, but the caller demands the full quote.
        escrow.setDeliveredBps(9000);
        _fundAndApprove(creator, SELL_USDC);
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);

        uint256 expectedOut = (BUY_EURC * 9000) / 10_000;
        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(
                StableFxPayoutRouter.StableFxPayoutRouter__InsufficientOutput.selector, expectedOut, BUY_EURC
            )
        );
        router.convertAndPay(quote, "", BUY_EURC, creator);
    }

    function testConvertAndPayAcceptsDeliveryAtMinOutFloor() public {
        // A fee shrinks the delivery, but the caller set a min out they still accept, so it goes through.
        escrow.setDeliveredBps(9500);
        _fundAndApprove(creator, SELL_USDC);
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);

        uint256 expectedOut = (BUY_EURC * 9500) / 10_000;
        vm.prank(creator);
        uint256 eurcOut = router.convertAndPay(quote, "", expectedOut, creator);

        assertEq(eurcOut, expectedOut);
        assertEq(eurc.balanceOf(creator), expectedOut);
    }

    function testRevertsIfQuoteReplayed() public {
        _fundAndApprove(creator, 2 * SELL_USDC);
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);

        vm.prank(creator);
        router.convertAndPay(quote, "", BUY_EURC, creator);

        vm.prank(creator);
        vm.expectRevert(MockFxEscrow.MockFxEscrow__NonceUsed.selector);
        router.convertAndPay(quote, "", BUY_EURC, creator);
    }

    function testRevertsIfQuoteExpired() public {
        _fundAndApprove(creator, SELL_USDC);
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);
        vm.warp(quote.deadline + 1);

        vm.prank(creator);
        vm.expectRevert(MockFxEscrow.MockFxEscrow__QuoteExpired.selector);
        router.convertAndPay(quote, "", BUY_EURC, creator);
    }

    function testRevertsIfPayerNotApproved() public {
        usdc.mint(creator, SELL_USDC);
        IFxEscrow.FxQuote memory quote = _quote(SELL_USDC, BUY_EURC);
        vm.prank(creator);
        vm.expectRevert();
        router.convertAndPay(quote, "", BUY_EURC, creator);
    }
}
