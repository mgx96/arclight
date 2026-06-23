// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {RevenuePool} from "../src/payments/RevenuePool.sol";
import {ProofOfView} from "../src/oracle/ProofOfView.sol";
import {RevenueSplitter} from "../src/payments/RevenueSplitter.sol";
import {Groth16Verifier} from "../src/zk/Groth16Verifier.sol";
import {ZkViewPrivacyVerifier} from "../src/zk/ZkViewPrivacyVerifier.sol";
import {ArcCctpGateway} from "../src/cctp/ArcCctpGateway.sol";
import {StableFxPayoutRouter} from "../src/stablefx/StableFxPayoutRouter.sol";
import {CreatorTreasury} from "../src/treasury/CreatorTreasury.sol";
import {AdvertiserAgentRegistry} from "../src/agents/AdvertiserAgentRegistry.sol";
import {HelperConfig} from "./HelperConfig.s.sol";

/**
 * @title DeployArclight
 * @author Malek Sharabi
 * @notice Deploys the Arclight core (RevenuePool, ProofOfView, RevenueSplitter) and wires them so the splitter is the
 * pool's distributor and the oracle's splitter, with the attestor set. The deployer owns the pool and oracle while we
 * wire them, then we hand ownership to the final owner if one is given.
 * @dev We read ATTESTOR and OWNER from the environment and fall back to the deployer. ATTESTOR should be the off chain
 * metering key, never an EOA you also deploy from in production. When ENABLE_ZK is set we also deploy the zero knowledge
 * privacy layer and turn it on, which demonstrates Configurable Privacy ahead of the native Arc feature. We leave it off
 * by default so the core rails can run before the privacy layer is wired.
 */
contract DeployArclight is Script {
    function run()
        external
        returns (RevenuePool pool, ProofOfView oracle, RevenueSplitter splitter, HelperConfig config)
    {
        config = new HelperConfig();
        HelperConfig.NetworkConfig memory networkConfig = config.getConfig();
        address usdc = networkConfig.usdc;

        address deployer = msg.sender;
        address attestor = vm.envOr("ATTESTOR", deployer);
        address finalOwner = vm.envOr("OWNER", deployer);
        bool enableZk = vm.envOr("ENABLE_ZK", false);

        vm.startBroadcast(deployer);
        pool = new RevenuePool(usdc, deployer);
        oracle = new ProofOfView(deployer);
        splitter = new RevenueSplitter(address(pool), address(oracle));

        pool.setDistributor(address(splitter));
        oracle.setSplitter(address(splitter));
        oracle.setAttestor(attestor);

        address privacyVerifier;
        if (enableZk) {
            Groth16Verifier groth16 = new Groth16Verifier();
            privacyVerifier = address(new ZkViewPrivacyVerifier(address(groth16)));
            oracle.setPrivacyVerifier(privacyVerifier);
        }

        // The Circle product modules deploy inside the same broadcast, so we keep them in a helper to stay within the
        // stack while the core rails own the return tuple.
        _deployModules(networkConfig, address(pool));

        if (finalOwner != deployer) {
            pool.transferOwnership(finalOwner);
            oracle.transferOwnership(finalOwner);
        }
        vm.stopBroadcast();

        console2.log("USDC:           ", usdc);
        console2.log("RevenuePool:    ", address(pool));
        console2.log("ProofOfView:    ", address(oracle));
        console2.log("RevenueSplitter:", address(splitter));
        console2.log("Attestor:       ", attestor);
        console2.log("Owner:          ", finalOwner);
        console2.log("PrivacyVerifier:", privacyVerifier);
    }

    /**
     * @notice Deploy the Circle product modules that hang off the core rails, each only where its dependencies exist.
     * @param networkConfig The resolved per network addresses for USDC, EURC, USYC, CCTP, and StableFX.
     * @param pool The RevenuePool the cross chain gateway and the agent registry fund into.
     * @dev We call this while the broadcast is already open so every deployment is still sent from the deployer. A module
     * is skipped on a network that does not have its Circle dependency, which keeps a local run to just the core rails.
     */
    function _deployModules(HelperConfig.NetworkConfig memory networkConfig, address pool) internal {
        address usdc = networkConfig.usdc;

        address cctpGateway;
        if (networkConfig.tokenMessenger != address(0) && networkConfig.messageTransmitter != address(0)) {
            cctpGateway =
                address(new ArcCctpGateway(usdc, networkConfig.tokenMessenger, networkConfig.messageTransmitter, pool));
        }

        address fxRouter;
        if (networkConfig.eurc != address(0) && networkConfig.fxEscrow != address(0)) {
            fxRouter = address(new StableFxPayoutRouter(usdc, networkConfig.eurc, networkConfig.fxEscrow));
        }

        address treasury;
        if (networkConfig.usyc != address(0) && networkConfig.usycTeller != address(0)) {
            treasury = address(new CreatorTreasury(usdc, networkConfig.usyc, networkConfig.usycTeller));
        }

        // The advertiser agent registry only needs USDC and the pool, so we always deploy it to guard agent top ups.
        address agentRegistry = address(new AdvertiserAgentRegistry(usdc, pool));

        console2.log("CctpGateway:    ", cctpGateway);
        console2.log("FxPayoutRouter: ", fxRouter);
        console2.log("CreatorTreasury:", treasury);
        console2.log("AgentRegistry:  ", agentRegistry);
    }
}
