// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Governed
 * @notice Abstract base contract providing access control via a single governance address.
 */
abstract contract Governed {
    address public governance;

    event GovernanceTransferred(address indexed previousGov, address indexed newGov);

    modifier onlyGovernance() {
        require(msg.sender == governance, "PG:NOT_GOV");
        _;
    }

    constructor() {
        governance = msg.sender;
        emit GovernanceTransferred(address(0), msg.sender);
    }

    /**
     * @notice Transfers governance to a new address.
     * @param newGov The address of the new governance account/contract.
     */
    function transferGovernance(address newGov) external onlyGovernance {
        require(newGov != address(0), "PG:ZERO_ADDR");
        address oldGov = governance;
        governance = newGov;
        emit GovernanceTransferred(oldGov, newGov);
    }
}
