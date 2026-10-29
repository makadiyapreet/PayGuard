// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDefenderMonitor {
    function evaluate(address user, uint256 amount, bool isRedeem) external;
    function isBlacklisted(address who) external view returns (bool);
}
