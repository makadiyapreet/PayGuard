/**
 * @title PayGuard Formal Verification Specification (CVL)
 * @notice Certora Prover specification outlining key security invariants of the PayGuard bridge system.
 */

methods {
    function totalSupply() external returns (uint256) envfree;
    function balanceOf(address) external returns (uint256) envfree;
    function isCursed() external returns (bool) envfree;
    function isGuardian(address) external returns (bool) envfree;
    function used(bytes32) external returns (bool) envfree;
}

/**
 * Rule 1: Bridge Solvency Invariant
 * Wrapped token total supply must never exceed the ETH balance held in the bridge contract.
 */
invariant bridgeSolvency(env e)
    wrappedToken.totalSupply() <= address(bridge).balance;

/**
 * Rule 2: Nonce / Digest Uniqueness (No Replay)
 * An approval digest can transition to executed at most once. Once marked used, it remains used.
 */
rule noApprovalReplay(bytes32 digest, method f) {
    env e;
    calldataarg args;

    bool wasUsedBefore = guardianRegistry.used(digest);

    f(e, args);

    bool isUsedAfter = guardianRegistry.used(digest);

    assert wasUsedBefore => isUsedAfter, "Approval digest can never be un-marked as used";
}

/**
 * Rule 3: Guardian Authorization
 * Only registered guardians can contribute valid signatures toward the approval threshold.
 */
rule onlyRegisteredGuardiansSign(bytes32 digest, bytes[] sigs) {
    env e;
    bool valid = guardianRegistry.verifyApproval(digest, sigs);

    // If verification succeeded, every recovered signer must be an active guardian
    assert valid => forall uint i. i < sigs.length => guardianRegistry.isGuardian(ecrecover(digest, sigs[i]));
}

/**
 * Rule 4: Cursed Bridge Halt
 * If the CCIP Risk Management Network has cursed the bridge, no minting / execution can occur.
 */
rule cursedBridgeCannotMint(bytes32 transferId, bytes[] sigs) {
    env e;
    bool cursed = riskManagement.isCursed();
    uint256 supplyBefore = wrappedToken.totalSupply();

    bridge.execute@withrevert(e, transferId, sigs);

    uint256 supplyAfter = wrappedToken.totalSupply();

    assert cursed => (lastReverted || supplyAfter == supplyBefore),
        "Cursed bridge must not mint tokens";
}

