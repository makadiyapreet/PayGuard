// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGuardianRegistry {
    function verifyApproval(bytes32 digest, bytes[] calldata sigs) external view returns (bool);
    function markUsed(bytes32 digest) external;
    function isGuardian(address who) external view returns (bool);
}
