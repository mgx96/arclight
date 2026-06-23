// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockTokenMessenger
 * @author Malek Sharabi
 * @notice A CCTP TokenMessenger test double. It pulls the USDC being burned into itself to simulate taking it out of
 * circulation, and records the burn parameters so the gateway tests can assert what was sent to CCTP.
 */
contract MockTokenMessenger {
    using SafeERC20 for IERC20;

    IERC20 private immutable i_usdc;

    uint256 public lastAmount;
    uint32 public lastDestinationDomain;
    bytes32 public lastMintRecipient;
    address public lastBurnToken;
    bytes32 public lastDestinationCaller;
    uint256 public lastMaxFee;
    uint32 public lastMinFinalityThreshold;

    constructor(IERC20 usdc) {
        i_usdc = usdc;
    }

    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external {
        i_usdc.safeTransferFrom(msg.sender, address(this), amount);
        lastAmount = amount;
        lastDestinationDomain = destinationDomain;
        lastMintRecipient = mintRecipient;
        lastBurnToken = burnToken;
        lastDestinationCaller = destinationCaller;
        lastMaxFee = maxFee;
        lastMinFinalityThreshold = minFinalityThreshold;
    }
}
