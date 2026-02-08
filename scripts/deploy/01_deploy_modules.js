// scripts/deploy/01_deploy_modules.js
"use strict";

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { verifyNetwork } = require("../utils/verify_network");
const { exportShared } = require("../utils/export_shared");

const { ethers, network } = hre;

const parseUnits = (s, d) => (ethers.parseUnits ? ethers.parseUnits(s, d) : ethers.utils.parseUnits(s, d));
const addrOf = async (c) => (c.getAddress ? await c.getAddress() : (c.target || c.address));

function deploymentsPath(netName) {
  return path.join(__dirname, "..", "..", "deployments", `${netName}.json`);
}

function readDeployment(netName) {
  const p = deploymentsPath(netName);
  if (!fs.existsSync(p)) throw new Error(`Missing deployments/${netName}.json (run 00_deploy_core first)`);
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

  const dep = readDeployment(network.name);

  const rolesAddr = dep.RoleManager;
  const registryAddr = dep.GEvidenceRegistry;

  if (!rolesAddr || !registryAddr) {
    throw new Error("Missing RoleManager/GEvidenceRegistry in deployments file. Run 00_deploy_core.js first.");
  }

  // --- Config ---
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;

  // rewardRate is "tokens per 1 ETH", but stored in token base units (18 decimals).
  const rateHuman = process.env.REWARD_RATE || "1000";
  const rewardRate = parseUnits(rateHuman, 18);

  const rewardName = process.env.REWARD_NAME || "GEvidence Reward";
  const rewardSymbol = process.env.REWARD_SYMBOL || "GEVR";

  const certName = process.env.CERT_NAME || "GEvidence Company Certificate";
  const certSymbol = process.env.CERT_SYMBOL || "GEVCERT";

  const minStakeHuman = process.env.OFFCYCLE_MIN_STAKE || "50";
  const minStake = parseUnits(minStakeHuman, 18);

  // --- Deploy modules ---
  const crowdfund = await deployContract("VerificationCrowdfund", [
    rolesAddr,
    registryAddr,
    rewardRate,
    rewardName,
    rewardSymbol,
    treasury,
  ]);

  // Reward token is deployed inside crowdfund; fetch its address
  const crowdfundC = await ethers.getContractAt("VerificationCrowdfund", crowdfund.address);
  const rewardTokenAddr = await crowdfundC.rewardToken();
  console.log(`[info] RewardToken -> ${rewardTokenAddr}`);

  const cert = await deployContract("CompanyCertificateNFT", [
    rolesAddr,
    registryAddr,
    crowdfund.address,
    certName,
    certSymbol,
  ]);

  const offcycle = await deployContract("OffCycleCheckModule", [
    rolesAddr,
    registryAddr,
    rewardTokenAddr,
    treasury,
    minStake,
  ]);

  const netInfo = await ethers.provider.getNetwork();
  const chainId = typeof netInfo.chainId === "bigint" ? Number(netInfo.chainId) : Number(netInfo.chainId);

  const merged = {
    ...dep,
    network: network.name,
    chainId,
    updatedAt: new Date().toISOString(),

    VerificationCrowdfund: crowdfund.address,
    RewardToken: rewardTokenAddr,
    CompanyCertificateNFT: cert.address,
    OffCycleCheckModule: offcycle.address,

    treasury,
    rewardRateTokensPerEth: rateHuman,
    offCycleMinStake: minStakeHuman,
  };

  writeDeployment(network.name, merged);
  console.log(`[deployments] updated -> deployments/${network.name}.json`);

  // Export ABIs + addresses for frontend
  exportShared();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});