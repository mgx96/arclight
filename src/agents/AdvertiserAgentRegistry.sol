// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRevenuePool} from "../interfaces/IRevenuePool.sol";

/**
 * @title AdvertiserAgentRegistry
 * @author Malek Sharabi
 * @notice The advertiser side guardrail of Arclight. An advertiser authorizes one or more funding agents with a USDC
 * spending cap, and those agents can top up the advertiser's RevenuePool budget only up to that cap. This keeps an
 * autonomous funding agent on a leash, so a compromised or runaway agent can never spend more than the advertiser
 * explicitly allowed.
 * @dev We key the cap and the running spend by advertiser and agent, so an agent only has an allowance for advertisers
 * who granted it one, and an advertiser stays fully in control of each agent independently. The cap is a cumulative
 * ceiling, raising it grants more headroom and setting it to zero revokes the agent. We assume USDC is a standard 6
 * decimal token that does not take a fee on transfer, so the amount the agent requests is the amount the budget receives.
 */
contract AdvertiserAgentRegistry {
    using SafeERC20 for IERC20;

    error AdvertiserAgentRegistry__ZeroAddress();
    error AdvertiserAgentRegistry__AmountZero();
    error AdvertiserAgentRegistry__CapExceeded(uint256 remaining, uint256 requested);

    IERC20 private immutable i_usdc;
    IRevenuePool private immutable i_pool;

    mapping(address advertiser => mapping(address agent => uint256 cap)) private s_cap;
    mapping(address advertiser => mapping(address agent => uint256 spent)) private s_spent;

    event AgentCapSet(address indexed advertiser, address indexed agent, uint256 cap);
    event AgentFunded(address indexed advertiser, address indexed agent, uint256 amount);

    /**
     * @notice Deploys the registry wired to USDC and the RevenuePool budgets are funded into.
     * @param usdc The USDC token agents fund with.
     * @param pool The RevenuePool the guarded top ups land in.
     */
    constructor(address usdc, address pool) {
        if (usdc == address(0) || pool == address(0)) {
            revert AdvertiserAgentRegistry__ZeroAddress();
        }
        i_usdc = IERC20(usdc);
        i_pool = IRevenuePool(pool);
    }

    /**
     * @notice Set the cumulative USDC cap the caller authorizes one of their funding agents to spend.
     * @param agent The funding agent the caller authorizes.
     * @param cap The cumulative USDC (6 decimals) the agent may spend funding the caller's budget, where zero revokes it.
     * @dev The caller is the advertiser, so an agent's allowance always belongs to the advertiser who set it. The cap is
     * a lifetime ceiling measured against the agent's running spend, so lowering it below what the agent already spent
     * simply leaves no headroom, and we never need to touch the running spend to revoke.
     */
    function setAgentCap(address agent, uint256 cap) external {
        if (agent == address(0)) {
            revert AdvertiserAgentRegistry__ZeroAddress();
        }
        s_cap[msg.sender][agent] = cap;
        emit AgentCapSet(msg.sender, agent, cap);
    }

    /**
     * @notice Fund an advertiser's RevenuePool budget as one of their authorized agents, within the agent's cap.
     * @param advertiser The advertiser whose budget the caller funds.
     * @param amount The amount of USDC (6 decimals) to fund.
     * @dev The caller is the agent. We check the request against the agent's remaining headroom and book the spend before
     * we move any funds (CEI), then pull the agent's USDC and deposit it into the pool for the advertiser. Crediting an
     * advertiser only ever adds to their budget, so routing the agent's funds straight into the named advertiser is safe.
     */
    function fundBudget(address advertiser, uint256 amount) external {
        if (advertiser == address(0)) {
            revert AdvertiserAgentRegistry__ZeroAddress();
        }
        if (amount == 0) {
            revert AdvertiserAgentRegistry__AmountZero();
        }

        uint256 spent = s_spent[advertiser][msg.sender];
        uint256 cap = s_cap[advertiser][msg.sender];
        uint256 remaining = cap > spent ? cap - spent : 0;
        if (amount > remaining) {
            revert AdvertiserAgentRegistry__CapExceeded(remaining, amount);
        }
        s_spent[advertiser][msg.sender] = spent + amount;

        i_usdc.safeTransferFrom(msg.sender, address(this), amount);
        i_usdc.forceApprove(address(i_pool), amount);
        i_pool.depositFor(advertiser, amount);
        emit AgentFunded(advertiser, msg.sender, amount);
    }

    /**
     * @notice Get the cumulative cap an advertiser set for one of their agents.
     * @param advertiser The advertiser who set the cap.
     * @param agent The agent the cap applies to.
     * @return The cumulative USDC cap.
     */
    function getAgentCap(address advertiser, address agent) external view returns (uint256) {
        return s_cap[advertiser][agent];
    }

    /**
     * @notice Get how much an agent has already spent funding an advertiser's budget.
     * @param advertiser The advertiser the spend was credited to.
     * @param agent The agent that spent it.
     * @return The cumulative USDC the agent has spent.
     */
    function getAgentSpent(address advertiser, address agent) external view returns (uint256) {
        return s_spent[advertiser][agent];
    }

    /**
     * @notice Get the USDC an agent can still spend funding an advertiser's budget.
     * @param advertiser The advertiser who set the cap.
     * @param agent The agent we want the headroom for.
     * @return The remaining USDC the agent may spend, which is zero once the cap is reached or revoked.
     */
    function getRemainingCap(address advertiser, address agent) external view returns (uint256) {
        uint256 cap = s_cap[advertiser][agent];
        uint256 spent = s_spent[advertiser][agent];
        return cap > spent ? cap - spent : 0;
    }

    /**
     * @notice Get the USDC token agents fund with.
     * @return The USDC token address.
     */
    function getUsdc() external view returns (address) {
        return address(i_usdc);
    }

    /**
     * @notice Get the RevenuePool guarded top ups land in.
     * @return The RevenuePool address.
     */
    function getPool() external view returns (address) {
        return address(i_pool);
    }
}
