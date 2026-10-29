// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRiskScore {
    enum Band { LOW, MEDIUM, HIGH, CRITICAL }

    function reduce(uint256 points, string calldata reason) external;
    function getBand() external view returns (Band);
    function getScore() external view returns (uint256);
}
