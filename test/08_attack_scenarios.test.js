const { deployFresh } = require("./helpers/deploy");
const { signApproval, signDigest } = require("./helpers/sign");
const { expectRevert } = require("./helpers/revert");
const ReentrancyAttacker = artifacts.require("ReentrancyAttacker");
const { assert } = require("chai");

contract("Attack Scenarios (08_attack_scenarios.test.js)", (accounts) => {
  let ctx;
  const user = accounts[13];
  const attacker = accounts[14];
  const bot = accounts[8];

  beforeEach(async () => {
    ctx = await deployFresh(accounts);
    // Register bot
    await ctx.detection.registerBot({
      from: bot,
      value: web3.utils.toWei("1", "ether")
    });
  });

  it("45. Ronin-style: compromise of 2 of 5 guardians (below threshold) fails", async () => {
    const { bridge, guardians, riskNodes } = ctx;
    const tx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("2", "ether") });
    const id = tx.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);

    // RMN blesses
    await ctx.rmn.bless(id, digest, { from: riskNodes[0] });
    await ctx.rmn.bless(id, digest, { from: riskNodes[1] });

    // Attacker only has 2 of 5 guardian signatures (threshold is 3)
    const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1]]);

    await expectRevert(
      bridge.execute(id, sigs, { from: attacker }),
      "PG:BAD_SIGS"
    );
  });

  it("46. Wormhole-style spoofed approval (forged signatures) fails", async () => {
    const { bridge, riskNodes } = ctx;
    const tx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("2", "ether") });
    const id = tx.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);

    await ctx.rmn.bless(id, digest, { from: riskNodes[0] });
    await ctx.rmn.bless(id, digest, { from: riskNodes[1] });

    // Attacker signs using non-guardian accounts
    const fakeSigners = [accounts[11], accounts[12], attacker];
    const fakeSigs = await signDigest(web3, digest, fakeSigners);

    await expectRevert(
      bridge.execute(id, fakeSigs, { from: attacker }),
      "PG:BAD_SIGS"
    );
  });

  it("47. Replay attack fails", async () => {
    const { bridge, guardians, riskNodes } = ctx;
    const tx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("2", "ether") });
    const id = tx.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);

    await ctx.rmn.bless(id, digest, { from: riskNodes[0] });
    await ctx.rmn.bless(id, digest, { from: riskNodes[1] });
    const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1], guardians[2]]);

    // Legitimate execution
    await bridge.execute(id, sigs, { from: user });

    // Attacker tries to replay the same execution
    await expectRevert(
      bridge.execute(id, sigs, { from: attacker }),
      "PG:NOT_PENDING"
    );
  });

  it("48. Reentrancy attack through redeem fails", async () => {
    const { bridge, token, guardians, riskNodes } = ctx;
    const attackerContract = await ReentrancyAttacker.new(bridge.address, token.address, {
      from: attacker
    });

    // Attacker deposits 2 ETH through attacking contract
    const tx = await attackerContract.deposit(attackerContract.address, {
      from: attacker,
      value: web3.utils.toWei("2", "ether")
    });
    const id = tx.logs.find((l) => l.event === "DepositedId").args.id; // or query events
    const digest = await bridge.getDigest(id);

    await ctx.rmn.bless(id, digest, { from: riskNodes[0] });
    await ctx.rmn.bless(id, digest, { from: riskNodes[1] });
    const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1], guardians[2]]);
    await bridge.execute(id, sigs, { from: attacker });

    // Attacker contract initiates re-entrant attack via redeem
    await attackerContract.attackRedeem(web3.utils.toWei("1", "ether"), { from: attacker });

    assert.isFalse(
      await attackerContract.attackSucceeded(),
      "Reentrancy on redeem must fail"
    );
  });

  it("49. Reentrancy attack through refund fails", async () => {
    const { bridge, token } = ctx;
    const attackerContract = await ReentrancyAttacker.new(bridge.address, token.address, {
      from: attacker
    });

    const tx = await attackerContract.deposit(attackerContract.address, {
      from: attacker,
      value: web3.utils.toWei("2", "ether")
    });
    const id = tx.logs.find((l) => l.event === "DepositedId").args.id;

    // Challenge the transfer via bot
    await bridge.challenge(id, "SUSPICIOUS_DEPOSIT", { from: bot });

    // Attacker contract attempts re-entrant refund
    await attackerContract.attackRefund(id, { from: attacker });

    assert.isFalse(
      await attackerContract.attackSucceeded(),
      "Reentrancy on refund must fail"
    );
  });

  it("50. Large-transfer attack: bot challenges inside delay window, enabling refund", async () => {
    const { bridge, guardians, riskNodes } = ctx;
    const largeAmount = web3.utils.toWei("6", "ether"); // >= 5 ETH largeThreshold

    const tx = await bridge.deposit(user, { from: user, value: largeAmount });
    const id = tx.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);

    await ctx.rmn.bless(id, digest, { from: riskNodes[0] });
    await ctx.rmn.bless(id, digest, { from: riskNodes[1] });
    const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1], guardians[2]]);

    // Execute large transfer transitions to Verified
    await bridge.execute(id, sigs, { from: user });
    let t = await bridge.getTransfer(id);
    assert.equal(t.state.toString(), "2", "Transfer should be in Verified (2) state");

    // Bot detects anomaly and challenges inside delay window
    await bridge.challenge(id, "SUSPICIOUS_WHALE_DRAIN", { from: bot });
    t = await bridge.getTransfer(id);
    assert.equal(t.state.toString(), "4", "Transfer should be in Challenged (4) state");

    // Attempting to finalize large transfer fails
    await expectRevert(bridge.finalizeLarge(id, { from: user }), "PG:NOT_VERIFIED");

    // User can refund the net funds
    const balBefore = web3.utils.toBN(await web3.eth.getBalance(user));
    await bridge.refund(id, { from: user });
    t = await bridge.getTransfer(id);
    assert.equal(t.state.toString(), "5", "Transfer should be in Refunded (5) state");

    const balAfter = web3.utils.toBN(await web3.eth.getBalance(user));
    assert.isTrue(balAfter.gt(balBefore), "Sender received net refund");
  });

  it("51. Full chain: valid alert -> score drops to HIGH -> attacker deposit fails shrunk limit", async () => {
    const { bridge, riskScore, detection, guard } = ctx;

    // Normal limit is 10 ETH
    assert.equal((await riskScore.getBand()).toString(), "0", "Initial band is LOW");
    assert.equal((await guard.effectivePerTxLimit()).toString(), web3.utils.toWei("10", "ether"));

    // Fund detection pool
    await detection.fundRewardPool({ from: accounts[0], value: web3.utils.toWei("5", "ether") });

    // Submit two high-severity alerts: 2 * 30 points = 60 pts deduction -> score drops from 100 to 40 (HIGH)
    const txId1 = web3.utils.sha3("ANOMALY_1");
    await detection.raiseAlert(txId1, 3, "SEVERE_MALICIOUS_ACTIVITY_1", { from: bot });

    const txId2 = web3.utils.sha3("ANOMALY_2");
    await detection.raiseAlert(txId2, 3, "SEVERE_MALICIOUS_ACTIVITY_2", { from: bot });

    // Multi-sig owners resolve alerts through DefenderMonitor governance
    const resolve1Data = detection.contract.methods.resolveAlert(0, true).encodeABI();
    const resolve2Data = detection.contract.methods.resolveAlert(1, true).encodeABI();

    const { govExec } = require("./helpers/gov");
    await govExec(ctx.monitor, [ctx.owners[0], ctx.owners[1]], detection.address, resolve1Data);
    await govExec(ctx.monitor, [ctx.owners[0], ctx.owners[1]], detection.address, resolve2Data);

    // Verify RiskScore is 40 and Band is HIGH (2)
    const score = await riskScore.getScore();
    assert.equal(score.toString(), "40", "Risk score must be 40");
    assert.equal((await riskScore.getBand()).toString(), "2", "Band must be HIGH (2)");

    // Effective limit has shrunk to 10% of 10 ETH = 1 ETH
    const shrunkLimit = await guard.effectivePerTxLimit();
    assert.equal(shrunkLimit.toString(), web3.utils.toWei("1", "ether"), "Effective limit shrunk to 1 ETH");

    // Attacker's 5-ether deposit fails the shrunk limit
    await expectRevert(
      bridge.deposit(attacker, { from: attacker, value: web3.utils.toWei("5", "ether") }),
      "PG:TX_LIMIT"
    );
  });

  it("52. Final: after the whole suite the invariant still holds", async () => {
    const { guard, bridge, token } = ctx;
    const holds = await guard.checkInvariant();
    assert.isTrue(holds, "Solvency invariant balance >= totalSupply must hold");

    const bridgeBal = await web3.eth.getBalance(bridge.address);
    const supply = await token.totalSupply();
    assert.isTrue(
      web3.utils.toBN(bridgeBal).gte(web3.utils.toBN(supply)),
      "Bridge ETH balance >= pgETH total supply"
    );
  });
});
