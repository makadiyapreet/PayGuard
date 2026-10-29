// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IInvariantGuard {
    function checkDeposit(address user, uint256 amount) external returns (bool);
    function checkInvariant() external view returns (bool);
}
