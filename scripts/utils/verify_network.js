// scripts/utils/verify_network.js
"use strict";

const DEFAULT_ALLOWED = new Set([
  31337, // hardhat
  1337,  // ganache/local
  11155111, // sepolia
  17000, // holesky
]);

function toNumChainId(chainId) {
  // ethers v6 can return bigint
  if (typeof chainId === "bigint") return Number(chainId);
  return Number(chainId);
}

async function verifyNetwork(hre, opts = {}) {
  const { ethers, network } = hre;

  const net = await ethers.provider.getNetwork();
  const chainId = toNumChainId(net.chainId);
  const name = network?.name || net.name || "unknown";

  // allow overriding allowed ids: ALLOWED_CHAIN_IDS="11155111,17000,31337"
  const envAllowed = process.env.ALLOWED_CHAIN_IDS;
  const allowed = envAllowed
    ? new Set(envAllowed.split(",").map((x) => Number(x.trim())).filter(Boolean))
    : DEFAULT_ALLOWED;

  const allowLocal = opts.allowLocal ?? true;

  if (!allowLocal) {
    // remove locals
    allowed.delete(31337);
    allowed.delete(1337);
  }

  if (!allowed.has(chainId)) {
    throw new Error(
      `Refusing to run on chainId=${chainId} (${name}). ` +
      `Allowed: ${Array.from(allowed).join(", ")}. ` +
      `Project must run on Ethereum TESTNET only.`
    );
  }

  console.log(`[network] ${name} | chainId=${chainId} ✅`);
  return { chainId, name };
}

module.exports = { verifyNetwork };