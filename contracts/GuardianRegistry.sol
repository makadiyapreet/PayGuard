// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BridgeBound.sol";
import "./interfaces/IGuardianRegistry.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title GuardianRegistry
 * @notice Wormhole Guardian Network-style multi-signature approval registry for cross-chain transfers.
 */
contract GuardianRegistry is BridgeBound, IGuardianRegistry {
    address[] public guardians;
    mapping(address => bool) public override isGuardian;
    uint256 public threshold;
    mapping(bytes32 => bool) public used;

    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event ThresholdChanged(uint256 oldThreshold, uint256 newThreshold);
    event ApprovalUsed(bytes32 indexed digest);

    /**
     * @notice Initializes guardian registry with initial guardian set and signature threshold.
     * @param initialGuardians Array of initial guardian addresses.
     * @param threshold_ Required number of valid signatures.
     */
    constructor(address[] memory initialGuardians, uint256 threshold_) {
        require(initialGuardians.length > 0, "PG:NO_GUARDIANS");
        require(threshold_ >= 1 && threshold_ <= initialGuardians.length, "PG:INVALID_THRESHOLD");

        for (uint256 i = 0; i < initialGuardians.length; i++) {
            address g = initialGuardians[i];
            require(g != address(0), "PG:ZERO_ADDR");
            require(!isGuardian[g], "PG:DUP_GUARDIAN");
            isGuardian[g] = true;
            guardians.push(g);
            emit GuardianAdded(g);
        }

        threshold = threshold_;
        emit ThresholdChanged(0, threshold_);
    }

    /**
     * @notice Verifies t-of-n guardian signatures over a given digest in strictly ascending signer order.
     * @param digest 32-byte transfer approval digest.
     * @param sigs Array of signature bytes.
     */
    function verifyApproval(
        bytes32 digest,
        bytes[] calldata sigs
    ) external view override returns (bool) {
        if (sigs.length < threshold || sigs.length > guardians.length) {
            return false;
        }

        bytes32 ethSignedDigest = MessageHashUtils.toEthSignedMessageHash(digest);
        address lastSigner = address(0);

        for (uint256 i = 0; i < sigs.length; i++) {
            (address signer, ECDSA.RecoverError err, ) = ECDSA.tryRecover(ethSignedDigest, sigs[i]);
            if (err != ECDSA.RecoverError.NoError) {
                return false;
            }
            if (signer <= lastSigner) {
                return false;
            }
            if (!isGuardian[signer]) {
                return false;
            }
            lastSigner = signer;
        }

        return true;
    }

    /**
     * @notice Marks an approval digest as used to prevent replay attacks. Callable only by the bridge.
     * @param digest 32-byte approval digest.
     */
    function markUsed(bytes32 digest) external override onlyBridge {
        require(!used[digest], "PG:REPLAY");
        used[digest] = true;
        emit ApprovalUsed(digest);
    }

    /**
     * @notice Adds a new guardian. Callable only by governance.
     * @param guardian Address of guardian to add.
     */
    function addGuardian(address guardian) external onlyGovernance {
        require(guardian != address(0), "PG:ZERO_ADDR");
        require(!isGuardian[guardian], "PG:DUP_GUARDIAN");

        isGuardian[guardian] = true;
        guardians.push(guardian);
        emit GuardianAdded(guardian);
    }

    /**
     * @notice Removes an existing guardian while maintaining the required threshold.
     * @param guardian Address of guardian to remove.
     */
    function removeGuardian(address guardian) external onlyGovernance {
        require(isGuardian[guardian], "PG:NOT_GUARDIAN");
        require(guardians.length - 1 >= threshold, "PG:THRESHOLD_VIOLATION");

        isGuardian[guardian] = false;
        uint256 len = guardians.length;
        for (uint256 i = 0; i < len; i++) {
            if (guardians[i] == guardian) {
                guardians[i] = guardians[len - 1];
                guardians.pop();
                break;
            }
        }

        emit GuardianRemoved(guardian);
    }

    /**
     * @notice Updates the signature verification threshold.
     * @param newThreshold New threshold value.
     */
    function setThreshold(uint256 newThreshold) external onlyGovernance {
        require(newThreshold >= 1 && newThreshold <= guardians.length, "PG:INVALID_THRESHOLD");
        uint256 old = threshold;
        threshold = newThreshold;
        emit ThresholdChanged(old, newThreshold);
    }

    /**
     * @notice Returns array of current guardians.
     */
    function getGuardians() external view returns (address[] memory) {
        return guardians;
    }

    /**
     * @notice Returns current threshold.
     */
    function getThreshold() external view returns (uint256) {
        return threshold;
    }

    /**
     * @notice Returns number of registered guardians.
     */
    function guardianCount() external view returns (uint256) {
        return guardians.length;
    }
}

