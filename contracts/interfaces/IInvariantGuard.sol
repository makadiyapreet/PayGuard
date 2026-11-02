// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IInvariantGuard {
    function checkDeposit(address user, uint256 amount) external returns (bool);
    function previewCheck(address user, uint256 amount) external view returns (bool ok, string memory reason);
    function checkInvariant() external view returns (bool);
}
