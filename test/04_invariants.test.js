const InvariantGuard = artifacts.require("InvariantGuard");
const RiskScore = artifacts.require("RiskScore");
const WrappedToken = artifacts.require("WrappedToken");
const ForceSend = artifacts.require("ForceSend");
const { expectRevert } = require("./helpers/revert");
const { increaseTime } = require("./helpers/time");
const { assert } = require("chai");

contract("InvariantGuard (04_invariants.test.js)", (accounts) => {
  const [deployer, mockBridge, user1, user2] = accounts;
  let riskScore;
  let token;
  let guard;

  const perTx = web3.utils.toWei("10", "ether");
  const userDaily = web3.utils.toWei("20", "ether");
  const globalDaily = web3.utils.toWei("50", "ether");
  const windowSeconds = 86400; // 1 day

  beforeEach(async () => {
    riskScore = await RiskScore.new(100, 5, 3600, { from: deployer });
    token = await WrappedToken.new("PayGuard Wrapped ETH", "pgETH", deployer, { from: deployer });
    guard = await InvariantGuard.new(
      riskScore.address,
      token.address,
      perTx,
      userDaily,
      globalDaily,
      windowSeconds,
      { from: deployer }
    );
    await guard.setBridge(mockBridge, { from: deployer });
    await riskScore.setAuthorized(deployer, true, { from: deployer });
  });

  it("19. deposit above perTxLimit reverts PG:TX_LIMIT", async () => {
    const overLimit = web3.utils.toWei("10.1", "ether");
    await expectRevert(
      guard.checkDeposit(user1, overLimit, { from: mockBridge }),
      "PG:TX_LIMIT"
    );

    // Exact limit succeeds
    const exactLimit = web3.utils.toWei("10", "ether");
    const ok = await guard.checkDeposit.call(user1, exactLimit, { from: mockBridge });
    assert.isTrue(ok);
  });

  it("20. user daily limit exceeded reverts PG:USER_LIMIT", async () => {
    const tx1 = web3.utils.toWei("10", "ether");
    const tx2 = web3.utils.toWei("10", "ether");
    const tx3 = web3.utils.toWei("0.1", "ether");

    await guard.checkDeposit(user1, tx1, { from: mockBridge });
    await guard.checkDeposit(user1, tx2, { from: mockBridge });

    // User has reached 20 ether; next deposit exceeds user limit
    await expectRevert(
      guard.checkDeposit(user1, tx3, { from: mockBridge }),
      "PG:USER_LIMIT"
    );

    // Another user can still deposit
    const okUser2 = await guard.checkDeposit.call(user2, tx1, { from: mockBridge });
    assert.isTrue(okUser2);
  });

  it("21. global daily limit exceeded reverts PG:GLOBAL_LIMIT", async () => {
    // 5 different users deposit 10 ether each -> 50 ether total
    for (let i = 0; i < 5; i++) {
      const u = accounts[5 + i];
      await guard.checkDeposit(u, web3.utils.toWei("10", "ether"), { from: mockBridge });
    }

    // 51st ether exceeds global daily limit (50 ETH)
    await expectRevert(
      guard.checkDeposit(user1, web3.utils.toWei("0.1", "ether"), { from: mockBridge }),
      "PG:GLOBAL_LIMIT"
    );
  });

  it("22. limits reset in a new window", async () => {
    // Fill user1's limit in current window
    await guard.checkDeposit(user1, web3.utils.toWei("10", "ether"), { from: mockBridge });
    await guard.checkDeposit(user1, web3.utils.toWei("10", "ether"), { from: mockBridge });

    await expectRevert(
      guard.checkDeposit(user1, web3.utils.toWei("1", "ether"), { from: mockBridge }),
      "PG:USER_LIMIT"
    );

    // Advance time past 1 window (86400s)
    await increaseTime(86401);

    // User can deposit again in new window
    const ok = await guard.checkDeposit.call(user1, web3.utils.toWei("10", "ether"), { from: mockBridge });
    assert.isTrue(ok, "Deposit should be allowed in the new window");
    await guard.checkDeposit(user1, web3.utils.toWei("10", "ether"), { from: mockBridge });
  });

  it("23. risk score drop shrinks effective limit (MEDIUM 50%, HIGH 10%, CRITICAL 0%)", async () => {
    // Initial: LOW (100) -> 100% -> perTx = 10 ETH
    assert.equal(
      (await guard.effectivePerTxLimit()).toString(),
      web3.utils.toWei("10", "ether")
    );

    // Drop to MEDIUM (score 70) -> 50% -> perTx = 5 ETH
    await riskScore.reduce(30, "DROP_TO_70", { from: deployer });
    assert.equal(
      (await guard.effectivePerTxLimit()).toString(),
      web3.utils.toWei("5", "ether")
    );
    // 6 ETH deposit should fail
    await expectRevert(
      guard.checkDeposit(user1, web3.utils.toWei("6", "ether"), { from: mockBridge }),
      "PG:TX_LIMIT"
    );
    // 5 ETH deposit should succeed
    const okMed = await guard.checkDeposit.call(user1, web3.utils.toWei("5", "ether"), { from: mockBridge });
    assert.isTrue(okMed);

    // Drop to HIGH (score 30) -> 10% -> perTx = 1 ETH
    await riskScore.reduce(40, "DROP_TO_30", { from: deployer });
    assert.equal(
      (await guard.effectivePerTxLimit()).toString(),
      web3.utils.toWei("1", "ether")
    );
    // 2 ETH deposit should fail
    await expectRevert(
      guard.checkDeposit(user1, web3.utils.toWei("2", "ether"), { from: mockBridge }),
      "PG:TX_LIMIT"
    );

    // Drop to CRITICAL (score 10) -> 0% -> perTx = 0 ETH (blocks all deposits)
    await riskScore.reduce(20, "DROP_TO_10", { from: deployer });
    assert.equal((await guard.effectivePerTxLimit()).toString(), "0");
    await expectRevert(
      guard.checkDeposit(user1, web3.utils.toWei("0.01", "ether"), { from: mockBridge }),
      "PG:TX_LIMIT"
    );
  });

  it("24. recovery of the score restores the limit", async () => {
    // Drop to CRITICAL (score 0)
    await riskScore.reduce(100, "FULL_DROP", { from: deployer });
    assert.equal((await guard.effectivePerTxLimit()).toString(), "0");

    // Recover score by advancing time (10 periods = 36000s -> +50 pts -> score 50 = MEDIUM = 50%)
    await increaseTime(36000);
    await riskScore.recover();
    assert.equal((await riskScore.getScore()).toString(), "50");
    assert.equal(
      (await guard.effectivePerTxLimit()).toString(),
      web3.utils.toWei("5", "ether")
    );

    // Recover to 100 (10 more periods -> +50 pts)
    await increaseTime(36000);
    await riskScore.recover();
    assert.equal((await riskScore.getScore()).toString(), "100");
    assert.equal(
      (await guard.effectivePerTxLimit()).toString(),
      web3.utils.toWei("10", "ether")
    );
  });

  it("25. force-sent ETH does not break the invariant", async () => {
    // Check invariant when bridge has 0 ETH and 0 supply
    assert.isTrue(await guard.checkInvariant(), "0 balance >= 0 supply must hold");

    // Force send 1 ETH to mockBridge via ForceSend
    const forceSend = await ForceSend.new({ from: deployer, value: web3.utils.toWei("1", "ether") });
    await forceSend.forceSend(mockBridge);

    const bridgeBalance = await web3.eth.getBalance(mockBridge);
    assert.isTrue(web3.utils.toBN(bridgeBalance).gte(web3.utils.toBN(web3.utils.toWei("1", "ether"))));

    // Token supply is still 0, bridge balance is >= 1 ETH -> invariant holds
    assert.isTrue(await guard.checkInvariant(), "Extra ETH must keep invariant true");
  });
});
