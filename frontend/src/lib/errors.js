export const REVERT_DICTIONARY = {
  "PG:PAUSED": {
    title: "Bridge is Temporarily Paused",
    layer: "L3",
    meaning: "The bridge has been halted by the emergency circuit breaker to protect funds.",
    hint: "Go to the Governance page to submit an Unpause Proposal, or wait for admins to unpause.",
  },
  "PG:CURSED": {
    title: "Bridge Cursed by Chainlink CCIP",
    layer: "L2",
    meaning: "The Risk Management Network detected an anomaly and voted to halt the bridge.",
    hint: "The curse can be lifted by an uncurse governance proposal passed through DefenderMonitor.",
  },
  "PG:BLACKLISTED": {
    title: "Address is Blacklisted",
    layer: "L3",
    meaning: "This address has been flagged for suspicious activity and blocked from using the bridge.",
    hint: "Blacklisted addresses cannot deposit, execute, or redeem funds across the bridge.",
  },
  "PG:TX_LIMIT": {
    title: "Transfer Limit Exceeded",
    layer: "L1",
    meaning: "You tried to transfer more than the allowed per-transaction limit (Base: 10 ETH).",
    hint: "Reduce your deposit amount to 10 ETH or less, or check the Pre-Execution Gate page.",
  },
  "PG:USER_LIMIT": {
    title: "Daily User Limit Exceeded",
    layer: "L1",
    meaning: "This address has reached its maximum daily transfer allowance for the 24-hour period.",
    hint: "Wait for the 24-hour window to reset, or transfer using a different account.",
  },
  "PG:GLOBAL_LIMIT": {
    title: "Global Bridge Volume Limit Exceeded",
    layer: "L1",
    meaning: "The bridge has hit its total daily volume cap across all users to protect liquidity.",
    hint: "Wait for the daily volume cap to refresh at midnight.",
  },
  "PG:BAD_SIGS": {
    title: "Missing or Invalid Guardian Signatures",
    layer: "L2",
    meaning: "You need at least 3 out of 5 valid Wormhole Guardian signatures to approve this transfer.",
    hint: "Click 'Sign Quorum (3 Guardians)' on the Guardian Studio page to gather all 3 signatures in 1 click.",
  },
  "PG:NOT_BLESSED": {
    title: "Missing Chainlink CCIP RMN Blessing",
    layer: "L2",
    meaning: "Both independent CCIP risk nodes (R1 and R2) must verify and bless this transfer before execution.",
    hint: "Both independent CCIP risk nodes (R1 and R2) must verify and bless this transfer. Go to the Risk Network (RMN) page to bless.",
  },
  "PG:NOT_CHALLENGER": {
    title: "Permission Denied: Only Forta Bots or Guardians Can Challenge",
    layer: "L3",
    meaning: "Regular users cannot challenge transactions. This prevents attackers from griefing normal transfers.",
    hint: "Select '#8 Forta Bot 1' or '#1 Guardian 1' from the challenger dropdown on the Challenge page.",
  },
  "PG:CANNOT_CHALLENGE": {
    title: "Transfer Ineligible for Challenge",
    layer: "L3",
    meaning: "Only pending transfers or transfers currently inside the 1-hour delay window can be challenged.",
    hint: "Transfers that are already executed, refunded, or expired cannot be challenged.",
  },
  "PG:CANNOT_REFUND": {
    title: "Refund Not Available Yet",
    layer: "L3",
    meaning: "Transfers can only be refunded if they were challenged, expired past their deadline, or if the bridge is cursed.",
    hint: "Challenge the transfer first on the Challenge page, or wait for its expiration deadline.",
  },
  "PG:DELAY_ACTIVE": {
    title: "1-Hour Fraud Delay Window Active",
    layer: "L1",
    meaning: "Transfers of 5 ETH or more have a mandatory 1-hour inspection window before pgETH can be minted.",
    hint: "Wait until the countdown timer expires, or fast-forward EVM time in Dev Tools.",
  },
  "PG:NOT_PENDING": {
    title: "Transfer Already Processed",
    layer: "CORE",
    meaning: "This transfer is no longer pending. It has already been executed, challenged, or refunded.",
    hint: "Select an active pending transfer from the list to approve.",
  },
  "PG:NOT_VERIFIED": {
    title: "Transfer Not Yet Verified",
    layer: "CORE",
    meaning: "This large transfer has not completed initial Guardian and RMN verification.",
    hint: "Run execute() with Guardian signatures first to verify the transfer.",
  },
  "PG:EXPIRED": {
    title: "Transfer Expired",
    layer: "CORE",
    meaning: "The time limit to execute this transfer has elapsed. It can no longer be minted.",
    hint: "You can safely claim a full refund of your ETH on the Challenge & Refund page.",
  },
  "PG:REPLAY": {
    title: "Replay Attack Blocked",
    layer: "L2",
    meaning: "This exact transfer approval was already used and cannot be executed a second time.",
    hint: "Each transfer has a unique ID and nonce. Create a new deposit to test again.",
  },
  "PG:INVARIANT": {
    title: "1:1 Solvency Invariant Breached",
    layer: "L1",
    meaning: "The bridge's locked ETH balance would fall below the pgETH token supply.",
    hint: "PayGuard guarantees 1:1 backing at all times. Execution was halted to protect solvency.",
  },
  "PG:NO_DIRECT_ETH": {
    title: "Direct ETH Send Rejected",
    layer: "CORE",
    meaning: "You cannot send raw ETH directly to the contract address without calling deposit().",
    hint: "Use the deposit form on the Transfers page to bridge your funds.",
  },
  "PG:NOT_GOV": {
    title: "Governance Access Required",
    layer: "CORE",
    meaning: "Only the DefenderMonitor multi-sig governance contract can call this admin function.",
    hint: "Submit a proposal through the Governance Multi-Sig page.",
  },
  "PG:NOT_MONITOR": {
    title: "Defender Monitor Access Required",
    layer: "L3",
    meaning: "This emergency function can only be triggered by the automated DefenderMonitor.",
    hint: "Use Defender rules or the Emergency Pause button.",
  },
};

