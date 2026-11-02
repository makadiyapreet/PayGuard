const fs = require("fs");
const path = require("path");
const { deployFresh } = require("./helpers/deploy");
const { signApproval, signDigest } = require("./helpers/sign");
const { expectRevert } = require("./helpers/revert");
const { increaseTime } = require("./helpers/time");
const { govExec } = require("./helpers/gov");
const { assert } = require("chai");

const BaselineBridge = artifacts.require("BaselineBridge");

contract("Frontend Views & Layer Introspection (10_frontend_views.test.js)", (accounts) => {
  let ctx;
  const deployer = accounts[0];
  const user = accounts[13];
  const recipient = accounts[13];
  const attacker = accounts[14];
  const bot = accounts[8];

  beforeEach(async () => {
    ctx = await deployFresh(accounts);
  });

  it("62. previewDeposit agrees with real deposit for pass and each failure", async () => {
    const { bridge, monitor, rmn, guard } = ctx;

    // 1. Pass condition
    const depAmount = web3.utils.toWei("2", "ether");
    const previewPass = await bridge.previewDeposit(user, recipient, depAmount);
    assert.isTrue(previewPass.ok, "previewDeposit should pass for valid transfer");
    assert.equal(previewPass.layer.toString(), "0");
    assert.equal(previewPass.reason, "");
    assert.equal(previewPass.isLarge, false);

    // 2. Blacklisted user failure (Layer 3)
    await govExec(monitor, ctx.owners, monitor.address, monitor.contract.methods.blacklist(user).encodeABI());
    const previewBlacklist = await bridge.previewDeposit(user, recipient, depAmount);
    assert.isFalse(previewBlacklist.ok);
    assert.equal(previewBlacklist.layer.toString(), "3", "Blacklist should map to L3");
    assert.equal(previewBlacklist.reason, "PG:BLACKLISTED");
    await expectRevert(bridge.deposit(recipient, { from: user, value: depAmount }), "PG:BLACKLISTED");
    // unblacklist
    await govExec(monitor, ctx.owners, monitor.address, monitor.contract.methods.unblacklist(user).encodeABI());

    // 3. Paused failure (Layer 3)
    await monitor.emergencyPause({ from: ctx.owners[0] });
    const previewPaused = await bridge.previewDeposit(user, recipient, depAmount);
    assert.isFalse(previewPaused.ok);
    assert.equal(previewPaused.layer.toString(), "3", "Pause should map to L3");
    assert.equal(previewPaused.reason, "PG:PAUSED");
    await expectRevert(bridge.deposit(recipient, { from: user, value: depAmount }), "PG:PAUSED");
    // unpause
    await govExec(monitor, ctx.owners, bridge.address, bridge.contract.methods.unpause().encodeABI());

    // 4. Cursed failure (Layer 2)
    await rmn.curse("TEST_CURSE", { from: ctx.riskNodes[0] });
    await rmn.curse("TEST_CURSE", { from: ctx.riskNodes[1] });
    assert.isTrue(await rmn.isCursed());
    const previewCursed = await bridge.previewDeposit(user, recipient, depAmount);
    assert.isFalse(previewCursed.ok);
    assert.equal(previewCursed.layer.toString(), "2", "Curse should map to L2");
    assert.equal(previewCursed.reason, "PG:CURSED");
    await expectRevert(bridge.deposit(recipient, { from: user, value: depAmount }), "PG:CURSED");
    // uncurse
    await govExec(monitor, ctx.owners, rmn.address, rmn.contract.methods.uncurse().encodeABI());

    // 5. Tx Limit failure (Layer 1)
    const overTx = web3.utils.toWei("11", "ether"); // base perTxLimit is 10 ETH
    const previewTxLimit = await bridge.previewDeposit(user, recipient, overTx);
    assert.isFalse(previewTxLimit.ok);
    assert.equal(previewTxLimit.layer.toString(), "1", "Tx limit should map to L1");
    assert.equal(previewTxLimit.reason, "PG:TX_LIMIT");
    await expectRevert(bridge.deposit(recipient, { from: user, value: overTx }), "PG:TX_LIMIT");

    // 6. User Daily Limit failure (Layer 1)
    // In MEDIUM band (after curse penalty), perTxLimit is 5 ETH and userDailyLimit is 10 ETH
    await bridge.deposit(recipient, { from: user, value: web3.utils.toWei("5", "ether") });
    await bridge.deposit(recipient, { from: user, value: web3.utils.toWei("5", "ether") });
    const previewUserLimit = await bridge.previewDeposit(user, recipient, web3.utils.toWei("1", "ether"));
    assert.isFalse(previewUserLimit.ok);
    assert.equal(previewUserLimit.layer.toString(), "1");
    assert.equal(previewUserLimit.reason, "PG:USER_LIMIT");
    await expectRevert(
      bridge.deposit(recipient, { from: user, value: web3.utils.toWei("1", "ether") }),
      "PG:USER_LIMIT"
    );
  });

  it("63. previewExecute returns same layer and reason as real revert", async () => {
    const { bridge, registry, rmn, monitor } = ctx;

    // Deposit 2 ETH
    const res = await bridge.deposit(recipient, { from: user, value: web3.utils.toWei("2", "ether") });
    const id = res.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);

    // 1. Bad signatures (below threshold or bad)
    const emptySigs = [];
    const previewBadSig = await bridge.previewExecute(id, emptySigs);
    assert.isFalse(previewBadSig.ok);
    assert.equal(previewBadSig.layer.toString(), "2");
    assert.equal(previewBadSig.reason, "PG:BAD_SIGS");
    await expectRevert(bridge.execute(id, emptySigs, { from: user }), "PG:BAD_SIGS");

    // Sign with 3 guardians
    const validSigs = await signApproval(web3, bridge, id, [ctx.guardians[0], ctx.guardians[1], ctx.guardians[2]]);

    // 2. Missing blessing
    const previewNoBless = await bridge.previewExecute(id, validSigs);
    assert.isFalse(previewNoBless.ok);
    assert.equal(previewNoBless.layer.toString(), "2");
    assert.equal(previewNoBless.reason, "PG:NOT_BLESSED");
    await expectRevert(bridge.execute(id, validSigs, { from: user }), "PG:NOT_BLESSED");

    // Bless by both risk nodes
    await rmn.bless(id, digest, { from: ctx.riskNodes[0] });
    await rmn.bless(id, digest, { from: ctx.riskNodes[1] });

    // 3. Success preview
    const previewSuccess = await bridge.previewExecute(id, validSigs);
    assert.isTrue(previewSuccess.ok);
    assert.equal(previewSuccess.layer.toString(), "0");

    // Execute transfer
    await bridge.execute(id, validSigs, { from: user });

    // 4. Replay preview (transfer state is no longer Pending)
    const previewReplay = await bridge.previewExecute(id, validSigs);
    assert.isFalse(previewReplay.ok);
    assert.equal(previewReplay.reason, "PG:NOT_PENDING");
    await expectRevert(bridge.execute(id, validSigs, { from: user }), "PG:NOT_PENDING");
  });

  it("64. limitsSnapshot values change correctly when risk band changes", async () => {
    const { guard, riskScore } = ctx;

    let snap = await guard.limitsSnapshot(user);
    assert.equal(web3.utils.fromWei(snap.perTxBase, "ether"), "10");
    assert.equal(web3.utils.fromWei(snap.perTxEff, "ether"), "10");
    assert.equal(snap.multiplierPct.toString(), "100");

    // Drop score by 30 (100 -> 70, band = MEDIUM, 50%)
    await ctx.detection.fundRewardPool({ from: deployer, value: web3.utils.toWei("1", "ether") });
    await ctx.detection.registerBot({ from: bot, value: web3.utils.toWei("1", "ether") });
    await ctx.detection.raiseAlert(web3.utils.randomHex(32), 3, "TEST_EVIDENCE", { from: bot });
    await govExec(
      ctx.monitor,
      ctx.owners,
      ctx.detection.address,
      ctx.detection.contract.methods.resolveAlert(0, true).encodeABI()
    );

    assert.equal((await riskScore.getScore()).toString(), "70");
    assert.equal((await riskScore.getBand()).toString(), "1"); // MEDIUM

    snap = await guard.limitsSnapshot(user);
    assert.equal(web3.utils.fromWei(snap.perTxBase, "ether"), "10");
    assert.equal(web3.utils.fromWei(snap.perTxEff, "ether"), "5");
    assert.equal(snap.multiplierPct.toString(), "50");
  });

  it("65. transferIdAt / transferTotal enumerate all transfers", async () => {
    const { bridge } = ctx;
    assert.equal((await bridge.transferTotal()).toString(), "0");

    const r1 = await bridge.deposit(recipient, { from: user, value: web3.utils.toWei("1", "ether") });
    const id1 = r1.logs.find((l) => l.event === "Deposited").args.id;

    const r2 = await bridge.deposit(recipient, { from: user, value: web3.utils.toWei("2", "ether") });
    const id2 = r2.logs.find((l) => l.event === "Deposited").args.id;

    assert.equal((await bridge.transferTotal()).toString(), "2");
    assert.equal(await bridge.transferIdAt(0), id1);
    assert.equal(await bridge.transferIdAt(1), id2);
  });

  it("66. getBots, getAlerts, getIncidents paginate correctly", async () => {
    const { detection, monitor, bridge } = ctx;

    // Register bots
    await detection.registerBot({ from: accounts[8], value: web3.utils.toWei("1", "ether") });
    await detection.registerBot({ from: accounts[9], value: web3.utils.toWei("1", "ether") });

    const bots = await detection.getBots();
    assert.equal(bots.length, 2);
    assert.equal(bots[0].toLowerCase(), accounts[8].toLowerCase());
    assert.equal(bots[1].toLowerCase(), accounts[9].toLowerCase());

    // Raise 2 alerts
    await detection.raiseAlert(web3.utils.randomHex(32), 1, "EVIDENCE_1", { from: accounts[8] });
    await detection.raiseAlert(web3.utils.randomHex(32), 2, "EVIDENCE_2", { from: accounts[9] });

    const alertsPage1 = await detection.getAlerts(0, 1);
    assert.equal(alertsPage1.length, 1);
    assert.equal(alertsPage1[0].evidence, "EVIDENCE_1");

    const alertsPage2 = await detection.getAlerts(1, 5);
    assert.equal(alertsPage2.length, 1);
    assert.equal(alertsPage2[0].evidence, "EVIDENCE_2");

    // Incidents in monitor
    await bridge.deposit(recipient, { from: user, value: web3.utils.toWei("8", "ether") }); // triggers Rule 0 (>= 8 ETH)
    assert.isAtLeast(Number(await monitor.incidentCount()), 1);

    const incidents = await monitor.getIncidents(0, 10);
    assert.isAtLeast(incidents.length, 1);
    assert.equal(incidents[0].user.toLowerCase(), user.toLowerCase());
  });

  it("67. hasBlessed, blessCountOf, curseVotesNow reflect votes", async () => {
    const { rmn, bridge } = ctx;

    const r = await bridge.deposit(recipient, { from: user, value: web3.utils.toWei("1", "ether") });
    const id = r.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);

    assert.equal((await rmn.blessCountOf(id, digest)).toString(), "0");
    assert.isFalse(await rmn.hasBlessed(id, digest, ctx.riskNodes[0]));

    await rmn.bless(id, digest, { from: ctx.riskNodes[0] });
    assert.equal((await rmn.blessCountOf(id, digest)).toString(), "1");
    assert.isTrue(await rmn.hasBlessed(id, digest, ctx.riskNodes[0]));
    assert.isFalse(await rmn.hasBlessed(id, digest, ctx.riskNodes[1]));

    assert.equal((await rmn.curseVotesNow()).toString(), "0");
    assert.isFalse(await rmn.hasCursed(ctx.riskNodes[0]));

    await rmn.curse("TEST_REASON", { from: ctx.riskNodes[0] });
    assert.equal((await rmn.curseVotesNow()).toString(), "1");
    assert.isTrue(await rmn.hasCursed(ctx.riskNodes[0]));
  });

  it("68. isUsed is true after execute", async () => {
    const { bridge, registry, rmn } = ctx;

    const res = await bridge.deposit(recipient, { from: user, value: web3.utils.toWei("1", "ether") });
    const id = res.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);

    assert.isFalse(await registry.isUsed(digest));

    const sigs = await signApproval(web3, bridge, id, [ctx.guardians[0], ctx.guardians[1], ctx.guardians[2]]);
    await rmn.bless(id, digest, { from: ctx.riskNodes[0] });
    await rmn.bless(id, digest, { from: ctx.riskNodes[1] });

    await bridge.execute(id, sigs, { from: user });
    assert.isTrue(await registry.isUsed(digest));
  });

  it("69. gas test writes frontend/public/reports/gas-table.json with BaselineBridge comparison", async () => {
    const { bridge, registry, rmn, token } = ctx;

    // Deploy BaselineBridge
    const baseline = await BaselineBridge.new(token.address, { from: deployer });
    const MINTER_ROLE = await token.MINTER_ROLE();
    await token.grantRole(MINTER_ROLE, baseline.address, { from: deployer });

    // 1. Measure PayGuard Lifecycle Gas
    const txDep = await bridge.deposit(recipient, { from: user, value: web3.utils.toWei("2", "ether") });
    const id = txDep.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);
    const gasDep = txDep.receipt.gasUsed;

    const sigs = await signApproval(web3, bridge, id, [ctx.guardians[0], ctx.guardians[1], ctx.guardians[2]]);
    const txB1 = await rmn.bless(id, digest, { from: ctx.riskNodes[0] });
    const txB2 = await rmn.bless(id, digest, { from: ctx.riskNodes[1] });
    const gasBless = txB1.receipt.gasUsed + txB2.receipt.gasUsed;

    const txExec = await bridge.execute(id, sigs, { from: user });
    const gasExec = txExec.receipt.gasUsed;

    const pgTotal = gasDep + gasBless + gasExec;

    // 2. Measure Baseline Bridge Gas
    const txBaseDep = await baseline.deposit(recipient, { from: user, value: web3.utils.toWei("2", "ether") });
    const baseId = txBaseDep.logs.find((l) => l.event === "Deposited").args.id;
    const gasBaseDep = txBaseDep.receipt.gasUsed;

    const txBaseMint = await baseline.mintTo(baseId, { from: deployer });
    const gasBaseMint = txBaseMint.receipt.gasUsed;

    const baseTotal = gasBaseDep + gasBaseMint;
    const overheadPct = Number((((pgTotal - baseTotal) / baseTotal) * 100).toFixed(2));

    const reportDir = path.resolve(__dirname, "..", "frontend", "public", "reports");
    fs.mkdirSync(reportDir, { recursive: true });

    const gasReport = {
      generatedAt: new Date().toISOString(),
      entries: [
        { fn: "deposit", contract: "PaymentBridge", layer: "L1", samples: 1, gasMin: gasDep, gasAvg: gasDep, gasMax: gasDep },
        { fn: "bless (2 nodes)", contract: "RiskManagement", layer: "L2", samples: 1, gasMin: gasBless, gasAvg: gasBless, gasMax: gasBless },
        { fn: "execute", contract: "PaymentBridge", layer: "L2", samples: 1, gasMin: gasExec, gasAvg: gasExec, gasMax: gasExec }
      ],
      lifecycle: {
        payguard: {
          deposit: gasDep,
          bless: gasBless,
          execute: gasExec,
          total: pgTotal
        },
        baseline: {
          deposit: gasBaseDep,
          mint: gasBaseMint,
          total: baseTotal
        },
        overheadPct
      }
    };

    const targetFile = path.join(reportDir, "gas-table.json");
    fs.writeFileSync(targetFile, JSON.stringify(gasReport, null, 2));

    console.log("\n========================================================");
    console.log("   PAYGUARD VS BASELINE LIFECYCLE GAS COMPARISON");
    console.log("========================================================");
    console.log(`  PayGuard Lifecycle Total: ${pgTotal.toLocaleString()} gas`);
    console.log(`  Baseline Lifecycle Total: ${baseTotal.toLocaleString()} gas`);
    console.log(`  Security Overhead:        +${overheadPct}%\n`);

    assert.isAbove(pgTotal, baseTotal, "PayGuard security layers require gas overhead");
    assert.isTrue(fs.existsSync(targetFile), "gas-table.json was generated");
  });
});
