# PayGuard Security Analysis & Slither Audit Report

## 1. Threat Model & Defense Matrix

| Threat / Attack Vector | Real-World Incident Reference | PayGuard Defense Layer | Defense Mechanism | Test Case Proving Defense |
|---|---|---|---|---|
| **Guardian Key Compromise (< Threshold)** | Ronin Bridge ($624M) | Consensus Layer (`GuardianRegistry`) | Requires $t$-of-$n$ (3-of-5) valid signatures; 2 signatures rejected with `PG:BAD_SIGS`. | Test 45 |
| **Forged Signature Injection** | Wormhole Bridge ($326M) | Consensus Layer (`GuardianRegistry`) | Signature verification checks signer registration; non-guardian keys rejected. | Test 46 |
| **Approval Replay Attack** | Nomad Bridge ($190M) | Consensus Layer (`GuardianRegistry`) | State transition mapping marks digest as `used`; second attempt rejected with `PG:NOT_PENDING` / `PG:REPLAY`. | Test 10, 47 |
| **Drain via Reentrancy on Redeem** | The DAO ($60M), Poly Network ($611M) | Execution Layer (`PaymentBridge`) | `ReentrancyGuard` modifier + Checks-Effects-Interactions (pgETH burned before ETH transfer). | Test 48 |
| **Drain via Reentrancy on Refund** | Poly Network | Execution Layer (`PaymentBridge`) | State updated to `Refunded` before native ETH sent; `nonReentrant` blocks second entry. | Test 49 |
| **Malicious Whale Withdrawal / Bridge Drain** | Multichain ($126M) | Execution & Post-Deploy (`PaymentBridge` + `DetectionNetwork`) | Transfers $\ge 5$ ETH locked in `Verified` state for 1 hour. Bots challenge inside delay window, enabling refund. | Test 50, 56 |
| **Colluding Guardian Set** | Ronin Bridge | Consensus Layer (`RiskManagement`) | Chainlink CCIP-style independent RMN nodes refuse to bless flagged transactions, halting execution (`PG:NOT_BLESSED`). | Test 16 |
| **Emergency Bridge Exploit in Progress** | Cross-chain flash-loan exploit | Consensus Layer (`RiskManagement`) | 2-of-2 RMN curse immediately halts deposits, executions, and redemptions (`PG:CURSED`) and deducts 30 risk points. | Test 17 |
| **High Velocity Automated Drain** | Bot Spam / Liquidity Drain | Post-Deployment (`DefenderMonitor`) | Sentinel VELOCITY rule triggers on 5+ transactions in 10 minutes, auto-pausing bridge. | Test 27 |
| **Flash-Loan Deposit-Redeem Exploit** | DeFi Price Manipulation | Post-Deployment (`DefenderMonitor`) | RAPID_REDEEM rule trips when redeem occurs within 300s of deposit, auto-pausing bridge. | Test 28 |
| **Direct ETH Drain via Contract Address** | Plain transfer exploit | Execution Layer (`PaymentBridge`) | `receive()` fallback unconditionally reverts with `PG:NO_DIRECT_ETH`. | Test 6 |
| **Deposit Limit Invariant Evasion** | Flash drain attack | Execution Layer (`InvariantGuard`) | Dynamic tiered limits shrink as RiskScore drops; deposits exceeding limits revert `PG:TX_LIMIT`. | Test 19, 23, 51 |
| **Signature Malleability Attack** | High-$s$ signature manipulation | Cryptographic Verification (`GuardianRegistry`) | OpenZeppelin `ECDSA.tryRecover` strictly enforces EIP-2 lower-half $s$ curve values ($s \le n/2$). | Test 58 |

---

## 2. Static Analysis: Slither Audit Findings

Slither 0.11.6 was run against all PayGuard contracts (`slither . --solc-remaps @openzeppelin/=node_modules/@openzeppelin/`). Below is the full evaluation and justification of all detected findings:

### 2.1 `arbitrary-send-eth` in `PaymentBridge.redeem`
- **Slither Diagnostic:** `PaymentBridge.redeem(uint256) sends eth to arbitrary user via (sent, ) = msg.sender.call{value: amount}()`.
- **Security Assessment:** **False Positive / Intended Functionality.** In a wrapped asset bridge, redeeming burns synthetic `pgETH` tokens from `msg.sender` and returns the corresponding locked native ETH. The function is protected by `nonReentrant`, checks `!monitor.isBlacklisted(msg.sender)`, executes token burning prior to the transfer (CEI pattern), and verifies `guard.checkInvariant()` post-transfer.

### 2.2 `low-level-calls` in `PaymentBridge`, `DetectionNetwork`, and `DefenderMonitor`
- **Slither Diagnostic:** Use of `call{value: ...}("")` for native currency transfers and `target.call(data)` in `DefenderMonitor.executeProposal`.
- **Security Assessment:** **Intended Design Pattern.** Solidity's built-in `transfer()` and `send()` forward a hardcoded 2300 gas stipend, which fails with modern smart contract wallets (e.g. Safe, ERC-4337). Using `.call{value: ...}("")` with full reentrancy protection is standard Solidity best practice. In `DefenderMonitor.executeProposal`, arbitrary call execution is restricted to timelocked proposals that reached the 2-of-3 multi-sig owner threshold.

### 2.3 `costly-operations-inside-a-loop` in `GuardianRegistry.removeGuardian`
- **Slither Diagnostic:** `guardians.pop()` inside an array loop.
- **Security Assessment:** **Acceptable / Governance Only.** The guardian array size is bounded ($n = 5$ in default deployment, rarely exceeding 20 in production Wormhole setups). Removal is an infrequent admin action restricted to `onlyGovernance` (the 2-of-3 multi-sig timelock).

### 2.4 `suicidal` in `ForceSend.forceSend`
- **Slither Diagnostic:** Contract allows anyone to destruct via `selfdestruct`.
- **Security Assessment:** **Test Mock Only.** `ForceSend.sol` is located in `contracts/mocks/` and is strictly used in test 25 to simulate forced ETH injections to verify the solvency invariant.

### 2.5 `immutable-states` Recommendations
- **Slither Diagnostic:** Parameters such as `timelock`, `recoveryPeriod`, `minStake` could be declared immutable.
- **Security Assessment:** **Design Choice.** In production decentralized bridges, parameters like detection bot minimum stake and recovery periods may require future tuning via governance proposals without redeploying the entire contract suite.

---

## 3. Trust Assumptions & Failure Modes

1. **DefenderMonitor Multi-Sig Quorum:** If 2 of the 3 multi-sig owners are compromised, governance parameters could be altered. Mitigation: The 60-second timelock allows honest actors or detection bots to observe queued malicious proposals and trigger emergency pause or RMN curse before execution.
2. **Guardian Registry:** If 3 of the 5 guardians are compromised simultaneously, malicious signatures could be generated. Mitigation: The independent CCIP Risk Management Network (`RiskManagement`) must independently bless the transfer. Without RMN quorum, guardian signatures alone cannot execute transactions.
3. **Reactive Nature of Rule Monitoring:** Defender monitoring evaluates transactions reactively. Mitigation: High-value transfers ($\ge 5$ ETH) enter a mandatory 1-hour delay window (`Verified` state), granting bots and guardians the window to challenge and halt the transfer prior to token minting.
