const { increaseTime } = require("./time");

/**
 * Executes a governance action through DefenderMonitor multi-sig + timelock.
 * @param {object} monitor DefenderMonitor contract instance.
 * @param {string[]} owners Array of owner addresses (at least 2).
 * @param {string} target Destination contract address.
 * @param {string} calldata Encoded ABI call bytes.
 */
async function govExec(monitor, owners, target, calldata) {
  const [o1, o2] = owners;
  await monitor.submitProposal(target, calldata, { from: o1 });
  const propId = Number(await monitor.proposalCount()) - 1;

  const required = Number(await monitor.required());
  if (required > 1 && o2) {
    await monitor.confirmProposal(propId, { from: o2 });
  }

  const timelock = Number(await monitor.timelock());
  await increaseTime(timelock + 2);

  const res = await monitor.executeProposal(propId, { from: o1 });
  return { tx: res, propId };
}

module.exports = {
  govExec
};
