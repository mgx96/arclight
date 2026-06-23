// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IRevenuePool} from "../interfaces/IRevenuePool.sol";
import {IProofOfView} from "../interfaces/IProofOfView.sol";
import {IViewPrivacyVerifier} from "../interfaces/IViewPrivacyVerifier.sol";

/**
 * @title RevenueSplitter
 * @author Malek Sharabi
 * @notice The distributor of Arclight. It takes a signed view, has the oracle verify it, turns the view weight into a
 * USDC amount using the advertiser's rate, and pays the creator or their split out of the RevenuePool.
 * @dev Must be set as the distributor on the RevenuePool and as the splitter on the ProofOfView oracle.
 */
contract RevenueSplitter {
    error RevenueSplitter__ZeroAddress();
    error RevenueSplitter__RateNotSet();
    error RevenueSplitter__PayoutZero();
    error RevenueSplitter__InsufficientPoolBalance(uint256 available, uint256 required);
    error RevenueSplitter__LengthMismatch();
    error RevenueSplitter__EmptySplit();
    error RevenueSplitter__TooManyPayees(uint256 provided, uint256 max);
    error RevenueSplitter__ZeroShare();
    error RevenueSplitter__SharesNotFull(uint256 total);

    struct Payee {
        address account;
        uint16 shareBps;
    }

    uint256 private constant PRECISION = 1e18;
    uint256 private constant BASIS_POINTS = 10_000;
    uint256 private constant MAX_PAYEES = 20;

    IRevenuePool private immutable i_pool;
    IProofOfView private immutable i_oracle;

    mapping(address advertiser => uint256 ratePerWeight) private s_ratePerWeight;
    mapping(address creator => Payee[] payees) private s_splits;

    event RateUpdated(address indexed advertiser, uint256 ratePerWeight);
    event SplitUpdated(address indexed creator, address[] accounts, uint16[] sharesBps);
    event SplitRemoved(address indexed creator);
    event Distributed(bytes32 indexed viewId, address indexed advertiser, address indexed creator, uint256 amount);

    /**
     * @notice Deploys the splitter wired to a RevenuePool and a ProofOfView oracle.
     * @param pool The RevenuePool this splitter pays out of.
     * @param oracle The ProofOfView oracle this splitter consumes attestations from.
     */
    constructor(address pool, address oracle) {
        if (pool == address(0) || oracle == address(0)) {
            revert RevenueSplitter__ZeroAddress();
        }
        i_pool = IRevenuePool(pool);
        i_oracle = IProofOfView(oracle);
    }

    /**
     * @notice Set the USDC rate the caller pays per unit of view weight.
     * @param ratePerWeight The USDC (6 decimals) paid per PRECISION units of weight.
     * @dev The caller is the advertiser. Setting it to zero effectively pauses their payouts since distribute reverts
     * when the rate is zero.
     */
    function setRate(uint256 ratePerWeight) external {
        s_ratePerWeight[msg.sender] = ratePerWeight;
        emit RateUpdated(msg.sender, ratePerWeight);
    }

    /**
     * @notice Set how the caller's view payouts are split between payees.
     * @param accounts The payee addresses.
     * @param sharesBps The share of each payee in basis points, which must add up to 10000.
     * @dev The caller is the creator and can only configure their own split. We overwrite any existing split, so the
     * full set of payees has to be passed every time.
     */
    function setSplit(address[] calldata accounts, uint16[] calldata sharesBps) external {
        if (accounts.length != sharesBps.length) {
            revert RevenueSplitter__LengthMismatch();
        }
        if (accounts.length == 0) {
            revert RevenueSplitter__EmptySplit();
        }
        if (accounts.length > MAX_PAYEES) {
            revert RevenueSplitter__TooManyPayees(accounts.length, MAX_PAYEES);
        }

        delete s_splits[msg.sender];
        uint256 total;
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] == address(0)) {
                revert RevenueSplitter__ZeroAddress();
            }
            if (sharesBps[i] == 0) {
                revert RevenueSplitter__ZeroShare();
            }
            total += sharesBps[i];
            s_splits[msg.sender].push(Payee({account: accounts[i], shareBps: sharesBps[i]}));
        }
        if (total != BASIS_POINTS) {
            revert RevenueSplitter__SharesNotFull(total);
        }

        emit SplitUpdated(msg.sender, accounts, sharesBps);
    }

    /**
     * @notice Remove the caller's split so they get paid directly again.
     */
    function removeSplit() external {
        delete s_splits[msg.sender];
        emit SplitRemoved(msg.sender);
    }

    /**
     * @notice Pay out a single verified view to its creator or their split.
     * @param attestation The signed view attestation.
     * @param signature The attestor's signature over the attestation.
     * @param proof The viewer privacy proof the oracle verifies when its privacy gate is on.
     * @dev Anyone can relay a valid attestation, which suits agent driven payouts. The oracle verifies and consumes it
     * first (CEI and replay safe), so a second relay of the same view reverts. We check the pool has enough before
     * paying so the failure is clear rather than a transfer revert deep in the loop.
     */
    function distribute(
        IProofOfView.ViewAttestation calldata attestation,
        bytes calldata signature,
        IViewPrivacyVerifier.Groth16Proof calldata proof
    ) external {
        uint256 weight = i_oracle.consume(attestation, signature, proof);

        uint256 rate = s_ratePerWeight[attestation.advertiser];
        if (rate == 0) {
            revert RevenueSplitter__RateNotSet();
        }

        uint256 amount = (weight * rate) / PRECISION;
        if (amount == 0) {
            revert RevenueSplitter__PayoutZero();
        }

        uint256 available = i_pool.getAdvertiserBalance(attestation.advertiser);
        if (amount > available) {
            revert RevenueSplitter__InsufficientPoolBalance(available, amount);
        }

        _payout(attestation.advertiser, attestation.creator, amount);
        emit Distributed(attestation.viewId, attestation.advertiser, attestation.creator, amount);
    }

    /**
     * @notice Route a payout to the creator directly or across their configured split.
     * @param advertiser The advertiser whose budget pays.
     * @param creator The creator that earned the view.
     * @param amount The total USDC to pay out.
     * @dev We give any rounding dust to the last payee so the full amount always lands. Zero shares are skipped because
     * the pool rejects zero value payouts.
     */
    function _payout(address advertiser, address creator, uint256 amount) internal {
        Payee[] storage payees = s_splits[creator];
        uint256 len = payees.length;
        if (len == 0) {
            i_pool.spend(advertiser, creator, amount);
            return;
        }

        uint256 distributed;
        for (uint256 i = 0; i < len; i++) {
            uint256 share;
            if (i == len - 1) {
                share = amount - distributed;
            } else {
                share = (amount * payees[i].shareBps) / BASIS_POINTS;
                distributed += share;
            }
            if (share != 0) {
                i_pool.spend(advertiser, payees[i].account, share);
            }
        }
    }

    /**
     * @notice Get the USDC rate an advertiser pays per unit of view weight.
     * @param advertiser The advertiser to check.
     * @return The USDC (6 decimals) paid per PRECISION units of weight.
     */
    function getRatePerWeight(address advertiser) external view returns (uint256) {
        return s_ratePerWeight[advertiser];
    }

    /**
     * @notice Get a creator's configured payout split.
     * @param creator The creator to check.
     * @return The list of payees and their shares, empty if the creator is paid directly.
     */
    function getSplit(address creator) external view returns (Payee[] memory) {
        return s_splits[creator];
    }

    /**
     * @notice Get the RevenuePool this splitter pays out of.
     * @return The RevenuePool address.
     */
    function getPool() external view returns (address) {
        return address(i_pool);
    }

    /**
     * @notice Get the ProofOfView oracle this splitter consumes attestations from.
     * @return The oracle address.
     */
    function getOracle() external view returns (address) {
        return address(i_oracle);
    }
}
