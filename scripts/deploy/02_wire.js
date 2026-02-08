// scripts/deploy/02_wire.js
"use strict";

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { verifyNetwork } = require("../utils/verify_network");
const { exportShared } = require("../utils/export_shared");

const { ethers, network } = hre;

const parseUnits = (s, d) => (ethers.parseUnits ? ethers.parseUnits(s, d) : ethers.utils.parseUnits(s, d));
const parseEther = (s) => (ethers.parseEther ? ethers.parseEther(s) : ethers.utils.parseEther(s));

function deploymentsPath(netName) {
  return path.join(__dirname, "..", "..", "deployments", `${netName}.json`);
}

function readDeployment(netName) {
  const p = deploymentsPath(netName);
  if (!fs.existsSync(p)) throw new Error(`Missing deployments/${netName}.json (run deploy scripts first)`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function csvAddrs(envVal) {
  if (!envVal) return [];
  return envVal
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function grantIfMissing(roles, roleId, addr) {
  const has = await roles.hasRole(roleId, addr);
  if (has) return false;
  const tx = await roles.grantRole(roleId, addr);
  await tx.wait();
  console.log(`[wire] grantRole ${roleId} -> ${addr}`);
  return true;
}

async function main() {
  await verifyNetwork(hre, { allowLocal: true });

  const [deployer] = await ethers.getSigners();
  console.log("[deployer]", deployer.address);

  const dep = readDeployment(network.name);

  const roles = await ethers.getContractAt("RoleManager", dep.RoleManager);

  // --- Roles wiring (optional) ---
  const companyAddrs = csvAddrs(process.env.COMPANY_ADDRS);
  const verifierAddrs = csvAddrs(process.env.VERIFIER_ADDRS);
  const iotAddrs = csvAddrs(process.env.IOT_OPERATOR_ADDRS);
  const adminAddrs = csvAddrs(process.env.ADMIN_ADDRS);

  const ADMIN_ROLE = await roles.ADMIN_ROLE();
  const COMPANY_ROLE = await roles.COMPANY_ROLE();
  const VERIFIER_ROLE = await roles.VERIFIER_ROLE();
  const IOT_ROLE = await roles.IOT_OPERATOR_ROLE();

  for (const a of adminAddrs) await grantIfMissing(roles, ADMIN_ROLE, a);
  for (const a of companyAddrs) await grantIfMissing(roles, COMPANY_ROLE, a);
  for (const a of verifierAddrs) await grantIfMissing(roles, VERIFIER_ROLE, a);
  for (const a of iotAddrs) await grantIfMissing(roles, IOT_ROLE, a);

  // --- Optional parameter wiring ---
  // Crowdfund controls
  if (dep.VerificationCrowdfund) {
    const cf = await ethers.getContractAt("VerificationCrowdfund", dep.VerificationCrowdfund);

    // Optional: set treasury (if you want to change post-deploy)
    if (process.env.TREASURY_ADDRESS) {
      const tx = await cf.setTreasury(process.env.TREASURY_ADDRESS);
      await tx.wait();
      console.log(`[wire] Crowdfund treasury -> ${process.env.TREASURY_ADDRESS}`);
    }

    // Optional anti-spam:
    // CF_MIN_GOAL_ETH="0.05"
    if (process.env.CF_MIN_GOAL_ETH) {
      const minGoalWei = parseEther(process.env.CF_MIN_GOAL_ETH);
      const tx = await cf.setMinGoalWei(minGoalWei);
      await tx.wait();
      console.log(`[wire] Crowdfund minGoalWei -> ${process.env.CF_MIN_GOAL_ETH} ETH`);
    }

    // CF_MIN_DURATION_SEC="600"
    if (process.env.CF_MIN_DURATION_SEC) {
      const secs = Number(process.env.CF_MIN_DURATION_SEC);
      const tx = await cf.setMinDurationSeconds(secs);
      await tx.wait();
      console.log(`[wire] Crowdfund minDurationSeconds -> ${secs}`);
    }
  }

  // Off-cycle controls
  if (dep.OffCycleCheckModule) {
    const off = await ethers.getContractAt("OffCycleCheckModule", dep.OffCycleCheckModule);

    if (process.env.TREASURY_ADDRESS) {
      const tx = await off.setTreasury(process.env.TREASURY_ADDRESS);
      await tx.wait();
      console.log(`[wire] OffCycle treasury -> ${process.env.TREASURY_ADDRESS}`);
    }

    if (process.env.OFFCYCLE_MIN_STAKE) {
      const minStake = parseUnits(process.env.OFFCYCLE_MIN_STAKE, 18);
      const tx = await off.setMinStake(minStake);
      await tx.wait();
      console.log(`[wire] OffCycle minStake -> ${process.env.OFFCYCLE_MIN_STAKE} tokens`);
    }
  }

  exportShared();
  console.log("[wire] done ✅");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});