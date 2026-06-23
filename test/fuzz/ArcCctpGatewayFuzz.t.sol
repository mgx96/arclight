// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ArcCctpGateway} from "../../src/cctp/ArcCctpGateway.sol";
import {RevenuePool} from "../../src/payments/RevenuePool.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {MockTokenMessenger} from "../mocks/MockTokenMessenger.sol";
import {MockMessageTransmitter} from "../mocks/MockMessageTransmitter.sol";

contract ArcCctpGatewayFuzzTest is Test {
    ArcCctpGateway internal gateway;
    RevenuePool internal pool;
    MockUSDC internal usdc;
    MockTokenMessenger internal tokenMessenger;
    MockMessageTransmitter internal messageTransmitter;

    address internal owner = makeAddr("owner");

    function setUp() public {
        usdc = new MockUSDC();
        tokenMessenger = new MockTokenMessenger(usdc);
        messageTransmitter = new MockMessageTransmitter(usdc);

        vm.prank(owner);
        pool = new RevenuePool(address(usdc), owner);

        gateway = new ArcCctpGateway(address(usdc), address(tokenMessenger), address(messageTransmitter), address(pool));
    }

    function testFuzzDepositFromRemoteCreditsExactlyMinted(address advertiser, uint256 amount, uint256 donation)
        public
    {
        vm.assume(advertiser != address(0));
        amount = bound(amount, 1, 1e18);
        donation = bound(donation, 0, 1e18);

        // A stray donation parked in the gateway must never inflate the credited budget.
        if (donation > 0) {
            usdc.mint(address(gateway), donation);
        }

        bytes memory message = abi.encode(address(gateway), amount);
        gateway.depositFromRemote(message, "", advertiser);

        assertEq(pool.getAdvertiserBalance(advertiser), amount);
        assertEq(usdc.balanceOf(address(pool)), amount);
        // Only the minted amount left the gateway, the donation stays parked.
        assertEq(usdc.balanceOf(address(gateway)), donation);
    }

    function testFuzzBridgeOutForwardsParams(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient) public {
        amount = bound(amount, 1, 1e18);
        vm.assume(mintRecipient != bytes32(0));

        address user = makeAddr("user");
        usdc.mint(user, amount);

        vm.startPrank(user);
        usdc.approve(address(gateway), amount);
        gateway.bridgeOut(amount, destinationDomain, mintRecipient);
        vm.stopPrank();

        assertEq(usdc.balanceOf(user), 0);
        assertEq(usdc.balanceOf(address(gateway)), 0);
        assertEq(usdc.balanceOf(address(tokenMessenger)), amount);
        assertEq(tokenMessenger.lastAmount(), amount);
        assertEq(tokenMessenger.lastDestinationDomain(), destinationDomain);
        assertEq(tokenMessenger.lastMintRecipient(), mintRecipient);
        assertEq(tokenMessenger.lastBurnToken(), address(usdc));
        assertEq(tokenMessenger.lastDestinationCaller(), bytes32(0));
        assertEq(tokenMessenger.lastMaxFee(), 0);
        assertEq(tokenMessenger.lastMinFinalityThreshold(), 2000);
    }
}
