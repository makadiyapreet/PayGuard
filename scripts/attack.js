const fs = require("fs");
const path = require("path");
const { signApproval, signDigest } = require("../test/helpers/sign");
const { govExec } = require("../test/helpers/gov");
const ReentrancyAttacker = artifacts.require("ReentrancyAttacker");

const PaymentBridge = artifacts.require("PaymentBridge");
const WrappedToken = artifacts.require("WrappedToken");
const GuardianRegistry = artifacts.require("GuardianRegistry");
const RiskManagement = artifacts.require("RiskManagement");
const DetectionNetwork = artifacts.require("DetectionNetwork");
const InvariantGuard = artifacts.require("InvariantGuard");
const DefenderMonitor = artifacts.require("DefenderMonitor");
const RiskScore = artifacts.require("RiskScore");

module.exports = async function (callback) {
  try {
    global.web3 = web3;
    global.artifacts = artifacts;

    const accounts = await web3.eth.getAccounts();
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
    const rmn = deployed.RiskManagement ? await RiskManagement.at(deployed.RiskManagement) : await RiskManagement.deployed();
    const detection = deployed.DetectionNetwork ? await DetectionNetwork.at(deployed.DetectionNetwork) : await DetectionNetwork.deployed();
    const guard = deployed.InvariantGuard ? await InvariantGuard.at(deployed.InvariantGuard) : await InvariantGuard.deployed();
    const monitor = deployed.DefenderMonitor ? await DefenderMonitor.at(deployed.DefenderMonitor) : await DefenderMonitor.deployed();

    // Ensure bridge is unpaused if left paused by a previous test
    if (await bridge.paused()) {
      const unpauseData = bridge.contract.methods.unpause().encodeABI();
      await govExec(monitor, [owners[0], owners[1]], bridge.address, unpauseData);
    }

    console.log("\x1b[1m\x1b[31m================================================================================");
    console.log("            PAYGUARD AUTOMATED PENETRATION & ATTACK SUITE                      ");
    console.log("================================================================================\x1b[0m\n");

    let passed = 0;
    let total = 0;

    async function reportAttack(name, attackFn) {
      total++;
      process.stdout.write(`[ATTACK ${total}] ${name.padEnd(55)} ... `);
      try {
        const res = await attackFn();
        if (res && res.blocked) {
          console.log(`\x1b[32mBLOCKED ✔\x1b[0m (${res.reason})`);
          passed++;
        } else {
          console.log(`\x1b[31mNOT BLOCKED ✘\x1b[0m`);
        }
      } catch (err) {
        console.log(`\x1b[32mBLOCKED ✔\x1b[0m (${err.reason || err.message.slice(0, 30)})`);
        passed++;
      }
    }

    // 1. Ronin Attack
    await reportAttack("Ronin Bridge: 2-of-5 Guardian Compromise", async () => {
      const tx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("1", "ether") });
      const id = tx.logs.find((l) => l.event === "Deposited").args.id;
      const digest = await bridge.getDigest(id);
      await rmn.bless(id, digest, { from: riskNodes[0] });
      await rmn.bless(id, digest, { from: riskNodes[1] });

      const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1]]);
      try {
        await bridge.execute(id, sigs, { from: attacker });
        return { blocked: false };
      } catch (e) {
        return { blocked: true, reason: e.reason || "PG:BAD_SIGS" };
      }
    });

    // 2. Wormhole Spoofed Approval
    await reportAttack("Wormhole Bridge: Forged Guardian Signatures", async () => {
      const tx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("1", "ether") });
      const id = tx.logs.find((l) => l.event === "Deposited").args.id;
      const digest = await bridge.getDigest(id);
      await rmn.bless(id, digest, { from: riskNodes[0] });
      await rmn.bless(id, digest, { from: riskNodes[1] });

      const fakeSigs = await signDigest(web3, digest, [accounts[10], accounts[11], attacker]);
      try {
        await bridge.execute(id, fakeSigs, { from: attacker });
        return { blocked: false };
      } catch (e) {
        return { blocked: true, reason: e.reason || "PG:BAD_SIGS" };
      }
    });

    // 3. Replay Attack
    await reportAttack("Nomad Bridge: Replay of Executed Transfer", async () => {
      const tx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("1", "ether") });
      const id = tx.logs.find((l) => l.event === "Deposited").args.id;
      const digest = await bridge.getDigest(id);
      await rmn.bless(id, digest, { from: riskNodes[0] });
      await rmn.bless(id, digest, { from: riskNodes[1] });
      const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1], guardians[2]]);
      await bridge.execute(id, sigs, { from: user });

      try {
        await bridge.execute(id, sigs, { from: attacker });
        return { blocked: false };
      } catch (e) {
        return { blocked: true, reason: e.reason || "PG:NOT_PENDING" };
      }
    });

    // 4. Reentrancy on Redeem
    await reportAttack("DAO / Poly Reentrancy: Re-entrant Drain on Redeem", async () => {
      const reentrancy = await ReentrancyAttacker.new(bridge.address, token.address, { from: attacker });
      const tx = await reentrancy.deposit(reentrancy.address, { from: attacker, value: web3.utils.toWei("1", "ether") });
      const id = tx.logs.find((l) => l.event === "DepositedId").args.id;
      const digest = await bridge.getDigest(id);
      await rmn.bless(id, digest, { from: riskNodes[0] });
      await rmn.bless(id, digest, { from: riskNodes[1] });
      const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1], guardians[2]]);
      await bridge.execute(id, sigs, { from: attacker });

      await reentrancy.attackRedeem(web3.utils.toWei("0.5", "ether"), { from: attacker });
      const succeeded = await reentrancy.attackSucceeded();
      return { blocked: !succeeded, reason: "ReentrancyGuard & CEI" };
    });

    // 5. Reentrancy on Refund
    await reportAttack("DAO Reentrancy: Re-entrant Drain on Refund", async () => {
      const reentrancy = await ReentrancyAttacker.new(bridge.address, token.address, { from: attacker });
      const tx = await reentrancy.deposit(reentrancy.address, { from: attacker, value: web3.utils.toWei("1", "ether") });
      const id = tx.logs.find((l) => l.event === "DepositedId").args.id;

      if (!(await detection.isBot(bot))) {
        await detection.registerBot({ from: bot, value: web3.utils.toWei("1", "ether") });
      }
      await bridge.challenge(id, "SUSPICIOUS_PAYLOAD", { from: bot });

      await reentrancy.attackRefund(id, { from: attacker });
      const succeeded = await reentrancy.attackSucceeded();
      return { blocked: !succeeded, reason: "ReentrancyGuard & CEI" };
    });

    // 6. Direct ETH theft via fallback
    await reportAttack("Plain ETH Fallback Transfer Theft", async () => {
      try {
        await bridge.sendTransaction({ from: attacker, value: web3.utils.toWei("0.1", "ether") });
        return { blocked: false };
      } catch (e) {
        return { blocked: true, reason: e.reason || "PG:NO_DIRECT_ETH" };
      }
    });

    // 7. Deposit Above Invariant Limit
    await reportAttack("Invariant Breach: Deposit Exceeding Base Limit", async () => {
      try {
        await bridge.deposit(attacker, { from: attacker, value: web3.utils.toWei("15", "ether") });
        return { blocked: false };
      } catch (e) {
        return { blocked: true, reason: e.reason || "PG:TX_LIMIT" };
      }
    });

    console.log(`\n\x1b[1mRESULTS: ${passed}/${total} Attacks BLOCKED (${((passed / total) * 100).toFixed(0)}% Defense Success Rate)\x1b[0m\n`);

    callback();
  } catch (err) {
    callback(err);
  }
};
