// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IPausable.sol";
import "../interfaces/IDefenderMonitor.sol";

/**
 * @title MockPausableBridge
 * @notice Test mock to verify DefenderMonitor pause and unpause controls.
 */
contract MockPausableBridge is IPausable {
    bool public paused;
    address public monitor;
    address public governance;

    constructor() {
        governance = msg.sender;
    }

    function setMonitor(address m) external {
        monitor = m;
    }

    function setGovernance(address g) external {
        governance = g;
    }

    function forwardEvaluate(address user, uint256 amount, bool isRedeem) external {
        IDefenderMonitor(monitor).evaluate(user, amount, isRedeem);
    }

    function pause() external override {
        require(msg.sender == monitor, "PG:NOT_MONITOR");
        paused = true;
    }

    function unpause() external override {
        require(msg.sender == governance, "PG:NOT_GOV");
        paused = false;
    }
}
