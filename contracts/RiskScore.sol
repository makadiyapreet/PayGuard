// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Governed.sol";
import "./interfaces/IRiskScore.sol";

/**
 * @title RiskScore
 * @notice CertiK Skynet-style dynamic risk score module that responds to security incidents.
 */
contract RiskScore is Governed, IRiskScore {
    struct ScoreChange {
        uint256 timestamp;
        uint256 oldScore;
        uint256 newScore;
        string reason;
        address by;
    }

    uint256 public score;
    uint256 public lastIncidentAt;
    uint256 public recoveryPoints;
    uint256 public recoveryPeriod;

    mapping(address => bool) public authorized;
    ScoreChange[] private history;

    event ScoreReduced(uint256 oldScore, uint256 newScore, string reason, address indexed by);
    event ScoreRecovered(uint256 oldScore, uint256 newScore, address indexed by);
    event AuthorizedCallerSet(address indexed caller, bool authorized);

    /**
     * @notice Initializes the risk score and recovery parameters.
     * @param initialScore Initial score, up to 100.
     * @param recoveryPoints_ Points regained per recovery period.
     * @param recoveryPeriod_ Time interval in seconds between recoveries.
     */
    constructor(
        uint256 initialScore,
        uint256 recoveryPoints_,
        uint256 recoveryPeriod_
    ) {
        require(initialScore <= 100, "PG:INVALID_SCORE");
        score = initialScore;
        recoveryPoints = recoveryPoints_;
        recoveryPeriod = recoveryPeriod_;
        lastIncidentAt = block.timestamp;
    }

    /**
     * @notice Authorizes or deauthorizes a contract to reduce the risk score.
     * @param who The address to authorize or revoke.
     * @param ok True to authorize, false to revoke.
     */
    function setAuthorized(address who, bool ok) external onlyGovernance {
        require(who != address(0), "PG:ZERO_ADDR");
        authorized[who] = ok;
        emit AuthorizedCallerSet(who, ok);
    }

    /**
     * @notice Reduces the risk score due to an incident.
     * @param points Number of points to deduct.
     * @param reason Incident description.
     */
    function reduce(uint256 points, string calldata reason) external override {
        require(authorized[msg.sender], "PG:NOT_AUTH");
        uint256 oldScore = score;
        uint256 newScore = points > oldScore ? 0 : oldScore - points;

        score = newScore;
        lastIncidentAt = block.timestamp;
        history.push(ScoreChange(block.timestamp, oldScore, newScore, reason, msg.sender));

        emit ScoreReduced(oldScore, newScore, reason, msg.sender);
    }

    /**
     * @notice Recovers risk score based on elapsed time without incidents.
     */
    function recover() external {
        require(score < 100, "PG:NOTHING_TO_RECOVER");
        uint256 elapsed = block.timestamp - lastIncidentAt;
        uint256 steps = elapsed / recoveryPeriod;
        require(steps > 0, "PG:NOTHING_TO_RECOVER");

        uint256 oldScore = score;
        uint256 newScore = oldScore + (steps * recoveryPoints);
        if (newScore > 100) {
            newScore = 100;
        }

        score = newScore;
        lastIncidentAt += steps * recoveryPeriod;
        history.push(ScoreChange(block.timestamp, oldScore, newScore, "RECOVERY", msg.sender));

        emit ScoreRecovered(oldScore, newScore, msg.sender);
    }

    /**
     * @notice Returns current risk score.
     */
    function getScore() external view override returns (uint256) {
        return score;
    }

    /**
     * @notice Returns current risk band according to score.
     */
    function getBand() public view override returns (Band) {
        if (score >= 80) return Band.LOW;
        if (score >= 50) return Band.MEDIUM;
        if (score >= 20) return Band.HIGH;
        return Band.CRITICAL;
    }

    /**
     * @notice Returns total number of score changes recorded.
     */
    function getHistoryLength() external view returns (uint256) {
        return history.length;
    }

    /**
     * @notice Returns history entry at a specific index.
     * @param index Entry index.
     */
    function getHistoryAt(uint256 index) external view returns (ScoreChange memory) {
        require(index < history.length, "PG:OUT_OF_BOUNDS");
        return history[index];
    }
}

