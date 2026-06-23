// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

/**
 * @title HelperConfig
 * @author Malek Sharabi
 * @notice Resolves the USDC token and the CCTP contracts Arclight binds to per network, so the deploy script stays the
 * same everywhere. On a local chain we deploy a mock USDC the first time we are asked and reuse it after, and we leave
 * the CCTP addresses zero so the deploy script knows to skip the cross chain gateway off chain.
 */
contract HelperConfig is Script {
    error HelperConfig__UnsupportedChain(uint256 chainId);

    struct NetworkConfig {
        address usdc;
        address eurc;
        address tokenMessenger;
        address messageTransmitter;
        address fxEscrow;
        address usyc;
        address usycTeller;
    }

    uint256 public constant ARC_TESTNET_CHAIN_ID = 5_042_002;
    uint256 public constant LOCAL_CHAIN_ID = 31_337;
    address public constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;
    address public constant ARC_TESTNET_EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    address public constant ARC_TESTNET_FX_ESCROW = 0x867650F5eAe8df91445971f14d89fd84F0C9a9f8;
    address public constant ARC_TESTNET_USYC = 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C;
    address public constant ARC_TESTNET_USYC_TELLER = 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A;

    // CCTP V2 contracts are deployed at the same deterministic address on every testnet chain.
    address public constant CCTP_V2_TESTNET_TOKEN_MESSENGER = 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA;
    address public constant CCTP_V2_TESTNET_MESSAGE_TRANSMITTER = 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275;

    address private s_localUsdc;

    function getConfig() public returns (NetworkConfig memory) {
        if (block.chainid == ARC_TESTNET_CHAIN_ID) {
            return NetworkConfig({
                usdc: ARC_TESTNET_USDC,
                eurc: ARC_TESTNET_EURC,
                tokenMessenger: CCTP_V2_TESTNET_TOKEN_MESSENGER,
                messageTransmitter: CCTP_V2_TESTNET_MESSAGE_TRANSMITTER,
                fxEscrow: ARC_TESTNET_FX_ESCROW,
                usyc: ARC_TESTNET_USYC,
                usycTeller: ARC_TESTNET_USYC_TELLER
            });
        }
        if (block.chainid == LOCAL_CHAIN_ID) {
            return _getOrCreateLocalConfig();
        }
        revert HelperConfig__UnsupportedChain(block.chainid);
    }

    function _getOrCreateLocalConfig() internal returns (NetworkConfig memory) {
        if (s_localUsdc != address(0)) {
            return _localConfig(s_localUsdc);
        }
        vm.startBroadcast();
        MockUSDC usdc = new MockUSDC();
        vm.stopBroadcast();
        s_localUsdc = address(usdc);
        return _localConfig(address(usdc));
    }

    function _localConfig(address usdc) internal pure returns (NetworkConfig memory) {
        return NetworkConfig({
            usdc: usdc,
            eurc: address(0),
            tokenMessenger: address(0),
            messageTransmitter: address(0),
            fxEscrow: address(0),
            usyc: address(0),
            usycTeller: address(0)
        });
    }
}
