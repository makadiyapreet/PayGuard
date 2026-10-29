const fs = require("fs");
const path = require("path");

async function printReport(customArtifacts, customWeb3) {
  const art = customArtifacts || global.artifacts;
  const w3 = customWeb3 || global.web3;

  const RiskScore = art.require("RiskScore");
  const WrappedToken = art.require("WrappedToken");
  const RiskManagement = art.require("RiskManagement");
  const DetectionNetwork = art.require("DetectionNetwork");
  const InvariantGuard = art.require("InvariantGuard");
  const DefenderMonitor = art.require("DefenderMonitor");
  const PaymentBridge = art.require("PaymentBridge");

  const deployedPath = path.join(__dirname, "..", "deployed.json");
  let deployed = {};
  if (fs.existsSync(deployedPath)) {
    deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  }

  const riskScore = deployed.RiskScore ? await RiskScore.at(deployed.RiskScore) : await RiskScore.deployed();
  const token = deployed.WrappedToken ? await WrappedToken.at(deployed.WrappedToken) : await WrappedToken.deployed();
  const rmn = deployed.RiskManagement ? await RiskManagement.at(deployed.RiskManagement) : await RiskManagement.deployed();
  const detection = deployed.DetectionNetwork ? await DetectionNetwork.at(deployed.DetectionNetwork) : await DetectionNetwork.deployed();
  const guard = deployed.InvariantGuard ? await InvariantGuard.at(deployed.InvariantGuard) : await InvariantGuard.deployed();
  const monitor = deployed.DefenderMonitor ? await DefenderMonitor.at(deployed.DefenderMonitor) : await DefenderMonitor.deployed();
  const bridge = deployed.PaymentBridge ? await PaymentBridge.at(deployed.PaymentBridge) : await PaymentBridge.deployed();

  console.log("\n================================================================================");
  console.log("                      PAYGUARD LIVE SYSTEM SNAPSHOT                             ");
  console.log("================================================================================");

  // Status flags
  const isPaused = await bridge.paused();
  const isCursed = await rmn.isCursed();
  console.log(`[STATUS] Bridge Paused: ${isPaused ? "\x1b[31mYES\x1b[0m" : "\x1b[32mNO\x1b[0m"} | RMN Cursed: ${isCursed ? "\x1b[31mYES\x1b[0m" : "\x1b[32mNO\x1b[0m"}`);

  // Risk Score & Band
  const score = await riskScore.getScore();
  const bandIdx = Number(await riskScore.getBand());
  const bands = ["LOW (>=80)", "MEDIUM (50-79)", "HIGH (20-49)", "CRITICAL (<20)"];
  console.log(`[RISK] Score: \x1b[33m${score}\x1b[0m/100 | Band: \x1b[35m${bands[bandIdx]}\x1b[0m | Multiplier: ${await guard.multiplier()}%`);

  // Limits
  const effPerTx = w3.utils.fromWei(await guard.effectivePerTxLimit(), "ether");
  const effUser = w3.utils.fromWei(await guard.effectiveUserDailyLimit(), "ether");
  const effGlobal = w3.utils.fromWei(await guard.effectiveGlobalDailyLimit(), "ether");
  console.log(`[LIMITS] Eff Per-Tx: ${effPerTx} ETH | Eff User Daily: ${effUser} ETH | Eff Global Daily: ${effGlobal} ETH`);

  // Solvency Invariant
  const bridgeBalance = await w3.eth.getBalance(bridge.address);
  const totalSupply = await token.totalSupply();
  const invariantHolds = await guard.checkInvariant();
  console.log(`[INVARIANT] Bridge Locked: ${w3.utils.fromWei(bridgeBalance, "ether")} ETH | pgETH Supply: ${w3.utils.fromWei(totalSupply, "ether")} pgETH | Solvency: ${invariantHolds ? "\x1b[32mPASSED (Balance >= Supply)\x1b[0m" : "\x1b[31mVIOLATED\x1b[0m"}`);

  // Reward pool
  const pool = await detection.rewardPool();
  console.log(`[DETECTION POOL] Available Reward Pool: ${w3.utils.fromWei(pool, "ether")} ETH`);

  // Incidents
  const incCount = Number(await monitor.incidentCount());
  console.log(`\n[DEFENDER INCIDENTS] Total: ${incCount}`);
  const startInc = Math.max(0, incCount - 5);
  for (let i = startInc; i < incCount; i++) {
    const inc = await monitor.getIncident(i);
    const actions = ["ALERT", "PAUSE", "BLACKLIST"];
    console.log(`  - Incident #${i}: User ${inc.user.slice(0, 8)}... | Rule #${inc.ruleId} | Action: ${actions[inc.action]} | Amount: ${w3.utils.fromWei(inc.amount, "ether")} ETH`);
  }

  // Alerts
  const alertCount = Number(await detection.alertCount());
  console.log(`\n[FORTA ALERTS] Total: ${alertCount}`);
  for (let i = 0; i < alertCount; i++) {
    const al = await detection.getAlert(i);
    const statuses = ["Pending", "Valid", "Invalid"];
    console.log(`  - Alert #${i}: Bot ${al.bot.slice(0, 8)}... | Severity: ${al.severity} | Status: ${statuses[al.status]} | Reason: ${al.evidence}`);
  }

  // Proposals
  const propCount = Number(await monitor.proposalCount());
  console.log(`\n[GOVERNANCE PROPOSALS] Total: ${propCount}`);
  for (let i = 0; i < propCount; i++) {
    const p = await monitor.getProposal(i);
    console.log(`  - Proposal #${i}: Target ${p.target.slice(0, 8)}... | Confirmations: ${p.confirmations} | Executed: ${p.executed} | Cancelled: ${p.cancelled}`);
  }
  console.log("================================================================================\n");
}

module.exports = async function (callback) {
  try {
    await printReport();
    callback();
  } catch (err) {
    callback(err);
  }
};

module.exports.printReport = printReport;
