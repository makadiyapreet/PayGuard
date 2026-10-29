const fs = require("fs");
const path = require("path");

const PaymentBridge = artifacts.require("PaymentBridge");
const RiskManagement = artifacts.require("RiskManagement");

module.exports = async function (callback) {
  try {
    global.web3 = web3;
    global.artifacts = artifacts;
    const accounts = await web3.eth.getAccounts();
    const r1 = accounts[6];
    const r2 = accounts[7];

    const deployedPath = path.join(__dirname, "..", "deployed.json");
    let deployed = {};
    if (fs.existsSync(deployedPath)) {
      deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
    }

    const bridge = deployed.PaymentBridge ? await PaymentBridge.at(deployed.PaymentBridge) : await PaymentBridge.deployed();
    const rmn = deployed.RiskManagement ? await RiskManagement.at(deployed.RiskManagement) : await RiskManagement.deployed();

    console.log("\n========================================================");
    console.log("   CHAINLINK CCIP RMN OFF-CHAIN MONITORING NODE");
    console.log("========================================================\n");

    const events = await bridge.getPastEvents("Deposited", { fromBlock: 0, toBlock: "latest" });
    console.log(`Found ${events.length} deposit event(s) to verify.`);

    const chainId = await web3.eth.getChainId();

    for (const evt of events) {
      const { id, sender, recipient, netAmount, nonce, expiresAt, digest } = evt.args;

      // Check if already blessed
      const alreadyBlessed = await rmn.isBlessed(id, digest);
      if (alreadyBlessed) {
        console.log(`[RMN] Transfer ${id.slice(0, 10)}... already blessed.`);
        continue;
      }

      console.log(`[RMN] Verifying Transfer: ${id}`);
      console.log(`      Sender: ${sender} | Recipient: ${recipient} | Net: ${web3.utils.fromWei(netAmount, "ether")} ETH`);

      // Independent digest recomputation
      const encoded = web3.eth.abi.encodeParameters(
        ["bytes32", "uint256", "address", "bytes32", "address", "address", "uint256", "uint256", "uint256"],
        [
          web3.utils.sha3("PAYGUARD_APPROVAL_V1"),
          chainId,
          bridge.address,
          id,
          sender,
          recipient,
          netAmount.toString(),
          nonce.toString(),
          expiresAt.toString()
        ]
      );
      const independentDigest = web3.utils.sha3(encoded);
      const onChainDigest = await bridge.getDigest(id);

      if (independentDigest.toLowerCase() !== digest.toLowerCase()) {
        console.log(`\x1b[31m[RMN REJECT]\x1b[0m Independent digest mismatch for transfer ${id}! Blessing refused.`);
        continue;
      }

      if (onChainDigest.toLowerCase() !== digest.toLowerCase()) {
        console.log(`\x1b[31m[RMN REJECT]\x1b[0m On-chain digest mismatch for transfer ${id}! Blessing refused.`);
        continue;
      }

      console.log(`\x1b[32m[RMN VERIFIED]\x1b[0m Digest matched (${independentDigest}). Nodes casting blessings...`);

      // Node R1 blesses
      await rmn.bless(id, digest, { from: r1 });
      console.log(`  - Node R1 (${r1.slice(0, 8)}...) blessed transfer.`);

      // Node R2 blesses
      await rmn.bless(id, digest, { from: r2 });
      console.log(`  - Node R2 (${r2.slice(0, 8)}...) blessed transfer.`);

      console.log(`[RMN SUCCESS] Transfer ${id.slice(0, 10)}... reached 2/2 quorum blessing.\n`);
    }

    callback();
  } catch (err) {
    callback(err);
  }
};
