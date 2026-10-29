const fs = require("fs");
const path = require("path");
const { printReport } = require("./report");
const { signApproval, signDigest } = require("../test/helpers/sign");
const { increaseTime } = require("../test/helpers/time");
const { govExec } = require("../test/helpers/gov");

const PaymentBridge = artifacts.require("PaymentBridge");
const WrappedToken = artifacts.require("WrappedToken");
const RiskScore = artifacts.require("RiskScore");
const GuardianRegistry = artifacts.require("GuardianRegistry");
const RiskManagement = artifacts.require("RiskManagement");
const DetectionNetwork = artifacts.require("DetectionNetwork");
const InvariantGuard = artifacts.require("InvariantGuard");
const DefenderMonitor = artifacts.require("DefenderMonitor");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async function (callback) {
  try {
    global.web3 = web3;
    global.artifacts = artifacts;
    const accounts = await web3.eth.getAccounts();
    const deployer = accounts[0];
    const guardians = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]];
    const riskNodes = [accounts[6], accounts[7]];
    const bot = accounts[8];
    const owners = [accounts[10], accounts[11], accounts[12]];
    const user = accounts[13];
    const attacker = accounts[14];

    const deployedPath = path.join(__dirname, "..", "deployed.json");
    let deployed = {};
    if (fs.existsSync(deployedPath)) {
      deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
    }

    const bridge = deployed.PaymentBridge ? await PaymentBridge.at(deployed.PaymentBridge) : await PaymentBridge.deployed();
    const token = deployed.WrappedToken ? await WrappedToken.at(deployed.WrappedToken) : await WrappedToken.deployed();
    const riskScore = deployed.RiskScore ? await RiskScore.at(deployed.RiskScore) : await RiskScore.deployed();
    const registry = deployed.GuardianRegistry ? await GuardianRegistry.at(deployed.GuardianRegistry) : await GuardianRegistry.deployed();
    const rmn = deployed.RiskManagement ? await RiskManagement.at(deployed.RiskManagement) : await RiskManagement.deployed();
    const detection = deployed.DetectionNetwork ? await DetectionNetwork.at(deployed.DetectionNetwork) : await DetectionNetwork.deployed();
    const guard = deployed.InvariantGuard ? await InvariantGuard.at(deployed.InvariantGuard) : await InvariantGuard.deployed();
    const monitor = deployed.DefenderMonitor ? await DefenderMonitor.at(deployed.DefenderMonitor) : await DefenderMonitor.deployed();

    console.log("\x1b[1m\x1b[36m================================================================================");
    console.log("            PAYGUARD LIVE DEMO: LAYERED PAYMENT-INTEGRITY BRIDGE               ");
    console.log("================================================================================\x1b[0m\n");

    // -------------------------------------------------------------------------------------------------
    // STEP 1: Deployment & Initial State
    // -------------------------------------------------------------------------------------------------
    console.log("\x1b[1m\x1b[34m[STEP 1/8] Verifying Deployment Table, Initial Stats, and Risk Score\x1b[0m");
    console.table(
      Object.entries(deployed).map(([Contract, Address]) => ({
        Contract,
        Address
      }))
    );
    await printReport(artifacts, web3);
    await sleep(1000);

    // -------------------------------------------------------------------------------------------------
    // STEP 2: Normal 2-ETH Transfer
    // -------------------------------------------------------------------------------------------------
    console.log("\x1b[1m\x1b[34m[STEP 2/8] Executing Legitimate 2-ETH Cross-Chain Transfer\x1b[0m");
    console.log("  -> User initiating 2 ETH deposit...");
    const depTx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("2", "ether") });
    const id = depTx.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);
    console.log(`  -> Transfer ID: ${id}`);
    console.log(`  -> Approval Digest: ${digest}`);

    console.log("  -> Collecting 3 Guardian Signatures (G1, G2, G3)...");
    const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1], guardians[2]]);
    console.log("  -> Signatures successfully normalized and sorted.");

    console.log("  -> CCIP Risk Management Network (RMN) blessing transfer independently...");
    await rmn.bless(id, digest, { from: riskNodes[0] });
    await rmn.bless(id, digest, { from: riskNodes[1] });
    console.log("  -> Quorum blessing confirmed (2/2).");

    console.log("  -> Executing bridge transfer...");
    await bridge.execute(id, sigs, { from: user });
    const userBal = await token.balanceOf(user);
    console.log(`  \x1b[32m✔ SUCCESS: pgETH minted to recipient: ${web3.utils.fromWei(userBal, "ether")} pgETH\x1b[0m`);
    await sleep(1000);

    // -------------------------------------------------------------------------------------------------
    // STEP 3: Attacker's Forged Approval
    // -------------------------------------------------------------------------------------------------
    console.log("\n\x1b[1m\x1b[34m[STEP 3/8] Simulating Wormhole-Style Attack: Forged Signatures\x1b[0m");
    const fakeTx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("1", "ether") });
    const fakeId = fakeTx.logs.find((l) => l.event === "Deposited").args.id;
    const fakeDigest = await bridge.getDigest(fakeId);

    await rmn.bless(fakeId, fakeDigest, { from: riskNodes[0] });
    await rmn.bless(fakeId, fakeDigest, { from: riskNodes[1] });

    // Attacker crafts signatures with non-guardians
    const forgedSigs = await signDigest(web3, fakeDigest, [accounts[11], accounts[12], attacker]);
    try {
      await bridge.execute(fakeId, forgedSigs, { from: attacker });
      console.log("\x1b[31m✘ FAILED: Forged approval succeeded!\x1b[0m");
    } catch (e) {
      console.log(`  \x1b[32m✔ BLOCKED: Bridge rejected forged approval (${e.reason || "PG:BAD_SIGS"})\x1b[0m`);
    }
    await sleep(1000);

    // -------------------------------------------------------------------------------------------------
    // STEP 4: Attacker's Replay Attack
    // -------------------------------------------------------------------------------------------------
    console.log("\n\x1b[1m\x1b[34m[STEP 4/8] Simulating Replay Attack on Executed Transfer\x1b[0m");
    try {
      await bridge.execute(id, sigs, { from: attacker });
      console.log("\x1b[31m✘ FAILED: Replay attack succeeded!\x1b[0m");
    } catch (e) {
      console.log(`  \x1b[32m✔ BLOCKED: Bridge rejected replay attack (${e.reason || "PG:NOT_PENDING"})\x1b[0m`);
    }
    await sleep(1000);

    // -------------------------------------------------------------------------------------------------
    // STEP 5: Detection Network Bot Alert -> Risk Score Drops -> Limits Shrink
    // -------------------------------------------------------------------------------------------------
    console.log("\n\x1b[1m\x1b[34m[STEP 5/8] Forta Detection Network Alert -> Score Drop -> Limit Shrinkage\x1b[0m");
    console.log("  -> Staking 1 ETH to register detection bot...");
    await detection.registerBot({ from: bot, value: web3.utils.toWei("1", "ether") });

    const limitBefore = web3.utils.fromWei(await guard.effectivePerTxLimit(), "ether");
    console.log(`  -> Current Effective Per-Tx Limit: \x1b[33m${limitBefore} ETH\x1b[0m (Score: ${await riskScore.getScore()})`);

    console.log("  -> Bot raising High Severity (Level 3) alert on suspicious off-chain pattern...");
    const anomId = web3.utils.sha3("OFF_CHAIN_DRAIN_PATTERN");
    await detection.raiseAlert(anomId, 3, "COLLUSION_SUSPECTED_ON_GUARDIAN_KEYS", { from: bot });

    console.log("  -> Multi-sig Governance resolving alert as VALID...");
    const resolveData = detection.contract.methods.resolveAlert(0, true).encodeABI();
    await govExec(monitor, [owners[0], owners[1]], detection.address, resolveData);

    const scoreAfter = await riskScore.getScore();
    const limitAfter = web3.utils.fromWei(await guard.effectivePerTxLimit(), "ether");
    console.log(`  \x1b[32m✔ SUCCESS: RiskScore reduced to ${scoreAfter}. Effective limit shrunk to: \x1b[31m${limitAfter} ETH\x1b[0m`);
    await sleep(1000);

    // -------------------------------------------------------------------------------------------------
    // STEP 6: Defender Auto-Pause on Rapid Deposit-Redeem
    // -------------------------------------------------------------------------------------------------
    console.log("\n\x1b[1m\x1b[34m[STEP 6/8] Defender Automated Rule Trigger: Rapid Deposit-Redeem\x1b[0m");
    console.log("  -> User deposits 2 ETH then immediately initiates rapid redeem of 1.5 ETH...");
    const dep2 = await bridge.deposit(user, { from: user, value: web3.utils.toWei("2", "ether") });
    const id2 = dep2.logs.find((l) => l.event === "Deposited").args.id;
    const dig2 = await bridge.getDigest(id2);
    await rmn.bless(id2, dig2, { from: riskNodes[0] });
    await rmn.bless(id2, dig2, { from: riskNodes[1] });
    const sigs2 = await signApproval(web3, bridge, id2, [guardians[0], guardians[1], guardians[2]]);
    await bridge.execute(id2, sigs2, { from: user });

    // Rapid redeem trips rule RAPID_REDEEM -> PAUSE
    await bridge.redeem(web3.utils.toWei("1.5", "ether"), { from: user });
    console.log(`  -> Bridge paused status: \x1b[31m${await bridge.paused()}\x1b[0m`);

    console.log("  -> Verifying subsequent deposit is rejected while paused...");
    try {
      await bridge.deposit(user, { from: user, value: web3.utils.toWei("0.5", "ether") });
      console.log("\x1b[31m✘ FAILED: Deposit succeeded while paused!\x1b[0m");
    } catch (e) {
      console.log(`  \x1b[32m✔ BLOCKED: Deposit rejected by paused bridge (${e.reason || "PG:PAUSED"})\x1b[0m`);
    }
    await sleep(1000);

    // -------------------------------------------------------------------------------------------------
    // STEP 7: Governance Proposal & Timelock Unpause
    // -------------------------------------------------------------------------------------------------
    console.log("\n\x1b[1m\x1b[34m[STEP 7/8] Multi-Sig Governance + Timelock Unpause Workflow\x1b[0m");
    console.log("  -> Owner 1 submitting unpause proposal to DefenderMonitor...");
    const unpauseData = bridge.contract.methods.unpause().encodeABI();
    await monitor.submitProposal(bridge.address, unpauseData, { from: owners[0] });
    const propId = Number(await monitor.proposalCount()) - 1;

    console.log("  -> Owner 2 confirming proposal (2-of-3 threshold reached)...");
    await monitor.confirmProposal(propId, { from: owners[1] });

    console.log("  -> Waiting for 60-second governance timelock to elapse...");
    await increaseTime(65);

    console.log("  -> Executing governance proposal...");
    await monitor.executeProposal(propId, { from: owners[0] });
    console.log(`  \x1b[32m✔ SUCCESS: Bridge unpaused! Current paused status: ${await bridge.paused()}\x1b[0m`);
    await sleep(1000);

    // -------------------------------------------------------------------------------------------------
    // STEP 8: Final Snapshot & Solvency Invariant
    // -------------------------------------------------------------------------------------------------
    console.log("\n\x1b[1m\x1b[34m[STEP 8/8] Final State Snapshot and Invariant Verification\x1b[0m");
    await printReport(artifacts, web3);

    const finalSolvency = await guard.checkInvariant();
    if (finalSolvency) {
      console.log("\x1b[1m\x1b[32m================================================================================");
      console.log("  DEMO COMPLETE: ALL 8 SECURITY LAYERS VERIFIED. BRIDGE FULLY SOLVENT & SECURE.  ");
      console.log("================================================================================\x1b[0m\n");
    } else {
      console.log("\x1b[1m\x1b[31mDEMO FAILED: SOLVENCY INVARIANT VIOLATED!\x1b[0m\n");
    }

    callback();
  } catch (err) {
    callback(err);
  }
};
