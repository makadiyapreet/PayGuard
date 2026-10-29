const { deployFresh } = require("./helpers/deploy");
const { signApproval } = require("./helpers/sign");
const { expectRevert } = require("./helpers/revert");
const { assert } = require("chai");

contract("PaymentBridge Happy Path (01_bridge_happy_path.test.js)", (accounts) => {
  let ctx;
  const user = accounts[13];
  const recipient = accounts[13];

  beforeEach(async () => {
    ctx = await deployFresh(accounts);
  });

  it("1. deploys with the correct parameters (constructor values readable)", async () => {
    const { bridge, token, registry, guard, rmn, monitor, detection } = ctx;

    assert.equal(await bridge.token(), token.address);
    assert.equal(await bridge.registry(), registry.address);
    assert.equal(await bridge.guard(), guard.address);
    assert.equal(await bridge.rmn(), rmn.address);
    assert.equal(await bridge.monitor(), monitor.address);
    assert.equal(await bridge.detection(), detection.address);

    assert.equal((await bridge.feeBps()).toString(), "10");
    assert.equal((await bridge.largeThreshold()).toString(), web3.utils.toWei("5", "ether"));
    assert.equal((await bridge.largeDelay()).toString(), "3600");
    assert.equal((await bridge.ttl()).toString(), "86400");
  });

  it("2. deposit stores a Pending transfer, charges fee, and funds reward pool", async () => {
    const { bridge, detection } = ctx;
    const depositAmount = web3.utils.toWei("2", "ether");

    const poolBefore = web3.utils.toBN(await detection.rewardPool());

    const tx = await bridge.deposit(recipient, { from: user, value: depositAmount });

    // Find Deposited event
    const depEvent = tx.logs.find((l) => l.event === "Deposited");
    assert.exists(depEvent, "Deposited event must be emitted");
    const { id, netAmount, fee, isLarge } = depEvent.args;

    // 0.10% fee on 2 ETH = 0.002 ETH; net = 1.998 ETH
    const expectedFee = web3.utils.toBN(depositAmount).mul(web3.utils.toBN("10")).div(web3.utils.toBN("10000"));
    const expectedNet = web3.utils.toBN(depositAmount).sub(expectedFee);

    assert.equal(fee.toString(), expectedFee.toString(), "Fee calculation check");
    assert.equal(netAmount.toString(), expectedNet.toString(), "Net amount calculation check");
    assert.isFalse(isLarge, "2 ETH is not a large transfer (< 5 ETH)");

    // Reward pool should have grown by exactly the fee
    const poolAfter = web3.utils.toBN(await detection.rewardPool());
    assert.equal(poolAfter.sub(poolBefore).toString(), fee.toString(), "Reward pool funded with fee");

    // Transfer state should be Pending (1)
    const t = await bridge.getTransfer(id);
    assert.equal(t.state.toString(), "1", "State must be Pending (1)");
    assert.equal(t.sender, user);
    assert.equal(t.recipient, recipient);
  });

  it("3. execute with 3 valid guardian signatures + 2 RMN blessings mints pgETH", async () => {
    const { bridge, token, guardians, riskNodes } = ctx;
    const depositAmount = web3.utils.toWei("2", "ether");

    const tx = await bridge.deposit(recipient, { from: user, value: depositAmount });
    const id = tx.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);

    // Bless with 2 RMN nodes
    await ctx.rmn.bless(id, digest, { from: riskNodes[0] });
    await ctx.rmn.bless(id, digest, { from: riskNodes[1] });

    // Collect 3 guardian signatures (G1, G2, G3)
    const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1], guardians[2]]);

    // Execute transfer
    const balBefore = await token.balanceOf(recipient);
    await bridge.execute(id, sigs, { from: user });
    const balAfter = await token.balanceOf(recipient);

    const t = await bridge.getTransfer(id);
    assert.equal(t.state.toString(), "3", "Transfer state must be Executed (3)");
    assert.equal(balAfter.sub(balBefore).toString(), t.netAmount.toString(), "Recipient received pgETH");
  });

  it("4. redeem burns pgETH and returns ETH", async () => {
    const { bridge, token, guardians, riskNodes } = ctx;
    const depositAmount = web3.utils.toWei("2", "ether");

    const tx = await bridge.deposit(recipient, { from: user, value: depositAmount });
    const id = tx.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);

    await ctx.rmn.bless(id, digest, { from: riskNodes[0] });
    await ctx.rmn.bless(id, digest, { from: riskNodes[1] });
    const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1], guardians[2]]);
    await bridge.execute(id, sigs, { from: user });

    const pgEthBal = await token.balanceOf(recipient);
    const redeemAmount = web3.utils.toWei("1", "ether");

    const ethBalBefore = web3.utils.toBN(await web3.eth.getBalance(recipient));
    const redeemTx = await bridge.redeem(redeemAmount, { from: recipient });
    const gasUsed = web3.utils.toBN(redeemTx.receipt.gasUsed);
    const txDetails = await web3.eth.getTransaction(redeemTx.tx);
    const gasCost = gasUsed.mul(web3.utils.toBN(txDetails.gasPrice));
    const ethBalAfter = web3.utils.toBN(await web3.eth.getBalance(recipient));

    const netEthReceived = ethBalAfter.sub(ethBalBefore).add(gasCost);
    assert.equal(netEthReceived.toString(), redeemAmount.toString(), "Redeemed exactly 1 ETH");

    const pgEthBalAfter = await token.balanceOf(recipient);
    assert.equal(pgEthBal.sub(pgEthBalAfter).toString(), redeemAmount.toString(), "1 pgETH was burned");
  });

  it("5. invariant balance >= totalSupply holds after each step", async () => {
    const { bridge, guard, guardians, riskNodes } = ctx;

    // Step 0: Initial
    assert.isTrue(await guard.checkInvariant(), "Invariant holds initially");

    // Step 1: After deposit
    const tx = await bridge.deposit(recipient, { from: user, value: web3.utils.toWei("3", "ether") });
    assert.isTrue(await guard.checkInvariant(), "Invariant holds after deposit");

    // Step 2: After execute
    const id = tx.logs.find((l) => l.event === "Deposited").args.id;
    const digest = await bridge.getDigest(id);
    await ctx.rmn.bless(id, digest, { from: riskNodes[0] });
    await ctx.rmn.bless(id, digest, { from: riskNodes[1] });
    const sigs = await signApproval(web3, bridge, id, [guardians[0], guardians[1], guardians[2]]);
    await bridge.execute(id, sigs, { from: user });
    assert.isTrue(await guard.checkInvariant(), "Invariant holds after execute");

    // Step 3: After redeem
    await bridge.redeem(web3.utils.toWei("1", "ether"), { from: recipient });
    assert.isTrue(await guard.checkInvariant(), "Invariant holds after redeem");
  });

  it("6. receive() reverts on plain ETH transfers", async () => {
    const { bridge } = ctx;
    await expectRevert(
      bridge.sendTransaction({
        from: user,
        value: web3.utils.toWei("1", "ether")
      }),
      "PG:NO_DIRECT_ETH"
    );
  });
});
