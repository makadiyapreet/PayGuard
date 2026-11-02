const RiskScore = artifacts.require("RiskScore");
const WrappedToken = artifacts.require("WrappedToken");
const GuardianRegistry = artifacts.require("GuardianRegistry");
const RiskManagement = artifacts.require("RiskManagement");
const DetectionNetwork = artifacts.require("DetectionNetwork");
const InvariantGuard = artifacts.require("InvariantGuard");
const DefenderMonitor = artifacts.require("DefenderMonitor");
const PaymentBridge = artifacts.require("PaymentBridge");

/**
 * Deploys and wires a fresh instance of the entire PayGuard bridge system.
 * @param {string[]} accounts Ganache accounts array.
 */
async function deployFresh(accounts) {
  const deployer = accounts[0];
  const guardians = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]];
  const riskNodes = [accounts[6], accounts[7]];
  const owners = [accounts[10], accounts[11], accounts[12]];

  // 1. Deploy contracts
  const riskScore = await RiskScore.new(100, 5, 3600, { from: deployer });
  const token = await WrappedToken.new("PayGuard Wrapped ETH", "pgETH", deployer, { from: deployer });
  const registry = await GuardianRegistry.new(guardians, 3, { from: deployer });
  const rmn = await RiskManagement.new(riskNodes, 2, riskScore.address, { from: deployer });
  const detection = await DetectionNetwork.new(
    riskScore.address,
    web3.utils.toWei("1", "ether"),
    1000,
    5000,
    86400,
    { from: deployer }
  );
  const guard = await InvariantGuard.new(
    riskScore.address,
    token.address,
    web3.utils.toWei("10", "ether"),
    web3.utils.toWei("20", "ether"),
    web3.utils.toWei("50", "ether"),
    86400,
    { from: deployer }
  );
  const monitor = await DefenderMonitor.new(owners, 2, 60, riskScore.address, { from: deployer });
  const bridge = await PaymentBridge.new(
    token.address,
    registry.address,
    guard.address,
    rmn.address,
    monitor.address,
    detection.address,
    10,                             // 10 bps fee
    web3.utils.toWei("5", "ether"), // 5 ETH large transfer threshold
    3600,                           // 1h delay
    86400,                          // 24h TTL
    { from: deployer }
  );

  // 2. Wiring
  const MINTER_ROLE = await token.MINTER_ROLE();
  await token.grantRole(MINTER_ROLE, bridge.address, { from: deployer });

  await registry.setBridge(bridge.address, { from: deployer });
  await guard.setBridge(bridge.address, { from: deployer });
  await detection.setBridge(bridge.address, { from: deployer });
  await monitor.setBridge(bridge.address, { from: deployer });

  await riskScore.setAuthorized(detection.address, true, { from: deployer });
  await riskScore.setAuthorized(monitor.address, true, { from: deployer });
  await riskScore.setAuthorized(rmn.address, true, { from: deployer });

  // Add default rules
  await monitor.addRule(0, web3.utils.toWei("8", "ether"), 0, 0, { from: deployer });
  await monitor.addRule(1, 5, 600, 1, { from: deployer });
  await monitor.addRule(2, web3.utils.toWei("1", "ether"), 300, 1, { from: deployer });
  await monitor.addRule(3, web3.utils.toWei("5", "ether"), 0, 0, { from: deployer });

  // Transfer governance to DefenderMonitor
  await riskScore.transferGovernance(monitor.address, { from: deployer });
  await registry.transferGovernance(monitor.address, { from: deployer });
  await rmn.transferGovernance(monitor.address, { from: deployer });
  await guard.transferGovernance(monitor.address, { from: deployer });
  await detection.transferGovernance(monitor.address, { from: deployer });
  await bridge.transferGovernance(monitor.address, { from: deployer });
  await monitor.transferGovernance(monitor.address, { from: deployer });

  return {
    deployer,
    guardians,
    riskNodes,
    owners,
    riskScore,
    token,
    registry,
    rmn,
    detection,
    guard,
    monitor,
    bridge
  };
}

module.exports = {
  deployFresh
};

