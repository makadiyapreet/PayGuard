const { assert } = require("chai");

/**
 * Asserts that a promise reverts with an error message containing the expected reason.
 * @param {Promise} promise The async promise to await.
 * @param {string} reason The expected substring in the revert reason.
 */
async function expectRevert(promise, reason) {
  try {
    await promise;
    assert.fail(`Expected transaction to revert with "${reason}", but it succeeded`);
  } catch (err) {
    if (err.message.includes(`Expected transaction to revert with "${reason}"`)) {
      throw err;
    }
    if (reason) {
      assert(
        err.message.includes(reason),
        `Expected revert reason "${reason}", but got "${err.message}"`
      );
    }
  }
}

module.exports = {
  expectRevert
};
