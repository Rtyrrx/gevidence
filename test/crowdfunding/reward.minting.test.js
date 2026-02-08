const { expect } = require("chai");
const { ethers } = require("hardhat");

function hashTxt(s) {
  return ethers.id(s);
}

async function deployCore() {
  const Roles = await ethers.getContractFactory("RoleManager");
  const roles = await Roles.deploy();
  await roles.waitForDeployment();

  const Registry = await ethers.getContractFactory("GEvidenceRegistry");
  const registry = await Registry.deploy(await roles.getAddress());
  await registry.waitForDeployment();

  return { roles, registry };
}

async function createEvidenceFlexible(registry, roles, admin, company) {
  try {
    const COMPANY_ROLE = await roles.COMPANY_ROLE();
    if (!(await roles.hasRole(COMPANY_ROLE, company.address))) {
      await (await roles.connect(admin).grantRole(COMPANY_ROLE, company.address)).wait();
    }
  } catch (_) {}

  const candidates = [
    { fn: "createEvidence", args: ["Demo Evidence", hashTxt("meta-1")] },
    { fn: "createEvidence", args: [hashTxt("meta-1")] },
    { fn: "registerEvidence", args: [hashTxt("meta-1")] },
    { fn: "submitEvidence", args: [hashTxt("meta-1")] },
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
      const ex = await registry.existsEvidence(i);
      if (!ex) continue;
      const owner = await registry.companyOfEvidence(i);
      if (owner.toLowerCase() === company.address.toLowerCase()) return i;
    } catch (_) {}
  }
  throw new Error("Could not create evidence for reward minting tests.");
}

describe("RewardToken minting", function () {
  it("should mint rewards proportional to multiple contributions", async function () {
    const [admin, company, creator, alice, bob, treasury] = await ethers.getSigners();

    const { roles, registry } = await deployCore();
    const evidenceId = await createEvidenceFlexible(registry, roles, admin, company);

    const Crowdfund = await ethers.getContractFactory("VerificationCrowdfund");
    const rewardRate = ethers.parseUnits("500", 18); // 500 tokens per 1 ETH
    const crowdfund = await Crowdfund.deploy(
      await roles.getAddress(),
      await registry.getAddress(),
      rewardRate,
      "GEvidence Reward",
      "GEVR",
      treasury.address
    );
    await crowdfund.waitForDeployment();

    const rewardTokenAddr = await crowdfund.rewardToken();
    const token = await ethers.getContractAt("RewardToken", rewardTokenAddr);

    const now = Number((await ethers.provider.getBlock("latest")).timestamp);
    const deadline = now + 3600;
    const goal = ethers.parseEther("1");

    const rc = await (await crowdfund.connect(creator).createCampaign(evidenceId, "Rewards", goal, deadline)).wait();
    const ev = rc.logs.map((l) => { try { return crowdfund.interface.parseLog(l); } catch { return null; } })
      .find((x) => x && x.name === "CampaignCreated");
    const campaignId = ev.args.campaignId;

    const a = ethers.parseEther("0.2");
    const b = ethers.parseEther("0.4");

    await (await crowdfund.connect(alice).contribute(campaignId, { value: a })).wait();
    await (await crowdfund.connect(bob).contribute(campaignId, { value: b })).wait();

    const expA = (a * rewardRate) / (10n ** 18n);
    const expB = (b * rewardRate) / (10n ** 18n);

    expect(await token.balanceOf(alice.address)).to.equal(expA);
    expect(await token.balanceOf(bob.address)).to.equal(expB);

    const total = await token.totalSupply();
    expect(total).to.equal(expA + expB);
  });
});
