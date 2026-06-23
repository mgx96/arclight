// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {MockUSDC} from "./MockUSDC.sol";

/**
 * @title MockMessageTransmitter
 * @author Malek Sharabi
 * @notice A CCTP MessageTransmitter test double. It decodes a message as an abi encoded (recipient, amount) pair and
 * mints that USDC to the recipient, standing in for a verified cross chain mint so the gateway tests can run end to end.
 * @dev We track used messages and reject a replay, mirroring the nonce protection of the real transmitter.
 */
contract MockMessageTransmitter {
    error MockMessageTransmitter__AlreadyUsed();

    MockUSDC private immutable i_usdc;

    mapping(bytes32 messageHash => bool used) public used;

    constructor(MockUSDC usdc) {
        i_usdc = usdc;
    }

    function receiveMessage(bytes calldata message, bytes calldata) external {
        bytes32 messageHash = keccak256(message);
        if (used[messageHash]) {
            revert MockMessageTransmitter__AlreadyUsed();
        }
        used[messageHash] = true;

        (address recipient, uint256 amount) = abi.decode(message, (address, uint256));
        i_usdc.mint(recipient, amount);
    }
}
