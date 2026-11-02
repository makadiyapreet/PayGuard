// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Governed.sol";
import "./WrappedToken.sol";
import "./GuardianRegistry.sol";
import "./InvariantGuard.sol";
import "./RiskManagement.sol";
import "./DefenderMonitor.sol";
import "./DetectionNetwork.sol";
import "./interfaces/IPausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PaymentBridge
 * @notice Core Payment-Integrity Bridge combining on-chain invariants, multi-sig guardians, RMN blessing,
 * Defender automated rules, and Forta detection networks.
 */
contract PaymentBridge is Governed, ReentrancyGuard, IPausable {
    enum TransferState {
        None,
        Pending,
        Verified,
        Executed,
        Challenged,
        Refunded
    }

    struct Transfer {
        address sender;
        address recipient;
        uint256 netAmount;
        uint256 fee;
        uint256 nonce;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 executableAt;
        bool isLarge;
        TransferState state;
    }

    WrappedToken public immutable token;
    GuardianRegistry public immutable registry;
    InvariantGuard public immutable guard;
    RiskManagement public immutable rmn;
    DefenderMonitor public immutable monitor;
    DetectionNetwork public immutable detection;

    uint256 public immutable feeBps;
    uint256 public immutable largeThreshold;
    uint256 public immutable largeDelay;
    uint256 public immutable ttl;

    bool public paused;
    mapping(bytes32 => Transfer) public transfers;
    mapping(address => uint256) public nonces;
    bytes32[] private transferIds;

    uint256 public totalDeposited;
    uint256 public totalExecuted;
    uint256 public totalRedeemed;
    uint256 public totalRefunded;
    uint256 public transferCount;

    event Deposited(
        bytes32 indexed id,
        address indexed sender,
        address indexed recipient,
        uint256 netAmount,
        uint256 fee,
        uint256 nonce,
        bool isLarge,
        uint256 expiresAt,
        bytes32 digest
    );
    event Verified(bytes32 indexed id, uint256 executableAt);
    event Executed(bytes32 indexed id, address indexed recipient, uint256 amount);
    event Challenged(bytes32 indexed id, address indexed challenger, string reason);
    event Refunded(bytes32 indexed id, address indexed sender, uint256 amount);
    event Redeemed(address indexed user, uint256 amount);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier operational() {
        require(!paused, "PG:PAUSED");
        require(!rmn.isCursed(), "PG:CURSED");
        _;
    }

    /**
     * @notice Initializes bridge dependencies and parameters.
     */
    constructor(
        address token_,
        address registry_,
        address guard_,
        address rmn_,
        address monitor_,
        address detection_,
        uint256 feeBps_,
        uint256 largeThreshold_,
        uint256 largeDelay_,
        uint256 ttl_
    ) {
        require(
            token_ != address(0) &&
                registry_ != address(0) &&
                guard_ != address(0) &&
                rmn_ != address(0) &&
                monitor_ != address(0) &&
                detection_ != address(0),
            "PG:ZERO_ADDR"
        );
        require(feeBps_ <= 10000, "PG:INVALID_FEE");

        token = WrappedToken(token_);
        registry = GuardianRegistry(registry_);
        guard = InvariantGuard(guard_);
        rmn = RiskManagement(rmn_);
        monitor = DefenderMonitor(monitor_);
        detection = DetectionNetwork(payable(detection_));

        feeBps = feeBps_;
        largeThreshold = largeThreshold_;
        largeDelay = largeDelay_;
        ttl = ttl_;
    }

    /**
     * @notice Computes approval digest required for guardian signing and RMN blessing.
     * @param id The transfer ID.
     */
    function getDigest(bytes32 id) public view returns (bytes32) {
        Transfer storage t = transfers[id];
        return
            keccak256(
                abi.encode(
                    keccak256("PAYGUARD_APPROVAL_V1"),
                    block.chainid,
                    address(this),
                    id,
                    t.sender,
                    t.recipient,
                    t.netAmount,
                    t.nonce,
                    t.expiresAt
                )
            );
    }

    /**
     * @notice Deposits ETH to bridge, funds detection reward pool with fee, logs reactive incident check.
     * @param recipient Target account on destination / receiving wrapped token.
     */
    function deposit(
        address recipient
    ) external payable operational nonReentrant returns (bytes32 id) {
        require(recipient != address(0), "PG:ZERO_ADDR");
        require(msg.value > 0, "PG:ZERO_AMOUNT");
        require(
            !monitor.isBlacklisted(msg.sender) && !monitor.isBlacklisted(recipient),
            "PG:BLACKLISTED"
        );

        guard.checkDeposit(msg.sender, msg.value);

        uint256 fee = (msg.value * feeBps) / 10000;
        uint256 net = msg.value - fee;
        uint256 nonce = nonces[msg.sender];
        nonces[msg.sender]++;

        id = keccak256(
            abi.encode(block.chainid, address(this), msg.sender, recipient, net, nonce)
        );
        bool isLarge = (net >= largeThreshold);
        uint256 exp = block.timestamp + ttl;

        transfers[id] = Transfer({
            sender: msg.sender,
            recipient: recipient,
            netAmount: net,
            fee: fee,
            nonce: nonce,
            createdAt: block.timestamp,
            expiresAt: exp,
            executableAt: 0,
            isLarge: isLarge,
            state: TransferState.Pending
        });

        transferCount++;
        totalDeposited += msg.value;
        transferIds.push(id);
        bytes32 digest = getDigest(id);

        if (fee > 0) {
            detection.fundRewardPool{value: fee}();
        }

        emit Deposited(id, msg.sender, recipient, net, fee, nonce, isLarge, exp, digest);
        monitor.evaluate(msg.sender, msg.value, false);
    }

    /**
     * @notice Executes verified transfer with guardian multi-sig and RMN blessing.
     * @param id The transfer ID.
     * @param sigs Array of sorted guardian signatures.
     */
    function execute(
        bytes32 id,
        bytes[] calldata sigs
    ) external operational nonReentrant {
        Transfer storage t = transfers[id];
        require(t.state == TransferState.Pending, "PG:NOT_PENDING");
        require(block.timestamp <= t.expiresAt, "PG:EXPIRED");
        require(!monitor.isBlacklisted(t.recipient), "PG:BLACKLISTED");

        bytes32 digest = getDigest(id);
        require(registry.verifyApproval(digest, sigs), "PG:BAD_SIGS");
        require(rmn.isBlessed(id, digest), "PG:NOT_BLESSED");

        registry.markUsed(digest);

        if (t.isLarge) {
            t.state = TransferState.Verified;
            t.executableAt = block.timestamp + largeDelay;
            emit Verified(id, t.executableAt);
        } else {
            _mint(id);
        }
    }

    /**
     * @notice Finalizes execution of a delayed large transfer after timelock elapses.
     * @param id The transfer ID.
     */
    function finalizeLarge(bytes32 id) external operational nonReentrant {
        Transfer storage t = transfers[id];
        require(t.state == TransferState.Verified, "PG:NOT_VERIFIED");
        require(block.timestamp >= t.executableAt, "PG:DELAY_ACTIVE");
        require(!monitor.isBlacklisted(t.recipient), "PG:BLACKLISTED");

        _mint(id);
    }

    function _mint(bytes32 id) internal {
        Transfer storage t = transfers[id];
        t.state = TransferState.Executed;
        totalExecuted += t.netAmount;

        token.mint(t.recipient, t.netAmount);
        emit Executed(id, t.recipient, t.netAmount);

        require(guard.checkInvariant(), "PG:INVARIANT");
    }

    /**
     * @notice Challenges a pending or verified delayed transfer.
     * @param id The transfer ID.
     * @param reason The challenge reason.
     */
    function challenge(bytes32 id, string calldata reason) external {
        require(
            registry.isGuardian(msg.sender) ||
                detection.isBot(msg.sender) ||
                msg.sender == governance,
            "PG:NOT_CHALLENGER"
        );

        Transfer storage t = transfers[id];
        require(
            t.state == TransferState.Pending ||
                (t.state == TransferState.Verified && block.timestamp < t.executableAt),
            "PG:CANNOT_CHALLENGE"
        );

        t.state = TransferState.Challenged;
        emit Challenged(id, msg.sender, reason);
    }

    /**
     * @notice Refunds a transfer if challenged, expired, or bridge is cursed.
     * @param id The transfer ID.
     */
    function refund(bytes32 id) external nonReentrant {
        Transfer storage t = transfers[id];

        bool canRefund = (t.state == TransferState.Challenged) ||
            (t.state == TransferState.Pending && block.timestamp > t.expiresAt) ||
            ((t.state == TransferState.Pending || t.state == TransferState.Verified) &&
                rmn.isCursed());

        require(canRefund, "PG:CANNOT_REFUND");

        t.state = TransferState.Refunded;
        uint256 refundAmount = t.netAmount;
        totalRefunded += refundAmount;

        (bool sent, ) = t.sender.call{value: refundAmount}("");
        require(sent, "PG:ETH_TRANSFER_FAILED");

        emit Refunded(id, t.sender, refundAmount);
        require(guard.checkInvariant(), "PG:INVARIANT");
    }

    /**
     * @notice Redeems wrapped token pgETH back into native ETH.
     * @param amount Amount of pgETH to redeem.
     */
    function redeem(uint256 amount) external operational nonReentrant {
        require(amount > 0, "PG:ZERO_AMOUNT");
        require(!monitor.isBlacklisted(msg.sender), "PG:BLACKLISTED");

        token.burn(msg.sender, amount);
        totalRedeemed += amount;

        monitor.evaluate(msg.sender, amount, true);

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "PG:ETH_TRANSFER_FAILED");

        require(guard.checkInvariant(), "PG:INVARIANT");
        emit Redeemed(msg.sender, amount);
    }

    /**
     * @notice Pauses the bridge. Callable only by the DefenderMonitor contract.
     */
    function pause() external override {
        require(msg.sender == address(monitor), "PG:NOT_MONITOR");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpauses the bridge. Callable only by governance (DefenderMonitor via proposal).
     */
    function unpause() external override onlyGovernance {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Returns transfer details.
     */
    function getTransfer(bytes32 id) external view returns (Transfer memory) {
        return transfers[id];
    }

    /**
     * @notice Returns statistical metrics for reporting and invariant validation.
     */
    function getStats()
        external
        view
        returns (
            uint256 deposited,
            uint256 executed,
            uint256 redeemed,
            uint256 refunded,
            uint256 balance,
            uint256 totalSupply
        )
    {
        return (
            totalDeposited,
            totalExecuted,
            totalRedeemed,
            totalRefunded,
            address(this).balance,
            token.totalSupply()
        );
    }

    receive() external payable {
        revert("PG:NO_DIRECT_ETH");
    }

    /**
     * @notice Returns transfer ID at specified index.
     */
    function transferIdAt(uint256 i) external view returns (bytes32) {
        require(i < transferIds.length, "PG:INVALID_INDEX");
        return transferIds[i];
    }

    /**
     * @notice Returns total number of transfers recorded.
     */
    function transferTotal() external view returns (uint256) {
        return transferIds.length;
    }

    /**
     * @notice Returns core bridge configuration.
     */
    function getConfig()
        external
        view
        returns (
            uint256 _feeBps,
            uint256 _largeThreshold,
            uint256 _largeDelay,
            uint256 _ttl,
            bool _paused
        )
    {
        return (feeBps, largeThreshold, largeDelay, ttl, paused);
    }

    /**
     * @notice Previews deposit execution without state mutation.
     * @return ok True if deposit would pass all checks.
     * @return layer Blocking layer: 0=CORE, 1=L1, 2=L2, 3=L3.
     * @return reason Revert reason if failed.
     * @return fee Estimated protocol fee.
     * @return net Estimated net pgETH amount.
     * @return isLarge Whether transfer triggers delay window.
     */
    function previewDeposit(
        address user,
        address recipient,
        uint256 amount
    )
        external
        view
        returns (
            bool ok,
            uint8 layer,
            string memory reason,
            uint256 fee,
            uint256 net,
            bool isLarge
        )
    {
        if (recipient == address(0)) {
            return (false, 0, "PG:ZERO_ADDR", 0, 0, false);
        }
        if (amount == 0) {
            return (false, 0, "PG:ZERO_AMOUNT", 0, 0, false);
        }
        if (paused) {
            return (false, 3, "PG:PAUSED", 0, 0, false);
        }
        if (rmn.isCursed()) {
            return (false, 2, "PG:CURSED", 0, 0, false);
        }
        if (monitor.isBlacklisted(user) || monitor.isBlacklisted(recipient)) {
            return (false, 3, "PG:BLACKLISTED", 0, 0, false);
        }

        (bool guardOk, string memory guardReason) = guard.previewCheck(user, amount);
        if (!guardOk) {
            return (false, 1, guardReason, 0, 0, false);
        }

        fee = (amount * feeBps) / 10000;
        net = amount - fee;
        isLarge = (net >= largeThreshold);
        return (true, 0, "", fee, net, isLarge);
    }

    /**
     * @notice Previews transfer execution against all consensus and verification rules.
     * @return ok True if execution would succeed.
     * @return layer Blocking layer: 0=CORE, 1=L1, 2=L2, 3=L3.
     * @return reason Error string on failure.
     */
    function previewExecute(
        bytes32 id,
        bytes[] calldata sigs
    ) external view returns (bool ok, uint8 layer, string memory reason) {
        Transfer storage t = transfers[id];
        if (t.state != TransferState.Pending) {
            return (false, 0, "PG:NOT_PENDING");
        }
        if (block.timestamp > t.expiresAt) {
            return (false, 0, "PG:EXPIRED");
        }
        if (paused) {
            return (false, 3, "PG:PAUSED");
        }
        if (rmn.isCursed()) {
            return (false, 2, "PG:CURSED");
        }
        if (monitor.isBlacklisted(t.recipient)) {
            return (false, 3, "PG:BLACKLISTED");
        }

        bytes32 digest = getDigest(id);
        if (!registry.verifyApproval(digest, sigs)) {
            return (false, 2, "PG:BAD_SIGS");
        }
        if (!rmn.isBlessed(id, digest)) {
            return (false, 2, "PG:NOT_BLESSED");
        }
        if (registry.isUsed(digest)) {
            return (false, 2, "PG:REPLAY");
        }

        return (true, 0, "");
    }

    /**
     * @notice Previews transfer refund eligibility.
     */
    function previewRefund(
        bytes32 id
    ) external view returns (bool ok, string memory reason) {
        Transfer storage t = transfers[id];
        bool canRefund = (t.state == TransferState.Challenged) ||
            (t.state == TransferState.Pending && block.timestamp > t.expiresAt) ||
            ((t.state == TransferState.Pending || t.state == TransferState.Verified) &&
                rmn.isCursed());

        if (canRefund) {
            return (true, "");
        }
        return (false, "PG:CANNOT_REFUND");
    }
}

