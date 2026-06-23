// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ArcCctpGateway} from "../../src/cctp/ArcCctpGateway.sol";
import {RevenuePool} from "../../src/Payments/RevenuePool.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {MockTokenMessenger} from "../mocks/MockTokenMessenger.sol";
import {MockMessageTransmitter} from "../mocks/MockMessageTransmitter.sol";

contract ArcCctpGatewayTest is Test {
    ArcCctpGateway internal gateway;
    RevenuePool internal pool;
    MockUSDC internal usdc;
    MockTokenMessenger internal tokenMessenger;
    MockMessageTransmitter internal messageTransmitter;

    address internal owner = makeAddr("owner");
    address internal advertiser = makeAddr("advertiser");
    address internal user = makeAddr("user");

    uint32 internal constant BASE_DOMAIN = 6;
    bytes32 internal constant REMOTE_RECIPIENT = bytes32(uint256(uint160(0xCAFE)));

    event DepositedFromRemote(address indexed advertiser, uint256 amount);
    event BridgedOut(address indexed sender, uint32 indexed destinationDomain, bytes32 mintRecipient, uint256 amount);

    function setUp() public {
        usdc = new MockUSDC();
        tokenMessenger = new MockTokenMessenger(usdc);
        messageTransmitter = new MockMessageTransmitter(usdc);

        vm.prank(owner);
        pool = new RevenuePool(address(usdc), owner);

        gateway = new ArcCctpGateway(address(usdc), address(tokenMessenger), address(messageTransmitter), address(pool));
    }

    function _inboundMessage(address recipient, uint256 amount) internal pure returns (bytes memory) {
        return abi.encode(recipient, amount);
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertsIfConstructedWithZeroUsdc() public {
        vm.expectRevert(ArcCctpGateway.ArcCctpGateway__ZeroAddress.selector);
        new ArcCctpGateway(address(0), address(tokenMessenger), address(messageTransmitter), address(pool));
    }

    function testRevertsIfConstructedWithZeroTokenMessenger() public {
        vm.expectRevert(ArcCctpGateway.ArcCctpGateway__ZeroAddress.selector);
        new ArcCctpGateway(address(usdc), address(0), address(messageTransmitter), address(pool));
    }

    function testRevertsIfConstructedWithZeroMessageTransmitter() public {
        vm.expectRevert(ArcCctpGateway.ArcCctpGateway__ZeroAddress.selector);
        new ArcCctpGateway(address(usdc), address(tokenMessenger), address(0), address(pool));
    }

    function testRevertsIfConstructedWithZeroPool() public {
        vm.expectRevert(ArcCctpGateway.ArcCctpGateway__ZeroAddress.selector);
        new ArcCctpGateway(address(usdc), address(tokenMessenger), address(messageTransmitter), address(0));
    }

    function testConstructorWiresDependencies() public view {
        assertEq(gateway.getUsdc(), address(usdc));
        assertEq(gateway.getTokenMessenger(), address(tokenMessenger));
        assertEq(gateway.getMessageTransmitter(), address(messageTransmitter));
        assertEq(gateway.getPool(), address(pool));
    }

    /*//////////////////////////////////////////////////////////////
                        DEPOSIT FROM REMOTE TESTS
    //////////////////////////////////////////////////////////////*/

    function testDepositFromRemoteCreditsAdvertiserBudget() public {
        uint256 amount = 250e6;
        bytes memory message = _inboundMessage(address(gateway), amount);

        vm.expectEmit(true, false, false, true);
        emit DepositedFromRemote(advertiser, amount);
        gateway.depositFromRemote(message, "", advertiser);

        assertEq(pool.getAdvertiserBalance(advertiser), amount);
        // The gateway forwards everything it minted, so it never retains USDC.
        assertEq(usdc.balanceOf(address(gateway)), 0);
        assertEq(usdc.balanceOf(address(pool)), amount);
    }

    function testDepositFromRemoteIsPermissionless() public {
        uint256 amount = 100e6;
        bytes memory message = _inboundMessage(address(gateway), amount);

        // An advertiser's funding agent can relay the attested message on their behalf.
        vm.prank(makeAddr("relayer"));
        gateway.depositFromRemote(message, "", advertiser);

        assertEq(pool.getAdvertiserBalance(advertiser), amount);
    }

    function testRevertsIfDepositFromRemoteAdvertiserZero() public {
        bytes memory message = _inboundMessage(address(gateway), 100e6);
        vm.expectRevert(ArcCctpGateway.ArcCctpGateway__ZeroAddress.selector);
        gateway.depositFromRemote(message, "", address(0));
    }

    function testRevertsIfNothingMintedToGateway() public {
        // The message mints to someone other than the gateway, so the gateway's balance does not move.
        bytes memory message = _inboundMessage(user, 100e6);
        vm.expectRevert(ArcCctpGateway.ArcCctpGateway__NothingMinted.selector);
        gateway.depositFromRemote(message, "", advertiser);
    }

    function testRevertsIfInboundMessageReplayed() public {
        bytes memory message = _inboundMessage(address(gateway), 100e6);
        gateway.depositFromRemote(message, "", advertiser);

        vm.expectRevert(MockMessageTransmitter.MockMessageTransmitter__AlreadyUsed.selector);
        gateway.depositFromRemote(message, "", advertiser);
    }

    function testDepositFromRemoteIgnoresPriorDonations() public {
        // A stray donation sitting in the gateway must not inflate the credited amount.
        usdc.mint(address(gateway), 1000e6);
        uint256 amount = 100e6;
        bytes memory message = _inboundMessage(address(gateway), amount);

        gateway.depositFromRemote(message, "", advertiser);

        assertEq(pool.getAdvertiserBalance(advertiser), amount);
        // The donation stays parked in the gateway, only the freshly minted amount was credited.
        assertEq(usdc.balanceOf(address(gateway)), 1000e6);
    }

    /*//////////////////////////////////////////////////////////////
                             BRIDGE OUT TESTS
    //////////////////////////////////////////////////////////////*/

    function testBridgeOutBurnsAndForwardsParams() public {
        uint256 amount = 400e6;
        usdc.mint(user, amount);
        vm.startPrank(user);
        usdc.approve(address(gateway), amount);

        vm.expectEmit(true, true, false, true);
        emit BridgedOut(user, BASE_DOMAIN, REMOTE_RECIPIENT, amount);
        gateway.bridgeOut(amount, BASE_DOMAIN, REMOTE_RECIPIENT);
        vm.stopPrank();

        assertEq(usdc.balanceOf(user), 0);
        assertEq(usdc.balanceOf(address(tokenMessenger)), amount);
        assertEq(usdc.balanceOf(address(gateway)), 0);

        assertEq(tokenMessenger.lastAmount(), amount);
        assertEq(tokenMessenger.lastDestinationDomain(), BASE_DOMAIN);
        assertEq(tokenMessenger.lastMintRecipient(), REMOTE_RECIPIENT);
        assertEq(tokenMessenger.lastBurnToken(), address(usdc));
        assertEq(tokenMessenger.lastDestinationCaller(), bytes32(0));
        assertEq(tokenMessenger.lastMaxFee(), 0);
        assertEq(tokenMessenger.lastMinFinalityThreshold(), 2000);
    }

    function testRevertsIfBridgeOutAmountZero() public {
        vm.prank(user);
        vm.expectRevert(ArcCctpGateway.ArcCctpGateway__AmountZero.selector);
        gateway.bridgeOut(0, BASE_DOMAIN, REMOTE_RECIPIENT);
    }

    function testRevertsIfBridgeOutMintRecipientZero() public {
        vm.prank(user);
        vm.expectRevert(ArcCctpGateway.ArcCctpGateway__ZeroAddress.selector);
        gateway.bridgeOut(100e6, BASE_DOMAIN, bytes32(0));
    }

    function testRevertsIfBridgeOutNotApproved() public {
        usdc.mint(user, 100e6);
        vm.prank(user);
        vm.expectRevert();
        gateway.bridgeOut(100e6, BASE_DOMAIN, REMOTE_RECIPIENT);
    }
}
