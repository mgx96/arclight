// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title ITokenMessenger
 * @author Malek Sharabi
 * @notice Minimal interface for Circle's CCTP V2 TokenMessenger, the entrypoint that burns USDC on a source chain so it
 * can be minted natively on a destination chain. We only need the burn side here.
 */
interface ITokenMessenger {
    /**
     * @notice Burn USDC on this chain to mint it natively on a destination domain.
     * @param amount The amount of USDC (6 decimals) to burn.
     * @param destinationDomain The CCTP domain id of the destination chain.
     * @param mintRecipient The recipient on the destination chain, left padded into a bytes32.
     * @param burnToken The token being burned, which is USDC.
     * @param destinationCaller The only address allowed to mint on the destination, or bytes32(0) for anyone.
     * @param maxFee The maximum fee to pay for a fast transfer, or 0 for a standard transfer.
     * @param minFinalityThreshold The minimum finality the burn must reach before it is attested.
     */
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external;
}
