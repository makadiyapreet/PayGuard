const RiskScore = artifacts.require("RiskScore");
const { expectRevert } = require("./helpers/revert");
const { increaseTime } = require("./helpers/time");
const { assert } = require("chai");

contract("RiskScore (07_risk_score.test.js)", (accounts) => {
  const [deployer, authorizedCaller, unauthorizedCaller] = accounts;
  let riskScore;

  beforeEach(async () => {
    // Initial score: 100, recovery: +5 points every 3600 seconds
    riskScore = await RiskScore.new(100, 5, 3600, { from: deployer });
    await riskScore.setAuthorized(authorizedCaller, true, { from: deployer });
  });

  it("41. only authorized contracts can reduce the score", async () => {
    // Unauthorized caller tries to reduce
    await expectRevert(
      riskScore.reduce(10, "UNAUTHORIZED_ATTEMPT", { from: unauthorizedCaller }),
      "PG:NOT_AUTH"
    );

    // Authorized caller reduces score
    await riskScore.reduce(10, "VALID_INCIDENT", { from: authorizedCaller });
    const score = await riskScore.getScore();
    assert.equal(score.toString(), "90", "Score should be 90 after 10 pt deduction");
  });

  it("42. score floors at 0 and bands change at the exact thresholds", async () => {
    // Check initial band: LOW (score = 100)
    let band = await riskScore.getBand();
    assert.equal(band.toString(), "0", "Band should be LOW (0) at score 100");

    // Reduce by 20 -> score = 80 -> still LOW
    await riskScore.reduce(20, "DROP_TO_80", { from: authorizedCaller });
    assert.equal((await riskScore.getScore()).toString(), "80");
    band = await riskScore.getBand();
    assert.equal(band.toString(), "0", "Band should be LOW (0) at score 80");

    // Reduce by 1 -> score = 79 -> MEDIUM (1)
    await riskScore.reduce(1, "DROP_TO_79", { from: authorizedCaller });
    assert.equal((await riskScore.getScore()).toString(), "79");
    band = await riskScore.getBand();
    assert.equal(band.toString(), "1", "Band should be MEDIUM (1) at score 79");

    // Reduce to 50 -> still MEDIUM
    await riskScore.reduce(29, "DROP_TO_50", { from: authorizedCaller });
    assert.equal((await riskScore.getScore()).toString(), "50");
    band = await riskScore.getBand();
    assert.equal(band.toString(), "1", "Band should be MEDIUM (1) at score 50");

    // Reduce to 49 -> HIGH (2)
    await riskScore.reduce(1, "DROP_TO_49", { from: authorizedCaller });
    assert.equal((await riskScore.getScore()).toString(), "49");
    band = await riskScore.getBand();
    assert.equal(band.toString(), "2", "Band should be HIGH (2) at score 49");

    // Reduce to 20 -> still HIGH
    await riskScore.reduce(29, "DROP_TO_20", { from: authorizedCaller });
    assert.equal((await riskScore.getScore()).toString(), "20");
    band = await riskScore.getBand();
    assert.equal(band.toString(), "2", "Band should be HIGH (2) at score 20");

    // Reduce to 19 -> CRITICAL (3)
    await riskScore.reduce(1, "DROP_TO_19", { from: authorizedCaller });
    assert.equal((await riskScore.getScore()).toString(), "19");
    band = await riskScore.getBand();
    assert.equal(band.toString(), "3", "Band should be CRITICAL (3) at score 19");

    // Deduct 50 more points -> floors at 0
    await riskScore.reduce(50, "OVER_PENALTY", { from: authorizedCaller });
    const flooredScore = await riskScore.getScore();
    assert.equal(flooredScore.toString(), "0", "Score should floor at 0");
    band = await riskScore.getBand();
    assert.equal(band.toString(), "3", "Band should be CRITICAL (3) at score 0");
  });

  it("43. recover() adds points per period and caps at 100", async () => {
    // Drop to 88
    await riskScore.reduce(12, "DROP", { from: authorizedCaller });
    assert.equal((await riskScore.getScore()).toString(), "88");

    // Advance time by 3500 seconds (< 3600), recover should revert
    await increaseTime(3500);
    await expectRevert(riskScore.recover(), "PG:NOTHING_TO_RECOVER");

    // Advance by another 200 seconds (total elapsed > 3600s, 1 step = +5)
    await increaseTime(200);
    await riskScore.recover();
    assert.equal((await riskScore.getScore()).toString(), "93", "Score should recover +5 to 93");

    // Advance by 7200 seconds (2 steps = +10) -> 93 + 10 = 103, capped at 100
    await increaseTime(7200);
    await riskScore.recover();
    assert.equal((await riskScore.getScore()).toString(), "100", "Score should cap at 100");

    // Attempting recover when already 100 should revert
    await expectRevert(riskScore.recover(), "PG:NOTHING_TO_RECOVER");
  });

  it("44. history entries are recorded with reasons", async () => {
    const lenBefore = await riskScore.getHistoryLength();
    assert.equal(lenBefore.toString(), "0");

    await riskScore.reduce(15, "TEST_PENALTY_1", { from: authorizedCaller });
    await riskScore.reduce(10, "TEST_PENALTY_2", { from: authorizedCaller });

    const lenAfter = await riskScore.getHistoryLength();
    assert.equal(lenAfter.toString(), "2");

    const entry0 = await riskScore.getHistoryAt(0);
    assert.equal(entry0.oldScore.toString(), "100");
    assert.equal(entry0.newScore.toString(), "85");
    assert.equal(entry0.reason, "TEST_PENALTY_1");
    assert.equal(entry0.by, authorizedCaller);

    const entry1 = await riskScore.getHistoryAt(1);
    assert.equal(entry1.oldScore.toString(), "85");
    assert.equal(entry1.newScore.toString(), "75");
    assert.equal(entry1.reason, "TEST_PENALTY_2");
    assert.equal(entry1.by, authorizedCaller);
  });
});
