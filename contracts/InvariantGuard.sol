// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BridgeBound.sol";
import "./interfaces/IInvariantGuard.sol";
import "./interfaces/IRiskScore.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title InvariantGuard
 * @notice Enforces dynamic risk-weighted deposit limits and the solvency invariant (bridge balance >= token total supply).
 */
contract InvariantGuard is BridgeBound, IInvariantGuard {
    IRiskScore public immutable riskScore;
    IERC20 public immutable token;

    uint256 public perTxLimit;
    uint256 public userDailyLimit;
    uint256 public globalDailyLimit;
    uint256 public windowSeconds;

    uint256[4] public bandPercent = [100, 50, 10, 0];

    // window => user => spent
    mapping(uint256 => mapping(address => uint256)) public spentByUser;
    // window => globalSpent
    mapping(uint256 => uint256) public globalSpent;

    event DepositChecked(address indexed user, uint256 amount, uint256 window);
    event LimitsUpdated(uint256 perTx, uint256 userDaily, uint256 globalDaily, uint256 window);
    event BandPercentsUpdated(uint256[4] percents);

    /**
     * @notice Initializes limits, window, and references to RiskScore and WrappedToken.
     */
    constructor(
        address riskScore_,
        address token_,
        uint256 perTxLimit_,
        uint256 userDailyLimit_,
        uint256 globalDailyLimit_,
        uint256 windowSeconds_
    ) {
        require(riskScore_ != address(0) && token_ != address(0), "PG:ZERO_ADDR");
        require(windowSeconds_ > 0, "PG:INVALID_WINDOW");

        riskScore = IRiskScore(riskScore_);
        token = IERC20(token_);
        perTxLimit = perTxLimit_;
        userDailyLimit = userDailyLimit_;
        globalDailyLimit = globalDailyLimit_;
        windowSeconds = windowSeconds_;
    }

    /**
     * @notice Returns limit multiplier percentage (0 to 100) based on current risk band.
     */
    function multiplier() public view returns (uint256) {
        return bandPercent[uint256(riskScore.getBand())];
    }

    /**
     * @notice Effective per-transaction limit adjusted by risk band.
     */
    function effectivePerTxLimit() public view returns (uint256) {
        return (perTxLimit * multiplier()) / 100;
    }

    /**
     * @notice Effective user daily limit adjusted by risk band.
     */
    function effectiveUserDailyLimit() public view returns (uint256) {
        return (userDailyLimit * multiplier()) / 100;
    }

    /**
     * @notice Effective global daily limit adjusted by risk band.
     */
    function effectiveGlobalDailyLimit() public view returns (uint256) {
        return (globalDailyLimit * multiplier()) / 100;
    }

    /**
     * @notice Enforces transaction, user, and global limits for a deposit.
     * @param user The deposit sender.
     * @param amount The deposit amount.
     */
    function checkDeposit(
        address user,
        uint256 amount
    ) external override onlyBridge returns (bool) {
        uint256 effPerTx = effectivePerTxLimit();
        require(amount <= effPerTx, "PG:TX_LIMIT");

        uint256 currentWindow = block.timestamp / windowSeconds;

        uint256 effUser = effectiveUserDailyLimit();
        require(spentByUser[currentWindow][user] + amount <= effUser, "PG:USER_LIMIT");

        uint256 effGlobal = effectiveGlobalDailyLimit();
        require(globalSpent[currentWindow] + amount <= effGlobal, "PG:GLOBAL_LIMIT");

        spentByUser[currentWindow][user] += amount;
        globalSpent[currentWindow] += amount;

        emit DepositChecked(user, amount, currentWindow);
        return true;
    }

    /**
     * @notice View-only check of limit rules without modifying storage.
     * @param user The deposit sender.
     * @param amount The deposit amount.
     */
    function previewCheck(
        address user,
        uint256 amount
    ) external view override returns (bool ok, string memory reason) {
        uint256 effPerTx = effectivePerTxLimit();
        if (amount > effPerTx) {
            return (false, "PG:TX_LIMIT");
        }

        uint256 currentWindow = block.timestamp / windowSeconds;
        uint256 effUser = effectiveUserDailyLimit();
        if (spentByUser[currentWindow][user] + amount > effUser) {
            return (false, "PG:USER_LIMIT");
        }

        uint256 effGlobal = effectiveGlobalDailyLimit();
        if (globalSpent[currentWindow] + amount > effGlobal) {
            return (false, "PG:GLOBAL_LIMIT");
        }

        return (true, "");
    }

    /**
     * @notice Comprehensive snapshot of base and effective limits for a given user.
     */
    function limitsSnapshot(
        address user
    )
        external
        view
        returns (
            uint256 perTxBase,
            uint256 perTxEff,
            uint256 userBase,
            uint256 userEff,
            uint256 userSpent,
            uint256 globalBase,
            uint256 globalEff,
            uint256 globalSpentAmount,
            uint256 multiplierPct,
            uint256 windowEndsAt
        )
    {
        uint256 currentWindow = block.timestamp / windowSeconds;
        perTxBase = perTxLimit;
        perTxEff = effectivePerTxLimit();
        userBase = userDailyLimit;
        userEff = effectiveUserDailyLimit();
        userSpent = spentByUser[currentWindow][user];
        globalBase = globalDailyLimit;
        globalEff = effectiveGlobalDailyLimit();
        globalSpentAmount = globalSpent[currentWindow];
        multiplierPct = multiplier();
        windowEndsAt = (currentWindow + 1) * windowSeconds;
    }

    /**
     * @notice Verifies solvency invariant: locked bridge ETH balance >= wrapped token total supply.
     */
    function checkInvariant() external view override returns (bool) {
        return bridge.balance >= token.totalSupply();
    }

    /**
     * @notice Updates base limit values. Callable only by governance.
     */
    function setLimits(
        uint256 perTx,
        uint256 userDaily,
        uint256 globalDaily,
        uint256 window
    ) external onlyGovernance {
        require(window > 0, "PG:INVALID_WINDOW");
        perTxLimit = perTx;
        userDailyLimit = userDaily;
        globalDailyLimit = globalDaily;
        windowSeconds = window;
        emit LimitsUpdated(perTx, userDaily, globalDaily, window);
    }

    /**
     * @notice Updates the percentage multipliers for each band. Callable only by governance.
     * @param percents Array of 4 percentages for [LOW, MEDIUM, HIGH, CRITICAL].
     */
    function setBandPercents(uint256[4] calldata percents) external onlyGovernance {
        bandPercent = percents;
        emit BandPercentsUpdated(percents);
    }
}