export function decodeRevertReason(error) {
  if (!error) return null;

  // Search across all nested fields where ethers v6 and Ganache place revert strings
  const searchParts = [
    typeof error === "string" ? error : "",
    error?.reason,
    error?.shortMessage,
    error?.revert?.args?.[0],
    error?.info?.error?.data?.reason,
    error?.info?.error?.message,
    error?.error?.message,
    error?.data,
    error?.message,
    typeof error?.info === "object" ? JSON.stringify(error.info) : "",
  ].filter(Boolean);

  const fullStr = searchParts.join(" ");

  for (const [code, meta] of Object.entries(REVERT_DICTIONARY)) {
    if (fullStr.includes(code)) {
      return { code, ...meta };
    }
  }

  // OpenZeppelin standard errors
  if (fullStr.includes("AccessControlUnauthorizedAccount")) {
    return {
      code: "AccessControlUnauthorizedAccount",
      title: "Permission Denied: Missing Role",
      layer: "CORE",
      meaning: "Your account does not have the required role to call this function.",
      hint: "Switch to an account with the appropriate permissions.",
    };
  }
  if (fullStr.includes("ReentrancyGuardReentrantCall")) {
    return {
      code: "ReentrancyGuardReentrantCall",
      title: "Reentrancy Attack Blocked",
      layer: "CORE",
      meaning: "A recursive re-entrant call was intercepted and stopped by ReentrancyGuard.",
      hint: "The smart contract prevented a duplicate withdrawal inside the callback.",
    };
  }

  // Common wallet / estimate gas fallback
  if (fullStr.includes("missing revert data") || fullStr.includes("CALL_EXCEPTION")) {
    return {
      code: "EXECUTION_INTERCEPTED",
      title: "Transaction Stopped by Security Rules",
      layer: "CORE",
      meaning: "The smart contract rejected this transaction during pre-flight checks. One of the defense conditions (such as missing signatures, RMN blessing, unauthorized role, or paused bridge) was not met.",
      hint: "Review the required steps (gather 3 Guardian signatures, verify RMN blessing, or switch to an authorized role) before submitting.",
    };
  }

  return {
    code: "ACTION_BLOCKED",
    title: "Transaction Stopped by Smart Contract",
    layer: "CORE",
    meaning: "The transaction did not pass the smart contract security conditions.",
    hint: "Check your transaction parameters, account permissions, and contract state.",
  };
}
