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
- Continuous risk score ($0$ to $100$) with dynamic multiplier bands:
  - **LOW (80–100):** 100% transfer limit.
  - **MEDIUM (50–79):** 50% transfer limit.
  - **HIGH (20–49):** 10% transfer limit.
  - **CRITICAL (0–19):** 0% transfer limit (auto-halt).
- **Recover Points:** Triggers recovery step (+5 points per period) to simulate score rehabilitation.

---

### 9. Multi-Sig Governance (`/governance`)
- 2-of-3 Owner confirmations + 60s timelock.
- How to unpause after an emergency pause:
  1. Switch to **#10 Owner 1**, click **Submit Unpause Proposal**.
  2. Switch to **#11 Owner 2**, click **Confirm Proposal**.
  3. Click **Fast-Forward Timelock (+65s)** button.
  4. Click **Execute Proposal** $\to$ Bridge is restored to active status!

---

### 10. Attack Lab (`/attack-lab`)
- Simulates 7 historic bridge hacks:
  1. Ronin (insufficient guardian signatures)
  2. Wormhole (forged digest signatures)
  3. Nomad (replay attack)
  4. Poly / DAO (reentrancy on redeem)
  5. DAO (reentrancy on refund)
  6. Direct Fallback ETH send
  7. Invariant Limit Breach (> 10 ETH)
- Demonstrates on-chain revert codes and safety intercepts in real time.

---

### 11. Gas Analytics (`/gas-analytics`)
- Displays real gas consumption benchmarks:
  - PayGuard Lifecycle: 867,613 gas
  - Baseline Unprotected Bridge: 185,858 gas
  - **Security Overhead:** $+366.81\%$ for 6 layers of verifiable enterprise protection.

