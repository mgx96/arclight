// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IFxEscrow} from "../../src/interfaces/IFxEscrow.sol";
import {MockEURC} from "./MockEURC.sol";

/**
 * @title MockFxEscrow
 * @author Malek Sharabi
 * @notice A StableFX escrow test double. It simulates payment versus payment settlement by pulling the taker's sell
 * token into itself and minting the buy token to the taker, standing in for a maker delivering EURC so the router tests
 * can run end to end. A settable delivery ratio lets a test simulate a fee or a short delivery, and we reject an expired
 * quote and a replayed nonce, mirroring the protection of the real escrow.
 * @dev We ignore the maker signature here on purpose, since verifying it is the real escrow's job, not the router's.
 */
contract MockFxEscrow {
    using SafeERC20 for IERC20;

    error MockFxEscrow__QuoteExpired();
    error MockFxEscrow__NonceUsed();

    MockEURC private immutable i_eurc;

    uint256 public deliveredBps = 10_000;
    mapping(address maker => mapping(uint256 nonce => bool used)) public nonceUsed;

    constructor(MockEURC eurc) {
        i_eurc = eurc;
    }

    function setDeliveredBps(uint256 bps) external {
        deliveredBps = bps;
    }

    function settle(IFxEscrow.FxQuote calldata quote, bytes calldata) external {
        if (block.timestamp > quote.deadline) {
            revert MockFxEscrow__QuoteExpired();
        }
        if (nonceUsed[quote.maker][quote.nonce]) {
            revert MockFxEscrow__NonceUsed();
        }
        nonceUsed[quote.maker][quote.nonce] = true;

        IERC20(quote.sellToken).safeTransferFrom(quote.taker, address(this), quote.sellAmount);
        uint256 out = (quote.buyAmount * deliveredBps) / 10_000;
        i_eurc.mint(quote.taker, out);
    }
}
