// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDetectionNetwork {
    function fundRewardPool() external payable;
    function isBot(address who) external view returns (bool);
}
