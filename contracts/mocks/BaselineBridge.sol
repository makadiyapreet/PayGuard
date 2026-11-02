// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../WrappedToken.sol";

/**
 * @title BaselineBridge
 * @notice Naive, un-layered reference bridge used strictly to measure PayGuard's security gas overhead.
 */
contract BaselineBridge {
    struct SimpleTransfer {
        address sender;
        address recipient;
        uint256 amount;
        bool executed;
    }

    WrappedToken public immutable token;
    address public owner;
    mapping(bytes32 => SimpleTransfer) public transfers;
    uint256 public nonce;

    event Deposited(bytes32 indexed id, address indexed sender, address indexed recipient, uint256 amount);
    event Executed(bytes32 indexed id, address indexed recipient, uint256 amount);

    constructor(address token_) {
        token = WrappedToken(token_);
        owner = msg.sender;
    }

    function deposit(address recipient) external payable returns (bytes32 id) {
        require(msg.value > 0, "ZERO_AMOUNT");
        id = keccak256(
            abi.encode(block.chainid, address(this), msg.sender, recipient, msg.value, nonce++)
        );
        transfers[id] = SimpleTransfer({
            sender: msg.sender,
            recipient: recipient,
            amount: msg.value,
            executed: false
        });
        emit Deposited(id, msg.sender, recipient, msg.value);
    }

    function mintTo(bytes32 id) external {
        require(msg.sender == owner, "NOT_OWNER");
        SimpleTransfer storage t = transfers[id];
        require(!t.executed, "ALREADY_EXECUTED");
        t.executed = true;
        token.mint(t.recipient, t.amount);
        emit Executed(id, t.recipient, t.amount);
    }
}

