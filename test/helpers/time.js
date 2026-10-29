/**
 * Advances block time by the specified number of seconds and mines a new block.
 * @param {number} seconds Time to advance in seconds.
 */
function increaseTime(seconds) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [seconds],
        id: new Date().getTime()
      },
      (err1) => {
        if (err1) return reject(err1);
        web3.currentProvider.send(
          {
            jsonrpc: "2.0",
            method: "evm_mine",
            params: [],
            id: new Date().getTime() + 1
          },
          (err2, res2) => {
            if (err2) return reject(err2);
            resolve(res2);
          }
        );
      }
    );
  });
}

/**
 * Returns the timestamp of the latest block mined.
 */
async function latestTime() {
  const block = await web3.eth.getBlock("latest");
  return Number(block.timestamp);
}

module.exports = {
  increaseTime,
  latestTime
};
