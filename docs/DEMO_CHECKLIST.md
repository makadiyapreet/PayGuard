# PayGuard Pre-Exam & Live Viva Demonstration Checklist

## 1. Environment Pre-Flight Check

Before calling the professor or opening the terminal for evaluation:

- [ ] **Node.js Environment:** Verified Node 20 LTS active (`node -v` $\to$ `v20.x`).
- [ ] **Ganache Running:** Listening on `127.0.0.1:7545` with 15 accounts:
  ```bash
  ganache --port 7545 --accounts 15 --defaultBalanceEther 10000 --deterministic --chain.networkId 5777
  ```
- [ ] **Fresh Compilation:** Clean build directory and recompile:
  ```bash
  npm run compile
  ```
- [ ] **Fresh Deployment:** Deploy contracts and generate fresh `deployed.json`:
  ```bash
  npm run migrate
  ```
- [ ] **All Tests Green:** Run full test suite to guarantee 61/61 passing:
  ```bash
  npm test
  ```

---

## 2. Live Demo Script (Step-by-Step Viva Execution)

Run the automated live demonstration script with formatted terminal output:
```bash
npm run demo
```

Walk through the 8 stages as prompted:
1. **Initial Deployment:** Point to deployment table in terminal; note initial `RiskScore = 100`, `Band = LOW`, `Multiplier = 100%`.
2. **Normal 2-ETH Transfer:** Show deposit of 2 ETH, 3-of-5 guardian signatures collection, 2-of-2 RMN independent blessing, and successful minting of 1.998 pgETH.
3. **Forged Signature Attack:** Show rejection of attacker's fake signatures (`PG:BAD_SIGS`).
4. **Replay Attack:** Show rejection of replaying executed digest (`PG:NOT_PENDING`).
5. **Detection Alert & Limit Shrinkage:** Explain bot registration (1 ETH stake), bot raising severity 3 alert, governance resolution, score dropping to 70 (MEDIUM), and per-tx limit shrinking from 10 ETH to 5 ETH.
6. **Defender Rapid Redeem Auto-Pause:** Demonstrate rapid redeem tripping Defender rule, bridge transitioning to `paused = true`, and subsequent deposit reverting (`PG:PAUSED`).
7. **Multi-Sig Governance Unpause:** Explain proposal submission, confirmation reaching 2-of-3 quorum, 60s timelock wait, and timelocked execution unpausing the bridge.
8. **Final State & Solvency:** Demonstrate final balance reconciliations and `bridge.balance >= token.totalSupply()` invariant holding.

---

## 3. Attack Suite Execution

Run the penetration testing script showing all 7 attack vectors blocked:
```bash
npm run attack
```

---

## 4. Contract Code Location Reference by Team Member

| Member | Code File Location | Viva Demonstration Function |
|---|---|---|
| **23BCP413** | `contracts/RiskScore.sol`<br>`contracts/DetectionNetwork.sol` | - `RiskScore.reduce()` & `recover()`<br>- `DetectionNetwork.registerBot()`, `raiseAlert()`, `resolveAlert()` |
| **23BCP414** | `contracts/GuardianRegistry.sol`<br>`contracts/DefenderMonitor.sol` | - `GuardianRegistry.verifyApproval()` & strictly ascending signers check<br>- `DefenderMonitor.evaluate()`, `emergencyPause()`, `submitProposal()`, `executeProposal()` |
| **23BCP417** | `contracts/PaymentBridge.sol`<br>`contracts/InvariantGuard.sol`<br>`contracts/RiskManagement.sol`<br>`contracts/WrappedToken.sol` | - `PaymentBridge.deposit()`, `execute()`, `finalizeLarge()`, `refund()`<br>- `InvariantGuard.checkDeposit()` & `checkInvariant()`<br>- `RiskManagement.bless()` & `curse()` |

---

## 5. Troubleshooting & Fallback Procedures

1. **If Ganache connection fails:**
   - Verify port: `lsof -i :7545`
   - Kill old process: `kill -9 $(lsof -t -i:7545)`
   - Restart Ganache CLI: `ganache --port 7545 --accounts 15 --defaultBalanceEther 10000 --deterministic --chain.networkId 5777`
2. **If contracts fail to migrate:**
   - Run `rm -rf build deployed.json`
   - Re-run `npx truffle compile && npx truffle migrate --reset --network ganache`
3. **If tests encounter an unexpected pause:**
   - A previous test may have left the bridge paused. Run `npx truffle migrate --reset --network ganache` before running tests.

