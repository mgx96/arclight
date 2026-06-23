// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IFxEscrow
 * @author Malek Sharabi
 * @notice Minimal interface for Arc's native StableFX escrow, the request for quote plus payment versus payment engine
 * that atomically swaps one stablecoin for another at a maker's quoted rate. We only need the settle side, where the
 * taker delivers the sell token and receives the buy token in the same transaction.
 */
interface IFxEscrow {
    /**
     * @notice A maker's signed quote committing to swap a fixed sell amount for a fixed buy amount.
     * @param maker The liquidity provider committing the rate and delivering the buy token.
     * @param taker The party paying the sell token and receiving the buy token.
     * @param sellToken The token the taker pays, which is USDC for an Arclight payout.
     * @param buyToken The token the taker receives, which is the creator's local stablecoin like EURC.
     * @param sellAmount The amount of sell token (6 decimals) the taker pays.
     * @param buyAmount The amount of buy token (6 decimals) the maker delivers.
     * @param deadline The unix timestamp after which the quote can no longer be settled.
     * @param nonce The maker's quote nonce, which the escrow consumes to stop a replay.
     */
    struct FxQuote {
        address maker;
        address taker;
        address sellToken;
        address buyToken;
        uint256 sellAmount;
        uint256 buyAmount;
        uint256 deadline;
        uint256 nonce;
    }

    /**
     * @notice Atomically settle a maker's signed quote, pulling the taker's sell token and delivering the buy token.
     * @param quote The maker's quote describing both legs of the swap.
     * @param makerSignature The maker's signature over the quote, which the escrow verifies.
     */
    function settle(FxQuote calldata quote, bytes calldata makerSignature) external;
}
