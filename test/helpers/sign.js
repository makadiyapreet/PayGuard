/**
 * Normalizes signature v parameter to 27 or 28 if necessary.
 * @param {string} sig Hex signature string.
 */
function normalizeSignature(sig) {
  let hex = sig.startsWith("0x") ? sig.slice(2) : sig;
  if (hex.length !== 130) {
    throw new Error(`Invalid signature length: ${hex.length}`);
  }
  let v = parseInt(hex.slice(128, 130), 16);
  if (v < 27) {
    v += 27;
  }
  const normalizedV = v.toString(16).padStart(2, "0");
  return "0x" + hex.slice(0, 128) + normalizedV;
}

/**
 * Signs a 32-byte digest with each guardian account and returns sorted signatures.
 * @param {object} web3 Web3 instance.
 * @param {string} digest 32-byte hex string.
 * @param {string[]} guardianAccounts Array of signer addresses.
 * @returns {Promise<string[]>} Array of sorted signature bytes.
 */
async function signDigest(web3, digest, guardianAccounts) {
  const signedEntries = [];

  for (const acc of guardianAccounts) {
    const rawSig = await web3.eth.sign(digest, acc);
    const normalized = normalizeSignature(rawSig);
    signedEntries.push({
      signer: acc,
      sig: normalized
    });
  }

  // Sort by signer address ascending (Solidity address numeric comparison)
  signedEntries.sort((a, b) => {
    const aBig = BigInt(a.signer);
    const bBig = BigInt(b.signer);
    if (aBig < bBig) return -1;
    if (aBig > bBig) return 1;
    return 0;
  });

  return signedEntries.map((item) => item.sig);
}

/**
 * Signs approval for a transfer id using the bridge contract.
 * @param {object} web3 Web3 instance.
 * @param {object} bridge PaymentBridge contract instance.
 * @param {string} id Transfer bytes32 id.
 * @param {string[]} guardianAccounts Array of signer addresses.
 */
async function signApproval(web3, bridge, id, guardianAccounts) {
  const digest = await bridge.getDigest(id);
  return signDigest(web3, digest, guardianAccounts);
}

module.exports = {
  normalizeSignature,
  signDigest,
  signApproval
};

