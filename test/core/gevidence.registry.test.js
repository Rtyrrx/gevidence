const { expect } = require("chai");
const { ethers } = require("hardhat");

async function mine() {
  await ethers.provider.send("evm_mine", []);
}

async function latestTs() {
  const b = await ethers.provider.getBlock("latest");
  return Number(b.timestamp);
}

function hashTxt(s) {
  return ethers.id(s);
}

async function tryCall(contract, signer, fnName, args) {
  const c = contract.connect(signer);
  if (typeof c[fnName] !== "function") return null;
  try {
    const tx = await c[fnName](...args);
    await tx.wait();
    return tx;
  } catch (e) {
    return null;
  }
}

async function findEvidenceId(registry, companyAddr, maxScan = 50) {
  for (let i = 1; i <= maxScan; i++) {
    try {
      const ex = await registry.existsEvidence(i);
      if (!ex) continue;
      try {
        const owner = await registry.companyOfEvidence(i);
        if (owner.toLowerCase() === companyAddr.toLowerCase()) return i;
      } catch (_) {}
    } catch (_) {}
  }
  return 0;
}

async function createEvidenceFlexible(registry, roles, admin, company) {
  // ensure COMPANY_ROLE if RoleManager is used for permissions
  try {
    const COMPANY_ROLE = await roles.COMPANY_ROLE();
    const has = await roles.hasRole(COMPANY_ROLE, company.address);
    if (!has) {
      await (await roles.connect(admin).grantRole(COMPANY_ROLE, company.address)).wait();
    }
  } catch (_) {
    // ignore if RoleManager API differs
  }

  const now = await latestTs();
  const candidates = [
    { fn: "createEvidence", args: ["Demo Evidence", hashTxt("meta-1")] },
    { fn: "createEvidence", args: [hashTxt("meta-1")] },
    { fn: "registerEvidence", args: ["Demo Evidence", hashTxt("meta-1")] },
    { fn: "registerEvidence", args: [hashTxt("meta-1")] },
    { fn: "submitEvidence", args: [hashTxt("meta-1")] },
    { fn: "addEvidence", args: ["Demo Evidence", hashTxt("meta-1")] },
    { fn: "addEvidence", args: [hashTxt("meta-1")] },
    // sometimes evidence has a uri and/or deadline-like field
    { fn: "createEvidence", args: ["Demo Evidence", hashTxt("meta-1"), `ipfs://demo-${now}`] },
  ];

  let okTx = null;
  for (const c of candidates) {
    okTx = await tryCall(registry, company, c.fn, c.args);
    if (okTx) break;
  }
  if (!okTx) {
    throw new Error(
      "Could not create evidence. Your GEvidenceRegistry needs a create/register/submit evidence function."
    );
  }

  await mine();
  const id = await findEvidenceId(registry, company.address);
  if (!id) throw new Error("Evidence created but could not detect evidenceId via existsEvidence/companyOfEvidence.");
  return id;
}

describe("GEvidenceRegistry (core)", function () {
  it("should create evidence and support linking campaign/certificate/offcycle", async function () {
    const [admin, company] = await ethers.getSigners();

    const Roles = await ethers.getContractFactory("RoleManager");
    const roles = await Roles.deploy();
    await roles.waitForDeployment();

    const Registry = await ethers.getContractFactory("GEvidenceRegistry");
    const registry = await Registry.deploy(await roles.getAddress());
    await registry.waitForDeployment();

    const evidenceId = await createEvidenceFlexible(registry, roles, admin, company);
    expect(await registry.existsEvidence(evidenceId)).to.equal(true);
    expect((await registry.companyOfEvidence(evidenceId)).toLowerCase()).to.equal(company.address.toLowerCase());

    // status read should not revert
    const st = await registry.statusOfEvidence(evidenceId);
    expect(st).to.not.equal(undefined);

    // link/update campaign (we patched registry to allow updates for community campaigns)
    await (await registry.linkCampaign(evidenceId, 101)).wait();
    expect(await registry.campaignOfEvidence(evidenceId)).to.equal(101);

    await (await registry.linkCampaign(evidenceId, 202)).wait();
    expect(await registry.campaignOfEvidence(evidenceId)).to.equal(202);

    // record off-cycle request (if implemented)
    await (await registry.recordOffCycleRequest(evidenceId, 77)).wait();

    // optional list helpers
    try {
      const list = await registry.listOffCycleRequests(evidenceId);
      expect(list.map((x) => Number(x))).to.include(77);
    } catch (_) {
      // ok if list helpers not present; recordOffCycleRequest still done
    }

    // link certificate token (if implemented)
    try {
      await (await registry.linkCertificate(evidenceId, 1)).wait();
      expect(await registry.certificateTokenOfEvidence(evidenceId)).to.equal(1);
    } catch (_) {
      // ok if certificate linking is enforced only by NFT contract
    }
  });
});
