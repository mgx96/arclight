// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IRevenuePool
 * @author Malek Sharabi
 * @notice Interface for the Arclight RevenuePool where advertisers escrow USDC and the distributor pays creators.
 */
interface IRevenuePool {
    /**
     * @notice Escrow USDC into a named advertiser's budget, paying from the caller.
     * @param advertiser The advertiser whose budget we credit.
     * @param amount The amount of USDC (6 decimals) to deposit.
     * @dev The caller must approve the pool for amount first. Crediting another advertiser only ever adds to their
     * budget, so this is safe to expose, which lets the CCTP gateway fund an advertiser from a bridged transfer.
     */
    function depositFor(address advertiser, uint256 amount) external;

    /**
     * @notice Spend an advertiser's escrowed USDC budget by paying it out to a recipient (the creator).
     * @param advertiser The advertiser whose budget we debit.
     * @param recipient The address that receives the USDC, usually the creator or the splitter.
     * @param amount The amount of USDC (6 decimals) to pay out.
     * @dev We only let the authorized distributor call this.
     */
    function spend(address advertiser, address recipient, uint256 amount) external;

    /**
     * @notice Get the USDC budget an advertiser still has escrowed.
     * @param advertiser The advertiser we want to check.
     * @return The advertiser's escrowed USDC balance that is available for payouts.
     */
    function getAdvertiserBalance(address advertiser) external view returns (uint256);
}
