# Team Individual Contributions & Work Breakdown

This project was built collaboratively by a team of three students for the Blockchain Technology (BCT) final lab exam. Work was modularized by security layers, smart contracts, test suites, and off-chain tooling:

---

## 1. Member: 23BCP413
* **Primary Role:** Decentralized Threat Detection & Continuous Risk Scoring
* **Contracts Authored:**
  - `contracts/RiskScore.sol` — Dynamic on-chain risk score, incident penalty reduction, step-based recovery algorithm, and band classification.
  - `contracts/DetectionNetwork.sol` — Forta-style staked bot network, severity alerting, fee-based reward pool, and slashing mechanics.
  - `contracts/interfaces/IRiskScore.sol` & `contracts/interfaces/IDetectionNetwork.sol`
* **Test Suites Owned:**
  - `test/06_detection.test.js` (Tests 35–40: Bot staking, alert validity, reward payout, slashing, unbonding delays).
  - `test/07_risk_score.test.js` (Tests 41–44: Authorized deductions, 0-flooring, band thresholds, recovery periods, event history).
* **Git Commit Prefix:** `[413]`

---

## 2. Member: 23BCP414
* **Primary Role:** Multi-Signature Consensus & Automated Rule Monitoring
* **Contracts Authored:**
  - `contracts/GuardianRegistry.sol` — Wormhole-inspired multi-signature approval registry enforcing strictly ascending signer order and replay guards.
  - `contracts/DefenderMonitor.sol` — OpenZeppelin Defender reactive sentinel monitoring (velocity, large amount, rapid redeem, new address), emergency pause, and 2-of-3 multi-sig + 60s timelock proposal governance.
  - `contracts/interfaces/IGuardianRegistry.sol` & `contracts/interfaces/IDefenderMonitor.sol`
* **Test Suites Owned:**
  - `test/02_guardians.test.js` (Tests 7–12: Threshold checks, invalid signers, duplicate rejection, replay protection, guardian rotation).
  - `test/05_defender.test.js` (Tests 26–34: Sentinel rule evaluation, automated pause triggers, multi-sig timelock proposals, blacklisting).
* **Git Commit Prefix:** `[414]`

---

## 3. Member: 23BCP417
* **Primary Role:** Core Bridge Hub, Invariants, Secondary Consensus, & Integration
* **Contracts Authored:**
  - `contracts/PaymentBridge.sol` — Core lock-and-mint bridge state machine, fee accounting, challenge mechanics, and large transfer delay.
  - `contracts/InvariantGuard.sol` — Solvency invariant (`balance >= supply`) and dynamic limits connected to `RiskScore` bands.
  - `contracts/RiskManagement.sol` — Chainlink CCIP independent secondary verification, blessing quorum, and emergency cursing.
  - `contracts/WrappedToken.sol` — ERC-20 wrapped synthetic token (`pgETH`) with role-based access control.
  - `contracts/Governed.sol` & `contracts/BridgeBound.sol` — Shared security base classes.
  - `contracts/mocks/ReentrancyAttacker.sol`, `contracts/mocks/ForceSend.sol`, `contracts/mocks/MockPausableBridge.sol`
  - `spec/PayGuard.spec` — CVL formal specification.
* **Test Suites & Tooling Owned:**
  - `test/01_bridge_happy_path.test.js` (Tests 1–6)
  - `test/03_risk_management.test.js` (Tests 13–18)
  - `test/04_invariants.test.js` (Tests 19–25)
  - `test/08_attack_scenarios.test.js` (Tests 45–52)
  - `test/09_governance_fees_gas.test.js` (Tests 53–61)
  - Test helpers: `deploy.js`, `sign.js`, `time.js`, `gov.js`, `revert.js`.
  - Automation scripts: `scripts/demo.js`, `scripts/attack.js`, `scripts/rmn.js`, `scripts/report.js`, `scripts/sign.js`.
  - Migrations: `migrations/1_initial_migration.js`, `migrations/2_deploy_payguard.js`.
* **Git Commit Prefix:** `[417]`

---

## 4. Collective Verification
All team members jointly reviewed the code, verified the complete test suite (61/61 passing), rehearsed the live demonstration (`scripts/demo.js`), and cross-audited against the viva examination questions in `docs/VIVA_PREP.md`.

