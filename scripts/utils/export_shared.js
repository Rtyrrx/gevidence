// scripts/utils/export_shared.js
"use strict";

const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function copyFile(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}

function backendRoot() {
  return path.join(__dirname, "..", ".."); // backend/
}

function repoRoot() {
  return path.join(backendRoot(), ".."); // repo root: ../
}

function exportAbis() {
  const bRoot = backendRoot();
  const artifactsRoot = path.join(bRoot, "artifacts", "contracts");

  const outAbiDir = path.join(repoRoot(), "shared", "abi");
  ensureDir(outAbiDir);

  // Update this list if you add new contracts.
  const targets = [
    ["core/RoleManager.sol", "RoleManager"],
    ["core/GEvidenceRegistry.sol", "GEvidenceRegistry"],
    ["core/IoTOracleMock.sol", "IoTOracleMock"],

    ["modules/crowdfunding/VerificationCrowdfund.sol", "VerificationCrowdfund"],
    ["modules/crowdfunding/RewardToken.sol", "RewardToken"],

    ["modules/certificates/CompanyCertificateNFT.sol", "CompanyCertificateNFT"],
    ["modules/checks/OffCycleCheckModule.sol", "OffCycleCheckModule"],
  ];

  for (const [relSolPath, contractName] of targets) {
    const artifactPath = path.join(artifactsRoot, relSolPath, `${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
      console.warn(`[export_shared] artifact not found: ${artifactPath} (compile first)`);
      continue;
    }
    const artifact = readJson(artifactPath);
    const outPath = path.join(outAbiDir, `${contractName}.json`);
    writeJson(outPath, { contractName, abi: artifact.abi });
    console.log(`[export_shared] ABI -> shared/abi/${contractName}.json`);
  }
}

function exportAddresses() {
  const bRoot = backendRoot();
  const depDir = path.join(bRoot, "deployments");
  const outAddrDir = path.join(repoRoot(), "shared", "addresses");
  ensureDir(outAddrDir);

  if (!fs.existsSync(depDir)) return;

  const files = fs.readdirSync(depDir).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    const src = path.join(depDir, f);
    const dst = path.join(outAddrDir, f);
    copyFile(src, dst);
    console.log(`[export_shared] ADDR -> shared/addresses/${f}`);
  }
}

function exportShared() {
  exportAbis();
  exportAddresses();
}

if (require.main === module) {
  exportShared();
}

module.exports = { exportShared };
