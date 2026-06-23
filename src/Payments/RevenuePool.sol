// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRevenuePool} from "../interfaces/IRevenuePool.sol";

/**
 * @title RevenuePool
 * @author Malek Sharabi
 * @notice The advertiser funded vault of Arclight. Advertisers escrow USDC per advertiser and the oracle gated
 * distributor pays it out to creators. Advertisers can withdraw whatever they haven't spent.
 * @dev Assumes USDC is a standard 6 decimal ERC20 that doesn't rebase or take a fee on transfer. The distributor must
 * be the trusted RevenueSplitter, never an EOA.
 */
contract RevenuePool is IRevenuePool, Ownable {
    using SafeERC20 for IERC20;

    error RevenuePool__AmountZero();
    error RevenuePool__ZeroAddress();
    error RevenuePool__InsufficientBalance(uint256 available, uint256 requested);
    error RevenuePool__NotDistributor();

    IERC20 private immutable i_usdc;

    address private s_distributor;
    mapping(address advertiser => uint256 escrowedBalance) private s_advertiserBalance;

    event Deposited(address indexed advertiser, uint256 amount);
    event Withdrawn(address indexed advertiser, uint256 amount);
    event Spent(address indexed advertiser, address indexed recipient, uint256 amount);
    event DistributorUpdated(address indexed distributor);

    modifier onlyDistributor() {
        if (msg.sender != s_distributor) {
            revert RevenuePool__NotDistributor();
        }
        _;
    }

    /**
     * @notice Deploys the RevenuePool bound to a fixed USDC token and an owner.
     * @param usdc The USDC token we use for budgets and payouts.
     * @param initialOwner The owner allowed to set the distributor.
     * @dev We make the USDC address immutable for the life of the pool so we remove a whole class of token swap rug risk.
     */
    constructor(address usdc, address initialOwner) Ownable(initialOwner) {
        if (usdc == address(0)) {
            revert RevenuePool__ZeroAddress();
        }
        i_usdc = IERC20(usdc);
    }

    /**
     * @notice Set or rotate the single contract we allow to spend escrowed budgets.
     * @param distributor The new distributor address, which is the RevenueSplitter gated by the oracle.
     * @dev Only the owner can call. The distributor is very powerful since it can debit any advertiser's escrowed
     * balance, so we only ever set it to an audited Arclight contract gated by the oracle.
     */
    function setDistributor(address distributor) external onlyOwner {
        if (distributor == address(0)) {
            revert RevenuePool__ZeroAddress();
        }
        s_distributor = distributor;
        emit DistributorUpdated(distributor);
    }

    /**
     * @notice Escrow USDC into the caller's advertiser budget.
     * @param amount The amount of USDC (6 decimals) to deposit.
     * @dev The caller has to approve the pool for amount first. We measure what we actually received by the balance
     * delta so our accounting stays correct even if USDC ever changes how it behaves.
     */
    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    /**
     * @notice Escrow USDC into a named advertiser's budget, paying from the caller.
     * @param advertiser The advertiser whose budget we credit.
     * @param amount The amount of USDC (6 decimals) to deposit.
     * @dev The caller has to approve the pool for amount first. Crediting another advertiser only ever adds to their
     * budget, so we let anyone do it, which is what the CCTP gateway uses to fund an advertiser from a bridged transfer.
     */
    function depositFor(address advertiser, uint256 amount) external {
        if (advertiser == address(0)) {
            revert RevenuePool__ZeroAddress();
        }
        _deposit(advertiser, amount);
    }

    /**
     * @notice Withdraw unspent USDC from the caller's advertiser budget.
     * @param amount The amount of USDC (6 decimals) to withdraw.
     * @dev We follow CEI here and debit the internal balance before we transfer the tokens out.
     */
    function withdraw(uint256 amount) external {
        if (amount == 0) {
            revert RevenuePool__AmountZero();
        }
        uint256 balance = s_advertiserBalance[msg.sender];
        if (amount > balance) {
            revert RevenuePool__InsufficientBalance(balance, amount);
        }
        s_advertiserBalance[msg.sender] = balance - amount;
        emit Withdrawn(msg.sender, amount);
        i_usdc.safeTransfer(msg.sender, amount);
    }

    /**
     * @notice Pay part of an advertiser's escrowed budget out to a recipient.
     * @param advertiser The advertiser whose budget we debit.
     * @param recipient The address that receives the USDC, the creator or the splitter.
     * @param amount The amount of USDC (6 decimals) to pay out.
     * @dev Only the distributor can call. We debit the advertiser's balance first (CEI), which also guarantees a payout
     * can never exceed what that advertiser escrowed, so advertisers stay isolated from each other.
     */
    function spend(address advertiser, address recipient, uint256 amount) external onlyDistributor {
        if (amount == 0) {
            revert RevenuePool__AmountZero();
        }
        if (recipient == address(0)) {
            revert RevenuePool__ZeroAddress();
        }
        uint256 balance = s_advertiserBalance[advertiser];
        if (amount > balance) {
            revert RevenuePool__InsufficientBalance(balance, amount);
        }
        s_advertiserBalance[advertiser] = balance - amount;
        emit Spent(advertiser, recipient, amount);
        i_usdc.safeTransfer(recipient, amount);
    }

    /**
     * @notice Pull USDC from the caller and credit it to an advertiser's escrowed budget.
     * @param advertiser The advertiser whose budget we credit.
     * @param amount The amount of USDC (6 decimals) to deposit.
     * @dev We measure what we actually received by the balance delta so our accounting stays correct even if USDC ever
     * changes how it behaves, and we credit only that amount.
     */
    function _deposit(address advertiser, uint256 amount) private {
        if (amount == 0) {
            revert RevenuePool__AmountZero();
        }
        uint256 balanceBefore = i_usdc.balanceOf(address(this));
        i_usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = i_usdc.balanceOf(address(this)) - balanceBefore;
        s_advertiserBalance[advertiser] += received;
        emit Deposited(advertiser, received);
    }

    /**
     * @notice Get the USDC budget an advertiser still has escrowed.
     * @param advertiser The advertiser we want to check.
     * @return The advertiser's escrowed USDC balance that is available for payouts.
     */
    function getAdvertiserBalance(address advertiser) external view returns (uint256) {
        return s_advertiserBalance[advertiser];
    }

    /**
     * @notice Get the USDC token address this pool is bound to.
     * @return The USDC token address.
     */
    function getUsdc() external view returns (address) {
        return address(i_usdc);
    }

    /**
     * @notice Get the current authorized distributor address.
     * @return The distributor address.
     */
    function getDistributor() external view returns (address) {
        return s_distributor;
    }
}
