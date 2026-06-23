// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {StableFxPayoutRouter} from "../../src/stablefx/StableFxPayoutRouter.sol";
import {IFxEscrow} from "../../src/interfaces/IFxEscrow.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {MockEURC} from "../mocks/MockEURC.sol";
import {MockFxEscrow} from "../mocks/MockFxEscrow.sol";

contract StableFxPayoutRouterFuzzTest is Test {
    StableFxPayoutRouter internal router;
    MockUSDC internal usdc;
    MockEURC internal eurc;
    MockFxEscrow internal escrow;

    address internal maker = makeAddr("maker");

    function setUp() public {
        usdc = new MockUSDC();
        eurc = new MockEURC();
        escrow = new MockFxEscrow(eurc);
        router = new StableFxPayoutRouter(address(usdc), address(eurc), address(escrow));
    }

    function testFuzzConvertAndPayDeliversExactly(
        address payer,
        address recipient,
        uint256 sellAmount,
        uint256 buyAmount,
        uint256 deliveredBps
    ) public {
        // Keep payer and recipient distinct from the escrow and router so balance assertions stay clean.
        vm.assume(payer != address(0) && recipient != address(0));
        vm.assume(payer != address(escrow) && payer != address(router));
        vm.assume(recipient != address(escrow) && recipient != address(router));
        sellAmount = bound(sellAmount, 1, 1e18);
        buyAmount = bound(buyAmount, 1, 1e18);
        deliveredBps = bound(deliveredBps, 1, 10_000);
        escrow.setDeliveredBps(deliveredBps);

        uint256 expectedOut = (buyAmount * deliveredBps) / 10_000;
        vm.assume(expectedOut > 0);

        usdc.mint(payer, sellAmount);
        vm.prank(payer);
        usdc.approve(address(router), sellAmount);

        IFxEscrow.FxQuote memory quote = IFxEscrow.FxQuote({
            maker: maker,
            taker: address(router),
            sellToken: address(usdc),
            buyToken: address(eurc),
            sellAmount: sellAmount,
            buyAmount: buyAmount,
            deadline: block.timestamp + 1 hours,
            nonce: 1
        });

        uint256 recipientBefore = eurc.balanceOf(recipient);

        vm.prank(payer);
        uint256 eurcOut = router.convertAndPay(quote, "", expectedOut, recipient);

        assertEq(eurcOut, expectedOut);
        assertEq(eurc.balanceOf(recipient), recipientBefore + expectedOut);
        assertEq(usdc.balanceOf(address(escrow)), sellAmount);
        // The router is stateless and keeps neither token.
        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(eurc.balanceOf(address(router)), 0);
    }
}
