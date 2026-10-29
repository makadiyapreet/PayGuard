// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BridgeBound.sol";
import "./interfaces/IDefenderMonitor.sol";
import "./interfaces/IRiskScore.sol";
import "./interfaces/IPausable.sol";

/**
 * @title DefenderMonitor
 * @notice OpenZeppelin Defender-style rule-based monitoring, emergency pausing, and multi-sig + timelock governance.
 */
contract DefenderMonitor is BridgeBound, IDefenderMonitor {
    enum RuleType {
        LARGE_AMOUNT,
        VELOCITY,
        RAPID_REDEEM,
        NEW_ADDRESS_LARGE
    }

    enum Action {
        ALERT,
        PAUSE,
        BLACKLIST
    }

    struct Rule {
        RuleType ruleType;
        uint256 threshold;
        uint256 window;
        Action action;
        bool active;
    }

    struct UserStats {
        uint256 firstSeen;
        uint256 lastDeposit;
        uint256 windowStart;
        uint256 countInWindow;
    }

    struct Incident {
        uint256 ruleId;
        address user;
        uint256 amount;
        Action action;
        uint256 timestamp;
    }

    struct Proposal {
        address target;
        bytes data;
        uint256 confirmations;
        uint256 eta;
        bool executed;
        bool cancelled;
        address proposer;
    }

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public required;
    uint256 public timelock;

    Rule[] private rules;
    mapping(address => UserStats) public stats;
    mapping(address => bool) public blacklisted;
    Incident[] private incidents;
    Proposal[] private proposals;
    mapping(uint256 => mapping(address => bool)) public confirmedBy;

    IRiskScore public immutable riskScore;
    IPausable public bridgeContract;

    event RuleAdded(uint256 indexed ruleId, RuleType ruleType, uint256 threshold, uint256 window, Action action);
    event RuleActiveSet(uint256 indexed ruleId, bool active);
    event IncidentLogged(uint256 indexed incidentId, uint256 indexed ruleId, address indexed user, uint256 amount, Action action);
    event EmergencyPaused(address indexed caller);
    event ProposalSubmitted(uint256 indexed id, address indexed proposer, address indexed target, bytes data);
    event ProposalConfirmed(uint256 indexed id, address indexed owner);
    event ProposalConfirmationRevoked(uint256 indexed id, address indexed owner);
    event ProposalQueued(uint256 indexed id, uint256 eta);
    event ProposalExecuted(uint256 indexed id, address indexed executor);
    event ProposalCancelled(uint256 indexed id);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event RequiredChanged(uint256 newRequired);
    event UserBlacklisted(address indexed user);
    event UserUnblacklisted(address indexed user);

    modifier onlyOwner() {
        require(isOwner[msg.sender], "PG:NOT_OWNER");
        _;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "PG:NOT_SELF");
        _;
    }

    /**
     * @notice Initializes DefenderMonitor with multi-sig owners, confirmation quorum, timelock, and risk score.
     */
    constructor(
        address[] memory owners_,
        uint256 required_,
        uint256 timelock_,
        address riskScore_
    ) {
        require(owners_.length > 0, "PG:NO_OWNERS");
        require(required_ >= 1 && required_ <= owners_.length, "PG:INVALID_REQUIRED");
        require(riskScore_ != address(0), "PG:ZERO_ADDR");

        for (uint256 i = 0; i < owners_.length; i++) {
            address o = owners_[i];
            require(o != address(0), "PG:ZERO_ADDR");
            require(!isOwner[o], "PG:DUP_OWNER");
            isOwner[o] = true;
            owners.push(o);
        }

        required = required_;
        timelock = timelock_;
        riskScore = IRiskScore(riskScore_);
    }

    /**
     * @notice Hooks bridge address to the typed IPausable interface as well.
     */
    function _onBridgeSet(address b) internal {
        bridgeContract = IPausable(b);
    }

    /**
     * @notice External wrapper to set bridge and pausable reference.
     * @param b Bridge address.
     */
    function setBridge(address b) external override onlyGovernance {
        require(bridge == address(0), "PG:BRIDGE_SET");
        require(b != address(0), "PG:ZERO_ADDR");
        bridge = b;
        _onBridgeSet(b);
        emit BridgeSet(b);
    }

    /**
     * @notice Adds a monitoring rule. Callable only by governance.
     */
    function addRule(
        RuleType ruleType,
        uint256 threshold,
        uint256 window,
        Action action
    ) external onlyGovernance returns (uint256 id) {
        id = rules.length;
        rules.push(Rule({
            ruleType: ruleType,
            threshold: threshold,
            window: window,
            action: action,
            active: true
        }));
        emit RuleAdded(id, ruleType, threshold, window, action);
    }

    /**
     * @notice Enables or disables an existing rule. Callable only by governance.
     */
    function setRuleActive(uint256 id, bool active) external onlyGovernance {
        require(id < rules.length, "PG:INVALID_RULE");
        rules[id].active = active;
        emit RuleActiveSet(id, active);
    }

    /**
     * @notice Evaluates rules reactively for a deposit or redeem event.
     * @param user The interacting account.
     * @param amount The transaction amount.
     * @param isRedeem True if redemption, false if deposit.
     */
    function evaluate(
        address user,
        uint256 amount,
        bool isRedeem
    ) external override onlyBridge {
        UserStats storage s = stats[user];
        bool isNew = (s.firstSeen == 0);
        if (isNew) {
            s.firstSeen = block.timestamp;
        }

        for (uint256 i = 0; i < rules.length; i++) {
            Rule storage r = rules[i];
            if (!r.active) continue;

            bool triggered = false;

            if (r.ruleType == RuleType.LARGE_AMOUNT) {
                if (amount >= r.threshold) {
                    triggered = true;
                }
            } else if (r.ruleType == RuleType.VELOCITY) {
                if (!isRedeem) {
                    if (s.windowStart == 0 || block.timestamp >= s.windowStart + r.window) {
                        s.windowStart = block.timestamp;
                        s.countInWindow = 1;
                    } else {
                        s.countInWindow++;
                    }
                    if (s.countInWindow >= r.threshold) {
                        triggered = true;
                    }
                }
            } else if (r.ruleType == RuleType.RAPID_REDEEM) {
                if (isRedeem && s.lastDeposit > 0 && block.timestamp - s.lastDeposit <= r.window && amount >= r.threshold) {
                    triggered = true;
                }
            } else if (r.ruleType == RuleType.NEW_ADDRESS_LARGE) {
                if (isNew && amount >= r.threshold) {
                    triggered = true;
                }
            }

            if (triggered) {
                _executeAction(i, user, amount, r.action);
            }
        }

        if (!isRedeem) {
            s.lastDeposit = block.timestamp;
        }
    }

    function _executeAction(
        uint256 ruleId,
        address user,
        uint256 amount,
        Action action
    ) internal {
        uint256 incId = incidents.length;
        incidents.push(Incident({
            ruleId: ruleId,
            user: user,
            amount: amount,
            action: action,
            timestamp: block.timestamp
        }));

        if (action == Action.ALERT) {
            riskScore.reduce(5, "DEFENDER_ALERT");
        } else if (action == Action.PAUSE) {
            riskScore.reduce(15, "DEFENDER_PAUSE");
            if (address(bridgeContract) != address(0)) {
                bridgeContract.pause();
            }
        } else if (action == Action.BLACKLIST) {
            riskScore.reduce(15, "DEFENDER_BLACKLIST");
            blacklisted[user] = true;
            emit UserBlacklisted(user);
        }

        emit IncidentLogged(incId, ruleId, user, amount, action);
    }

    /**
     * @notice Immediate emergency pause by any multi-sig owner without timelock.
     */
    function emergencyPause() external onlyOwner {
        riskScore.reduce(15, "EMERGENCY_PAUSE");
        if (address(bridgeContract) != address(0)) {
            bridgeContract.pause();
        }
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @notice Submits a governance proposal. Proposer automatically confirms.
     */
    function submitProposal(address target, bytes calldata data) external onlyOwner returns (uint256 id) {
        require(target != address(0), "PG:ZERO_ADDR");
        id = proposals.length;

        proposals.push(Proposal({
            target: target,
            data: data,
            confirmations: 1,
            eta: 0,
            executed: false,
            cancelled: false,
            proposer: msg.sender
        }));

        confirmedBy[id][msg.sender] = true;
        emit ProposalSubmitted(id, msg.sender, target, data);
        emit ProposalConfirmed(id, msg.sender);

        if (required == 1) {
            proposals[id].eta = block.timestamp + timelock;
            emit ProposalQueued(id, proposals[id].eta);
        }
    }

    /**
     * @notice Confirms a proposal. Sets ETA when required threshold is reached.
     */
    function confirmProposal(uint256 id) external onlyOwner {
        require(id < proposals.length, "PG:INVALID_PROPOSAL");
        Proposal storage p = proposals[id];
        require(!p.executed && !p.cancelled, "PG:PROPOSAL_CLOSED");
        require(!confirmedBy[id][msg.sender], "PG:ALREADY_CONFIRMED");

        confirmedBy[id][msg.sender] = true;
        p.confirmations++;
        emit ProposalConfirmed(id, msg.sender);

        if (p.confirmations == required && p.eta == 0) {
            p.eta = block.timestamp + timelock;
            emit ProposalQueued(id, p.eta);
        }
    }

    /**
     * @notice Revokes a previously given confirmation.
     */
    function revokeConfirmation(uint256 id) external onlyOwner {
        require(id < proposals.length, "PG:INVALID_PROPOSAL");
        Proposal storage p = proposals[id];
        require(!p.executed && !p.cancelled, "PG:PROPOSAL_CLOSED");
        require(confirmedBy[id][msg.sender], "PG:NOT_CONFIRMED");

        confirmedBy[id][msg.sender] = false;
        p.confirmations--;
        emit ProposalConfirmationRevoked(id, msg.sender);

        if (p.confirmations < required) {
            p.eta = 0;
        }
    }

    /**
     * @notice Executes a confirmed proposal after timelock expiration.
     */
    function executeProposal(uint256 id) external onlyOwner returns (bytes memory) {
        require(id < proposals.length, "PG:INVALID_PROPOSAL");
        Proposal storage p = proposals[id];
        require(!p.executed && !p.cancelled, "PG:PROPOSAL_CLOSED");
        require(p.confirmations >= required, "PG:NOT_ENOUGH_CONFIRMATIONS");
        require(p.eta > 0 && block.timestamp >= p.eta, "PG:TIMELOCK_NOT_EXPIRED");

        p.executed = true;
        (bool success, bytes memory result) = p.target.call(p.data);
        require(success, "PG:CALL_FAILED");

        emit ProposalExecuted(id, msg.sender);
        return result;
    }

    /**
     * @notice Cancels an unexecuted proposal by its proposer.
     */
    function cancelProposal(uint256 id) external {
        require(id < proposals.length, "PG:INVALID_PROPOSAL");
        Proposal storage p = proposals[id];
        require(msg.sender == p.proposer, "PG:NOT_PROPOSER");
        require(!p.executed && !p.cancelled, "PG:PROPOSAL_CLOSED");

        p.cancelled = true;
        emit ProposalCancelled(id);
    }

    /**
     * @notice Adds owner to multi-sig via proposal.
     */
    function addOwner(address newOwner) external onlySelf {
        require(newOwner != address(0), "PG:ZERO_ADDR");
        require(!isOwner[newOwner], "PG:DUP_OWNER");
        isOwner[newOwner] = true;
        owners.push(newOwner);
        emit OwnerAdded(newOwner);
    }

    /**
     * @notice Removes owner from multi-sig via proposal.
     */
    function removeOwner(address owner) external onlySelf {
        require(isOwner[owner], "PG:NOT_OWNER");
        require(owners.length - 1 >= required, "PG:REQUIRED_VIOLATION");
        isOwner[owner] = false;

        uint256 len = owners.length;
        for (uint256 i = 0; i < len; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[len - 1];
                owners.pop();
                break;
            }
        }
        emit OwnerRemoved(owner);
    }

    /**
     * @notice Changes required multi-sig confirmation count via proposal.
     */
    function changeRequired(uint256 newRequired) external onlySelf {
        require(newRequired >= 1 && newRequired <= owners.length, "PG:INVALID_REQUIRED");
        required = newRequired;
        emit RequiredChanged(newRequired);
    }

    /**
     * @notice Blacklists a user directly. Callable only by governance.
     */
    function blacklist(address user) external onlyGovernance {
        require(user != address(0), "PG:ZERO_ADDR");
        blacklisted[user] = true;
        emit UserBlacklisted(user);
    }

    /**
     * @notice Unblacklists a user. Callable only by governance.
     */
    function unblacklist(address user) external onlyGovernance {
        blacklisted[user] = false;
        emit UserUnblacklisted(user);
    }

    /**
     * @notice Checks if an address is blacklisted.
     */
    function isBlacklisted(address who) external view override returns (bool) {
        return blacklisted[who];
    }

    /**
     * @notice Returns rule by index.
     */
    function getRule(uint256 id) external view returns (Rule memory) {
        require(id < rules.length, "PG:INVALID_RULE");
        return rules[id];
    }

    /**
     * @notice Returns total number of rules configured.
     */
    function ruleCount() external view returns (uint256) {
        return rules.length;
    }

    /**
     * @notice Returns incident details by index.
     */
    function getIncident(uint256 id) external view returns (Incident memory) {
        require(id < incidents.length, "PG:INVALID_INCIDENT");
        return incidents[id];
    }

    /**
     * @notice Returns total number of incidents logged.
     */
    function incidentCount() external view returns (uint256) {
        return incidents.length;
    }

    /**
     * @notice Returns proposal details by index.
     */
    function getProposal(uint256 id) external view returns (Proposal memory) {
        require(id < proposals.length, "PG:INVALID_PROPOSAL");
        return proposals[id];
    }

    /**
     * @notice Returns total number of proposals.
     */
    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    /**
     * @notice Returns array of current multi-sig owners.
     */
    function getOwners() external view returns (address[] memory) {
        return owners;
    }
}
