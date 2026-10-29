const DefenderMonitor = artifacts.require("DefenderMonitor");
const RiskScore = artifacts.require("RiskScore");
const MockPausableBridge = artifacts.require("MockPausableBridge");
const { expectRevert } = require("./helpers/revert");
const { increaseTime } = require("./helpers/time");
const { govExec } = require("./helpers/gov");
const { assert } = require("chai");

contract("DefenderMonitor (05_defender.test.js)", (accounts) => {
  const [deployer, o1, o2, o3, outsider, user1, user2] = accounts;
  const owners = [o1, o2, o3];
  const required = 2;
  const timelock = 60; // 60 seconds

  let riskScore;
  let monitor;
  let mockBridge;

  beforeEach(async () => {
    riskScore = await RiskScore.new(100, 5, 3600, { from: deployer });
    monitor = await DefenderMonitor.new(owners, required, timelock, riskScore.address, {
      from: deployer
    });
    mockBridge = await MockPausableBridge.new({ from: deployer });

    await mockBridge.setMonitor(monitor.address, { from: deployer });
    await mockBridge.setGovernance(monitor.address, { from: deployer });

    await monitor.setBridge(mockBridge.address, { from: deployer });
    await riskScore.setAuthorized(monitor.address, true, { from: deployer });

    // Add default rules:
    // Rule 0: LARGE_AMOUNT (threshold: 8 ether, window: 0, ALERT)
    await monitor.addRule(0, web3.utils.toWei("8", "ether"), 0, 0, { from: deployer });
    // Rule 1: VELOCITY (threshold: 5, window: 600, PAUSE)
    await monitor.addRule(1, 5, 600, 1, { from: deployer });
    // Rule 2: RAPID_REDEEM (threshold: 1 ether, window: 300, PAUSE)
    await monitor.addRule(2, web3.utils.toWei("1", "ether"), 300, 1, { from: deployer });
    // Rule 3: NEW_ADDRESS_LARGE (threshold: 5 ether, window: 0, ALERT)
    await monitor.addRule(3, web3.utils.toWei("5", "ether"), 0, 0, { from: deployer });
  });

  it("26. LARGE_AMOUNT rule logs an incident and lowers the score", async () => {
    // Warm up user1 with small deposit so firstSeen > 0
    await mockBridge.forwardEvaluate(user1, web3.utils.toWei("0.1", "ether"), false, { from: deployer });

    const scoreBefore = await riskScore.getScore();
    const incBefore = await monitor.incidentCount();

    // Trigger LARGE_AMOUNT (8.5 ether >= 8 ether)
    await mockBridge.forwardEvaluate(user1, web3.utils.toWei("8.5", "ether"), false, { from: deployer });

    const scoreAfter = await riskScore.getScore();
    const incAfter = await monitor.incidentCount();

    assert.equal(incAfter.sub(incBefore).toString(), "1", "One incident should be logged");
    assert.equal(scoreBefore.sub(scoreAfter).toString(), "5", "Score should reduce by 5 points");
  });

  it("27. VELOCITY rule (6 deposits in 10 min) pauses the bridge", async () => {
    assert.isFalse(await mockBridge.paused());

    // Send 6 deposits within window
    for (let i = 0; i < 6; i++) {
      await mockBridge.forwardEvaluate(user1, web3.utils.toWei("0.5", "ether"), false, { from: deployer });
    }

    assert.isTrue(await mockBridge.paused(), "Bridge should be paused by velocity rule");
  });

  it("28. RAPID_REDEEM rule pauses the bridge after a quick deposit-redeem", async () => {
    assert.isFalse(await mockBridge.paused());

    // Deposit 2 ETH
    await mockBridge.forwardEvaluate(user2, web3.utils.toWei("2", "ether"), false, { from: deployer });

    // Redeem within 300s window (threshold 1 ether)
    await mockBridge.forwardEvaluate(user2, web3.utils.toWei("1.5", "ether"), true, { from: deployer });

    assert.isTrue(await mockBridge.paused(), "Bridge should be paused by rapid redeem rule");
  });

  it("29. NEW_ADDRESS_LARGE rule logs an alert", async () => {
    const freshUser = accounts[7];
    const scoreBefore = await riskScore.getScore();

    // First ever interaction with 6 ETH (>= 5 ETH threshold)
    await mockBridge.forwardEvaluate(freshUser, web3.utils.toWei("6", "ether"), false, { from: deployer });

    const scoreAfter = await riskScore.getScore();
    // Rule 3 (NEW_ADDRESS_LARGE) trips ALERT (-5)
    assert.isTrue(scoreAfter.lt(scoreBefore), "Score should drop after new address alert");
  });

  it("30. a paused bridge rejects operations", async () => {
    await monitor.emergencyPause({ from: o1 });
    assert.isTrue(await mockBridge.paused(), "Bridge must be paused");
  });

  it("31. emergencyPause works for an owner and not for outsiders", async () => {
    // Outsider cannot emergencyPause
    await expectRevert(monitor.emergencyPause({ from: outsider }), "PG:NOT_OWNER");

    // Owner can emergencyPause
    await monitor.emergencyPause({ from: o1 });
    assert.isTrue(await mockBridge.paused(), "Bridge should be paused via emergencyPause");
  });

  it("32. unpause fails directly and succeeds only via proposal + timelock", async () => {
    // Emergency pause
    await monitor.emergencyPause({ from: o1 });
    assert.isTrue(await mockBridge.paused());

    // Outsider or owner direct unpause on bridge fails
    await expectRevert(mockBridge.unpause({ from: o1 }), "PG:NOT_GOV");
    await expectRevert(mockBridge.unpause({ from: deployer }), "PG:NOT_GOV");

    // Prepare unpause call data: mockBridge.unpause()
    const unpauseData = mockBridge.contract.methods.unpause().encodeABI();

    // Execute via multi-sig proposal + timelock
    await govExec(monitor, [o1, o2], mockBridge.address, unpauseData);

    assert.isFalse(await mockBridge.paused(), "Bridge should now be unpaused");
  });

  it("33. proposal needs required confirmations; early executeProposal reverts", async () => {
    const unpauseData = mockBridge.contract.methods.unpause().encodeABI();

    // o1 submits proposal (confirmations = 1 < 2)
    await monitor.submitProposal(mockBridge.address, unpauseData, { from: o1 });
    const propId = Number(await monitor.proposalCount()) - 1;

    // Execution with only 1 confirmation should revert
    await expectRevert(
      monitor.executeProposal(propId, { from: o1 }),
      "PG:NOT_ENOUGH_CONFIRMATIONS"
    );

    // o2 confirms -> confirmations = 2 >= required (eta is set)
    await monitor.confirmProposal(propId, { from: o2 });

    // Early execution before timelock elapses should revert
    await expectRevert(
      monitor.executeProposal(propId, { from: o1 }),
      "PG:TIMELOCK_NOT_EXPIRED"
    );

    // Advance time past timelock (60s)
    await increaseTime(65);

    // Now execution succeeds
    await monitor.executeProposal(propId, { from: o1 });
    const prop = await monitor.getProposal(propId);
    assert.isTrue(prop.executed);
  });

  it("34. blacklisted user cannot deposit or receive", async () => {
    assert.isFalse(await monitor.isBlacklisted(user1));

    // Governance blacklists user1
    await monitor.blacklist(user1, { from: deployer });
    assert.isTrue(await monitor.isBlacklisted(user1));

    // Governance unblacklists user1
    await monitor.unblacklist(user1, { from: deployer });
    assert.isFalse(await monitor.isBlacklisted(user1));
  });
});
