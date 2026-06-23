// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {DeployArclight} from "../../script/DeployArclight.s.sol";
import {HelperConfig} from "../../script/HelperConfig.s.sol";
import {RevenuePool} from "../../src/payments/RevenuePool.sol";
import {ProofOfView} from "../../src/oracle/ProofOfView.sol";
import {RevenueSplitter} from "../../src/payments/RevenueSplitter.sol";
import {IProofOfView} from "../../src/interfaces/IProofOfView.sol";
import {IViewPrivacyVerifier} from "../../src/interfaces/IViewPrivacyVerifier.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract DeployArclightTest is Test {
    DeployArclight internal deployer;
    RevenuePool internal pool;
    ProofOfView internal oracle;
    RevenueSplitter internal splitter;
    HelperConfig internal config;
    address internal expectedUsdc;

    function setUp() public {
        deployer = new DeployArclight();
        (pool, oracle, splitter, config) = deployer.run();
        expectedUsdc = config.getConfig().usdc;
    }

    /*//////////////////////////////////////////////////////////////
                              WIRING TESTS
    //////////////////////////////////////////////////////////////*/

    function testDeploySetsSplitterAsDistributor() public view {
        assertEq(pool.getDistributor(), address(splitter));
    }

    function testDeployWiresSplitterToPoolAndOracle() public view {
        assertEq(splitter.getPool(), address(pool));
        assertEq(splitter.getOracle(), address(oracle));
    }

    function testDeploySetsSplitterAndAttestorOnOracle() public view {
        assertEq(oracle.getSplitter(), address(splitter));
        // This test contract is what calls run(), so with no ATTESTOR env set it is the deployer and the attestor.
        assertEq(oracle.getAttestor(), address(this));
    }

    function testDeployBindsPoolToConfiguredUsdc() public view {
        assertEq(pool.getUsdc(), expectedUsdc);
    }

    function testDeployLeavesOwnershipWithDeployer() public view {
        assertEq(pool.owner(), address(this));
        assertEq(oracle.owner(), address(this));
    }

    /*//////////////////////////////////////////////////////////////
                           END TO END PAYOUT
    //////////////////////////////////////////////////////////////*/

    function testDeployedSystemPaysOutAView() public {
        // Use the deployer key as the attestor so we can sign a valid attestation end to end.
        (address attestor, uint256 attestorKey) = makeAddrAndKey("attestor");
        vm.prank(pool.owner());
        oracle.setAttestor(attestor);

        MockUSDC usdc = MockUSDC(pool.getUsdc());
        address advertiser = makeAddr("advertiser");
        address creator = makeAddr("creator");

        usdc.mint(advertiser, 1000e6);
        vm.startPrank(advertiser);
        usdc.approve(address(pool), 1000e6);
        pool.deposit(1000e6);
        splitter.setRate(1e6);
        vm.stopPrank();

        IProofOfView.ViewAttestation memory a = IProofOfView.ViewAttestation({
            viewId: keccak256("v1"),
            advertiser: advertiser,
            creator: creator,
            commitment: uint256(keccak256("commitment")),
            nullifier: uint256(keccak256("nullifier")),
            campaignId: 42,
            weight: 5e18,
            epoch: 7,
            deadline: uint64(block.timestamp + 1 hours)
        });
        bytes32 digest = oracle.getAttestationDigest(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorKey, digest);

        IViewPrivacyVerifier.Groth16Proof memory proof = IViewPrivacyVerifier.Groth16Proof({
            a: [uint256(0), 0], b: [[uint256(0), 0], [uint256(0), 0]], c: [uint256(0), 0]
        });
        splitter.distribute(a, abi.encodePacked(r, s, v), proof);

        assertEq(usdc.balanceOf(creator), 5e6);
        assertTrue(oracle.isConsumed(a.viewId));
    }
}
