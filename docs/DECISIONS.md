# Architectural & Implementation Decisions

This document records key technical decisions, trade-offs, and justifications made during the implementation of PayGuard.

---

### D1: Short Revert Strings Prefixed with `PG:`
* **Decision:** Used string reverts prefixed with `PG:` (e.g. `"PG:BAD_SIGS"`, `"PG:PAUSED"`, `"PG:TX_LIMIT"`) rather than custom Solidity errors (`error BadSigs()`).
* **Justification:** Custom errors introduced in Solidity 0.8.4 can have decoding and string-matching issues across specific Truffle and Ganache toolchain combinations. Short ASCII strings prefixed with `PG:` decode reliably in Truffle assertions and make live viva demonstrations crystal clear.

---

### D2: Strictly Ascending Signer Addresses for Multi-Sig
* **Decision:** `GuardianRegistry.verifyApproval` enforces that recovered signer addresses must be strictly ascending:
  ```solidity
  if (signer <= lastSigner) return false;
  ```
* **Justification:** This eliminates duplicate guardian signatures in a single $O(n)$ linear scan without requiring expensive storage mappings or memory bitmasks. Off-chain signers sort addresses numerically before submission.

---

### D3: OpenZeppelin 5.0.2 Cryptographic Primitives
* **Decision:** Used OZ 5.0.2 `ECDSA.tryRecover` and `MessageHashUtils.toEthSignedMessageHash`.
* **Justification:** Standardizes Ethereum-signed-message envelope handling (`"\x19Ethereum Signed Message:\n32"`). Crucially, OpenZeppelin's `tryRecover` rejects malleable high-$s$ values ($s > n/2$) according to EIP-2, protecting against signature malleability attacks.

---

### D4: Unified Defender Monitoring & Multi-Sig Governance
* **Decision:** `DefenderMonitor` implements both rule-based reactive threat detection and the 2-of-3 multi-sig timelock governance.
* **Justification:** Mirrors enterprise OpenZeppelin Defender + OpenZeppelin Contracts architecture, where Defender Relayers trigger automated pause actions, while human multi-sig owners review incidents and execute timelocked unpause and parameter update transactions.

---

### D5: Independent Off-Chain CCIP RMN Verification
* **Decision:** `scripts/rmn.js` performs independent payload re-encoding via `web3.eth.abi.encodeParameters` from emitted event logs rather than simply trusting the bridge's `getDigest` view function.
* **Justification:** Chainlink CCIP's core security premise is an independently developed software stack that validates canonical transactions before blessing. Recomputing the digest independently proves the viability of this defense.

---

### D6: Non-Refundable Protocol Fee on Transfer Cancellation
* **Decision:** In `PaymentBridge.refund()`, `t.netAmount` is returned to the depositor, but `t.fee` is not refunded.
* **Justification:** Protocol fees are immediately forwarded to fund the Forta detection bot reward pool upon deposit (`detection.fundRewardPool{value: fee}()`). Refunding fees would create an economic drain on the detection reward pool and encourage spam deposit/refund cycles.

---

### D7: Dual Check Solvency Invariant
* **Decision:** `bridge.balance >= token.totalSupply()` is checked both before and after every mint, redeem, and refund action.
* **Justification:** Guarantees that wrapped synthetic tokens in circulation are at all times fully collateralized by native locked ETH, preventing insolvency even in complex reentrancy or edge-case deposit flows.

