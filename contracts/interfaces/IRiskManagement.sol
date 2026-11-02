// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRiskManagement {
    function isBlessed(bytes32 id, bytes32 digest) external view returns (bool);
    function isCursed() external view returns (bool);
}

