// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BridgeBound.sol";
import "./interfaces/IDetectionNetwork.sol";
import "./interfaces/IRiskScore.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DetectionNetwork
 * @notice Forta-style decentralized security detection network with staked bots, alerts, rewards, and slashing.
 */
contract DetectionNetwork is BridgeBound, ReentrancyGuard, IDetectionNetwork {
    enum AlertStatus {
        Pending,
        Valid,
        Invalid
    }

    struct Bot {
        uint256 stake;
        bool registered;
        uint256 unbondRequestedAt;
        uint256 pendingAlerts;
    }

    struct Alert {
        address bot;
        bytes32 transferId;
        uint8 severity;
        string evidence;
        AlertStatus status;
        uint256 timestamp;
    }

    uint256 public minStake;
    uint256 public rewardBps;
    uint256 public slashBps;
    uint256 public unbondDelay;
    uint256 public rewardPool;

    mapping(address => Bot) public bots;
    mapping(address => uint256) public pendingRewards;
    Alert[] private alerts;
    IRiskScore public immutable riskScore;

    event BotRegistered(address indexed bot, uint256 stake);
    event AlertRaised(
        uint256 indexed alertId,
        address indexed bot,
        bytes32 indexed transferId,
        uint8 severity,
        string evidence
    );
    event AlertResolved(
        uint256 indexed alertId,
        address indexed bot,
        bool valid,
        uint256 amount
    );
    event RewardClaimed(address indexed bot, uint256 amount);
    event UnbondRequested(address indexed bot, uint256 unbondAt);
    event StakeWithdrawn(address indexed bot, uint256 amount);
    event RewardPoolFunded(address indexed funder, uint256 amount);
    event BotDeregistered(address indexed bot);

    /**
     * @notice Initializes detection network economics and risk score reference.
     */
    constructor(
        address riskScore_,
        uint256 minStake_,
        uint256 rewardBps_,
        uint256 slashBps_,
        uint256 unbondDelay_
    ) {
        require(riskScore_ != address(0), "PG:ZERO_ADDR");
        require(minStake_ > 0, "PG:INVALID_STAKE");
        require(rewardBps_ <= 10000 && slashBps_ <= 10000, "PG:INVALID_BPS");

        riskScore = IRiskScore(riskScore_);
        minStake = minStake_;
        rewardBps = rewardBps_;
        slashBps = slashBps_;
        unbondDelay = unbondDelay_;
    }

    /**
     * @notice Registers a new detection bot by staking at least minStake ETH.
     */
    function registerBot() external payable {
        require(msg.value >= minStake, "PG:MIN_STAKE");
        require(!bots[msg.sender].registered, "PG:ALREADY_BOT");

        bots[msg.sender] = Bot({
            stake: msg.value,
            registered: true,
            unbondRequestedAt: 0,
            pendingAlerts: 0
        });

        emit BotRegistered(msg.sender, msg.value);
    }

    /**
     * @notice Raises a security alert against a suspicious transfer.
     * @param transferId The ID of the transfer.
     * @param severity Alert severity level (1: Low, 2: Medium, 3: High).
     * @param evidence Proof/reason string.
     */
    function raiseAlert(
        bytes32 transferId,
        uint8 severity,
        string calldata evidence
    ) external returns (uint256 alertId) {
        Bot storage b = bots[msg.sender];
        require(b.registered, "PG:NOT_BOT");
        require(b.unbondRequestedAt == 0, "PG:UNBONDING");
        require(severity >= 1 && severity <= 3, "PG:INVALID_SEVERITY");

        alertId = alerts.length;
        alerts.push(
            Alert({
                bot: msg.sender,
                transferId: transferId,
                severity: severity,
                evidence: evidence,
                status: AlertStatus.Pending,
                timestamp: block.timestamp
            })
        );

        b.pendingAlerts++;
        emit AlertRaised(alertId, msg.sender, transferId, severity, evidence);
    }

    /**
     * @notice Resolves a pending alert as valid or invalid. Callable only by governance.
     * @param alertId Index of alert to resolve.
     * @param valid True if confirmed malicious, false if false positive.
     */
    function resolveAlert(uint256 alertId, bool valid) external onlyGovernance {
        require(alertId < alerts.length, "PG:INVALID_ALERT");
        Alert storage a = alerts[alertId];
        require(a.status == AlertStatus.Pending, "PG:ALREADY_RESOLVED");

        Bot storage b = bots[a.bot];

        if (valid) {
            a.status = AlertStatus.Valid;
            uint256 reward = (rewardPool * rewardBps) / 10000;
            rewardPool -= reward;
            pendingRewards[a.bot] += reward;
            riskScore.reduce(uint256(a.severity) * 10, "ALERT_VALID");
            emit AlertResolved(alertId, a.bot, true, reward);
        } else {
            a.status = AlertStatus.Invalid;
            uint256 slash = (b.stake * slashBps) / 10000;
            b.stake -= slash;
            rewardPool += slash;

            if (b.stake < minStake) {
                b.registered = false;
                emit BotDeregistered(a.bot);
            }
            emit AlertResolved(alertId, a.bot, false, slash);
        }

        b.pendingAlerts--;
    }

    /**
     * @notice Claims accumulated pending rewards for the calling bot using CEI pattern.
     */
    function claimReward() external nonReentrant {
        uint256 reward = pendingRewards[msg.sender];
        require(reward > 0, "PG:NO_REWARD");

        pendingRewards[msg.sender] = 0;
        (bool sent, ) = msg.sender.call{value: reward}("");
        require(sent, "PG:ETH_TRANSFER_FAILED");

        emit RewardClaimed(msg.sender, reward);
    }

    /**
     * @notice Requests unbonding of bot stake.
     */
    function requestUnbond() external {
        Bot storage b = bots[msg.sender];
        require(b.registered, "PG:NOT_BOT");
        require(b.unbondRequestedAt == 0, "PG:ALREADY_UNBONDING");

        b.unbondRequestedAt = block.timestamp;
        emit UnbondRequested(msg.sender, block.timestamp);
    }

    /**
     * @notice Withdraws stake after unbondDelay has elapsed and no pending alerts remain.
     */
    function withdrawStake() external nonReentrant {
        Bot storage b = bots[msg.sender];
        require(b.registered || b.stake > 0, "PG:NOT_BOT");
        require(b.unbondRequestedAt > 0, "PG:NOT_UNBONDING");
        require(block.timestamp >= b.unbondRequestedAt + unbondDelay, "PG:UNBOND_DELAY");
        require(b.pendingAlerts == 0, "PG:PENDING_ALERTS");

        uint256 amount = b.stake;
        b.stake = 0;
        b.registered = false;
        b.unbondRequestedAt = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "PG:ETH_TRANSFER_FAILED");

        emit StakeWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Funds the reward pool. Can be called by anyone or by the bridge with protocol fees.
     */
    function fundRewardPool() external payable override {
        rewardPool += msg.value;
        emit RewardPoolFunded(msg.sender, msg.value);
    }

    /**
     * @notice Checks if an address is an active registered bot.
     * @param who The address to query.
     */
    function isBot(address who) external view override returns (bool) {
        return bots[who].registered;
    }

    /**
     * @notice Returns bot registration details.
     */
    function getBot(address who) external view returns (Bot memory) {
        return bots[who];
    }

    /**
     * @notice Returns alert details by id.
     */
    function getAlert(uint256 id) external view returns (Alert memory) {
        require(id < alerts.length, "PG:INVALID_ALERT");
        return alerts[id];
    }

    /**
     * @notice Returns total number of alerts raised.
     */
    function alertCount() external view returns (uint256) {
        return alerts.length;
    }

    receive() external payable {
        rewardPool += msg.value;
        emit RewardPoolFunded(msg.sender, msg.value);
    }
}
