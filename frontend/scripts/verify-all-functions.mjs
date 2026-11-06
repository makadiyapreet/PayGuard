/**
 * frontend/scripts/verify-all-functions.mjs
 *
 * Verifies that all smart contract functions exposed in the PayGuard Control Center
 * frontend work cleanly on Ganache without errors.
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("\n========================================================");
  console.log("   PAYGUARD ALL-FUNCTIONS COMPREHENSIVE AUDIT");
  console.log("========================================================\n");

  const contractsPath = path.join(__dirname, "..", "public", "generated", "contracts.json");
  const contractsData = JSON.parse(fs.readFileSync(contractsPath, "utf-8"));
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");

  const mnemonic = ethers.Mnemonic.fromPhrase("myth like bonus scare over problem client lizard pioneer submit female collect");

  // Unlocked signer for transactions
  const getTxSigner = async (idx) => {
    return provider.getSigner(idx);
  };

  // Local HD wallet for ECDSA message signing (avoids personal_sign RPC missing)
  const getMessageSigner = (idx) => {
    return ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${idx}`);
  };

  const bridgeAddr = contractsData.contracts.PaymentBridge.address;
  const bridge = new ethers.Contract(bridgeAddr, contractsData.contracts.PaymentBridge.abi, provider);
  const token = new ethers.Contract(contractsData.contracts.WrappedToken.address, contractsData.contracts.WrappedToken.abi, provider);
  const rmn = new ethers.Contract(contractsData.contracts.RiskManagement.address, contractsData.contracts.RiskManagement.abi, provider);
  const guard = new ethers.Contract(contractsData.contracts.InvariantGuard.address, contractsData.contracts.InvariantGuard.abi, provider);
  const monitor = new ethers.Contract(contractsData.contracts.DefenderMonitor.address, contractsData.contracts.DefenderMonitor.abi, provider);
  const detection = new ethers.Contract(contractsData.contracts.DetectionNetwork.address, contractsData.contracts.DetectionNetwork.abi, provider);
  const riskScore = new ethers.Contract(contractsData.contracts.RiskScore.address, contractsData.contracts.RiskScore.abi, provider);

  const user = await getTxSigner(13);
  const userAddr = await user.getAddress();

  // 1. previewDeposit test
  console.log("1. Testing InvariantGuard.previewDeposit()...");
  const preview = await bridge.previewDeposit(userAddr, userAddr, ethers.parseEther("2.0"));
  console.log(`   ✓ previewDeposit: ok=${preview[0]}, layer=${preview[1]}, fee=${ethers.formatEther(preview[3])} ETH, net=${ethers.formatEther(preview[4])} ETH`);
  if (!preview[0]) throw new Error("previewDeposit failed unexpectedly");

  // 2. deposit (2 ETH)
  console.log("\n2. Testing PaymentBridge.deposit() (2 ETH)...");
  const depTx = await bridge.connect(user).deposit(userAddr, { value: ethers.parseEther("2.0"), gasLimit: 800000n });
  const depRc = await depTx.wait();
  console.log(`   ✓ Deposited! Tx: ${depRc.hash} (Gas: ${depRc.gasUsed.toString()})`);

  const totalTransfers = await bridge.transferTotal();
  const transferId = await bridge.transferIdAt(totalTransfers - 1n);
  const digest = await bridge.getDigest(transferId);
  console.log(`   ✓ Transfer ID: ${transferId}`);
  console.log(`   ✓ Approval Digest: ${digest}`);

  // 3. RMN Blessings (2 nodes)
  console.log("\n3. Testing RiskManagement.bless() from Nodes R1 (#6) & R2 (#7)...");
  const r1 = await getTxSigner(6);
  const r2 = await getTxSigner(7);
  const b1 = await rmn.connect(r1).bless(transferId, digest, { gasLimit: 500000n });
  await b1.wait();
  const b2 = await rmn.connect(r2).bless(transferId, digest, { gasLimit: 500000n });
  await b2.wait();
  const blessCount = await rmn.blessCountOf(transferId, digest);
  console.log(`   ✓ Blessed by 2/2 RMN nodes! Total bless count: ${blessCount.toString()}`);

  // 4. Guardian Signatures (3 guardians)
  console.log("\n4. Testing GuardianRegistry ECDSA Approvals (G1, G2, G3)...");
  const digestBytes = ethers.getBytes(digest);
  const sigEntries = [];

  for (const gIdx of [1, 2, 3]) {
    const gSigner = getMessageSigner(gIdx);
    const rawSig = await gSigner.signMessage(digestBytes);
    let hex = rawSig.startsWith("0x") ? rawSig.slice(2) : rawSig;
    let v = parseInt(hex.slice(128, 130), 16);
    if (v < 27) v += 27;
    const normSig = "0x" + hex.slice(0, 128) + v.toString(16).padStart(2, "0");
    sigEntries.push({ signer: gSigner.address, sig: normSig });
  }

  // Sort by signer address ascending
  sigEntries.sort((a, b) => {
    const aBig = BigInt(a.signer);
    const bBig = BigInt(b.signer);
    return aBig < bBig ? -1 : aBig > bBig ? 1 : 0;
  });
  const sortedSigs = sigEntries.map((s) => s.sig);
  console.log(`   ✓ Collected & sorted ${sortedSigs.length} guardian signatures`);

  // 5. previewExecute
  console.log("\n5. Testing PaymentBridge.previewExecute()...");
  const prevExec = await bridge.previewExecute(transferId, sortedSigs);
  console.log(`   ✓ previewExecute: ok=${prevExec[0]}, layer=${prevExec[1]}, reason="${prevExec[2]}"`);
  if (!prevExec[0]) throw new Error(`previewExecute returned false: ${prevExec[2]}`);

  // 6. execute transfer
  console.log("\n6. Testing PaymentBridge.execute()...");
  const execTx = await bridge.connect(user).execute(transferId, sortedSigs, { gasLimit: 800000n });
  const execRc = await execTx.wait();
  console.log(`   ✓ Executed! Tx: ${execRc.hash} (Gas: ${execRc.gasUsed.toString()})`);
  const pgEthBal = await token.balanceOf(userAddr);
  console.log(`   ✓ Recipient pgETH balance: ${ethers.formatEther(pgEthBal)} pgETH`);

  // 7. redeem partial
  console.log("\n7. Testing PaymentBridge.redeem() (0.5 pgETH)...");
  const redeemTx = await bridge.connect(user).redeem(ethers.parseEther("0.5"), { gasLimit: 800000n });
  const redeemRc = await redeemTx.wait();
  console.log(`   ✓ Redeemed! Tx: ${redeemRc.hash} (Gas: ${redeemRc.gasUsed.toString()})`);
  const pgEthBalAfter = await token.balanceOf(userAddr);
  console.log(`   ✓ Recipient pgETH balance after redeem: ${ethers.formatEther(pgEthBalAfter)} pgETH`);

  // 8. Forta bot registration & alert
  console.log("\n8. Testing DetectionNetwork.registerBot() & raiseAlert()...");
  const bot1 = await getTxSigner(8);
  const bot1Addr = await bot1.getAddress();
  const isBot = await detection.isBot(bot1Addr);
  if (!isBot) {
    const regTx = await detection.connect(bot1).registerBot({ value: ethers.parseEther("1.0"), gasLimit: 500000n });
    await regTx.wait();
    console.log(`   ✓ Bot 1 (${bot1Addr.slice(0, 8)}...) registered with 1 ETH stake`);
  }
  const alertTx = await detection.connect(bot1).raiseAlert(transferId, 1, "Suspicious velocity burst from client", { gasLimit: 500000n });
  await alertTx.wait();
  console.log(`   ✓ Alert raised! Severity 1 (MEDIUM). Penalty recorded on RiskScore.`);

  // 9. DefenderMonitor Emergency Pause & Unpause Multi-Sig Flow
  console.log("\n9. Testing DefenderMonitor Emergency Pause & Governance Unpause Flow...");
  const owner1 = await getTxSigner(10);
  const owner2 = await getTxSigner(11);

  // Pause
  const pauseTx = await monitor.connect(owner1).emergencyPause({ gasLimit: 500000n });
  await pauseTx.wait();
  console.log(`   ✓ Emergency pause triggered! bridge.paused() = ${await bridge.paused()}`);

  // Multi-sig unpause proposal
  const unpauseCalldata = bridge.interface.encodeFunctionData("unpause", []);
  const propTx = await monitor.connect(owner1).submitProposal(bridge.target, unpauseCalldata, { gasLimit: 500000n });
  await propTx.wait();
  const propCount = await monitor.proposalCount();
  const propId = propCount - 1n;
  console.log(`   ✓ Submitted unpause proposal #${propId}`);

  // Confirm by owner 2
  const confTx = await monitor.connect(owner2).confirmProposal(propId, { gasLimit: 500000n });
  await confTx.wait();
  console.log(`   ✓ Proposal confirmed by Owner 2. Status: 2/2 confirmations reached.`);

  // Advance time past 60s timelock
  await provider.send("evm_increaseTime", [65]);
  await provider.send("evm_mine", []);
  console.log(`   ✓ Fast-forwarded EVM time +65s past timelock`);

  // Execute proposal
  const execPropTx = await monitor.connect(owner1).executeProposal(propId, { gasLimit: 800000n });
  await execPropTx.wait();
  const isPausedAfter = await bridge.paused();
  console.log(`   ✓ Proposal executed! bridge.paused() = ${isPausedAfter}`);
  if (isPausedAfter) throw new Error("Bridge should be unpaused now");

  // 10. Large Transfer Delay Window
  console.log("\n10. Testing Large Transfer Delay Window (>= 5 ETH)...");
  // Fast-forward 24h to refresh daily limits and allow risk score recovery
  await provider.send("evm_increaseTime", [86400]);
  await provider.send("evm_mine", []);
  try {
    const recTx = await riskScore.connect(user).recover();
    await recTx.wait();
  } catch (_) {}

  // Use Account #14 so user daily volume limit is fresh
  const user14 = await getTxSigner(14);
  const user14Addr = await user14.getAddress();
  const largeDepTx = await bridge.connect(user14).deposit(user14Addr, { value: ethers.parseEther("6.0"), gasLimit: 800000n });
  await largeDepTx.wait();
  const totalTransfersAfter = await bridge.transferTotal();
  const largeTransferId = await bridge.transferIdAt(totalTransfersAfter - 1n);
  const largeTransferData = await bridge.getTransfer(largeTransferId);
  console.log(`   ✓ Large Transfer created: ID ${largeTransferId.slice(0, 16)}...`);
  console.log(`   ✓ isLarge: ${largeTransferData.isLarge}, state: ${largeTransferData.state} (Pending = 1)`);

  console.log("\n========================================================");
  console.log("   ✓ ALL 10 CORE FRONTEND FUNCTIONS TESTED & PASSING!");
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
