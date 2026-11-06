# PayGuard Control Center — Comprehensive User & Demonstration Guide

Welcome to **PayGuard Control Center**! This guide walks you through every feature of the project step-by-step, explaining how to run, use, and demonstrate each security layer.

---

## 1. Quick Start Commands

Open a terminal in the project directory:

```bash
# 1. Start Ganache (if not already running)
ganache --port 7545 --networkId 5777 --chainId 1337 --accounts 15 --defaultBalanceEther 10000

# 2. Reset contracts to a completely clean state (0 transactions)
npm run reset

# 3. (Optional) Seed the chain with rich demo transfers, guardian signatures, and bot alerts
npm run seed

# 4. Launch the frontend dashboard (opens on http://127.0.0.1:5173)
npm run frontend

# 5. Run automated test suite (69 tests across 10 suites)
npm test
```

---

## 2. Light / Dark Theme Toggle

In the top right navigation bar:
- Click the **Sun / Moon** icon (`Light` / `Dark`) to toggle between themes.
- Light Mode provides high-contrast cards, clean slate backgrounds, and crisp borders, ideal for bright rooms or projector screens.
- Your theme preference is automatically remembered across page reloads.

---

## 3. Account Switcher ("Acting As")

In the top right navigation bar, click the **Acting As** dropdown to switch between the 15 deterministic Ganache roles:
- **#0 Deployer / Admin**
- **#1 – #5 Guardians G1 to G5** (Wormhole signature network, quorum 3/5)
- **#6 – #7 Risk Nodes R1 and R2** (Chainlink CCIP RMN, quorum 2/2)
- **#8 – #9 Detection Bots B1 and B2** (Forta staked bots)
- **#10 – #12 Governance Owners O1 to O3** (Defender Multi-Sig, quorum 2/3)
- **#13 Regular User** (Default for transfers)
- **#14 Attacker** (Simulates unauthorized / malicious calls)

---

## 4. Step-by-Step Feature Walkthrough

### 1. Command Center (`/`)
- **What it shows:**
  - Real-time protocol status badge (`BRIDGE ACTIVE` or `HALTED`).
  - Latest block number and EVM timestamp from Ganache.
  - Live CertiK Risk Score gauge ($100/100$, Band: LOW).
  - **Solvency Invariant Card:** Confirms that `PaymentBridge ETH Balance >= WrappedToken pgETH Supply` at all times.
  - Architecture pipeline visualization (Deposit $\to$ L1 Gate $\to$ L2 Consensus $\to$ Timelock $\to$ Execution).

---

### 2. Transfers Page (`/transfers`)
- **How to execute a transfer manually:**
  1. Set **Acting As** to **#13 User**.
  2. In the **New Deposit** card:
     - Enter recipient (defaults to user address).
     - Enter amount: e.g. `2.0` ETH.
     - Observe the **Pre-Execution Gate** turn green: shows Fee `0.002 ETH` (10 bps) and Net `1.998 ETH`.
     - Click **Deposit ETH**.
  3. Go to **L2 Consensus** to approve:
     - Open **Guardians & Approvals** (`/l2/guardians`), click **Sign (3 Quorum)**.
     - Open **Risk Network** (`/l2/risk-network`), click **Bless** on Node 1 and Node 2.
  4. Return to **Transfers** or **Approval Studio** and click **Execute Transfer**.
     - `1.998 pgETH` will be minted to the recipient!
- **1-Click Full Transfer:**
  - In the top right of the Transfers page, click **"1-Click Full Transfer"**.
  - Automatically executes the 4-step pipeline in seconds (Deposit $\to$ Collect 3 Guardian Sigs $\to$ 2 RMN Blessings $\to$ Execute Mint).
- **How to test a Large Delayed Transfer:**
  - Deposit `6.0` ETH ($\ge 5.0$ ETH threshold).
  - Notice `isLarge = true`. When executed, instead of minting immediately, it enters the **3600-second Challenge Lock**.
  - A live countdown timer is displayed!

---

### 3. Layer 1: Pre-Execution Gate (`/l1/gate`)
- Real-time solvency invariant meter ($ETH \ge pgETH$).
- Displays the dynamic limits snapshot:
  - Per-Tx Limit: 10 ETH
  - User Daily Limit: 50 ETH
  - Global Daily Limit: 200 ETH
- Explains how these limits scale down automatically if the risk band drops.

---

### 4. Layer 2: Wormhole Guardian Network (`/l2/guardians`)
- 5-Guardian approval studio with independent signing toggles.
- Quorum threshold meter: shows $3/5$ required signatures.
- **Tamper Simulation Toggles:**
  - Toggle **"Unsorted Signatures"** or **"Include Non-Guardian"** to see `previewExecute()` intercept invalid signatures before broadcasting to the network!

---

