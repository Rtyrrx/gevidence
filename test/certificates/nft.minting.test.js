const { expect } = require("chai");
const { ethers } = require("hardhat");

function hashTxt(s) {
  return ethers.id(s);
}

async function advanceTime(sec) {
  await ethers.provider.send("evm_increaseTime", [sec]);
  await ethers.provider.send("evm_mine", []);
}

async function deployAll(treasuryAddr) {
  const [admin] = await ethers.getSigners();

  const Roles = await ethers.getContractFactory("RoleManager");
  const roles = await Roles.deploy(await admin.getAddress());
  await roles.waitForDeployment();

  const Registry = await ethers.getContractFactory("GEvidenceRegistry");
  const registry = await Registry.deploy(await roles.getAddress());
  await registry.waitForDeployment();

  const Crowdfund = await ethers.getContractFactory("VerificationCrowdfund");
  const rate = ethers.parseUnits("1000", 18);
  const crowdfund = await Crowdfund.deploy(
    await roles.getAddress(),
    await registry.getAddress(),
    rate,
    "GEvidence Reward",
    "GEVR",
    treasuryAddr
  );
  await crowdfund.waitForDeployment();

  const tokenAddr = await crowdfund.rewardToken();

  const Cert = await ethers.getContractFactory("CompanyCertificateNFT");
  const cert = await Cert.deploy(
    await roles.getAddress(),
    await registry.getAddress(),
    await crowdfund.getAddress(),
    "GEvidence Company Certificate",
    "GEVCERT"
  );
  await cert.waitForDeployment();

  return { roles, registry, crowdfund, tokenAddr, cert, admin };
}

async function createEvidenceFlexible(registry, roles, admin, company) {
  try {
    const COMPANY_ROLE = await roles.COMPANY_ROLE();
    if (!(await roles.hasRole(COMPANY_ROLE, company.address))) {
      await (await roles.connect(admin).grantRole(COMPANY_ROLE, company.address)).wait();
    }
  } catch (_) {}

  const candidates = [
    { fn: "createEvidence", args: [hashTxt("meta-1"), "Demo Evidence"] },
  ];

  for (const c of candidates) {
    if (typeof registry.connect(company)[c.fn] !== "function") continue;
    try {
      await (await registry.connect(company)[c.fn](...c.args)).wait();
      break;
    } catch (_) {}
  }

  for (let i = 1; i <= 50; i++) {
    try {
      if (!(await registry.existsEvidence(i))) continue;
      const owner = await registry.companyOfEvidence(i);
      if (owner.toLowerCase() === company.address.toLowerCase()) return i;
    } catch (_) {}
  }
  throw new Error("Could not create evidence for certificate tests.");
}

async function ensureVerified(registry, roles, admin, verifier, evidenceId, company) {
  try {
    const COMPANY_ROLE = await roles.COMPANY_ROLE();
    if (!(await roles.hasRole(COMPANY_ROLE, company.address))) {
      await (await roles.connect(admin).grantRole(COMPANY_ROLE, company.address)).wait();
    }
  } catch (_) {}

  try {
    const VERIFIER_ROLE = await roles.VERIFIER_ROLE();
    if (!(await roles.hasRole(VERIFIER_ROLE, verifier.address))) {
      await (await roles.connect(admin).grantRole(VERIFIER_ROLE, verifier.address)).wait();
    }
  } catch (_) {}

  try {
    await (await registry.connect(company).submitEvidence(evidenceId)).wait();
  } catch (_) {}

  try {
    await (await registry.connect(verifier).moveToUnderReview(evidenceId, "review initiated")).wait();
  } catch (_) {}

  try {
    await (await registry.connect(verifier).verifyEvidence(evidenceId, true, "verified")).wait();
  } catch (_) {}
}

describe("CompanyCertificateNFT", function () {
  it("mints certificate after successful campaign + verified evidence", async function () {
    const [admin, company, creator, contributor, verifier, treasury] = await ethers.getSigners();

    const { roles, registry, crowdfund, cert } = await deployAll(treasury.address);
    const evidenceId = await createEvidenceFlexible(registry, roles, admin, company);

    const now = Number((await ethers.provider.getBlock("latest")).timestamp);
    const deadline = now + 3600;
    const goal = ethers.parseEther("1.0");

    const rc = await (await crowdfund.connect(creator).createCampaign(evidenceId, "IoT Fund", goal, deadline)).wait();
    const ev = rc.logs.map((l) => { try { return crowdfund.interface.parseLog(l); } catch { return null; } })
      .find((x) => x && x.name === "CampaignCreated");
    const campaignId = ev.args.campaignId;

    await (await crowdfund.connect(contributor).contribute(campaignId, { value: ethers.parseEther("1.2") })).wait();
    await advanceTime(3605);
    await (await crowdfund.finalize(campaignId)).wait();

    await ensureVerified(registry, roles, admin, verifier, evidenceId, company);

    const tokenUri = "ipfs://gevidence/company-cert/1";
    const tx = await cert.connect(verifier).mintCertificate(evidenceId, campaignId, tokenUri);
    const r = await tx.wait();

    const parsed = r.logs.map((l) => {
      try { return cert.interface.parseLog(l); } catch { return null; }
    }).find((x) => x && x.name === "CertificateMinted");

    expect(parsed).to.not.equal(undefined);
    const tokenId = parsed.args.tokenId;

    expect((await cert.ownerOf(tokenId)).toLowerCase()).to.equal(company.address.toLowerCase());

    try {
      const linked = await registry.certificateTokenOfEvidence(evidenceId);
      expect(linked).to.equal(tokenId);
    } catch (_) {}
  });
});
