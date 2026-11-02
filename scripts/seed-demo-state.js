/**
 * scripts/seed-demo-state.js
 *
 * Seeds Ganache with realistic, live demo transactions so that when the faculty
 * opens the PayGuard Control Center dashboard, all tables, gauges, event logs,
 * and timelines display real on-chain data.
 *
 * Usage:
 *   npx truffle exec scripts/seed-demo-state.js --network ganache
 */

const PaymentBridge = artifacts.require("PaymentBridge");
const WrappedToken = artifacts.require("WrappedToken");
const GuardianRegistry = artifacts.require("GuardianRegistry");
const RiskManagement = artifacts.require("RiskManagement");
const DetectionNetwork = artifacts.require("DetectionNetwork");
const InvariantGuard = artifacts.require("InvariantGuard");
const DefenderMonitor = artifacts.require("DefenderMonitor");
const RiskScore = artifacts.require("RiskScore");

const { signApproval } = require("../test/helpers/sign");

module.exports = async function (callback) {
  try {
    const accounts = await web3.eth.getAccounts();
    const deployer = accounts[0];
    const guardians = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]];
    const riskNodes = [accounts[6], accounts[7]];
    const bots = [accounts[8], accounts[9]];
    const owners = [accounts[10], accounts[11], accounts[12]];
    const user = accounts[13];
    const attacker = accounts[14];

    console.log("\n========================================================");
    console.log("   PAYGUARD DEMO STATE SEEDER");
    console.log("========================================================\n");

    const bridge = await PaymentBridge.deployed();
    const token = await WrappedToken.deployed();
    const registry = await GuardianRegistry.deployed();
    const rmn = await RiskManagement.deployed();
    const detection = await DetectionNetwork.deployed();
    const guard = await InvariantGuard.deployed();
    const monitor = await DefenderMonitor.deployed();
    const riskScore = await RiskScore.deployed();

    console.log("Connected to deployed contracts:");
    console.log(`- PaymentBridge:   ${bridge.address}`);
    console.log(`- WrappedToken:    ${token.address}`);
    console.log(`- InvariantGuard:  ${guard.address}`);
    console.log(`- DefenderMonitor: ${monitor.address}\n`);

    // 1. Register Detection Bots
    console.log("1. Registering Forta Detection Bots B1 & B2...");
    const isB1 = await detection.isBot(bots[0]);
    if (!isB1) {
      await detection.registerBot({ from: bots[0], value: web3.utils.toWei("1", "ether") });
      console.log(`   ✓ Bot 1 (${bots[0].slice(0, 8)}...) registered with 1 ETH stake.`);
    }
    const isB2 = await detection.isBot(bots[1]);
    if (!isB2) {
      await detection.registerBot({ from: bots[1], value: web3.utils.toWei("1", "ether") });
      console.log(`   ✓ Bot 2 (${bots[1].slice(0, 8)}...) registered with 1 ETH stake.`);
    }

    // 2. Regular Transfer (2 ETH) - Full Lifecycle (Deposit -> Bless -> Sign -> Execute)
    console.log("\n2. Executing Standard Bridge Transfer (2 ETH)...");
    const dep1Tx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("2", "ether") });
    const dep1Event = dep1Tx.logs.find((l) => l.event === "Deposited");
    const t1Id = dep1Event.args.id;
    const t1Digest = await bridge.getDigest(t1Id);
    console.log(`   ✓ Deposit submitted. Transfer ID: ${t1Id.slice(0, 14)}...`);
    console.log(`     Net Amount: ${web3.utils.fromWei(dep1Event.args.netAmount, "ether")} ETH (Fee: ${web3.utils.fromWei(dep1Event.args.fee, "ether")} ETH)`);

    // RMN Blessing
    console.log("   - Risk Management Nodes (R1, R2) evaluating transfer...");
    await rmn.bless(t1Id, t1Digest, { from: riskNodes[0] });
    await rmn.bless(t1Id, t1Digest, { from: riskNodes[1] });
    console.log("   ✓ Quorum reached: 2/2 RMN blessings confirmed.");

    // Guardian Signatures (G1, G2, G3)
    console.log("   - Wormhole Guardians (G1, G2, G3) signing approval...");
    const sigs1 = await signApproval(web3, bridge, t1Id, [guardians[0], guardians[1], guardians[2]]);
    console.log("   ✓ Quorum reached: 3/5 Guardian ECDSA signatures collected.");

    // Execution
    await bridge.execute(t1Id, sigs1, { from: user });
    const userPgEth = await token.balanceOf(user);
    console.log(`   ✓ Transfer Executed! Recipient minted ${web3.utils.fromWei(userPgEth, "ether")} pgETH.`);

    // 3. Large Transfer (6 ETH) -> Enters 48-hour Timelock (Challengeable)
    console.log("\n3. Creating Large Transfer (6 ETH >= 5 ETH threshold)...");
    const dep2Tx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("6", "ether") });
    const dep2Event = dep2Tx.logs.find((l) => l.event === "Deposited");
    const t2Id = dep2Event.args.id;
    const t2Digest = await bridge.getDigest(t2Id);
    console.log(`   ✓ Large Transfer submitted! ID: ${t2Id.slice(0, 14)}...`);
    console.log(`     IsLarge: ${dep2Event.args.isLarge} (Enters Challenge Window)`);

    // Bless & Verify
    await rmn.bless(t2Id, t2Digest, { from: riskNodes[0] });
    await rmn.bless(t2Id, t2Digest, { from: riskNodes[1] });
    const sigs2 = await signApproval(web3, bridge, t2Id, [guardians[0], guardians[1], guardians[2]]);
    await bridge.execute(t2Id, sigs2, { from: user });
    const t2Data = await bridge.getTransfer(t2Id);
    console.log(`   ✓ Transfer verified and placed in 3600s challenge lock!`);
    console.log(`     Executable At timestamp: ${t2Data.executableAt} (State: Verified = 2)`);

    // 4. Raise Forta Alert to demonstrate dynamic risk score mutation
    console.log("\n4. Bot B1 raising an automated detection alert...");
    const mockAttackId = web3.utils.sha3("SIMULATED_PROBE_0x82");
    await detection.raiseAlert(mockAttackId, 1, "Suspicious rapid calls from untrusted proxy", { from: bots[0] });
    console.log("   ✓ Alert emitted: Severity 1 (MEDIUM). RiskScore reduced by penalty.");
    const currentScore = await riskScore.getScore();
    const currentBand = await riskScore.getBand();
    console.log(`   ✓ Live CertiK Risk Score: ${currentScore}/100 (Band: ${["LOW", "MEDIUM", "HIGH", "CRITICAL"][currentBand]})`);

    // 5. Invariant check
    console.log("\n5. Verifying Solvency Invariants...");
    const bridgeBal = await web3.eth.getBalance(bridge.address);
    const supply = await token.totalSupply();
    console.log(`   - PaymentBridge ETH balance:  ${web3.utils.fromWei(bridgeBal, "ether")} ETH`);
    console.log(`   - WrappedToken pgETH supply:  ${web3.utils.fromWei(supply, "ether")} pgETH`);
    console.log(`   ✓ Invariant balance >= totalSupply: ${BigInt(bridgeBal) >= BigInt(supply) ? "PASSED" : "VIOLATED"}`);

    // Update frontend artifacts
    const { exportArtifacts } = require("./export-frontend-artifacts.js");
    exportArtifacts();

    console.log("\n========================================================");
    console.log("   ✓ SEEDING COMPLETE: DASHBOARD IS NOW LIVE WITH DATA");
    console.log("========================================================\n");

    callback();
  } catch (err) {
    console.error("Error seeding demo state:", err);
    callback(err);
  }
};
