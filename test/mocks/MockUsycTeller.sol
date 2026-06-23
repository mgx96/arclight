// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MockUSDC} from "./MockUSDC.sol";
import {MockUsyc} from "./MockUsyc.sol";

/**
 * @title MockUsycTeller
 * @author Malek Sharabi
 * @notice A USYC teller test double. It converts between USDC and USYC at a settable price, where the price is the USDC
 * value of one USYC scaled by 1e6, so a price above par lets a test simulate the yield USYC accrues over time. On a buy
 * it pulls USDC and mints USYC, on a sell it pulls USYC and mints USDC, standing in for the real teller so the treasury
 * tests can run end to end.
 */
contract MockUsycTeller {
    using SafeERC20 for IERC20;

    uint256 private constant PRICE_SCALE = 1e6;

    MockUSDC private immutable i_usdc;
    MockUsyc private immutable i_usyc;

    // The USDC value of one USYC, scaled by 1e6, so 1e6 is par and 1.05e6 is a 5 percent gain.
    uint256 public priceE6 = 1e6;

    constructor(MockUSDC usdc, MockUsyc usyc) {
        i_usdc = usdc;
        i_usyc = usyc;
    }

    function setPriceE6(uint256 newPriceE6) external {
        priceE6 = newPriceE6;
    }

    function buy(uint256 usdcAmount) external returns (uint256 usycOut) {
        i_usdc.transferFrom(msg.sender, address(this), usdcAmount);
        usycOut = (usdcAmount * PRICE_SCALE) / priceE6;
        i_usyc.mint(msg.sender, usycOut);
    }

    function sell(uint256 usycAmount) external returns (uint256 usdcOut) {
        i_usyc.transferFrom(msg.sender, address(this), usycAmount);
        usdcOut = (usycAmount * priceE6) / PRICE_SCALE;
        i_usdc.mint(msg.sender, usdcOut);
    }
}
