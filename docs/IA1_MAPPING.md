# IA1 Research Solutions to PayGuard Implementation Mapping

## 1. What is New in Our Work

Existing blockchain bridge and payment integrity solutions operate in isolated silos: Wormhole relies on fixed guardian multi-signatures with no formal invariant verification; Chainlink CCIP introduces secondary verification but does not dynamically throttle throughput based on live security alerts; Forta detection bots raise alerts off-chain without automatic protocol intervention; OpenZeppelin Defender provides rule monitoring that is purely reactive; and CertiK Skynet provides lagging risk scores that require manual off-chain interpretation.

**PayGuard's Novel Contribution:** We establish an on-chain, closed-loop feedback mechanism connecting real-time threat detection to execution enforcement. Confirmed alerts and automated rule trips immediately deduct points from `RiskScore`. As the risk score drops, `InvariantGuard` automatically and proportionally **shrinks cross-chain transfer limits** ($100\% \to 50\% \to 10\% \to 0\%$) directly on-chain without human delay. Furthermore, high-value transfers are automatically locked into a **1-hour challenge window**, transforming reactive monitoring into proactive exploit prevention.

---

## 2. Research Mapping Matrix

| IA1 Researched Solution | Roll Number | PayGuard Contract | What We Kept (Preserved Core) | What We Simplified (Educational Scope) | IA1 Limitation / "Con" Addressed | Test Numbers Proving Defense |
|---|---|---|---|---|---|---|
| **Certora Prover** (Formal Verification) | 23BCP417 | `InvariantGuard.sol`<br>`spec/PayGuard.spec` | Formal solvency property enforcement ($\text{bridge.balance} \ge \text{token.totalSupply}$), base & tiered deposit limits. | Certora CLI Prover binary is not run; properties enforced as runtime assertions + CVL specification. | **"Only as strong as the written spec":** Enforced as an on-chain, non-bypassable runtime invariant checked on every state change. | Tests 19, 20, 21, 22, 23, 24, 25 |
| **Wormhole Guardian Network** | 23BCP414 | `GuardianRegistry.sol` | $t$-of-$n$ multi-sig threshold approvals, sorted address validation, replay protection. | 5 Ganache guardians with 3-of-5 threshold instead of 19 distributed validator nodes with 13-of-19. | **"Fixed, permissioned guardian set":** Added multi-sig governance functions for dynamic guardian addition, removal, and threshold rotation. | Tests 7, 8, 9, 10, 11, 12, 45, 46, 47, 58 |
| **Chainlink CCIP Risk Management Network** | 23BCP417 | `RiskManagement.sol`<br>`scripts/rmn.js` | Independent secondary verification layer with blessing quorum and emergency cursing powers. | 2 local risk nodes with 2-of-2 quorum; off-chain script recomputes digest independently from event data. | **"CCIP latency and gas cost overhead":** Empirically measured in gas benchmark table (test 59) to prove feasibility on local EVM. | Tests 13, 14, 15, 16, 17, 18 |
| **OpenZeppelin Defender** | 23BCP414 | `DefenderMonitor.sol` | Sentinel condition rules (velocity, rapid redeem, large amount), emergency pause, multi-sig timelock. | Relayer logic compiled directly into on-chain `evaluate` calls triggered by the bridge. | **"Defender is purely reactive":** Addressed by coupling Defender alerts with automatic bridge pauses and the 1-hour large transfer delay window. | Tests 26, 27, 28, 29, 30, 31, 32, 33, 34 |
| **Forta Network** | 23BCP413 | `DetectionNetwork.sol` | Decentralized detection bots, severity-ranked alerts, community pool rewards. | Machine learning models replaced by deterministic smart contract rules; governance resolves alerts. | **"Unclear bot incentive and false positives":** Solved via economic staking, fee-based reward pool, and 50% slashing for false alerts. | Tests 35, 36, 37, 38, 39, 40 |
| **CertiK Skynet** | 23BCP413 | `RiskScore.sol` | Public, continuously updated security risk score (0-100) with event logging and score recovery. | Time-based step recovery algorithm implemented in pure Solidity without off-chain oracle feeds. | **"Lagging metric with no protocol impact":** Risk score directly controls InvariantGuard limit multipliers in real time. | Tests 23, 24, 41, 42, 43, 44, 51 |

