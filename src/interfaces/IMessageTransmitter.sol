// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IMessageTransmitter
 * @author Malek Sharabi
 * @notice Minimal interface for Circle's CCTP V2 MessageTransmitter, the contract that verifies a Circle attestation and
 * mints the bridged USDC on the destination chain. We only need the receive side here.
 * @dev We declare receiveMessage without a return value so the call works whether the deployed contract returns a bool
 * or nothing, since the return type is not part of the function selector.
 */
interface IMessageTransmitter {
    /**
     * @notice Verify an attested CCTP message and mint the bridged USDC to its recipient.
     * @param message The raw CCTP message emitted by the source chain burn.
     * @param attestation The Circle attestation over the message.
     */
    function receiveMessage(bytes calldata message, bytes calldata attestation) external;
}
