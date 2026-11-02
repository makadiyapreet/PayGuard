# PayGuard Viva Preparation Guide

This guide contains 32 core viva interview questions and answers, complete with theoretical foundations, implementation specifics, and an ownership matrix for team examination defense.

---

## 1. Team Ownership & Responsibilities

| Student Roll Number | Assigned Component Contracts | Tests & Key Focus Areas |
|---|---|---|
| **23BCP413** | `RiskScore.sol`<br>`DetectionNetwork.sol` | - Dynamic Skynet risk score feedback loop<br>- Staked Forta bot alerting, reward & slash economics<br>- Tests 35–44 |
| **23BCP414** | `GuardianRegistry.sol`<br>`DefenderMonitor.sol` | - Wormhole $t$-of-$n$ ascending signature multi-sig<br>- Defender automated sentinel rules & emergency pause<br>- 2-of-3 multi-sig + 60s timelock governance<br>- Tests 7–12, 26–34 |
| **23BCP417** | `PaymentBridge.sol`<br>`InvariantGuard.sol`<br>`RiskManagement.sol`<br>`WrappedToken.sol` | - Core lock & mint bridge state machine & replay guards<br>- Solvency invariant (`balance >= supply`) & dynamic limits<br>- CCIP independent RMN blessing & cursing network<br>- Tests 1–6, 13–25, 45–61 |

*Note: In accordance with university exam rules, all team members understand and can walk through the entire end-to-end cross-contract flow.*

---

## 2. High-Level Architecture & Theory

