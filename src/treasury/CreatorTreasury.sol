// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IUsycTeller} from "../interfaces/IUsycTeller.sol";

/**
 * @title CreatorTreasury
 * @author Malek Sharabi
 * @notice The yield layer of Arclight. It lets a creator or their treasury agent park idle USDC earnings into Circle's
 * yield bearing USYC through the teller, and redeem back to USDC whenever they want. Each creator's USYC is tracked
 * separately so the yield it accrues belongs only to them.
 * @dev We hold every creator's USYC in this one contract and track per creator how much of it is theirs, which stays
 * correct because USYC is a price appreciating token whose balance does not rebase. The sum of the tracked balances
 * always equals the USYC this contract holds. We follow CEI on withdraw and measure both legs by the balance delta, so
 * a teller fee can never desync our accounting. On Arc this treasury must be entitled to hold USYC, which is an
 * operational allowlist step outside this contract.
 */
contract CreatorTreasury {
    using SafeERC20 for IERC20;

    error CreatorTreasury__ZeroAddress();
    error CreatorTreasury__AmountZero();
    error CreatorTreasury__InsufficientBalance(uint256 available, uint256 requested);
    error CreatorTreasury__InsufficientUsycMinted(uint256 minted, uint256 minOut);
    error CreatorTreasury__InsufficientUsdcRedeemed(uint256 redeemed, uint256 minOut);

    IERC20 private immutable i_usdc;
    IERC20 private immutable i_usyc;
    IUsycTeller private immutable i_teller;

    mapping(address creator => uint256 usycBalance) private s_usycBalance;

    event Deposited(address indexed creator, uint256 usdcIn, uint256 usycMinted);
    event Withdrawn(address indexed creator, uint256 usycBurned, uint256 usdcOut);

    /**
     * @notice Deploys the treasury wired to USDC, USYC, and Circle's USYC teller.
     * @param usdc The USDC token creators deposit.
     * @param usyc The yield bearing USYC token the treasury holds.
     * @param teller The USYC teller that converts between USDC and USYC.
     */
    constructor(address usdc, address usyc, address teller) {
        if (usdc == address(0) || usyc == address(0) || teller == address(0)) {
            revert CreatorTreasury__ZeroAddress();
        }
        i_usdc = IERC20(usdc);
        i_usyc = IERC20(usyc);
        i_teller = IUsycTeller(teller);
    }

    /**
     * @notice Deposit USDC into the caller's own treasury and put it to work in USYC.
     * @param usdcAmount The amount of USDC (6 decimals) to deposit.
     * @param minUsycOut The minimum USYC the caller accepts from the teller, which floors a fee or a price move.
     * @return usycMinted The USYC credited to the caller.
     */
    function deposit(uint256 usdcAmount, uint256 minUsycOut) external returns (uint256 usycMinted) {
        return _deposit(msg.sender, usdcAmount, minUsycOut);
    }

    /**
     * @notice Deposit USDC into a named creator's treasury, paying from the caller.
     * @param creator The creator whose treasury we credit.
     * @param usdcAmount The amount of USDC (6 decimals) to deposit.
     * @param minUsycOut The minimum USYC the caller accepts from the teller, which floors a fee or a price move.
     * @return usycMinted The USYC credited to the creator.
     * @dev Crediting a creator only ever adds to their balance, so we let anyone fund a creator, which is what a treasury
     * agent or the payout flow uses to sweep a creator's earnings into yield.
     */
    function depositFor(address creator, uint256 usdcAmount, uint256 minUsycOut) external returns (uint256 usycMinted) {
        if (creator == address(0)) {
            revert CreatorTreasury__ZeroAddress();
        }
        return _deposit(creator, usdcAmount, minUsycOut);
    }

    /**
     * @notice Redeem part of the caller's USYC back to USDC and receive it.
     * @param usycAmount The amount of USYC (6 decimals) to redeem.
     * @param minUsdcOut The minimum USDC the caller accepts from the teller, which floors a fee or a price move.
     * @return usdcOut The USDC paid to the caller.
     * @dev We debit the caller's tracked balance before we touch the teller (CEI), which also guarantees a redemption can
     * never exceed what that creator holds, so creators stay isolated from each other's yield.
     */
    function withdraw(uint256 usycAmount, uint256 minUsdcOut) external returns (uint256 usdcOut) {
        if (usycAmount == 0) {
            revert CreatorTreasury__AmountZero();
        }
        uint256 balance = s_usycBalance[msg.sender];
        if (usycAmount > balance) {
            revert CreatorTreasury__InsufficientBalance(balance, usycAmount);
        }
        s_usycBalance[msg.sender] = balance - usycAmount;

        i_usyc.forceApprove(address(i_teller), usycAmount);
        uint256 usdcBefore = i_usdc.balanceOf(address(this));
        i_teller.sell(usycAmount);
        usdcOut = i_usdc.balanceOf(address(this)) - usdcBefore;
        if (usdcOut < minUsdcOut) {
            revert CreatorTreasury__InsufficientUsdcRedeemed(usdcOut, minUsdcOut);
        }

        emit Withdrawn(msg.sender, usycAmount, usdcOut);
        i_usdc.safeTransfer(msg.sender, usdcOut);
    }

    /**
     * @notice Pull USDC from the caller, buy USYC, and credit it to a creator's tracked balance.
     * @param creator The creator whose balance we credit.
     * @param usdcAmount The amount of USDC (6 decimals) to deposit.
     * @param minUsycOut The minimum USYC the caller accepts from the teller.
     * @return usycMinted The USYC actually credited, measured by the balance delta.
     */
    function _deposit(address creator, uint256 usdcAmount, uint256 minUsycOut) private returns (uint256 usycMinted) {
        if (usdcAmount == 0 || minUsycOut == 0) {
            revert CreatorTreasury__AmountZero();
        }

        i_usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        i_usdc.forceApprove(address(i_teller), usdcAmount);

        uint256 usycBefore = i_usyc.balanceOf(address(this));
        i_teller.buy(usdcAmount);
        usycMinted = i_usyc.balanceOf(address(this)) - usycBefore;
        if (usycMinted < minUsycOut) {
            revert CreatorTreasury__InsufficientUsycMinted(usycMinted, minUsycOut);
        }

        s_usycBalance[creator] += usycMinted;
        emit Deposited(creator, usdcAmount, usycMinted);
    }

    /**
     * @notice Get the USYC a creator holds in the treasury.
     * @param creator The creator we want to check.
     * @return The creator's USYC balance, whose USDC value grows as USYC accrues yield.
     */
    function getUsycBalance(address creator) external view returns (uint256) {
        return s_usycBalance[creator];
    }

    /**
     * @notice Get the USDC token this treasury accepts.
     * @return The USDC token address.
     */
    function getUsdc() external view returns (address) {
        return address(i_usdc);
    }

    /**
     * @notice Get the USYC token this treasury holds.
     * @return The USYC token address.
     */
    function getUsyc() external view returns (address) {
        return address(i_usyc);
    }

    /**
     * @notice Get the USYC teller this treasury converts through.
     * @return The teller address.
     */
    function getTeller() external view returns (address) {
        return address(i_teller);
    }
}
