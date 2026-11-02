export const STATIC_ROLES = [
  { index: 0, label: "Deployer", category: "Admin", desc: "Initial Deployer / Bootstrapper" },
  { index: 1, label: "Guardian 1 (G1)", category: "Guardian", desc: "Wormhole Consensus Signer" },
  { index: 2, label: "Guardian 2 (G2)", category: "Guardian", desc: "Wormhole Consensus Signer" },
  { index: 3, label: "Guardian 3 (G3)", category: "Guardian", desc: "Wormhole Consensus Signer" },
  { index: 4, label: "Guardian 4 (G4)", category: "Guardian", desc: "Wormhole Consensus Signer" },
  { index: 5, label: "Guardian 5 (G5)", category: "Guardian", desc: "Wormhole Consensus Signer" },
  { index: 6, label: "Risk Node 1 (R1)", category: "RMN", desc: "Chainlink CCIP Verifier Node" },
  { index: 7, label: "Risk Node 2 (R2)", category: "RMN", desc: "Chainlink CCIP Verifier Node" },
  { index: 8, label: "Bot 1 (B1)", category: "Bot", desc: "Forta Detection Network Staked Bot" },
  { index: 9, label: "Bot 2 (B2)", category: "Bot", desc: "Forta Detection Network Staked Bot" },
  { index: 10, label: "Owner 1 (O1)", category: "Governance", desc: "Defender Multi-Sig Owner" },
  { index: 11, label: "Owner 2 (O2)", category: "Governance", desc: "Defender Multi-Sig Owner" },
  { index: 12, label: "Owner 3 (O3)", category: "Governance", desc: "Defender Multi-Sig Owner" },
  { index: 13, label: "User", category: "User", desc: "Standard Bridge Cross-Chain User" },
  { index: 14, label: "Attacker", category: "Attacker", desc: "Malicious Penetration Actor" },
];

export function getRoleMeta(index) {
  return STATIC_ROLES[index] || { index, label: `Account #${index}`, category: "Other", desc: "EVM Account" };
}