### Q1: Why does blockchain immutability not guarantee payment integrity?
**Answer:** Immutability guarantees that transactions, once mined into finalized blocks, cannot be altered or erased from the ledger. However, it does not guarantee that the transaction was legitimate, correctly authorized, or logically valid. If a smart contract contains logic bugs (Nomad's uninitialized root), compromised multi-sig keys (Ronin's 5-of-9 validator breach), or cryptographic bypasses (Wormhole's unverified signature contract), the blockchain will faithfully and immutably record the fraudulent transfer. Payment integrity requires multi-layered application-level verification, not just consensus immutability.

### Q2: Why are there three defense layers and what does each layer close?
**Answer:** Fraudulent transactions can penetrate cross-chain bridges at three distinct lifecycle points:
1. **Before/At Execution:** Invariants and rate limits (`InvariantGuard`) stop abnormal volume, limit drain velocity, and mathematically guarantee wrapped token backing.
2. **At Consensus:** Guardian multi-sigs (`GuardianRegistry`) combined with independent secondary verification (`RiskManagement`) ensure no single compromised signer set can mint tokens.
3. **After Deployment:** Reactive sentinel rules (`DefenderMonitor`) and staked detection bots (`DetectionNetwork`) flag anomalies, auto-pause the bridge, and lower risk scores to automatically constrict limits.

### Q3: What is the novel contribution of PayGuard?
**Answer:** In existing bridges, security systems operate as isolated silos. PayGuard connects them into a closed-loop feedback mechanism: confirmed alerts from Forta bots or trips from Defender rules penalize the on-chain `RiskScore`. As `RiskScore` drops across thresholds (LOW $\to$ MEDIUM $\to$ HIGH $\to$ CRITICAL), `InvariantGuard` automatically shrinks effective deposit limits ($100\% \to 50\% \to 10\% \to 0\%$) on-chain without human delay. Furthermore, high-value transfers are automatically locked into a challenge delay window.

---

## 3. GuardianRegistry & Multi-Sig Consensus (Wormhole)

### Q4: How does `verifyApproval` prevent signature replay and duplicate signers?
**Answer:** It recovers the signer of each signature against `MessageHashUtils.toEthSignedMessageHash(digest)` using `ECDSA.tryRecover`. Signer addresses must be in **strictly ascending numerical order** (`signer > lastSigner`). This single comparison prevents duplicate signatures from the same guardian, prevents unsorted malleability, and guarantees uniqueness in $O(n)$ gas complexity.

### Q5: How is approval replay blocked across different transactions and chains?
**Answer:** 
1. The approval digest binds: `keccak256("PAYGUARD_APPROVAL_V1")`, `block.chainid`, `address(this)`, `id`, `sender`, `recipient`, `netAmount`, `nonce`, and `expiresAt`.
2. Once executed, `GuardianRegistry.markUsed(digest)` permanently records `used[digest] = true`. Replaying the same digest reverts with `PG:REPLAY`.

### Q6: What happens if a signature uses a malleable high-$s$ value?
**Answer:** OpenZeppelin's `ECDSA.tryRecover` strictly enforces EIP-2, which requires $s \le n/2$ (where $n$ is the secp256k1 curve order). Flipped high-$s$ signatures fail recovery with `ECDSAInvalidSignatureS` and return `false`, triggering a bridge revert `PG:BAD_SIGS`.

---

## 4. Chainlink CCIP Risk Management Network (`RiskManagement`)

### Q7: What is the difference between OpenZeppelin Defender's pause and RMN's curse?
**Answer:**
- **Defender Pause:** Reactive incident response triggered automatically by Defender rules or manually by a multi-sig owner via `emergencyPause()`. It halts the bridge, but governance can unpause via multi-sig proposal + timelock.
- **RMN Curse:** An independent consensus veto triggered by independent risk nodes reaching quorum ($2/2$). It halts deposits, executions, and redemptions, deducts 30 points from `RiskScore`, and can only be uncursed by formal multi-sig governance proposal.

### Q8: How does CCIP simulate an independent codebase?
**Answer:** In `scripts/rmn.js`, the risk nodes do not call `bridge.getDigest(id)`. Instead, they independently reconstruct the payload from the emitted `Deposited` log parameters, ABI-encode it independently with `web3.eth.abi.encodeParameters`, hash it, and verify that it matches the on-chain digest before casting a blessing vote.

### Q9: What happens if all 5 Guardians collude or are compromised?
**Answer:** Even if all 5 guardians sign a malicious approval, `PaymentBridge.execute` strictly requires `rmn.isBlessed(id, digest)`. If the independent RMN nodes have not blessed the transfer, the transaction unconditionally reverts with `PG:NOT_BLESSED`.

---

## 5. InvariantGuard & Certora Formal Invariants

### Q10: What is the core solvency invariant and why is it checked twice?
**Answer:** The invariant is:
$$\text{bridge.balance} \ge \text{token.totalSupply()}$$
It guarantees that every synthetic `pgETH` in existence is 100% backed by native ETH locked in the bridge. It is evaluated at initialization, after deposit, before and after minting, and after redeeming/refunding.

### Q11: What can the on-chain invariant guarantee, and what can it NOT guarantee?
**Answer:** It guarantees solvency at the exact EVM execution point (balance $\ge$ supply). However, on-chain runtime checks cannot prove universal mathematical inductive correctness across all possible future states and unreachable code paths—which requires off-chain formal verification (e.g. Certora Prover CVL rules as documented in `spec/PayGuard.spec`).

### Q12: How do dynamic limits change across risk bands?
**Answer:**
- Base limits: Per-Tx: 10 ETH, User Daily: 20 ETH, Global Daily: 50 ETH.
- Band Multipliers:
  - **LOW ($\ge 80$):** $100\%$ ($10$ ETH per-tx)
  - **MEDIUM ($50 - 79$):** $50\%$ ($5$ ETH per-tx)
  - **HIGH ($20 - 49$):** $10\%$ ($1$ ETH per-tx)
  - **CRITICAL ($< 20$):** $0\%$ ($0$ ETH per-tx, deposits blocked)

---

## 6. Forta Detection Network (`DetectionNetwork`)

### Q13: Explain the economic incentives of detection bots (stake, reward, slash, unbond).
**Answer:**
- **Stake ($1$ ETH):** Bots must stake skin-in-the-game to prevent spam alerts.
- **Reward ($10\%$ of pool):** Valid alerts are rewarded with $10\%$ of the reward pool funded by bridge fees ($0.10\%$).
- **Slash ($50\%$):** False positive or malicious alerts are penalized by slashing $50\%$ of the bot's stake into the reward pool. If stake drops below $1$ ETH, the bot is automatically deregistered.
- **Unbond Delay ($24$ hours):** Prevents bots from front-running a slashing resolution by immediately withdrawing their stake upon raising an invalid alert.

### Q14: How does a detection bot challenge a suspicious large transfer?
**Answer:** When a transfer $\ge 5$ ETH is executed, it transitions to the `Verified` state and enters a 1-hour timelock delay (`executableAt = now + 3600`). During this window, any registered bot can call `bridge.challenge(id, reason)`, transitioning the transfer to `Challenged` and preventing finalization.

---

## 7. DefenderMonitor & Multi-Sig Governance

### Q15: Why is unpausing harder than pausing?
**Answer:** Pausing is an emergency defensive reflex that must execute with zero friction to halt active exploits (`emergencyPause()` requires only 1 owner, no timelock). Unpausing, however, resumes financial flows and must be deliberately vetted to ensure the exploit vector is remediated. Unpausing requires a full 2-of-3 multi-sig proposal plus a 60-second timelock delay.

### Q16: Walk through the multi-sig proposal lifecycle.
**Answer:**
1. **Submit:** Owner 1 submits target and call data (`submitProposal`); proposer auto-confirms.
2. **Confirm:** Owner 2 confirms (`confirmProposal`). Confirmations reach required ($2$), setting $\text{ETA} = \text{now} + 60\text{s}$.
3. **Timelock:** System waits $60$ seconds.
4. **Execute:** Any owner calls `executeProposal`, which triggers `target.call(data)`.

---

## 8. PaymentBridge Core & Token Mechanics

### Q17: Why are protocol fees not refunded during `refund()`?
**Answer:** Protocol fees ($0.10\%$) are immediately transferred to the `DetectionNetwork` reward pool at the moment of deposit to subsidize bot monitoring. Refunding fees would create an exploit drain against the decentralized bot reward pool.

### Q18: What is the difference between state-changing transaction functions and view functions?
**Answer:**
- **State-Changing:** `deposit`, `execute`, `finalizeLarge`, `challenge`, `refund`, `redeem`, `pause`, `unpause`. They consume gas, alter storage slots, emit events, and update accounting totals.
- **Views:** `getDigest`, `getTransfer`, `getStats`, `nonces`, `isBlessed`, `isCursed`, `checkInvariant`. They are read-only, execute locally with zero gas cost when called externally, and query contract state.

---

## 9. Limitations & Differences from Production

### Q19: What are the main simplifications made for this educational project?
**Answer:**
1. Single chain Ganache simulation: A single EVM instance simulates both source chain locking and destination chain minting.
2. Simplified Forta: Machine learning models (FORTRESS) are simulated via deterministic rule thresholds.
3. Fast Timelock: Timelock is set to 60 seconds for live demo friendliness (production uses 24–48 hours).
4. Local Guardians: Guardians are Ganache test accounts rather than distributed HSMs.

