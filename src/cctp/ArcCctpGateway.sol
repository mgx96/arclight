// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITokenMessenger} from "../interfaces/ITokenMessenger.sol";
import {IMessageTransmitter} from "../interfaces/IMessageTransmitter.sol";
import {IRevenuePool} from "../interfaces/IRevenuePool.sol";

/**
 * @title ArcCctpGateway
 * @author Malek Sharabi
 * @notice The cross chain on and off ramp of Arclight. It lets an advertiser fund their Arc budget straight from USDC on
 * another chain through Circle CCTP, and lets anyone who holds USDC on Arc bridge it back out to another chain. Inbound,
 * we mint the bridged USDC and escrow it into the RevenuePool for a named advertiser in a single transaction.
 * @dev Stateless beyond its immutable wiring, so it never custodies funds between transactions. For the inbound flow the
 * source chain burn must set its mintRecipient to this gateway and its destinationCaller to this gateway too, so only we
 * can mint the message and the funds always land in the pool rather than being stranded by a front run.
 */
contract ArcCctpGateway {
    using SafeERC20 for IERC20;

    error ArcCctpGateway__ZeroAddress();
    error ArcCctpGateway__AmountZero();
    error ArcCctpGateway__NothingMinted();

    uint256 private constant STANDARD_MAX_FEE = 0;
    uint32 private constant STANDARD_FINALITY_THRESHOLD = 2000;

    IERC20 private immutable i_usdc;
    ITokenMessenger private immutable i_tokenMessenger;
    IMessageTransmitter private immutable i_messageTransmitter;
    IRevenuePool private immutable i_pool;

    event DepositedFromRemote(address indexed advertiser, uint256 amount);
    event BridgedOut(address indexed sender, uint32 indexed destinationDomain, bytes32 mintRecipient, uint256 amount);

    /**
     * @notice Deploys the gateway wired to USDC, the CCTP contracts, and the RevenuePool.
     * @param usdc The USDC token on this chain.
     * @param tokenMessenger The CCTP TokenMessenger that burns USDC for an outbound transfer.
     * @param messageTransmitter The CCTP MessageTransmitter that mints USDC for an inbound transfer.
     * @param pool The RevenuePool inbound deposits are credited into.
     */
    constructor(address usdc, address tokenMessenger, address messageTransmitter, address pool) {
        if (
            usdc == address(0) || tokenMessenger == address(0) || messageTransmitter == address(0) || pool == address(0)
        ) {
            revert ArcCctpGateway__ZeroAddress();
        }
        i_usdc = IERC20(usdc);
        i_tokenMessenger = ITokenMessenger(tokenMessenger);
        i_messageTransmitter = IMessageTransmitter(messageTransmitter);
        i_pool = IRevenuePool(pool);
    }

    /**
     * @notice Mint a bridged CCTP transfer and escrow it into an advertiser's budget in one transaction.
     * @param message The raw CCTP message from the source chain burn.
     * @param attestation The Circle attestation over the message.
     * @param advertiser The advertiser whose RevenuePool budget the minted USDC funds.
     * @dev Anyone can relay a valid attested message, which suits agent driven funding. We measure the USDC the mint
     * actually delivered to us by the balance delta, so a donation sitting in the gateway can never inflate the credit,
     * then we deposit exactly that into the pool for the advertiser. Crediting an advertiser only ever adds to their
     * budget, so naming the advertiser here is safe, the bridged funds belong to whoever burned them on the source side.
     */
    function depositFromRemote(bytes calldata message, bytes calldata attestation, address advertiser) external {
        if (advertiser == address(0)) {
            revert ArcCctpGateway__ZeroAddress();
        }

        uint256 balanceBefore = i_usdc.balanceOf(address(this));
        i_messageTransmitter.receiveMessage(message, attestation);
        uint256 received = i_usdc.balanceOf(address(this)) - balanceBefore;
        if (received == 0) {
            revert ArcCctpGateway__NothingMinted();
        }

        i_usdc.forceApprove(address(i_pool), received);
        i_pool.depositFor(advertiser, received);
        emit DepositedFromRemote(advertiser, received);
    }

    /**
     * @notice Bridge USDC the caller holds on Arc out to another chain through CCTP.
     * @param amount The amount of USDC (6 decimals) to bridge.
     * @param destinationDomain The CCTP domain id of the destination chain.
     * @param mintRecipient The recipient on the destination chain, left padded into a bytes32.
     * @dev We pull the caller's USDC, then burn it through the TokenMessenger to mint natively on the destination. This
     * is the cash out path for a creator who earned USDC on Arc or an advertiser who withdrew an unspent budget. We use
     * a standard transfer with no fast transfer fee, and leave the destination caller open so the recipient can claim it.
     */
    function bridgeOut(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient) external {
        if (amount == 0) {
            revert ArcCctpGateway__AmountZero();
        }
        if (mintRecipient == bytes32(0)) {
            revert ArcCctpGateway__ZeroAddress();
        }

        i_usdc.safeTransferFrom(msg.sender, address(this), amount);
        i_usdc.forceApprove(address(i_tokenMessenger), amount);
        i_tokenMessenger.depositForBurn(
            amount,
            destinationDomain,
            mintRecipient,
            address(i_usdc),
            bytes32(0),
            STANDARD_MAX_FEE,
            STANDARD_FINALITY_THRESHOLD
        );
        emit BridgedOut(msg.sender, destinationDomain, mintRecipient, amount);
    }

    /**
     * @notice Get the USDC token this gateway bridges.
     * @return The USDC token address.
     */
    function getUsdc() external view returns (address) {
        return address(i_usdc);
    }

    /**
     * @notice Get the CCTP TokenMessenger used for outbound burns.
     * @return The TokenMessenger address.
     */
    function getTokenMessenger() external view returns (address) {
        return address(i_tokenMessenger);
    }

    /**
     * @notice Get the CCTP MessageTransmitter used for inbound mints.
     * @return The MessageTransmitter address.
     */
    function getMessageTransmitter() external view returns (address) {
        return address(i_messageTransmitter);
    }

    /**
     * @notice Get the RevenuePool inbound deposits are credited into.
     * @return The RevenuePool address.
     */
    function getPool() external view returns (address) {
        return address(i_pool);
    }
}
