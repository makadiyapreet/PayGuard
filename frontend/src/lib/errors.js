export const REVERT_DICTIONARY = {
  "PG:PAUSED": {
    title: "Bridge Operation Paused",
    layer: "L3",
    meaning: "The bridge has been halted by OpenZeppelin Defender automated rules or emergency multi-sig action.",
    hint: "Unpause requires an on-chain DefenderMonitor multi-sig proposal with 2-of-3 owner signatures and a 60-second timelock.",
  },
  "PG:CURSED": {
    title: "Bridge Cursed by RMN",
    layer: "L2",
    meaning: "The Chainlink CCIP Risk Management Network quorum has voted to curse (halt) the bridge due to anomalous consensus behavior.",
    hint: "Lifting the curse requires an uncurse governance proposal passed through DefenderMonitor.",
  },
  "PG:BLACKLISTED": {
    title: "Address Blacklisted",
    layer: "L3",
    meaning: "The sender or recipient address has been blacklisted by automated risk rules or governance.",
    hint: "Blacklisted addresses cannot deposit, execute, or redeem funds across the bridge.",
  },
  "PG:TX_LIMIT": {
    title: "Per-Transaction Limit Exceeded",
    layer: "L1",
    meaning: "The requested deposit exceeds the effective per-transaction limit enforced by InvariantGuard.",
    hint: "Limits dynamically shrink when the CertiK Skynet RiskScore drops into lower bands (MEDIUM 50%, HIGH 10%, CRITICAL 0%).",
  },
  "PG:USER_LIMIT": {
    title: "User Daily Limit Exceeded",
    layer: "L1",
    meaning: "The user has exhausted their 24-hour cumulative deposit limit.",
    hint: "Wait for the current limit window to expire or deposit from a different address.",
  },
  "PG:GLOBAL_LIMIT": {
    title: "Global Protocol Daily Limit Exceeded",
    layer: "L1",
    meaning: "The bridge has reached maximum allowable volume across all users for the current 24-hour window.",
    hint: "Global limits protect total liquidity. Wait for the window reset.",
  },
  "PG:BAD_SIGS": {
    title: "Guardian Approval Signatures Invalid",
    layer: "L2",
    meaning: "Signatures are fewer than threshold (3), duplicate, unsorted by address, or contain non-guardian signers.",
    hint: "Ensure at least 3 distinct guardian signatures are gathered and passed in strictly ascending address order.",
  },
  "PG:NOT_BLESSED": {
    title: "Missing RMN Secondary Blessing",
    layer: "L2",
    meaning: "The independent Chainlink CCIP Risk Management Network quorum has not blessed this approval digest.",
    hint: "Both Risk Nodes (R1 and R2) must verify and call bless(id, digest) before execution is permitted.",
  },
  "PG:REPLAY": {
    title: "Replay Attack Detected",
    layer: "L2",
    meaning: "This approval digest was already executed and permanently marked as used in GuardianRegistry.",
    hint: "Each transfer digest is unique (includes per-sender nonce). Old approvals cannot be reused.",
  },
  "PG:INVARIANT": {
    title: "Solvency Invariant Violation",
    layer: "L1",
    meaning: "The invariant check failed: Bridge native ETH balance is less than total pgETH token supply.",
    hint: "The protocol guarantees 1:1 backing at all times. Execution halts immediately if backing is impaired.",
  },
  "PG:NOT_GOV": {
    title: "Governance Access Denied",
    layer: "CORE",
    meaning: "Caller is not the authorized governance address (DefenderMonitor).",
    hint: "All admin actions must be proposed and executed through the multi-sig timelock.",
  },
  "PG:NOT_BRIDGE": {
    title: "Bridge Bound Access Denied",
    layer: "CORE",
    meaning: "Caller is not the registered PaymentBridge contract.",
    hint: "Only PaymentBridge can trigger limit checks, mark digests used, or pause states.",
  },
  "PG:BRIDGE_SET": {
    title: "Bridge Address Already Immutable",
    layer: "CORE",
    meaning: "setBridge() has already been executed on this contract.",
    hint: "Bridge association is one-time immutable for security.",
  },
  "PG:NOTHING_TO_RECOVER": {
    title: "No Risk Score Recovery Due",
    layer: "L3",
    meaning: "Insufficient time has elapsed since the last incident, or score is already at maximum (100).",
    hint: "RiskScore recovers linearly (+5 points per 3600 seconds) after incident cooldown.",
  },
  "PG:CALL_FAILED": {
    title: "Governance Proposal Target Call Reverted",
    layer: "L3",
    meaning: "The underlying target contract reverted during execution of the governance proposal.",
    hint: "Inspect target function parameters and permissions.",
  },
  "PG:NO_DIRECT_ETH": {
    title: "Direct ETH Transfer Rejected",
    layer: "CORE",
    meaning: "PaymentBridge receive() rejects raw ether transfers without deposit metadata.",
    hint: "Use deposit(recipient) with value to initiate a valid cross-chain transfer.",
  },
  "PG:NOT_CHALLENGER": {
    title: "Unauthorized Challenger (Access Denied)",
    layer: "L3",
    meaning: "Caller is not authorized to challenge transfers. Only Wormhole Guardians (Accounts 1-5), Forta Staked Bots (Accounts 8-9), or Governance can issue security challenges.",
    hint: "Switch 'Acting As' in the top bar to a Guardian (e.g. Account #1) or Forta Bot (Account #8), or use the quick challenger selector on the Challenge page.",
  },
  "PG:CANNOT_CHALLENGE": {
    title: "Transfer Ineligible for Challenge",
    layer: "L3",
    meaning: "Transfers can only be challenged while in Pending state (State 1) or inside the 1-hour delayed verification window (State 2) before execution.",
    hint: "Transfers already executed, refunded, or expired cannot be challenged.",
  },
  "PG:CANNOT_REFUND": {
    title: "Refund Conditions Not Satisfied",
    layer: "L3",
    meaning: "Transfers can only be refunded if they were challenged (State 4), expired past their deadline, or if the bridge is currently cursed by RMN.",
    hint: "A challenge must be recorded or the expiration deadline must elapse before funds can be refunded to the sender.",
  },
  "PG:DELAY_ACTIVE": {
    title: "Challenge Delay Window Active",
    layer: "L1",
    meaning: "Large transfers (>= 5 ETH) enforce a mandatory 1-hour delay window before destination pgETH can be minted.",
    hint: "Wait until the challenge window elapses, or fast-forward EVM time in Dev Tools.",
  },
  "PG:NOT_PENDING": {
    title: "Transfer Not in Pending State",
    layer: "CORE",
    meaning: "The transfer is no longer in Pending state (it has already been approved, executed, or refunded).",
    hint: "Only newly deposited transfers in State 1 (Pending) can be approved by Guardians.",
  },
  "PG:NOT_VERIFIED": {
    title: "Transfer Not in Verified State",
    layer: "CORE",
    meaning: "The transfer has not passed dual-consensus verification or is not delayed.",
    hint: "Run execute() with Guardian and RMN signatures first to verify the transfer.",
  },
  "PG:EXPIRED": {
    title: "Transfer Expired",
    layer: "CORE",
    meaning: "The transfer validity window has elapsed. Unexecuted transfers past expiration cannot be finalized.",
    hint: "Expired transfers can be safely refunded to the original sender using refund().",
  },
  "PG:NOT_MONITOR": {
    title: "Caller Not Defender Monitor",
    layer: "L3",
    meaning: "This function can only be invoked by the DefenderMonitor contract.",
    hint: "Ensure automated emergency pauses are routed through DefenderMonitor.",
  },
};

