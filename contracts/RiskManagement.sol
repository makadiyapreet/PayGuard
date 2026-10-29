// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Governed.sol";
import "./interfaces/IRiskManagement.sol";
import "./interfaces/IRiskScore.sol";

/**
 * @title RiskManagement
 * @notice Chainlink CCIP RMN-style independent secondary verification and emergency cursing network.
 */
contract RiskManagement is Governed, IRiskManagement {
    uint256 public constant CURSE_PENALTY = 30;

    address[] public nodes;
    mapping(address => bool) public isNode;
    uint256 public quorum;
    bool public cursed;
    uint256 public curseEpoch;
    IRiskScore public immutable riskScore;

    mapping(bytes32 => uint256) public blessCount;
    mapping(bytes32 => mapping(address => bool)) public blessedBy;

    mapping(uint256 => uint256) public curseVotes;
    mapping(uint256 => mapping(address => bool)) public cursedBy;

    event Blessed(bytes32 indexed id, bytes32 indexed digest, address indexed node);
    event CurseVoted(uint256 indexed epoch, address indexed node, string reason);
    event Cursed(uint256 indexed epoch, string reason);
    event Uncursed(uint256 indexed epoch);
    event NodeAdded(address indexed node);
    event NodeRemoved(address indexed node);
    event QuorumChanged(uint256 oldQuorum, uint256 newQuorum);

    modifier onlyNode() {
        require(isNode[msg.sender], "PG:NOT_NODE");
        _;
    }

    /**
     * @notice Initializes RiskManagement with nodes, quorum, and risk score reference.
     * @param nodes_ Array of risk node addresses.
     * @param quorum_ Blessing and curse threshold.
     * @param riskScore_ RiskScore contract address.
     */
    constructor(
        address[] memory nodes_,
        uint256 quorum_,
        address riskScore_
    ) {
        require(nodes_.length > 0, "PG:NO_NODES");
        require(quorum_ >= 1 && quorum_ <= nodes_.length, "PG:INVALID_QUORUM");
        require(riskScore_ != address(0), "PG:ZERO_ADDR");

        for (uint256 i = 0; i < nodes_.length; i++) {
            address n = nodes_[i];
            require(n != address(0), "PG:ZERO_ADDR");
            require(!isNode[n], "PG:DUP_NODE");
            isNode[n] = true;
            nodes.push(n);
            emit NodeAdded(n);
        }

        quorum = quorum_;
        riskScore = IRiskScore(riskScore_);
        emit QuorumChanged(0, quorum_);
    }

    /**
     * @notice Blesses a transfer digest. One vote per node per (id, digest) pair.
     * @param id Transfer id.
     * @param digest Transfer approval digest.
     */
    function bless(bytes32 id, bytes32 digest) external onlyNode {
        bytes32 key = keccak256(abi.encode(id, digest));
        require(!blessedBy[key][msg.sender], "PG:ALREADY_BLESSED");

        blessedBy[key][msg.sender] = true;
        blessCount[key]++;

        emit Blessed(id, digest, msg.sender);
    }

    /**
     * @notice Checks if a transfer approval has reached quorum blessing.
     * @param id Transfer id.
     * @param digest Transfer approval digest.
     */
    function isBlessed(bytes32 id, bytes32 digest) external view override returns (bool) {
        bytes32 key = keccak256(abi.encode(id, digest));
        return blessCount[key] >= quorum;
    }

    /**
     * @notice Casts an emergency curse vote to halt the bridge.
     * @param reason Reason for cursing.
     */
    function curse(string calldata reason) external onlyNode {
        require(!cursed, "PG:ALREADY_CURSED");
        require(!cursedBy[curseEpoch][msg.sender], "PG:ALREADY_CURSED_VOTE");

        cursedBy[curseEpoch][msg.sender] = true;
        curseVotes[curseEpoch]++;
        emit CurseVoted(curseEpoch, msg.sender, reason);

        if (curseVotes[curseEpoch] >= quorum) {
            cursed = true;
            riskScore.reduce(CURSE_PENALTY, "RMN_CURSE");
            emit Cursed(curseEpoch, reason);
        }
    }

    /**
     * @notice Lifts the curse and increments curse epoch. Callable only by governance.
     */
    function uncurse() external onlyGovernance {
        require(cursed, "PG:NOT_CURSED");
        cursed = false;
        curseEpoch++;
        emit Uncursed(curseEpoch);
    }

    /**
     * @notice Adds a risk node. Callable only by governance.
     * @param node Address of the new risk node.
     */
    function addNode(address node) external onlyGovernance {
        require(node != address(0), "PG:ZERO_ADDR");
        require(!isNode[node], "PG:DUP_NODE");

        isNode[node] = true;
        nodes.push(node);
        emit NodeAdded(node);
    }

    /**
     * @notice Removes a risk node. Callable only by governance.
     * @param node Address of the risk node to remove.
     */
    function removeNode(address node) external onlyGovernance {
        require(isNode[node], "PG:NOT_NODE");
        require(nodes.length - 1 >= quorum, "PG:QUORUM_VIOLATION");

        isNode[node] = false;
        uint256 len = nodes.length;
        for (uint256 i = 0; i < len; i++) {
            if (nodes[i] == node) {
                nodes[i] = nodes[len - 1];
                nodes.pop();
                break;
            }
        }

        emit NodeRemoved(node);
    }

    /**
     * @notice Updates the blessing and cursing quorum. Callable only by governance.
     * @param newQuorum New quorum threshold.
     */
    function setQuorum(uint256 newQuorum) external onlyGovernance {
        require(newQuorum >= 1 && newQuorum <= nodes.length, "PG:INVALID_QUORUM");
        uint256 old = quorum;
        quorum = newQuorum;
        emit QuorumChanged(old, newQuorum);
    }

    /**
     * @notice Returns whether the bridge is currently cursed.
     */
    function isCursed() external view override returns (bool) {
        return cursed;
    }

    /**
     * @notice Returns array of current risk nodes.
     */
    function getNodes() external view returns (address[] memory) {
        return nodes;
    }

    /**
     * @notice Returns number of registered risk nodes.
     */
    function nodeCount() external view returns (uint256) {
        return nodes.length;
    }
}
