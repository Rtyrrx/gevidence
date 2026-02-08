// scripts/deploy/00_deploy_core.js
"use strict";

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { verifyNetwork } = require("../utils/verify_network");

const { ethers, network } = hre;

const parseEther = (s) => (ethers.parseEther ? ethers.parseEther(s) : ethers.utils.parseEther(s));
const addrOf = async (c) => (c.getAddress ? await c.getAddress() : (c.target || c.address));

function deploymentsPath(netName) {
  return path.join(__dirname, "..", "..", "deployments", `${netName}.json`);
}

function readDeployment(netName) {
  const p = deploymentsPath(netName);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeDeployment(netName, data) {
  const p = deploymentsPath(netName);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

async function deployContract(name, args = []) {
  const F = await ethers.getContractFactory(name);
  const c = await F.deploy(...args);
  if (c.waitForDeployment) await c.waitForDeployment();
  else await c.deployed();
  const address = await addrOf(c);
  console.log(`[deploy] ${name} -> ${address}`);
  return { c, address };
}

async function main() {
  await verifyNetwork(hre, { allowLocal: true });

  const [deployer] = await ethers.getSigners();
  console.log("[deployer]", deployer.address);

  // --- Core ---
  const roles = await deployContract("RoleManager", []);
  const registry = await deployContract("GEvidenceRegistry", [roles.address]);

  // IoT Oracle mock (dev/demo). Adjust args if your constructor differs.
  const oracle = await deployContract("IoTOracleMock", [roles.address, registry.address]);

  const netInfo = await ethers.provider.getNetwork();
  const chainId = typeof netInfo.chainId === "bigint" ? Number(netInfo.chainId) : Number(netInfo.chainId);

  const prev = readDeployment(network.name);
  const merged = {
    ...prev,
    network: network.name,
    chainId,
    updatedAt: new Date().toISOString(),
    deployer: deployer.address,

    RoleManager: roles.address,
    GEvidenceRegistry: registry.address,
    IoTOracleMock: oracle.address,
  };

  writeDeployment(network.name, merged);
  console.log(`[deployments] saved -> deployments/${network.name}.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