export function decodeRevertReason(error) {
  if (!error) return null;

  // Search common locations in ethers errors
  const errStr = String(error?.reason || error?.data || error?.message || error);
  for (const [code, meta] of Object.entries(REVERT_DICTIONARY)) {
    if (errStr.includes(code)) {
      return { code, ...meta };
    }
  }

  // OpenZeppelin standard errors
  if (errStr.includes("AccessControlUnauthorizedAccount")) {
    return {
      code: "AccessControlUnauthorizedAccount",
      title: "Access Control Error",
      layer: "CORE",
      meaning: "Caller does not hold the required AccessControl role (e.g. MINTER_ROLE).",
      hint: "Check role assignments on WrappedToken.",
    };
  }
  if (errStr.includes("ReentrancyGuardReentrantCall")) {
    return {
      code: "ReentrancyGuardReentrantCall",
      title: "Reentrancy Guard Triggered",
      layer: "CORE",
      meaning: "A re-entrant call was intercepted and blocked by OpenZeppelin ReentrancyGuard.",
      hint: "State changes occurred before external call, and the lock prevented nested execution.",
    };
  }

  return {
    code: "UNKNOWN",
    title: "Transaction Reverted",
    layer: "CORE",
    meaning: errStr.length > 200 ? errStr.slice(0, 200) + "..." : errStr,
    hint: "Inspect transaction inputs and account permissions.",
  };
}

