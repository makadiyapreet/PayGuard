const GuardianRegistry = artifacts.require("GuardianRegistry");
const { expectRevert } = require("./helpers/revert");
const { signDigest } = require("./helpers/sign");
const { assert } = require("chai");

contract("GuardianRegistry (02_guardians.test.js)", (accounts) => {
  const [deployer, g1, g2, g3, g4, g5, nonGuardian, mockBridge] = accounts;
  const guardians = [g1, g2, g3, g4, g5];
  let registry;
  const sampleDigest = web3.utils.sha3("TRANSFER_PAYLOAD_TEST");

  beforeEach(async () => {
    registry = await GuardianRegistry.new(guardians, 3, { from: deployer });
    await registry.setBridge(mockBridge, { from: deployer });
  });

  it("7. fewer than 3 signatures returns false", async () => {
    // Only 2 signatures (below threshold 3)
    const sigs = await signDigest(web3, sampleDigest, [g1, g2]);
    const isValid = await registry.verifyApproval(sampleDigest, sigs);
    assert.isFalse(isValid, "Approval with fewer than 3 signatures must be invalid");
  });

  it("8. signature from a non-guardian returns false", async () => {
    // 3 signatures including one non-guardian
    const sigs = await signDigest(web3, sampleDigest, [g1, g2, nonGuardian]);
    const isValid = await registry.verifyApproval(sampleDigest, sigs);
    assert.isFalse(isValid, "Approval including non-guardian must be invalid");
  });

  it("9. duplicate signer / unsorted signatures returns false", async () => {
    // Valid 3 signers
    const validSigs = await signDigest(web3, sampleDigest, [g1, g2, g3]);
    const validResult = await registry.verifyApproval(sampleDigest, validSigs);
    assert.isTrue(validResult, "Valid 3-of-5 signatures should return true");

    // Duplicate signer: duplicate g1 instead of g3
    const duplicateSigs = await signDigest(web3, sampleDigest, [g1, g1, g2]);
    const dupResult = await registry.verifyApproval(sampleDigest, duplicateSigs);
    assert.isFalse(dupResult, "Duplicate signers must return false");

    // Reversed / unsorted signatures
    const reversedSigs = [...validSigs].reverse();
    const reverseResult = await registry.verifyApproval(sampleDigest, reversedSigs);
    assert.isFalse(reverseResult, "Unsorted signatures must return false");
  });

  it("10. replay of an executed approval is rejected", async () => {
    // Mark used from mockBridge
    await registry.markUsed(sampleDigest, { from: mockBridge });
    const isUsed = await registry.used(sampleDigest);
    assert.isTrue(isUsed, "Digest should be marked as used");

    // Replaying markUsed must revert with PG:REPLAY
    await expectRevert(
      registry.markUsed(sampleDigest, { from: mockBridge }),
      "PG:REPLAY"
    );

    // Caller other than bridge cannot mark used
    await expectRevert(
      registry.markUsed(web3.utils.sha3("ANOTHER"), { from: deployer }),
      "PG:NOT_BRIDGE"
    );
  });

  it("11. add / remove guardian and threshold change work only through governance", async () => {
    // Non-governance caller cannot add guardian
    await expectRevert(
      registry.addGuardian(nonGuardian, { from: nonGuardian }),
      "PG:NOT_GOV"
    );

    // Governance can add guardian
    await registry.addGuardian(nonGuardian, { from: deployer });
    assert.isTrue(await registry.isGuardian(nonGuardian));
    assert.equal((await registry.guardianCount()).toString(), "6");

    // Non-governance caller cannot change threshold
    await expectRevert(
      registry.setThreshold(4, { from: nonGuardian }),
      "PG:NOT_GOV"
    );

    // Governance changes threshold
    await registry.setThreshold(4, { from: deployer });
    assert.equal((await registry.getThreshold()).toString(), "4");

    // Governance removes guardian
    await registry.removeGuardian(nonGuardian, { from: deployer });
    assert.isFalse(await registry.isGuardian(nonGuardian));
    assert.equal((await registry.guardianCount()).toString(), "5");
  });

  it("12. removeGuardian cannot drop below the threshold", async () => {
    // Threshold is 3, currently 5 guardians
    // Remove 2 guardians -> 3 left (equal to threshold)
    await registry.removeGuardian(g5, { from: deployer });
    await registry.removeGuardian(g4, { from: deployer });
    assert.equal((await registry.guardianCount()).toString(), "3");

    // Removing another guardian would leave 2 < threshold (3), must revert
    await expectRevert(
      registry.removeGuardian(g3, { from: deployer }),
      "PG:THRESHOLD_VIOLATION"
    );
  });
});
