const fs = require("fs");
const path = require("path");
const { signApproval } = require("../test/helpers/sign");

const PaymentBridge = artifacts.require("PaymentBridge");

module.exports = async function (callback) {
  try {
    global.web3 = web3;
    global.artifacts = artifacts;
    const accounts = await web3.eth.getAccounts();
    const guardians = [accounts[1], accounts[2], accounts[3]];

    const deployedPath = path.join(__dirname, "..", "deployed.json");
    let bridgeAddress;
    if (fs.existsSync(deployedPath)) {
      const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
      bridgeAddress = deployed.PaymentBridge;
    }
    const bridge = bridgeAddress ? await PaymentBridge.at(bridgeAddress) : await PaymentBridge.deployed();

    // Check args or query latest event
    let targetId = process.env.TRANSFER_ID;
    if (!targetId) {
      // Find latest Deposited event
      const events = await bridge.getPastEvents("Deposited", { fromBlock: 0, toBlock: "latest" });
      if (events.length > 0) {
        targetId = events[events.length - 1].args.id;
      }
    }

    if (!targetId) {
      console.log("No transfers found. Provide TRANSFER_ID env var or execute a deposit first.");
      callback();
      return;
    }

    console.log(`\nCollecting 3 Guardian Signatures for Transfer ID: ${targetId}`);
    const sigs = await signApproval(web3, bridge, targetId, guardians);

    console.log("Guardian Signatures (Ascending Signer Order):");
    sigs.forEach((sig, idx) => {
      console.log(`  [G${idx + 1}] (${guardians[idx]}): ${sig}`);
    });

    callback();
  } catch (err) {
    callback(err);
  }
};
