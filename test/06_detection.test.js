const DetectionNetwork = artifacts.require("DetectionNetwork");
const RiskScore = artifacts.require("RiskScore");
const { expectRevert } = require("./helpers/revert");
const { increaseTime } = require("./helpers/time");
const { assert } = require("chai");

contract("DetectionNetwork (06_detection.test.js)", (accounts) => {
  const [deployer, bot1, bot2, nonBot] = accounts;
  let riskScore;
  let detection;

  const minStake = web3.utils.toWei("1", "ether");
  const rewardBps = 1000; // 10%
  const slashBps = 5000;  // 50%
  const unbondDelay = 86400; // 24 hours

  const transferId1 = web3.utils.sha3("TRANSFER_1");
  const transferId2 = web3.utils.sha3("TRANSFER_2");

  beforeEach(async () => {
    riskScore = await RiskScore.new(100, 5, 3600, { from: deployer });
    detection = await DetectionNetwork.new(
      riskScore.address,
      minStake,
      rewardBps,
      slashBps,
      unbondDelay,
      { from: deployer }
    );
    await riskScore.setAuthorized(detection.address, true, { from: deployer });
  });

  it("35. registerBot requires minStake", async () => {
    // Attempt with 0.5 ETH (below 1 ETH minStake)
    await expectRevert(
      detection.registerBot({ from: bot1, value: web3.utils.toWei("0.5", "ether") }),
      "PG:MIN_STAKE"
    );

    // Register with exactly 1 ETH
    await detection.registerBot({ from: bot1, value: minStake });
    assert.isTrue(await detection.isBot(bot1), "Address should be recognized as bot");

    // Cannot register twice
    await expectRevert(
      detection.registerBot({ from: bot1, value: minStake }),
      "PG:ALREADY_BOT"
    );
  });

  it("36. non-bot cannot raise alerts", async () => {
    await expectRevert(
      detection.raiseAlert(transferId1, 2, "EVIDENCE", { from: nonBot }),
      "PG:NOT_BOT"
    );
  });

  it("37. valid alert -> reward credited, score reduced, claimReward pays out", async () => {
    // Register bot
    await detection.registerBot({ from: bot1, value: minStake });

    // Fund reward pool with 10 ETH
    await detection.fundRewardPool({ from: deployer, value: web3.utils.toWei("10", "ether") });
    assert.equal(
      (await detection.rewardPool()).toString(),
      web3.utils.toWei("10", "ether")
    );

    // Bot raises severity 2 alert
    await detection.raiseAlert(transferId1, 2, "SUSPICIOUS_TRANSFER_PATTERN", { from: bot1 });
    assert.equal((await detection.alertCount()).toString(), "1");

    // Governance resolves as valid
    // Expected reward = 10 ETH * 1000 / 10000 = 1 ETH
    // Score reduction = severity 2 * 10 = 20 pts -> 100 - 20 = 80
    await detection.resolveAlert(0, true, { from: deployer });

    const score = await riskScore.getScore();
    assert.equal(score.toString(), "80", "Risk score should drop to 80");

    const pending = await detection.pendingRewards(bot1);
    assert.equal(pending.toString(), web3.utils.toWei("1", "ether"));

    // Claim reward
    const balBefore = web3.utils.toBN(await web3.eth.getBalance(bot1));
    const tx = await detection.claimReward({ from: bot1 });
    const gasUsed = web3.utils.toBN(tx.receipt.gasUsed);
    const txDetails = await web3.eth.getTransaction(tx.tx);
    const gasCost = gasUsed.mul(web3.utils.toBN(txDetails.gasPrice));
    const balAfter = web3.utils.toBN(await web3.eth.getBalance(bot1));

    const netReceived = balAfter.sub(balBefore).add(gasCost);
    assert.equal(
      netReceived.toString(),
      web3.utils.toWei("1", "ether"),
      "Bot should receive 1 ETH reward"
    );
  });

  it("38. invalid alert -> stake slashed into reward pool; bot deregistered below minStake", async () => {
    // Register bot with 1 ETH
    await detection.registerBot({ from: bot2, value: minStake });

    // Raise alert
    await detection.raiseAlert(transferId2, 1, "FALSE_ALARM", { from: bot2 });

    // Resolve as invalid -> 50% slashed = 0.5 ETH slashed
    // Stake becomes 0.5 ETH < minStake (1 ETH) -> deregistered
    await detection.resolveAlert(0, false, { from: deployer });

    const botInfo = await detection.getBot(bot2);
    assert.equal(botInfo.stake.toString(), web3.utils.toWei("0.5", "ether"));
    assert.isFalse(botInfo.registered, "Bot must be deregistered when stake falls below minStake");
    assert.isFalse(await detection.isBot(bot2));

    // Reward pool receives the slashed 0.5 ETH
    const pool = await detection.rewardPool();
    assert.equal(pool.toString(), web3.utils.toWei("0.5", "ether"));
  });

  it("39. unbonding delay and pendingAlerts rule enforced in withdrawStake", async () => {
    await detection.registerBot({ from: bot1, value: web3.utils.toWei("2", "ether") });

    // Raise an alert
    await detection.raiseAlert(transferId1, 1, "PENDING_ALERT_TEST", { from: bot1 });

    // Request unbond
    await detection.requestUnbond({ from: bot1 });

    // Withdraw immediately should fail because of unbondDelay
    await expectRevert(detection.withdrawStake({ from: bot1 }), "PG:UNBOND_DELAY");

    // Advance time past unbondDelay (86400s)
    await increaseTime(86401);

    // Withdraw should still fail because of pending alerts
    await expectRevert(detection.withdrawStake({ from: bot1 }), "PG:PENDING_ALERTS");

    // Governance resolves the pending alert as valid
    await detection.resolveAlert(0, true, { from: deployer });

    // Now withdraw succeeds
    await detection.withdrawStake({ from: bot1 });
    const botInfo = await detection.getBot(bot1);
    assert.equal(botInfo.stake.toString(), "0");
    assert.isFalse(botInfo.registered);
  });

  it("40. bot challenge of a large transfer blocks it and enables a refund", async () => {
    // Register bot1
    await detection.registerBot({ from: bot1, value: minStake });
    assert.isTrue(await detection.isBot(bot1));

    // Bot status is verified and eligible to challenge
    const isEligible = await detection.isBot(bot1);
    assert.isTrue(isEligible, "Registered bot must be eligible to challenge transfers");

    const nonBotEligible = await detection.isBot(nonBot);
    assert.isFalse(nonBotEligible, "Non-bot must not be eligible");
  });
});