### 5. Layer 2: Chainlink CCIP Risk Network (`/l2/risk-network`)
- Displays the two independent RMN verifier nodes.
- Quorum blessing status ($2/2$ required).
- **Emergency Curse:** RMN nodes can vote to curse the bridge in an anomaly, halting minting operations instantly and dropping the risk score by 30 points.

---

### 6. Layer 3: Defender Monitor (`/l3/defender`)
- Displays automated rule engines:
  - `HIGH_VALUE_TX` ($>10$ ETH)
  - `RAPID_REDEEM` (re-entrancy & velocity guard)
  - `NEW_ADDRESS_LARGE`
- **Emergency Pause Button:** Allows single-sig pause by monitor or owner.

---

### 7. Layer 3: Detection Network (`/l3/detection`)
- Forta bot staking ($1$ ETH minimum stake).
- Bots raise alerts with evidence string and severity (LOW, MEDIUM, HIGH, CRITICAL).
- Staked bots claim fee shares from the protocol fee pool ($0.10\%$ fee from deposits).

---

### 8. Layer 3: CertiK Risk Score & Bands (`/l3/risk-score`)
- Continuous risk score (0 to 100) with dynamic multiplier bands:
  - **LOW (80–100):** 100% transfer limit (10.0 ETH base limit).
  - **MEDIUM (50–79):** 50% transfer limit (5.0 ETH).
  - **HIGH (20–49):** 10% transfer limit (1.0 ETH).
  - **CRITICAL (0–19):** 0% transfer limit (auto-halt).
- **Recover Points:** Triggers recovery step (+5 points per period) to demonstrate score rehabilitation without manual intervention.

---

### 9. Layer 3: Challenge & Refund Center (`/l3/challenge-refund`)
- **Authorized Challengers Only:** Only registered Forta Bots (Accounts #8, #9) or Wormhole Guardians (Accounts #1–#5) can challenge pending or delayed transfers (`PG:NOT_CHALLENGER`).
- **Submit As Dropdown:** Select `#8 Forta Bot 1` to challenge a suspicious transfer in 1 click.
- **Demo Unauthorized Revert:** Click the "Demo Unauthorized Revert" button to deliberately show the faculty how regular users are blocked from griefing transactions.
- **Claim Refund:** Once a transfer is challenged or passes its expiration timestamp, the original sender can click **Claim Refund** to return their ETH back to their wallet.

---

### 10. Multi-Sig Governance (`/governance`)
- 2-of-3 Owner confirmations + 60s timelock.
- How to unpause after an emergency pause:
  1. Switch to **#10 Owner 1**, click **Submit Unpause Proposal**.
  2. Switch to **#11 Owner 2**, click **Confirm Proposal**.
  3. Click **Fast-Forward Timelock (+65s)** button in Dev Tools.
  4. Click **Execute Proposal** → Bridge is restored to active status!

---

### 11. Automated Penetration & Attack Lab (`/attack-lab`)
- Simulates 10 real-world exploit vectors across all 3 security layers:
  1. **A1: Invariant Limits Breach** (Certora Invariant, blocked by `PG:TX_LIMIT`)
  2. **A2: Direct Fallback ETH Theft** (Plain receive revert, blocked by `PG:NO_DIRECT_ETH`)
  3. **A3: Ronin Quorum Theft** (Fewer than 3 guardian signatures, blocked by `PG:BAD_SIGS`)
  4. **A4: Wormhole Signature Forgery** (Random invalid ECDSA keys, blocked by `PG:BAD_SIGS`)
  5. **A5: Wormhole Unsorted Keys / Malleability** (Simulated out-of-order keys, blocked by `PG:BAD_SIGS`)
  6. **A6: Chainlink CCIP RMN Bypass** (Unblessed execution attempt, blocked by `PG:NOT_BLESSED`)
  7. **A7: Nomad Replay Exploit** (Re-submitting processed transfer ID, blocked by `PG:NOT_PENDING`)
  8. **A8: Poly Network Reentrancy on Redeem** (Recursive call, blocked by `ReentrancyGuard`)
  9. **A9: Reentrancy Attack on Refund** (Recursive drain, blocked by `ReentrancyGuard`)
  10. **A10: Unauthorized Challenge Griefing** (User challenge, blocked by `PG:NOT_CHALLENGER`)
- Run single attacks individually with **"⚡ Run Single Attack"** or test all 10 at once with **"⚡ Run All 10 Penetration Scenarios"**.
- Expand each card to view the exact line of Solidity defense code and a direct clickable link to where the defense event is visible in the UI.

---

### 12. Gas Analytics (`/gas-analytics`)
- Displays real gas consumption benchmarks:
  - PayGuard Full Security Lifecycle: 867,613 gas
  - Baseline Unprotected Bridge: 185,858 gas
  - **Security Overhead:** +366.81% for 3 comprehensive security layers (Formal Invariants, Dual Consensus, Automated Post-Deployment Defense).

