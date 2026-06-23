// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IUsycTeller
 * @author Malek Sharabi
 * @notice Minimal interface for Circle's USYC teller on Arc, the entrypoint that converts between USDC and the yield
 * bearing USYC token at the fund's current price. We only need the buy and sell legs, and we never rely on the return
 * values being exact since the treasury measures what it actually received by the balance delta.
 */
interface IUsycTeller {
    /**
     * @notice Buy USYC with USDC at the current price. The caller must approve the teller for the USDC first.
     * @param usdcAmount The amount of USDC (6 decimals) to spend.
     * @return usycOut The amount of USYC the teller minted to the caller.
     */
    function buy(uint256 usdcAmount) external returns (uint256 usycOut);

    /**
     * @notice Sell USYC for USDC at the current price. The caller must approve the teller for the USYC first.
     * @param usycAmount The amount of USYC (6 decimals) to redeem.
     * @return usdcOut The amount of USDC the teller paid to the caller.
     */
    function sell(uint256 usycAmount) external returns (uint256 usdcOut);
}
