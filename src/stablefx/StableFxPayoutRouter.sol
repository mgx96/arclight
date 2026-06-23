// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IFxEscrow} from "../interfaces/IFxEscrow.sol";

/**
 * @title StableFxPayoutRouter
 * @author Malek Sharabi
 * @notice The local currency payout rail of Arclight. It lets a creator or their treasury agent convert USDC they earned
 * on Arc into EURC through Arc's native StableFX escrow and deliver it to a recipient, so a creator can be paid in their
 * local stablecoin at a maker's quoted rate.
 * @dev Stateless beyond its immutable wiring, so it never custodies funds between transactions. It is bound to the USDC
 * sell side and the EURC buy side, and relays a maker's signed quote to the escrow which verifies the signature, checks
 * the deadline, and consumes the nonce. We measure the EURC the swap actually delivered by the balance delta and enforce
 * a caller supplied minimum, so a fee or a short delivery can never silently pay the creator less than they accept.
 */
contract StableFxPayoutRouter {
    using SafeERC20 for IERC20;

    error StableFxPayoutRouter__ZeroAddress();
    error StableFxPayoutRouter__AmountZero();
    error StableFxPayoutRouter__WrongSellToken(address sellToken);
    error StableFxPayoutRouter__WrongBuyToken(address buyToken);
    error StableFxPayoutRouter__TakerNotRouter(address taker);
    error StableFxPayoutRouter__InsufficientOutput(uint256 received, uint256 minOut);

    IERC20 private immutable i_usdc;
    IERC20 private immutable i_eurc;
    IFxEscrow private immutable i_escrow;

    event ConvertedToEurc(address indexed payer, address indexed recipient, uint256 usdcIn, uint256 eurcOut);

    /**
     * @notice Deploys the router wired to USDC, EURC, and Arc's StableFX escrow.
     * @param usdc The USDC token creators are paid in and sell here.
     * @param eurc The EURC token creators receive.
     * @param escrow The StableFX escrow that settles the swap.
     */
    constructor(address usdc, address eurc, address escrow) {
        if (usdc == address(0) || eurc == address(0) || escrow == address(0)) {
            revert StableFxPayoutRouter__ZeroAddress();
        }
        i_usdc = IERC20(usdc);
        i_eurc = IERC20(eurc);
        i_escrow = IFxEscrow(escrow);
    }

    /**
     * @notice Convert the caller's USDC into EURC through StableFX and pay it to a recipient.
     * @param quote The maker's signed quote describing the USDC to EURC swap.
     * @param makerSignature The maker's signature over the quote, which the escrow verifies.
     * @param minOut The minimum EURC the caller accepts, which floors any fee or short delivery.
     * @param recipient The address that receives the EURC, usually the creator.
     * @return eurcOut The EURC actually delivered to the recipient.
     * @dev We bind the swap to our USDC sell side and EURC buy side and require the quote names us as the taker, so a
     * caller cannot point the router at an unrelated pair or route the proceeds elsewhere. We pull exactly the quoted
     * sell amount, settle, then forward by balance delta so only the freshly swapped EURC moves on to the recipient.
     */
    function convertAndPay(
        IFxEscrow.FxQuote calldata quote,
        bytes calldata makerSignature,
        uint256 minOut,
        address recipient
    ) external returns (uint256 eurcOut) {
        if (recipient == address(0)) {
            revert StableFxPayoutRouter__ZeroAddress();
        }
        if (minOut == 0 || quote.sellAmount == 0) {
            revert StableFxPayoutRouter__AmountZero();
        }
        if (quote.sellToken != address(i_usdc)) {
            revert StableFxPayoutRouter__WrongSellToken(quote.sellToken);
        }
        if (quote.buyToken != address(i_eurc)) {
            revert StableFxPayoutRouter__WrongBuyToken(quote.buyToken);
        }
        if (quote.taker != address(this)) {
            revert StableFxPayoutRouter__TakerNotRouter(quote.taker);
        }

        i_usdc.safeTransferFrom(msg.sender, address(this), quote.sellAmount);
        i_usdc.forceApprove(address(i_escrow), quote.sellAmount);

        uint256 balanceBefore = i_eurc.balanceOf(address(this));
        i_escrow.settle(quote, makerSignature);
        eurcOut = i_eurc.balanceOf(address(this)) - balanceBefore;

        if (eurcOut < minOut) {
            revert StableFxPayoutRouter__InsufficientOutput(eurcOut, minOut);
        }

        i_eurc.safeTransfer(recipient, eurcOut);
        emit ConvertedToEurc(msg.sender, recipient, quote.sellAmount, eurcOut);
    }

    /**
     * @notice Get the USDC token this router sells.
     * @return The USDC token address.
     */
    function getUsdc() external view returns (address) {
        return address(i_usdc);
    }

    /**
     * @notice Get the EURC token this router buys.
     * @return The EURC token address.
     */
    function getEurc() external view returns (address) {
        return address(i_eurc);
    }

    /**
     * @notice Get the StableFX escrow this router settles through.
     * @return The escrow address.
     */
    function getEscrow() external view returns (address) {
        return address(i_escrow);
    }
}
