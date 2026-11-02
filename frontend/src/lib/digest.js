import { keccak256, toUtf8Bytes, AbiCoder } from "ethers";

const DOMAIN_HASH = keccak256(toUtf8Bytes("PAYGUARD_APPROVAL_V1"));

/**
 * Computes PayGuard approval digest locally to verify or create guardian signatures.
 */
export function computeApprovalDigest({
  chainId,
  bridgeAddress,
  id,
  sender,
  recipient,
  netAmount,
  nonce,
  expiresAt,
}) {
  const coder = AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(
    [
      "bytes32",
      "uint256",
      "address",
      "bytes32",
      "address",
      "address",
      "uint256",
      "uint256",
      "uint256",
    ],
    [
      DOMAIN_HASH,
      BigInt(chainId),
      bridgeAddress,
      id,
      sender,
      recipient,
      BigInt(netAmount),
      BigInt(nonce),
      BigInt(expiresAt),
    ]
  );
  return keccak256(encoded);
}
