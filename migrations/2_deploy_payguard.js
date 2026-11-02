const fs = require("fs");
const path = require("path");

const RiskScore = artifacts.require("RiskScore");
const WrappedToken = artifacts.require("WrappedToken");
const GuardianRegistry = artifacts.require("GuardianRegistry");
const RiskManagement = artifacts.require("RiskManagement");
const DetectionNetwork = artifacts.require("DetectionNetwork");
const InvariantGuard = artifacts.require("InvariantGuard");
const DefenderMonitor = artifacts.require("DefenderMonitor");
const PaymentBridge = artifacts.require("PaymentBridge");

module.exports = async function (deployer, network, accounts) {
  // Accounts mapping from Section 4:
  // 0: Deployer
  // 1-5: Guardians G1-G5
  // 6-7: Risk nodes R1-R2
  // 8-9: Detection bots B1-B2
  // 10-12: Governance owners O1-O3
  // 13: User
  // 14: Attacker

  const deployerAcc = accounts[0];
  const guardians = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]];
  const riskNodes = [accounts[6], accounts[7]];
  const owners = [accounts[10], accounts[11], accounts[12]];

  console.log("\n========================================================");
  console.log("   PAYGUARD DEPLOYMENT & GOVERNANCE INITIALIZATION");
  console.log("========================================================\n");

  // 1. RiskScore
  await deployer.deploy(RiskScore, 100, 5, 3600, { from: deployerAcc });
  const riskScore = await RiskScore.deployed();

  // 2. WrappedToken
  await deployer.deploy(WrappedToken, "PayGuard Wrapped ETH", "pgETH", deployerAcc, { from: deployerAcc });
  const token = await WrappedToken.deployed();

  // 3. GuardianRegistry
  await deployer.deploy(GuardianRegistry, guardians, 3, { from: deployerAcc });
  const registry = await GuardianRegistry.deployed();

  // 4. RiskManagement
  await deployer.deploy(RiskManagement, riskNodes, 2, riskScore.address, { from: deployerAcc });
  const rmn = await RiskManagement.deployed();

  // 5. DetectionNetwork
  await deployer.deploy(
    DetectionNetwork,
    riskScore.address,
    web3.utils.toWei("1", "ether"),
    1000, // 10% reward
    5000, // 50% slash
    86400, // 24h unbond
    { from: deployerAcc }
  );
  const detection = await DetectionNetwork.deployed();

  // 6. InvariantGuard
  await deployer.deploy(
    InvariantGuard,
    riskScore.address,
    token.address,
    web3.utils.toWei("10", "ether"),  // 10 ETH per tx
    web3.utils.toWei("20", "ether"),  // 20 ETH user daily
    web3.utils.toWei("50", "ether"),  // 50 ETH global daily
    86400,                            // 24h window
    { from: deployerAcc }
  );
  const guard = await InvariantGuard.deployed();

  // 7. DefenderMonitor
  await deployer.deploy(
    DefenderMonitor,
    owners,
    2,  // 2-of-3 required
    60, // 60s timelock
    riskScore.address,
    { from: deployerAcc }
  );
  const monitor = await DefenderMonitor.deployed();

  // 8. PaymentBridge
  await deployer.deploy(
    PaymentBridge,
    token.address,
    registry.address,
    guard.address,
    rmn.address,
    monitor.address,
    detection.address,
    10,                             // 10 bps (0.10%) fee
    web3.utils.toWei("5", "ether"), // 5 ETH large transfer threshold
    3600,                           // 1h large delay
    86400,                          // 24h TTL
    { from: deployerAcc }
  );
  const bridge = await PaymentBridge.deployed();

  // Wiring
  console.log("Wiring contracts...");
  const MINTER_ROLE = await token.MINTER_ROLE();
  await token.grantRole(MINTER_ROLE, bridge.address, { from: deployerAcc });

  await registry.setBridge(bridge.address, { from: deployerAcc });
  await guard.setBridge(bridge.address, { from: deployerAcc });
  await detection.setBridge(bridge.address, { from: deployerAcc });
  await monitor.setBridge(bridge.address, { from: deployerAcc });

  await riskScore.setAuthorized(detection.address, true, { from: deployerAcc });
  await riskScore.setAuthorized(monitor.address, true, { from: deployerAcc });
  await riskScore.setAuthorized(rmn.address, true, { from: deployerAcc });

  // Add default rules:
  // Rule 0: LARGE_AMOUNT, 8 ETH, window 0, ALERT
  await monitor.addRule(0, web3.utils.toWei("8", "ether"), 0, 0, { from: deployerAcc });
  // Rule 1: VELOCITY, 5 tx, window 600s, PAUSE
  await monitor.addRule(1, 5, 600, 1, { from: deployerAcc });
  // Rule 2: RAPID_REDEEM, 1 ETH, window 300s, PAUSE
  await monitor.addRule(2, web3.utils.toWei("1", "ether"), 300, 1, { from: deployerAcc });
  // Rule 3: NEW_ADDRESS_LARGE, 5 ETH, window 0, ALERT
  await monitor.addRule(3, web3.utils.toWei("5", "ether"), 0, 0, { from: deployerAcc });

  // Transfer governance of every contract to DefenderMonitor
  console.log("Transferring governance to DefenderMonitor...");
  await riskScore.transferGovernance(monitor.address, { from: deployerAcc });
  await registry.transferGovernance(monitor.address, { from: deployerAcc });
  await rmn.transferGovernance(monitor.address, { from: deployerAcc });
  await guard.transferGovernance(monitor.address, { from: deployerAcc });
  await detection.transferGovernance(monitor.address, { from: deployerAcc });
  await bridge.transferGovernance(monitor.address, { from: deployerAcc });
  await monitor.transferGovernance(monitor.address, { from: deployerAcc });

  const deployedAddresses = {
    RiskScore: riskScore.address,
    WrappedToken: token.address,
    GuardianRegistry: registry.address,
    RiskManagement: rmn.address,
    DetectionNetwork: detection.address,
    InvariantGuard: guard.address,
    DefenderMonitor: monitor.address,
    PaymentBridge: bridge.address
  };

  const deployedFilePath = path.join(__dirname, "..", "deployed.json");
  fs.writeFileSync(deployedFilePath, JSON.stringify(deployedAddresses, null, 2));

  console.log("\n========================================================");
  console.log("   PAYGUARD DEPLOYED ADDRESSES TABLE");
  console.log("========================================================");
  console.table(
    Object.entries(deployedAddresses).map(([Contract, Address]) => ({
      Contract,
      Address
    }))
  );
  console.log("Addresses successfully written to deployed.json\n");

  // Export frontend artifacts
  try {
    const { exportArtifacts } = require("../scripts/export-frontend-artifacts.js");
    exportArtifacts();
  } catch (err) {
    console.warn("Could not export frontend artifacts:", err.message);
  }
};

