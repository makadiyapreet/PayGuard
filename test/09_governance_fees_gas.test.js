const fs = require("fs");
const path = require("path");
const { deployFresh } = require("./helpers/deploy");
const { signApproval, signDigest } = require("./helpers/sign");
const { expectRevert } = require("./helpers/revert");
const { increaseTime } = require("./helpers/time");
const { govExec } = require("./helpers/gov");
const { assert } = require("chai");

contract("Governance, Fees, Gas & Accounting (09_governance_fees_gas.test.js)", (accounts) => {
  let ctx;
  const deployer = accounts[0];
  const user = accounts[13];
  const attacker = accounts[14];
  const bot = accounts[8];

  beforeEach(async () => {
    ctx = await deployFresh(accounts);
  });

  it("53. after migration deployer has no governance rights on any contract", async () => {
    const { riskScore, registry, rmn, guard, detection, bridge, monitor } = ctx;

    // Every onlyGovernance call from deployer (account 0) must revert with PG:NOT_GOV
    await expectRevert(riskScore.setAuthorized(deployer, true, { from: deployer }), "PG:NOT_GOV");
    await expectRevert(registry.addGuardian(accounts[9], { from: deployer }), "PG:NOT_GOV");
    await expectRevert(rmn.uncurse({ from: deployer }), "PG:NOT_GOV");
    await expectRevert(guard.setLimits(1, 1, 1, 1, { from: deployer }), "PG:NOT_GOV");
    await expectRevert(detection.resolveAlert(0, true, { from: deployer }), "PG:NOT_GOV");
    await expectRevert(bridge.unpause({ from: deployer }), "PG:NOT_GOV");
    await expectRevert(monitor.blacklist(user, { from: deployer }), "PG:NOT_GOV");
  });

  it("54. setBridge can be called only once per contract", async () => {
    const { registry, guard, detection, monitor } = ctx;

    // Bridge is already set during deployment, calling again must revert PG:BRIDGE_SET
    // Note: calls must be from governance (DefenderMonitor) to reach the check, or if from others revert PG:NOT_GOV
    const dummyBridge = accounts[9];
    const callData = registry.contract.methods.setBridge(dummyBridge).encodeABI();

    // Calling via governance proposal must fail with PG:CALL_FAILED because inner call reverts with PG:BRIDGE_SET
    const propTx = await ctx.monitor.submitProposal(registry.address, callData, { from: ctx.owners[0] });
    const propId = Number(await ctx.monitor.proposalCount()) - 1;
    await ctx.monitor.confirmProposal(propId, { from: ctx.owners[1] });
    await increaseTime(65);

    await expectRevert(
      ctx.monitor.executeProposal(propId, { from: ctx.owners[0] }),
      "PG:CALL_FAILED"
    );
  });

  it("55. fee accounting: fee = 0.10% of deposit, rewardPool increases by fee, user receives net in pgETH", async () => {
    const { bridge, token, detection, guardians, riskNodes } = ctx;
    const depositAmount = web3.utils.toWei("4", "ether");

    const poolBefore = web3.utils.toBN(await detection.rewardPool());
    const tx = await bridge.deposit(user, { from: user, value: depositAmount });
    const depLog = tx.logs.find((l) => l.event === "Deposited").args;
    const { id, netAmount, fee } = depLog;

    // Fee = 4 ether * 10 / 10000 = 0.004 ether; Net = 3.996 ether
    assert.equal(fee.toString(), web3.utils.toWei("0.004", "ether"));
    assert.equal(netAmount.toString(), web3.utils.toWei("3.996", "ether"));

    const poolAfter = web3.utils.toBN(await detection.rewardPool());
    assert.equal(poolAfter.sub(poolBefore).toString(), web3.utils.toWei("0.004", "ether"));

    // Execute
    const digest = await bridge.getDigest(id);
    await ctx.rmn.bless(id, digest, { from: riskNodes[0] });
    await ctx.rmn.bless(id, digest, { from: riskNodes[1] });
    const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1], guardians[2]]);
    await bridge.execute(id, sigs, { from: user });

    const pgEthBal = await token.balanceOf(user);
    assert.equal(pgEthBal.toString(), web3.utils.toWei("3.996", "ether"));
  });

  it("56. challenge is rejected for a random account and accepted for a guardian, a bot and governance", async () => {
    const { bridge, guardians, owners } = ctx;

    // Register bot
    await ctx.detection.registerBot({ from: bot, value: web3.utils.toWei("1", "ether") });

    // Create 3 transfers
    const tx1 = await bridge.deposit(user, { from: user, value: web3.utils.toWei("1", "ether") });
    const id1 = tx1.logs.find((l) => l.event === "Deposited").args.id;

    const tx2 = await bridge.deposit(user, { from: user, value: web3.utils.toWei("1", "ether") });
    const id2 = tx2.logs.find((l) => l.event === "Deposited").args.id;

    const tx3 = await bridge.deposit(user, { from: user, value: web3.utils.toWei("1", "ether") });
    const id3 = tx3.logs.find((l) => l.event === "Deposited").args.id;

    // Random user cannot challenge
    await expectRevert(bridge.challenge(id1, "RANDOM_REASON", { from: attacker }), "PG:NOT_CHALLENGER");

    // Guardian can challenge
    await bridge.challenge(id1, "GUARDIAN_CHALLENGE", { from: guardians[0] });
    assert.equal((await bridge.getTransfer(id1)).state.toString(), "4"); // Challenged

    // Bot can challenge
    await bridge.challenge(id2, "BOT_CHALLENGE", { from: bot });
    assert.equal((await bridge.getTransfer(id2)).state.toString(), "4"); // Challenged

    // Governance can challenge via proposal
    const chalData = bridge.contract.methods.challenge(id3, "GOV_CHALLENGE").encodeABI();
    await govExec(ctx.monitor, [owners[0], owners[1]], bridge.address, chalData);
    assert.equal((await bridge.getTransfer(id3)).state.toString(), "4"); // Challenged
  });

  it("57. refund on an expired Pending transfer works; the fee is not refunded", async () => {
    const { bridge } = ctx;
    const depositAmount = web3.utils.toWei("2", "ether");

    const tx = await bridge.deposit(user, { from: user, value: depositAmount });
    const depLog = tx.logs.find((l) => l.event === "Deposited").args;
    const { id, netAmount, fee } = depLog;

    // Advance time past TTL (86400s)
    await increaseTime(86405);

    const ethBalBefore = web3.utils.toBN(await web3.eth.getBalance(user));
    const refTx = await bridge.refund(id, { from: user });
    const gasUsed = web3.utils.toBN(refTx.receipt.gasUsed);
    const txDetails = await web3.eth.getTransaction(refTx.tx);
    const gasCost = gasUsed.mul(web3.utils.toBN(txDetails.gasPrice));
    const ethBalAfter = web3.utils.toBN(await web3.eth.getBalance(user));

    const netReceived = ethBalAfter.sub(ethBalBefore).add(gasCost);
    assert.equal(netReceived.toString(), netAmount.toString(), "Refunded net amount");
    assert.notEqual(netReceived.toString(), depositAmount.toString(), "Fee was not refunded");

    const t = await bridge.getTransfer(id);
    assert.equal(t.state.toString(), "5", "State must be Refunded");
  });

  it("58. signature malleability: a signature with a flipped s value is rejected", async () => {
    const { bridge, guardians, riskNodes } = ctx;
    const tx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("1", "ether") });
    const id = tx.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);

    await ctx.rmn.bless(id, digest, { from: riskNodes[0] });
    await ctx.rmn.bless(id, digest, { from: riskNodes[1] });

    // Collect valid signatures
    const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1], guardians[2]]);

    // Flip s value on the first signature
    // In secp256k1: N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    const N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
    const rawSig = sigs[0];
    const r = rawSig.slice(2, 66);
    const sHex = rawSig.slice(66, 130);
    const v = parseInt(rawSig.slice(130, 132), 16);

    const s = BigInt("0x" + sHex);
    const flippedS = N - s;
    const flippedSHex = flippedS.toString(16).padStart(64, "0");
    const flippedV = (v === 27 ? 28 : 27).toString(16).padStart(2, "0");

    const malleableSig = "0x" + r + flippedSHex + flippedV;
    const malleableSigs = [malleableSig, sigs[1], sigs[2]];

    await expectRevert(
      bridge.execute(id, malleableSigs, { from: attacker }),
      "PG:BAD_SIGS"
    );
  });

  it("59. gas table: measure and print gas used by core functions", async () => {
    const { bridge, token, guardians, riskNodes, owners, detection, monitor } = ctx;

    // Register bot
    await detection.registerBot({ from: bot, value: web3.utils.toWei("1", "ether") });

    const gasResults = {};

    // 1. deposit
    const depTx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("2", "ether") });
    gasResults["deposit (2 ETH)"] = depTx.receipt.gasUsed;
    const idNormal = depTx.logs.find((l) => l.event === "Deposited").args.id;
    const digNormal = await bridge.getDigest(idNormal);

    // 2. execute (normal)
    await ctx.rmn.bless(idNormal, digNormal, { from: riskNodes[0] });
    await ctx.rmn.bless(idNormal, digNormal, { from: riskNodes[1] });
    const sigsNormal = await signApproval(web3, bridge, idNormal, [guardians[0], guardians[1], guardians[2]]);
    const execNormalTx = await bridge.execute(idNormal, sigsNormal, { from: user });
    gasResults["execute (normal)"] = execNormalTx.receipt.gasUsed;

    // 3. execute (large)
    const depLargeTx = await bridge.deposit(user, { from: user, value: web3.utils.toWei("6", "ether") });
    const idLarge = depLargeTx.logs.find((l) => l.event === "Deposited").args.id;
    const digLarge = await bridge.getDigest(idLarge);
    await ctx.rmn.bless(idLarge, digLarge, { from: riskNodes[0] });
    await ctx.rmn.bless(idLarge, digLarge, { from: riskNodes[1] });
    const sigsLarge = await signApproval(web3, bridge, idLarge, [guardians[0], guardians[1], guardians[2]]);
    const execLargeTx = await bridge.execute(idLarge, sigsLarge, { from: user });
    gasResults["execute (large -> Verified)"] = execLargeTx.receipt.gasUsed;

    // 4. finalizeLarge
    await increaseTime(3605);
    const finalizeTx = await bridge.finalizeLarge(idLarge, { from: user });
    gasResults["finalizeLarge"] = finalizeTx.receipt.gasUsed;

    // 5. redeem
    const redeemTx = await bridge.redeem(web3.utils.toWei("1", "ether"), { from: user });
    gasResults["redeem (1 pgETH)"] = redeemTx.receipt.gasUsed;

    // 6. raiseAlert
    const dummyId = web3.utils.sha3("DUMMY_SUSPICIOUS");
    const alertTx = await detection.raiseAlert(dummyId, 2, "GAS_MEASUREMENT_ALERT", { from: bot });
    gasResults["raiseAlert"] = alertTx.receipt.gasUsed;

    // 7. resolveAlert (via proposal)
    const resolveData = detection.contract.methods.resolveAlert(0, true).encodeABI();
    const propTx = await monitor.submitProposal(detection.address, resolveData, { from: owners[0] });
    gasResults["submitProposal"] = propTx.receipt.gasUsed;

    const propId = Number(await monitor.proposalCount()) - 1;
    await monitor.confirmProposal(propId, { from: owners[1] });
    await increaseTime(65);

    const execPropTx = await monitor.executeProposal(propId, { from: owners[0] });
    gasResults["executeProposal (resolving alert)"] = execPropTx.receipt.gasUsed;

    // Print gas table
    console.log("\n========================================================");
    console.log("             PAYGUARD GAS BENCHMARK TABLE               ");
    console.log("========================================================");
    console.table(
      Object.entries(gasResults).map(([Operation, GasUsed]) => ({
        Operation,
        "Gas Used": GasUsed.toLocaleString(),
        "Est. Cost @ 2.5 Gwei (ETH)": (GasUsed * 2.5e-9).toFixed(6)
      }))
    );

    // Save to docs/GAS_TABLE.md
    const gasMdContent = `# PayGuard Gas Consumption Benchmarks

| Operation | Gas Used | Estimated Cost @ 2.5 Gwei (ETH) |
|---|---|---|
${Object.entries(gasResults)
  .map(
    ([op, gas]) =>
      `| \`${op}\` | ${gas.toLocaleString()} | ${(gas * 2.5e-9).toFixed(6)} ETH |`
  )
  .join("\n")}

