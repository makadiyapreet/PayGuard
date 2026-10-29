# PayGuard System Architecture

## 1. System Overview

PayGuard is a layered payment-integrity bridge system that bridges native ETH to wrapped pgETH tokens. It enforces end-to-end security across three crucial transaction lifecycle points:

1. **Before / at Execution:** On-chain invariants and dynamic risk-weighted limits (`InvariantGuard`).
2. **At Consensus:** Distributed multi-signature approvals (`GuardianRegistry`) combined with independent secondary verification and cursing (`RiskManagement`).
3. **After Deployment:** Automated rule monitoring, incident response and timelocked multi-sig governance (`DefenderMonitor`), decentralized detection bot alerting and slashing (`DetectionNetwork`), and real-time risk scoring (`RiskScore`).

---

## 2. Component Diagram

```
                             +------------------------+
                             |     PaymentBridge      |
                             | (Core Lock & Mint Hub) |
                             +-----------+------------+
                                         |
     +-----------------------------------+-----------------------------------+
     |                                   |                                   |
     v                                   v                                   v
+------------------+           +--------------------+           +----------------------+
|  InvariantGuard  |           |  GuardianRegistry  |           |   RiskManagement     |
| (Solvency Invar, |           | (Wormhole 3-of-5   |           | (CCIP Secondary RMN, |
|  Dynamic Limits) |           |  Sorted Signatures)|           |  2-of-2 Bless/Curse) |
+--------+---------+           +---------+----------+           +----------+-----------+
         |                               |                                 |
         | (Multipliers)                 | (Verification)                  | (Penalties)
         v                               v                                 v
+------------------+           +--------------------+           +----------------------+
|    RiskScore     |<----------|   DefenderMonitor  |<----------|   DetectionNetwork   |
| (Skynet Dynamic  | (Penalties| (OpenZeppelin Rules| (Alerts & | (Forta Staked Bots,  |
|  Score 0 - 100)  |  -5, -15) |  Pause, Multi-Sig) |  Rewards) |  Slash, Challenges)  |
+------------------+           +--------------------+           +----------------------+
```

---

## 3. Transfer Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> None
    None --> Pending: deposit()
    Pending --> Executed: execute() [netAmount < largeThreshold]
    Pending --> Verified: execute() [netAmount >= largeThreshold]
    Verified --> Executed: finalizeLarge() [now >= executableAt]
    Pending --> Challenged: challenge() [Guardian / Bot / Gov]
    Verified --> Challenged: challenge() [Guardian / Bot / Gov before delay]
    Pending --> Refunded: refund() [now > expiresAt OR RMN cursed]
    Verified --> Refunded: refund() [RMN cursed]
    Challenged --> Refunded: refund() [Always allowed]
    Executed --> [*]
    Refunded --> [*]
```

---

## 4. End-to-End Transfer Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Depositor
    participant Bridge as PaymentBridge
    participant Guard as InvariantGuard
    participant Score as RiskScore
    participant RMN as RiskManagement (CCIP)
    participant GuardNet as GuardianRegistry (Wormhole)
    participant Monitor as DefenderMonitor
    participant Detection as DetectionNetwork (Forta)
    participant Token as WrappedToken (pgETH)

    User->>Bridge: deposit{value: 2 ETH}(recipient)
    Bridge->>Guard: checkDeposit(user, 2 ETH)
    Guard->>Score: getBand() -> Band.LOW (100% multiplier)
    Guard-->>Bridge: Approved (under perTx & daily limits)
    Bridge->>Detection: fundRewardPool{value: 0.002 ETH}()
    Bridge->>Monitor: evaluate(user, 2 ETH, false)
    Bridge-->>User: Emit Deposited(id, digest)

    Note over GuardNet,RMN: Off-chain consensus & secondary verification
    GuardNet->>GuardNet: 3 Guardians sign digest (ordered by address)
    RMN->>RMN: Independent off-chain recomputation & verification
    RMN->>RMN: 2 Nodes call bless(id, digest)

    User->>Bridge: execute(id, signatures)
    Bridge->>GuardNet: verifyApproval(digest, sigs)
    GuardNet-->>Bridge: true (valid 3-of-5 threshold)
    Bridge->>RMN: isBlessed(id, digest)
    RMN-->>Bridge: true (2-of-2 quorum satisfied)
    Bridge->>GuardNet: markUsed(digest) [Replay protection]
    Bridge->>Token: mint(recipient, 1.998 pgETH)
    Bridge->>Guard: checkInvariant() [Bridge Balance >= Total Supply]
    Bridge-->>User: Emit Executed(id, recipient, 1.998 pgETH)
```

---

## 5. Security Interconnection & Feedback Loop

The key contribution of PayGuard is the bidirectional closed-loop connection between monitoring and protocol execution:

```
[ Security Incident Detected ] 
          │
          ├──> DetectionNetwork valid alert (Severity 1-3)
          ├──> DefenderMonitor rule trip (VELOCITY, RAPID_REDEEM, etc.)
          └──> RiskManagement emergency curse
          │
          ▼
   [ RiskScore.reduce(points) ]
          │
          ▼
   [ RiskScore.getBand() ]
   ├── LOW      (80-100) -> 100% Limits
   ├── MEDIUM   (50-79)  -> 50% Limits
   ├── HIGH     (20-49)  -> 10% Limits
   └── CRITICAL (< 20)   -> 0% Limits (Deposits Halted)
          │
          ▼
[ InvariantGuard.effectivePerTxLimit() auto-shrinks on-chain ]
```
