/**
 * scripts/export-frontend-artifacts.js
 *
 * Reads build/contracts/*.json and deployed.json to generate:
 *   frontend/public/generated/contracts.json
 *
 * This provides the frontend with typed ABIs, deployed addresses, deployment blocks,
 * constructor args, layer mappings, and standalone artifacts (for the Attack Lab).
 */

const fs = require("fs");
const path = require("path");

function exportArtifacts() {
  const rootDir = path.resolve(__dirname, "..");
  const buildDir = path.join(rootDir, "build", "contracts");
  const deployedPath = path.join(rootDir, "deployed.json");
  const targetDir = path.join(rootDir, "frontend", "public", "generated");
  const targetFile = path.join(targetDir, "contracts.json");

  let deployed = {};
  if (fs.existsSync(deployedPath)) {
    try {
      deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
    } catch (e) {
      console.warn("Could not parse deployed.json:", e.message);
    }
  }

  const contractMeta = {
    RiskScore: { layer: "L3", solution: "CertiK Skynet" },
    WrappedToken: { layer: "CORE", solution: "—" },
    GuardianRegistry: { layer: "L2", solution: "Wormhole Guardian Network" },
    RiskManagement: { layer: "L2", solution: "Chainlink CCIP RMN" },
    DetectionNetwork: { layer: "L3", solution: "Forta Network" },
    InvariantGuard: { layer: "L1", solution: "Certora Prover" },
    DefenderMonitor: { layer: "L3", solution: "OpenZeppelin Defender" },
    PaymentBridge: { layer: "CORE", solution: "—" },
  };

  const output = {
    chainId: 1337,
    networkId: 5777,
    rpcUrl: "http://127.0.0.1:7545",
    deployedAt: new Date().toISOString(),
    deployer: "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    contracts: {},
    artifacts: {},
  };

  for (const [name, meta] of Object.entries(contractMeta)) {
    const artifactPath = path.join(buildDir, `${name}.json`);
    if (fs.existsSync(artifactPath)) {
      const art = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const netInfo = (art.networks && (art.networks["5777"] || Object.values(art.networks)[0])) || {};
      const address = deployed[name] || netInfo.address || "0x0000000000000000000000000000000000000000";

      output.contracts[name] = {
        address: address,
        abi: art.abi,
        deployBlock: netInfo.transactionHash ? 1 : 0, // Fallback if block not in truffle artifact
        constructorArgs: [],
        layer: meta.layer,
        solution: meta.solution,
      };
    }
  }

  // Include auxiliary artifacts for Attack Lab
  const auxArtifacts = ["ReentrancyAttacker", "BaselineBridge", "ForceSend"];
  for (const aux of auxArtifacts) {
    const auxPath = path.join(buildDir, `${aux}.json`);
    if (fs.existsSync(auxPath)) {
      const art = JSON.parse(fs.readFileSync(auxPath, "utf8"));
      output.artifacts[aux] = {
        abi: art.abi,
        bytecode: art.bytecode,
      };
    }
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(output, null, 2));
  console.log(`[export] Wrote ${targetFile} successfully.`);
  return output;
}

if (require.main === module) {
  exportArtifacts();
}

module.exports = { exportArtifacts };

