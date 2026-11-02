const RiskManagement = artifacts.require("RiskManagement");
const RiskScore = artifacts.require("RiskScore");
const { expectRevert } = require("./helpers/revert");
const { assert } = require("chai");

contract("RiskManagement (03_risk_management.test.js)", (accounts) => {
  const [deployer, r1, r2, nonNode, user] = accounts;
  const nodes = [r1, r2];
  let riskScore;
  let rmn;

  const id1 = web3.utils.sha3("TRANSFER_ID_1");
  const digest1 = web3.utils.sha3("DIGEST_1");
  const digest2 = web3.utils.sha3("DIGEST_2");

  beforeEach(async () => {
    riskScore = await RiskScore.new(100, 5, 3600, { from: deployer });
    rmn = await RiskManagement.new(nodes, 2, riskScore.address, { from: deployer });
    await riskScore.setAuthorized(rmn.address, true, { from: deployer });
  });

  it("13. execute without RMN quorum returns isBlessed = false", async () => {
    // 0 blessings
    assert.isFalse(await rmn.isBlessed(id1, digest1));

    // 1 blessing (below quorum 2)
    await rmn.bless(id1, digest1, { from: r1 });
    assert.isFalse(await rmn.isBlessed(id1, digest1), "1 of 2 blessings is not enough for quorum");

    // 2 blessings reaches quorum
    await rmn.bless(id1, digest1, { from: r2 });
    assert.isTrue(await rmn.isBlessed(id1, digest1), "2 of 2 blessings must satisfy quorum");
  });

  it("14. a node blessing a different digest does not count", async () => {
    await rmn.bless(id1, digest1, { from: r1 });
    await rmn.bless(id1, digest2, { from: r2 }); // r2 blessed digest2, not digest1

    assert.isFalse(
      await rmn.isBlessed(id1, digest1),
      "Mismatched digest must not contribute to quorum"
    );
    assert.isFalse(
      await rmn.isBlessed(id1, digest2),
      "Only 1 blessing for digest2, below quorum"
    );
  });

  it("15. a node cannot bless twice", async () => {
    await rmn.bless(id1, digest1, { from: r1 });

    await expectRevert(
      rmn.bless(id1, digest1, { from: r1 }),
      "PG:ALREADY_BLESSED"
    );

    // Non-node cannot bless
    await expectRevert(
      rmn.bless(id1, digest1, { from: nonNode }),
      "PG:NOT_NODE"
    );
  });

  it("16. collusion case: guardians sign but RMN refuses to bless -> isBlessed is false", async () => {
    // Simulate: Transfer flagged off-chain by RMN, nodes refuse to bless
    // Despite any external guardian signatures, without RMN blessings isBlessed remains false
    const isApproved = await rmn.isBlessed(id1, digest1);
    assert.isFalse(isApproved, "Flagged transfer without RMN blessings cannot be blessed");
  });

  it("17. RMN quorum curse halts bridge and lowers risk score", async () => {
    assert.isFalse(await rmn.isCursed());
    const scoreBefore = await riskScore.getScore();
    assert.equal(scoreBefore.toString(), "100");

    // First node votes curse
    await rmn.curse("SUSPICIOUS_DRAIN_ATTEMPT", { from: r1 });
    assert.isFalse(await rmn.isCursed(), "1 of 2 curse votes should not yet curse");

    // Second node votes curse -> reaches quorum
    await rmn.curse("SUSPICIOUS_DRAIN_ATTEMPT", { from: r2 });
    assert.isTrue(await rmn.isCursed(), "Quorum reached, bridge must be cursed");

    // Risk score reduced by CURSE_PENALTY (30 pts) -> 100 - 30 = 70 (MEDIUM)
    const scoreAfter = await riskScore.getScore();
    assert.equal(scoreAfter.toString(), "70", "Curse should deduct 30 points from RiskScore");
  });

  it("18. uncurse works only through governance", async () => {
    // Curse first
    await rmn.curse("EMERGENCY", { from: r1 });
    await rmn.curse("EMERGENCY", { from: r2 });
    assert.isTrue(await rmn.isCursed());

    // Non-governance cannot uncurse
    await expectRevert(rmn.uncurse({ from: nonNode }), "PG:NOT_GOV");

    // Governance uncurses
    await rmn.uncurse({ from: deployer });
    assert.isFalse(await rmn.isCursed(), "Bridge should be uncursed by governance");
    assert.equal((await rmn.curseEpoch()).toString(), "1", "Curse epoch should increment");
  });
});

