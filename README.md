# PayGuard — Layered Payment-Integrity Bridge System

[![Solidity 0.8.20](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)
[![Truffle 5.11.x](https://img.shields.io/badge/Truffle-5.11.x-orange.svg)](https://trufflesuite.com/)
[![Ganache 7.9.x](https://img.shields.io/badge/Ganache-7.9.x-yellow.svg)](https://trufflesuite.com/ganache/)
[![Tests Passing](https://img.shields.io/badge/Tests-61%20Passing-brightgreen.svg)]()
[![Slither Audited](https://img.shields.io/badge/Slither-Audited-blueviolet.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**PayGuard** is a production-grade, multi-layered payment-integrity cross-chain bridge system developed in Solidity 0.8.20 for the university Blockchain Technology (BCT) final lab examination. It synthesizes six real-world blockchain security architectures into a unified, on-chain closed-loop system:

1. **Before / at Execution:** Certora-style formal invariants and dynamic rate limits (`InvariantGuard`).
2. **At Consensus:** Wormhole Guardian Network $t$-of-$n$ multi-signatures (`GuardianRegistry`).
3. **At Consensus:** Chainlink CCIP Risk Management Network secondary verification and emergency cursing (`RiskManagement`).
4. **After Deployment:** OpenZeppelin Defender reactive sentinel monitoring and multi-sig timelock governance (`DefenderMonitor`).
5. **After Deployment:** Forta Network decentralized staked detection bots, alerting, rewards, and slashing (`DetectionNetwork`).
6. **After Deployment:** CertiK Skynet public dynamic security risk scoring (`RiskScore`).

**Novel Contribution:** The layers are dynamically coupled: confirmed security alerts from Forta bots and automated Defender rule trips directly penalize the on-chain `RiskScore`. As the risk band degrades, `InvariantGuard` automatically and proportionally **shrinks cross-chain transfer limits** ($100\% \to 50\% \to 10\% \to 0\%$) directly on-chain without human latency. High-value transfers ($\ge 5$ ETH) enter a mandatory **1-hour challenge delay window** enabling decentralized bot cancellation.

---

## Architecture

```
                    +---------------------+
   User ----------->|    PaymentBridge    |<---------- Relayer (anyone)
                    +---------+-----------+
     checks before/during      |        monitors after
  +-------------+--------------+-------------+----------------+
  |             |              |             |                |
InvariantGuard GuardianRegistry RiskManagement DefenderMonitor DetectionNetwork
 (limits,      (t-of-n sigs,   (2nd verifier,  (rules, pause,   (bots, alerts,
  invariant)    replay guard)   curse)          multisig+timelock)stake, slash)
  ^                                                  |                |
  |                                                  v                v
  +------------------ risk band --------------- RiskScore <-----------+
                                                  (score 0-100)
```

---

## Account Roles (Ganache Index Mapping)

| Account Index | Address Role | Description |
|---|---|---|
| `0` | Deployer / Bootstrap | Deploys contracts, sets references, transfers governance to DefenderMonitor |
| `1` – `5` | Guardians G1 – G5 | 3-of-5 threshold multi-sig signers (`GuardianRegistry`) |
| `6` – `7` | Risk Nodes R1 – R2 | Chainlink CCIP independent secondary verification nodes (`RiskManagement`) |
| `8` – `9` | Detection Bots B1 – B2 | Staked Forta detection bots, alert submission & challenges (`DetectionNetwork`) |
| `10` – `12` | Owners O1 – O3 | 2-of-3 multi-sig governance owners with 60s timelock (`DefenderMonitor`) |
| `13` | User | Legitimate bridge depositor and redeemer |
| `14` | Attacker | Adversary attempting multi-sig forgeries, replays, and reentrancy |

---

## Global Default Parameters

| Parameter | Configuration Value | Description |
|---|---|---|
| Guardians / Threshold | 5 / 3 | 3-of-5 guardian signatures required for execution |
| RMN Quorum | 2 / 2 | 2-of-2 independent node blessings required |
| Governance Quorum | 2 / 3 | 2-of-3 multi-sig confirmations required |
| Governance Timelock | 60 seconds | Demo-friendly timelock delay |
| Per-Tx Limit | 10 ether | Maximum base deposit per transaction |
| User Daily Limit | 20 ether | Maximum base deposit per user per 24h |
| Global Daily Limit | 50 ether | Maximum base deposit across all users per 24h |
| Limit Window | 86,400 seconds (24h) | Time interval for rolling rate limits |
| Large Transfer Threshold | 5 ether | Transfers $\ge 5$ ETH trigger 1h challenge window |
| Large Transfer Delay | 3,600 seconds (1h) | Delay period before finalization |
| Transfer Expiry (TTL) | 86,400 seconds (24h) | Transfer valid duration before refund eligibility |
| Bridge Protocol Fee | 10 bps (0.10%) | Fee routed directly to Forta bot reward pool |
| Bot Minimum Stake | 1 ether | Minimum stake to register a detection bot |
| Alert Reward Share | 1,000 bps (10%) | Share of reward pool paid per valid alert |
| Alert Slash Share | 5,000 bps (50%) | Share of bot stake slashed per invalid alert |
| Unbonding Delay | 86,400 seconds (24h) | Timelock to withdraw bot stake |
| RiskScore Initial / Recovery | 100 / +5 per 3600s | Starts at 100, recovers +5 points every hour capped at 100 |
| Risk Bands | LOW $\ge 80$, MEDIUM 50–79, HIGH 20–49, CRITICAL $< 20$ | Tiered risk bands |
| Band Multipliers | LOW: 100%, MEDIUM: 50%, HIGH: 10%, CRITICAL: 0% | Multipliers applied to base limits |

---

## Quickstart & Commands

### Prerequisites
- Node.js 18 or 20 LTS (`nvm use 20`)
- Global Truffle: `npm install -g truffle@5.11.5`
- Global Ganache CLI: `npm install -g ganache@7.9.2`

### 1. Launch Ganache Local Testnet
In a separate terminal:
```bash
ganache --port 7545 --accounts 15 --defaultBalanceEther 10000 --deterministic --chain.networkId 5777
```

### 2. Install Project Dependencies
```bash
npm install
```

### 3. Compile Contracts
```bash
npm run compile
```

### 4. Deploy & Wire Full System
```bash
npm run migrate
```

### 5. Run Complete Test Suite (61 Passing Tests)
```bash
npm test
```

### 6. Run Live 5-Minute Demonstration Script
```bash
npm run demo
```

### 7. Run Automated Attack Suite (7 Blocked Attacks)
```bash
npm run attack
```

### 8. Run Slither Static Analyzer
```bash
npm run slither
```

---

## Repository Structure

```text
payguard/
├── contracts/
│   ├── Governed.sol                     # Abstract single-owner governance base
│   ├── BridgeBound.sol                  # Abstract bridge-linked base contract
│   ├── Migrations.sol                   # Truffle migration registry
│   ├── WrappedToken.sol                 # ERC-20 pgETH token with minter/burner role
│   ├── RiskScore.sol                    # CertiK Skynet dynamic score & band manager
│   ├── GuardianRegistry.sol             # Wormhole 3-of-5 multi-sig approval registry
│   ├── RiskManagement.sol               # Chainlink CCIP independent secondary verifier
│   ├── InvariantGuard.sol               # Solvency invariant & dynamic tiered limits
│   ├── DefenderMonitor.sol              # OZ Defender rules, pause, & 2-of-3 timelock gov
│   ├── DetectionNetwork.sol             # Forta staked bots, rewards, slashing, & challenges
│   ├── PaymentBridge.sol                # Core lock-and-mint bridge state machine
│   ├── interfaces/                      # Clean contract interfaces
│   │   ├── IRiskScore.sol
│   │   ├── IGuardianRegistry.sol
│   │   ├── IRiskManagement.sol
│   │   ├── IInvariantGuard.sol
│   │   ├── IDefenderMonitor.sol
│   │   ├── IDetectionNetwork.sol
│   │   └── IPausable.sol
│   └── mocks/                           # Test mocks
│       ├── ReentrancyAttacker.sol       # Tests reentrancy defense on redeem & refund
│       ├── ForceSend.sol                # Invariant solvency check with forced ETH
│       └── MockPausableBridge.sol       # Modular unit testing mock
├── spec/
│   └── PayGuard.spec                    # Certora Prover CVL formal specification
├── migrations/
│   ├── 1_initial_migration.js
│   └── 2_deploy_payguard.js             # Ordered deployment, wiring, & governance transfer
├── test/
│   ├── helpers/
│   │   ├── deploy.js                    # Fresh deployer for isolated test runs
│   │   ├── sign.js                      # Signature collection, v-normalization, & address sorting
│   │   ├── time.js                      # EVM block time manipulation (evm_increaseTime)
│   │   ├── gov.js                       # Multi-sig proposal submission, confirmation, & exec
│   │   └── revert.js                    # Revert assertion helper
│   ├── 01_bridge_happy_path.test.js     # Tests 1–6
│   ├── 02_guardians.test.js             # Tests 7–12
│   ├── 03_risk_management.test.js       # Tests 13–18
│   ├── 04_invariants.test.js            # Tests 19–25
│   ├── 05_defender.test.js              # Tests 26–34
│   ├── 06_detection.test.js             # Tests 35–40
│   ├── 07_risk_score.test.js            # Tests 41–44
│   ├── 08_attack_scenarios.test.js      # Tests 45–52
│   └── 09_governance_fees_gas.test.js   # Tests 53–61 (including 20-deposit fuzz test)
├── scripts/
│   ├── demo.js                          # 8-step live demonstration script
│   ├── attack.js                        # Penetration attack testing script
│   ├── report.js                        # System state report generator
│   ├── rmn.js                           # CCIP independent digest verification node
│   └── sign.js                          # CLI guardian signature collector
└── docs/
    ├── ARCHITECTURE.md                  # Component & Mermaid sequence/state diagrams
    ├── DECISIONS.md                     # Architectural decisions & design choices
    ├── SECURITY_NOTES.md                # Threat model & Slither audit justifications
    ├── TEST_REPORT.md                   # Real test outputs & bytecode sizes (< 24 KB)
    ├── GAS_TABLE.md                     # On-chain gas benchmark table
    ├── VIVA_PREP.md                     # 32 viva questions & answers with ownership matrix
    ├── IA1_MAPPING.md                   # Research mapping table to IA1 presentation
    ├── DEMO_CHECKLIST.md                # Pre-exam rehearsal checklist & fallback steps
    └── CONTRIBUTIONS.md                 # Roll number ownership breakdown (413 / 414 / 417)
```

---

## License

This project is licensed under the [MIT License](LICENSE).
