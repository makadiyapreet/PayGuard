// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../PaymentBridge.sol";
import "../WrappedToken.sol";

/**
 * @title ReentrancyAttacker
 * @notice Test mock that attempts to re-enter PaymentBridge via redeem and refund callbacks.
 */
contract ReentrancyAttacker {
    PaymentBridge public bridge;
    WrappedToken public token;

    enum AttackMode { None, Redeem, Refund }
    AttackMode public mode;
    bytes32 public targetTransferId;
    bool public attackSucceeded;
    uint256 public reentrancyAttempts;

    event DepositedId(bytes32 indexed id);

    constructor(address payable bridge_, address token_) {
        bridge = PaymentBridge(bridge_);
        token = WrappedToken(token_);
    }

    function deposit(address recipient) external payable returns (bytes32 id) {
        id = bridge.deposit{value: msg.value}(recipient);
        emit DepositedId(id);
    }

    function attackRedeem(uint256 amount) external {
        mode = AttackMode.Redeem;
        token.approve(address(bridge), amount);
        bridge.redeem(amount);
    }

    function attackRefund(bytes32 id) external {
        mode = AttackMode.Refund;
        targetTransferId = id;
        bridge.refund(id);
    }

    receive() external payable {
        reentrancyAttempts++;
        if (mode == AttackMode.Redeem) {
            mode = AttackMode.None;
            try bridge.redeem(1 ether) {
                attackSucceeded = true;
            } catch {
                // Blocked by ReentrancyGuard
            }
        } else if (mode == AttackMode.Refund) {
            mode = AttackMode.None;
            try bridge.refund(targetTransferId) {
                attackSucceeded = true;
            } catch {
                // Blocked by ReentrancyGuard and state update
            }
        }
    }
}
