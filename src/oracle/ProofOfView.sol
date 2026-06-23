// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IProofOfView} from "../interfaces/IProofOfView.sol";
import {IViewPrivacyVerifier} from "../interfaces/IViewPrivacyVerifier.sol";

/**
 * @title ProofOfView
 * @author Malek Sharabi
 * @notice The sybil gate of Arclight. It verifies signed attestations that a genuine view happened and makes sure each
 * view can only ever be paid out once. The RevenueSplitter consults this before paying a creator.
 * @dev Attestations are EIP712 signed by a trusted off chain metering service. The viewer is only referenced by a
 * hiding commitment so their identity never hits the public chain. When a privacy verifier is configured we also demand
 * a zero knowledge proof and burn a nullifier, so a viewer is counted at most once per campaign and epoch without us
 * ever learning who they are. That privacy layer is pluggable and will be backed by Arc Configurable Privacy later.
 */
contract ProofOfView is IProofOfView, Ownable, EIP712 {
    error ProofOfView__ZeroAddress();
    error ProofOfView__InvalidViewId();
    error ProofOfView__InvalidCreator();
    error ProofOfView__InvalidAdvertiser();
    error ProofOfView__WeightZero();
    error ProofOfView__AttestationExpired();
    error ProofOfView__AlreadyConsumed(bytes32 viewId);
    error ProofOfView__InvalidAttestor();
    error ProofOfView__NotSplitter();
    error ProofOfView__NullifierUsed(uint256 nullifier);
    error ProofOfView__InvalidProof();

    bytes32 private constant VIEW_ATTESTATION_TYPEHASH = keccak256(
        "ViewAttestation(bytes32 viewId,address advertiser,address creator,uint256 commitment,uint256 nullifier,uint256 campaignId,uint256 weight,uint64 epoch,uint64 deadline)"
    );

    address private s_attestor;
    address private s_splitter;
    IViewPrivacyVerifier private s_privacyVerifier;

    mapping(bytes32 viewId => bool consumed) private s_consumed;
    mapping(uint256 nullifier => bool spent) private s_spentNullifier;

    event AttestorUpdated(address indexed attestor);
    event SplitterUpdated(address indexed splitter);
    event PrivacyVerifierUpdated(address indexed privacyVerifier);
    event ViewConsumed(bytes32 indexed viewId, address indexed advertiser, address indexed creator, uint256 weight);

    modifier onlySplitter() {
        if (msg.sender != s_splitter) {
            revert ProofOfView__NotSplitter();
        }
        _;
    }

    /**
     * @notice Deploys the oracle with its EIP712 domain and an owner.
     * @param initialOwner The owner allowed to set the attestor and the splitter.
     */
    constructor(address initialOwner) Ownable(initialOwner) EIP712("ArclightProofOfView", "1") {}

    /**
     * @notice Set or rotate the trusted attestor whose signatures we accept.
     * @param attestor The new attestor address.
     * @dev Only the owner can call. The attestor is the root of trust for genuine views, so it has to be the audited
     * metering key and nothing else.
     */
    function setAttestor(address attestor) external onlyOwner {
        if (attestor == address(0)) {
            revert ProofOfView__ZeroAddress();
        }
        s_attestor = attestor;
        emit AttestorUpdated(attestor);
    }

    /**
     * @notice Set or rotate the splitter allowed to consume attestations.
     * @param splitter The new splitter address.
     * @dev Only the owner can call. We gate consume to one address so nobody can grief us by consuming a view id early
     * and blocking the real payout.
     */
    function setSplitter(address splitter) external onlyOwner {
        if (splitter == address(0)) {
            revert ProofOfView__ZeroAddress();
        }
        s_splitter = splitter;
        emit SplitterUpdated(splitter);
    }

    /**
     * @notice Set or rotate the privacy verifier that proves a genuine unique viewer without revealing them.
     * @param privacyVerifier The new privacy verifier, or the zero address to run without the zero knowledge gate.
     * @dev Only the owner can call. While Arc Configurable Privacy is still in development we point this at our
     * application level zero knowledge verifier. Setting it to the zero address turns the gate off and falls back to
     * trusting the attestor alone, which is how we run before the privacy layer is wired.
     */
    function setPrivacyVerifier(address privacyVerifier) external onlyOwner {
        s_privacyVerifier = IViewPrivacyVerifier(privacyVerifier);
        emit PrivacyVerifierUpdated(privacyVerifier);
    }

    /**
     * @notice Verify an attestation and mark its view as paid so it can never be reused.
     * @param attestation The signed view attestation.
     * @param signature The attestor's signature over the attestation.
     * @param proof The viewer privacy proof, verified only when a privacy verifier is configured.
     * @return weight The verified payout weight the distributor should use.
     * @dev Only the splitter can call. We run every check first, then mark the view consumed and burn the nullifier
     * (CEI) before returning, so a replay of the same view id or the same viewer always reverts. Signature checking uses
     * SignatureChecker so an account abstraction attestor that implements ERC1271 works too. When a privacy verifier is
     * set we also require a valid zero knowledge proof binding the commitment and nullifier to this campaign and epoch,
     * and we burn the nullifier so the same viewer cannot be counted twice. The proof call is view only so it cannot
     * reenter us.
     */
    function consume(
        ViewAttestation calldata attestation,
        bytes calldata signature,
        IViewPrivacyVerifier.Groth16Proof calldata proof
    ) external onlySplitter returns (uint256 weight) {
        if (attestation.viewId == bytes32(0)) {
            revert ProofOfView__InvalidViewId();
        }
        if (attestation.advertiser == address(0)) {
            revert ProofOfView__InvalidAdvertiser();
        }
        if (attestation.creator == address(0)) {
            revert ProofOfView__InvalidCreator();
        }
        if (attestation.weight == 0) {
            revert ProofOfView__WeightZero();
        }
        if (block.timestamp > attestation.deadline) {
            revert ProofOfView__AttestationExpired();
        }
        if (s_consumed[attestation.viewId]) {
            revert ProofOfView__AlreadyConsumed(attestation.viewId);
        }

        bytes32 digest = _hashAttestation(attestation);
        if (!SignatureChecker.isValidSignatureNow(s_attestor, digest, signature)) {
            revert ProofOfView__InvalidAttestor();
        }

        IViewPrivacyVerifier privacyVerifier = s_privacyVerifier;
        bool privacyEnabled = address(privacyVerifier) != address(0);
        if (privacyEnabled) {
            if (s_spentNullifier[attestation.nullifier]) {
                revert ProofOfView__NullifierUsed(attestation.nullifier);
            }
            bool ok = privacyVerifier.verifyView(
                proof, attestation.commitment, attestation.nullifier, attestation.campaignId, attestation.epoch
            );
            if (!ok) {
                revert ProofOfView__InvalidProof();
            }
        }

        s_consumed[attestation.viewId] = true;
        if (privacyEnabled) {
            s_spentNullifier[attestation.nullifier] = true;
        }
        emit ViewConsumed(attestation.viewId, attestation.advertiser, attestation.creator, attestation.weight);
        return attestation.weight;
    }

    /**
     * @notice Build the EIP712 digest for an attestation.
     * @param attestation The attestation to hash.
     * @return The digest an attestor signs.
     */
    function _hashAttestation(ViewAttestation calldata attestation) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                VIEW_ATTESTATION_TYPEHASH,
                attestation.viewId,
                attestation.advertiser,
                attestation.creator,
                attestation.commitment,
                attestation.nullifier,
                attestation.campaignId,
                attestation.weight,
                attestation.epoch,
                attestation.deadline
            )
        );
        return _hashTypedDataV4(structHash);
    }

    /**
     * @notice Check whether a view id has already been consumed.
     * @param viewId The view id to check.
     * @return True if the view was already paid out.
     */
    function isConsumed(bytes32 viewId) external view returns (bool) {
        return s_consumed[viewId];
    }

    /**
     * @notice Check whether a viewer nullifier has already been spent.
     * @param nullifier The nullifier to check.
     * @return True if the viewer behind this nullifier was already counted for their campaign and epoch.
     */
    function isNullifierSpent(uint256 nullifier) external view returns (bool) {
        return s_spentNullifier[nullifier];
    }

    /**
     * @notice Build the EIP712 digest for an attestation, for off chain signers to sign.
     * @param attestation The attestation to hash.
     * @return The digest an attestor signs.
     */
    function getAttestationDigest(ViewAttestation calldata attestation) external view returns (bytes32) {
        return _hashAttestation(attestation);
    }

    /**
     * @notice Get the current trusted attestor.
     * @return The attestor address.
     */
    function getAttestor() external view returns (address) {
        return s_attestor;
    }

    /**
     * @notice Get the splitter allowed to consume attestations.
     * @return The splitter address.
     */
    function getSplitter() external view returns (address) {
        return s_splitter;
    }

    /**
     * @notice Get the configured privacy verifier.
     * @return The privacy verifier address, or the zero address when the privacy gate is off.
     */
    function getPrivacyVerifier() external view returns (address) {
        return address(s_privacyVerifier);
    }
}
