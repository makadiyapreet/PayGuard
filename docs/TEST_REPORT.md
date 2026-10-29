# PayGuard Formal Test & Gas Benchmark Report

## 1. Test Suite Execution Summary

All tests were executed against Ganache 7.9.2 on network `127.0.0.1:7545` with Solidity `0.8.20` and EVM `paris`.

```text
================================================================================
                    PAYGUARD COMPREHENSIVE TEST RESULTS                         
================================================================================

  Contract: PaymentBridge Happy Path (01_bridge_happy_path.test.js)
    ✔ 1. deploys with the correct parameters (constructor values readable)
    ✔ 2. deposit stores a Pending transfer, charges fee, and funds reward pool (248ms)
    ✔ 3. execute with 3 valid guardian signatures + 2 RMN blessings mints pgETH (505ms)
    ✔ 4. redeem burns pgETH and returns ETH (676ms)
    ✔ 5. invariant balance >= totalSupply holds after each step (673ms)
    ✔ 6. receive() reverts on plain ETH transfers (74ms)

  Contract: GuardianRegistry (02_guardians.test.js)
    ✔ 7. fewer than 3 signatures returns false
    ✔ 8. signature from a non-guardian returns false
    ✔ 9. duplicate signer / unsorted signatures returns false
    ✔ 10. replay of an executed approval is rejected
    ✔ 11. add / remove guardian and threshold change work only through governance (47ms)
    ✔ 12. removeGuardian cannot drop below the threshold

  Contract: RiskManagement (03_risk_management.test.js)
    ✔ 13. execute without RMN quorum returns isBlessed = false
    ✔ 14. a node blessing a different digest does not count
    ✔ 15. a node cannot bless twice
    ✔ 16. collusion case: guardians sign but RMN refuses to bless -> isBlessed is false
    ✔ 17. RMN quorum curse halts bridge and lowers risk score
    ✔ 18. uncurse works only through governance (44ms)

  Contract: InvariantGuard (04_invariants.test.js)
    ✔ 19. deposit above perTxLimit reverts PG:TX_LIMIT
    ✔ 20. user daily limit exceeded reverts PG:USER_LIMIT (42ms)
    ✔ 21. global daily limit exceeded reverts PG:GLOBAL_LIMIT (80ms)
    ✔ 22. limits reset in a new window (54ms)
    ✔ 23. risk score drop shrinks effective limit (MEDIUM 50%, HIGH 10%, CRITICAL 0%) (63ms)
    ✔ 24. recovery of the score restores the limit (49ms)
    ✔ 25. force-sent ETH does not break the invariant

  Contract: DefenderMonitor (05_defender.test.js)
    ✔ 26. LARGE_AMOUNT rule logs an incident and lowers the score (168ms)
    ✔ 27. VELOCITY rule (6 deposits in 10 min) pauses the bridge (582ms)
    ✔ 28. RAPID_REDEEM rule pauses the bridge after a quick deposit-redeem (54ms)
    ✔ 29. NEW_ADDRESS_LARGE rule logs an alert (42ms)
    ✔ 30. a paused bridge rejects operations
    ✔ 31. emergencyPause works for an owner and not for outsiders
    ✔ 32. unpause fails directly and succeeds only via proposal + timelock (76ms)
    ✔ 33. proposal needs required confirmations; early executeProposal reverts (106ms)
    ✔ 34. blacklisted user cannot deposit or receive

  Contract: DetectionNetwork (06_detection.test.js)
    ✔ 35. registerBot requires minStake
    ✔ 36. non-bot cannot raise alerts
    ✔ 37. valid alert -> reward credited, score reduced, claimReward pays out (97ms)
    ✔ 38. invalid alert -> stake slashed into reward pool; bot deregistered below minStake (41ms)
    ✔ 39. unbonding delay and pendingAlerts rule enforced in withdrawStake (70ms)
    ✔ 40. bot challenge of a large transfer blocks it and enables a refund

  Contract: RiskScore (07_risk_score.test.js)
    ✔ 41. only authorized contracts can reduce the score
    ✔ 42. score floors at 0 and bands change at the exact thresholds (122ms)
    ✔ 43. recover() adds points per period and caps at 100 (51ms)
    ✔ 44. history entries are recorded with reasons

  Contract: Attack Scenarios (08_attack_scenarios.test.js)
    ✔ 45. Ronin-style: compromise of 2 of 5 guardians (below threshold) fails (272ms)
    ✔ 46. Wormhole-style spoofed approval (forged signatures) fails (273ms)
    ✔ 47. Replay attack fails (475ms)
    ✔ 48. Reentrancy attack through redeem fails (785ms)
    ✔ 49. Reentrancy attack through refund fails (365ms)
    ✔ 50. Large-transfer attack: bot challenges inside delay window, enabling refund (361ms)
    ✔ 51. Full chain: valid alert -> score drops to HIGH -> attacker deposit fails shrunk limit (202ms)
    ✔ 52. Final: after the whole suite the invariant still holds

  Contract: Governance, Fees, Gas & Accounting (09_governance_fees_gas.test.js)
    ✔ 53. after migration deployer has no governance rights on any contract
    ✔ 54. setBridge can be called only once per contract
    ✔ 55. fee accounting: fee = 0.10% of deposit, rewardPool increases by fee, user receives net in pgETH (506ms)
    ✔ 56. challenge is rejected for a random account and accepted for a guardian, a bot and governance (913ms)
    ✔ 57. refund on an expired Pending transfer works; the fee is not refunded (341ms)
    ✔ 58. signature malleability: a signature with a flipped s value is rejected (307ms)
    ✔ 59. gas table: measure and print gas used by core functions (1415ms)
    ✔ 60. accounting reconciles after mixed run of deposits, executions, refunds, redeems (1474ms)
    ✔ 61. Fuzz-style check: loops 20 seeded deposit amounts asserting invariant after each (6617ms)

  TOTAL: 61 passing (29s)
  FAILURES: 0
```

