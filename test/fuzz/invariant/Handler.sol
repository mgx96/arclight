// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {RevenuePool} from "../../../src/payments/RevenuePool.sol";
import {ProofOfView} from "../../../src/oracle/ProofOfView.sol";
import {RevenueSplitter} from "../../../src/payments/RevenueSplitter.sol";
import {IProofOfView} from "../../../src/interfaces/IProofOfView.sol";
import {IViewPrivacyVerifier} from "../../../src/interfaces/IViewPrivacyVerifier.sol";
import {MockUSDC} from "../../mocks/MockUSDC.sol";

/**
 * @title Handler
 * @author Malek Sharabi
 * @notice Drives the Arclight payment system with bounded random actions so the invariant suite can check that pool
 * accounting and solvency always hold. We track ghost totals for every value that enters or leaves the pool.
 */
contract Handler is Test {
    RevenuePool internal immutable i_pool;
    ProofOfView internal immutable i_oracle;
    RevenueSplitter internal immutable i_splitter;
    MockUSDC internal immutable i_usdc;
    uint256 internal immutable i_attestorKey;

    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant MAX_DEPOSIT = 1e30;

    address[] internal s_advertisers;
    address[] internal s_creators;

    uint256 public ghost_deposited;
    uint256 public ghost_withdrawn;
    uint256 public ghost_paidOut;
    uint256 internal s_viewNonce;

    constructor(
        RevenuePool pool,
        ProofOfView oracle,
        RevenueSplitter splitter,
        MockUSDC usdc,
        uint256 attestorKey,
        address[] memory advertisers,
        address[] memory creators
    ) {
        i_pool = pool;
        i_oracle = oracle;
        i_splitter = splitter;
        i_usdc = usdc;
        i_attestorKey = attestorKey;
        s_advertisers = advertisers;
        s_creators = creators;
    }

    function _advertiser(uint256 seed) internal view returns (address) {
        return s_advertisers[seed % s_advertisers.length];
    }

    function _creator(uint256 seed) internal view returns (address) {
        return s_creators[seed % s_creators.length];
    }

    function deposit(uint256 advertiserSeed, uint256 amount) external {
        address advertiser = _advertiser(advertiserSeed);
        amount = bound(amount, 1, MAX_DEPOSIT);

        i_usdc.mint(advertiser, amount);
        vm.startPrank(advertiser);
        i_usdc.approve(address(i_pool), amount);
        i_pool.deposit(amount);
        vm.stopPrank();

        ghost_deposited += amount;
    }

    function withdraw(uint256 advertiserSeed, uint256 amount) external {
        address advertiser = _advertiser(advertiserSeed);
        uint256 balance = i_pool.getAdvertiserBalance(advertiser);
        if (balance == 0) {
            return;
        }
        amount = bound(amount, 1, balance);

        vm.prank(advertiser);
        i_pool.withdraw(amount);

        ghost_withdrawn += amount;
    }

    function setRate(uint256 advertiserSeed, uint256 rate) external {
        address advertiser = _advertiser(advertiserSeed);
        rate = bound(rate, 1, 1e18);
        vm.prank(advertiser);
        i_splitter.setRate(rate);
    }

    function distribute(uint256 advertiserSeed, uint256 creatorSeed, uint256 payoutSeed) external {
        address advertiser = _advertiser(advertiserSeed);
        address creator = _creator(creatorSeed);

        uint256 rate = i_splitter.getRatePerWeight(advertiser);
        uint256 balance = i_pool.getAdvertiserBalance(advertiser);
        if (rate == 0 || balance == 0) {
            return;
        }

        // Pick a target payout within budget, then derive the weight that produces it.
        uint256 payout = bound(payoutSeed, 1, balance);
        uint256 weight = (payout * PRECISION) / rate;
        if (weight == 0) {
            return;
        }
        uint256 owed = (weight * rate) / PRECISION;
        if (owed == 0 || owed > balance) {
            return;
        }

        uint256 nonce = s_viewNonce++;
        IProofOfView.ViewAttestation memory attestation = IProofOfView.ViewAttestation({
            viewId: keccak256(abi.encode("view", nonce)),
            advertiser: advertiser,
            creator: creator,
            commitment: uint256(keccak256(abi.encode("commitment", creator))),
            nullifier: uint256(keccak256(abi.encode("nullifier", nonce))),
            campaignId: 42,
            weight: weight,
            epoch: 7,
            deadline: uint64(block.timestamp + 1 hours)
        });
        bytes32 digest = i_oracle.getAttestationDigest(attestation);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(i_attestorKey, digest);

        IViewPrivacyVerifier.Groth16Proof memory proof = IViewPrivacyVerifier.Groth16Proof({
            a: [uint256(0), 0], b: [[uint256(0), 0], [uint256(0), 0]], c: [uint256(0), 0]
        });
        i_splitter.distribute(attestation, abi.encodePacked(r, s, v), proof);

        ghost_paidOut += owed;
    }

    function advertiserCount() external view returns (uint256) {
        return s_advertisers.length;
    }

    function advertiserAt(uint256 index) external view returns (address) {
        return s_advertisers[index];
    }
}