*Measurements conducted on Ganache local testnet (EVM: Paris, Optimizer: enabled with 200 runs).*
`;

    const docsDir = path.join(__dirname, "..", "docs");
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, "GAS_TABLE.md"), gasMdContent);
    console.log("Gas table saved to docs/GAS_TABLE.md\n");
  });

  it("60. accounting reconciles after mixed run of deposits, executions, refunds, redeems", async () => {
    const { bridge, token, guardians, riskNodes } = ctx;
    const testUser = accounts[9];

    // 1. User deposits 3 ETH (net = 2.997 ETH, fee = 0.003 ETH)
    const tx1 = await bridge.deposit(testUser, { from: testUser, value: web3.utils.toWei("3", "ether") });
    const id1 = tx1.logs.find((l) => l.event === "Deposited").args.id;
    const dig1 = await bridge.getDigest(id1);

    // 2. User deposits 2 ETH (net = 1.998 ETH, fee = 0.002 ETH)
    const tx2 = await bridge.deposit(testUser, { from: testUser, value: web3.utils.toWei("2", "ether") });
    const id2 = tx2.logs.find((l) => l.event === "Deposited").args.id;

    // 3. User deposits 1 ETH (net = 0.999 ETH, fee = 0.001 ETH)
    const tx3 = await bridge.deposit(testUser, { from: testUser, value: web3.utils.toWei("1", "ether") });
    const id3 = tx3.logs.find((l) => l.event === "Deposited").args.id;
    const dig3 = await bridge.getDigest(id3);

    // Execute transfer 1
    await ctx.rmn.bless(id1, dig1, { from: riskNodes[0] });
    await ctx.rmn.bless(id1, dig1, { from: riskNodes[1] });
    const sigs1 = await signApproval(web3, bridge, id1, [guardians[0], guardians[1], guardians[2]]);
    await bridge.execute(id1, sigs1, { from: testUser });

    // Redeem 1 pgETH from executed transfer 1
    await bridge.redeem(web3.utils.toWei("1", "ether"), { from: testUser });

    // Challenge and refund transfer 2
    await bridge.challenge(id2, "USER_CANCEL_REQUEST", { from: guardians[0] });
    await bridge.refund(id2, { from: testUser });

    // Transfer 3 remains Pending

    // Total net deposited: 2.997 + 1.998 + 0.999 = 5.994 ETH
    // Total refunded net: 1.998 ETH
    // Total redeemed: 1.0 ETH
    // Expected bridge ETH balance = 5.994 - 1.998 - 1.0 = 2.996 ETH
    const stats = await bridge.getStats();
    const expectedBalance = web3.utils.toWei("2.996", "ether");

    assert.equal(
      stats.balance.toString(),
      expectedBalance,
      "Bridge ETH balance matches exact accounting formula"
    );
  });

  it("61. Fuzz-style check: loops 20 seeded deposit amounts asserting invariant after each", async () => {
    const { bridge, guard, token, guardians, riskNodes } = ctx;

    // 20 seeded amounts between 0.1 and 4.0 ETH (within 10 ETH perTx limit)
    const seededAmounts = [
      "0.15", "0.32", "0.45", "0.80", "1.10", "1.25", "1.50", "1.75",
      "0.20", "0.60", "2.10", "0.95", "1.30", "0.55", "0.40", "1.80",
      "0.70", "1.05", "0.85", "0.50"
    ];

    for (let i = 0; i < seededAmounts.length; i++) {
      const amt = web3.utils.toWei(seededAmounts[i], "ether");
      const u = accounts[1 + (i % 12)]; // rotate users to test invariant across multiple senders
      await bridge.deposit(u, { from: u, value: amt });

      const holds = await guard.checkInvariant();
      assert.isTrue(holds, `Invariant must hold after seeded deposit #${i + 1} of ${seededAmounts[i]} ETH`);
    }
  });
});
