// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ForceSend
 * @notice Mock contract to forcibly send ETH to an address via selfdestruct.
 */
contract ForceSend {
    constructor() payable {}

    function forceSend(address payable target) external {
        selfdestruct(target);
    }
}

