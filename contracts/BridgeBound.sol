// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Governed.sol";

/**
 * @title BridgeBound
 * @notice Abstract base contract for contracts bound to a single PaymentBridge instance.
 */
abstract contract BridgeBound is Governed {
    address public bridge;

    event BridgeSet(address indexed bridge);

    modifier onlyBridge() {
        require(msg.sender == bridge, "PG:NOT_BRIDGE");
        _;
    }

    /**
     * @notice Sets the bridge address once by governance.
     * @param b The address of the PaymentBridge contract.
     */
    function setBridge(address b) external onlyGovernance {
        require(bridge == address(0), "PG:BRIDGE_SET");
        require(b != address(0), "PG:ZERO_ADDR");
        bridge = b;
        emit BridgeSet(b);
    }
}