---

## 2. On-Chain Gas Benchmark Results

Extracted directly from Test 59 measurement run:

| Operation | Gas Used | Estimated Cost @ 2.5 Gwei (ETH) |
|---|---|---|
| `deposit (2 ETH)` | 495,504 | 0.001239 ETH |
| `execute (normal)` | 201,850 | 0.000505 ETH |
| `execute (large -> Verified)` | 142,565 | 0.000356 ETH |
| `finalizeLarge` | 80,390 | 0.000201 ETH |
| `redeem (1 pgETH)` | 125,938 | 0.000315 ETH |
| `raiseAlert` | 188,728 | 0.000472 ETH |
| `submitProposal` | 214,944 | 0.000537 ETH |
| `executeProposal (resolving alert)` | 269,328 | 0.000673 ETH |

---

## 3. Contract Bytecode Footprint (< 24 KB EIP-170 Limit)

All compiled contracts strictly respect the EVM 24,576 byte deployment limit:

| Contract | Bytecode Size | Size in KB | Spurious Dragon Limit Status |
|---|---|---|---|
| `RiskScore` | 3,508 bytes | 3.43 KB | **PASS** (< 24 KB) |
| `WrappedToken` | 3,045 bytes | 2.97 KB | **PASS** (< 24 KB) |
| `GuardianRegistry` | 3,719 bytes | 3.63 KB | **PASS** (< 24 KB) |
| `RiskManagement` | 4,117 bytes | 4.02 KB | **PASS** (< 24 KB) |
| `DetectionNetwork` | 6,452 bytes | 6.30 KB | **PASS** (< 24 KB) |
| `InvariantGuard` | 3,198 bytes | 3.12 KB | **PASS** (< 24 KB) |
| `DefenderMonitor` | 11,261 bytes | 11.00 KB | **PASS** (< 24 KB) |
| `PaymentBridge` | 10,999 bytes | 10.74 KB | **PASS** (< 24 KB) |
