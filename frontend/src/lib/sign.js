import { getBytes, recoverAddress, hashMessage } from "ethers";

/**
 * Normalizes signature v parameter to 27 or 28 if needed.
 */
export function normalizeSignature(sig) {
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
 * Signs a 32-byte digest with a signer and verifies the recovered address.
 */
export async function signDigestWithSigner(signer, digest) {
  const digestBytes = getBytes(digest);
  const rawSig = await signer.signMessage(digestBytes);
  const normalized = normalizeSignature(rawSig);

  // Verification by local recovery
  const ethHash = hashMessage(digestBytes);
  const recovered = recoverAddress(ethHash, normalized);
  const signerAddress = await signer.getAddress();

  if (recovered.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(
      `Signature recovery mismatch: recovered ${recovered} vs signer ${signerAddress}`
    );
  }

  return {
    signer: signerAddress,
    sig: normalized,
    recovered,
    valid: true,
  };
}

/**
 * Sorts array of signed entries ascending by signer address.
 */
export function sortSignaturesBySigner(signedList) {
  return [...signedList].sort((a, b) => {
    const aBig = BigInt(a.signer);
    const bBig = BigInt(b.signer);
    if (aBig < bBig) return -1;
    if (aBig > bBig) return 1;
    return 0;
  });
}

