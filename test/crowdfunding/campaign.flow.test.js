const { expect } = require("chai");
const { ethers } = require("hardhat");

function hashTxt(s) {
  return ethers.id(s);
}

async function advanceTime(sec) {
  await ethers.provider.send("evm_increaseTime", [sec]);
  await ethers.provider.send("evm_mine", []);
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
    const f = registry.connect(company)[c.fn];
    if (typeof f !== "function") continue;
    try {
      const tx = await registry.connect(company)[c.fn](...c.args);
      await tx.wait();
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
  throw new Error("Could not create evidence for crowdfunding tests.");
}

describe("Crowdfunding (campaign flow)", function () {
  it("community user can create campaign, contribute, finalize, withdraw to treasury", async function () {
    const [admin, company, userCreator, contributor, treasury] = await ethers.getSigners();

    const { roles, registry } = await deployCore();
    const evidenceId = await createEvidenceFlexible(registry, roles, admin, company);

    const Crowdfund = await ethers.getContractFactory("VerificationCrowdfund");
    const rewardRate = ethers.parseUnits("1000", 18); // 1000 tokens per 1 ETH
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
    const rewardToken = await ethers.getContractAt("RewardToken", rewardTokenAddr);

    const now = Number((await ethers.provider.getBlock("latest")).timestamp);
    const deadline = now + 3600;

    const goal = ethers.parseEther("1.0");
    const tx = await crowdfund.connect(userCreator).createCampaign(evidenceId, "Community IoT Check", goal, deadline);
    const rc = await tx.wait();

    // campaignId is returned, but easiest: take from event args[0]
    const ev = rc.logs.map((l) => {
      try {
        return crowdfund.interface.parseLog(l);
      } catch (_) {
        return null;
      }
    }).find((x) => x && x.name === "CampaignCreated");

    expect(ev).to.not.equal(undefined);
    const campaignId = ev.args.campaignId;

    const contributeValue = ethers.parseEther("1.2");
    await expect(crowdfund.connect(contributor).contribute(campaignId, { value: contributeValue }))
      .to.emit(crowdfund, "Contributed");

    const contrib = await crowdfund.contributions(campaignId, contributor.address);
    expect(contrib).to.equal(contributeValue);

    // reward minted proportional: valueWei * rate / 1e18
    const expectedReward = (contributeValue * rewardRate) / (10n ** 18n);
    expect(await rewardToken.balanceOf(contributor.address)).to.equal(expectedReward);

    // finalize after deadline
    await advanceTime(3605);
    await (await crowdfund.finalize(campaignId)).wait();

    const camp = await crowdfund.getCampaign(campaignId);
    expect(camp.finalized).to.equal(true);
    expect(camp.successful).to.equal(true);

    // withdraw to treasury
    const before = await ethers.provider.getBalance(treasury.address);
    await (await crowdfund.connect(treasury).withdraw(campaignId)).wait();
    const after = await ethers.provider.getBalance(treasury.address);

    expect(after).to.be.gt(before); // exact depends on gas, so > is ok
    expect(await ethers.provider.getBalance(await crowdfund.getAddress())).to.equal(0n);
  });

  it("failed campaign allows refunds and resets contribution record", async function () {
    const [admin, company, creator, contributor, treasury] = await ethers.getSigners();

    const { roles, registry } = await deployCore();
    const evidenceId = await createEvidenceFlexible(registry, roles, admin, company);

    const Crowdfund = await ethers.getContractFactory("VerificationCrowdfund");
    const rewardRate = ethers.parseUnits("1000", 18);
    const crowdfund = await Crowdfund.deploy(
      await roles.getAddress(),
      await registry.getAddress(),
      rewardRate,
      "GEvidence Reward",
      "GEVR",
      treasury.address
    );
    await crowdfund.waitForDeployment();

    const now = Number((await ethers.provider.getBlock("latest")).timestamp);
    const deadline = now + 3600;

    const goal = ethers.parseEther("10.0"); // too high
    const rc = await (await crowdfund.connect(creator).createCampaign(evidenceId, "Failing Campaign", goal, deadline)).wait();
    const parsed = rc.logs.map((l) => { try { return crowdfund.interface.parseLog(l); } catch { return null; } })
      .find((x) => x && x.name === "CampaignCreated");
    const campaignId = parsed.args.campaignId;

    const val = ethers.parseEther("0.5");
    await (await crowdfund.connect(contributor).contribute(campaignId, { value: val })).wait();
    expect(await crowdfund.contributions(campaignId, contributor.address)).to.equal(val);

    await advanceTime(3605);
    await (await crowdfund.finalize(campaignId)).wait();

    const camp = await crowdfund.getCampaign(campaignId);
    expect(camp.finalized).to.equal(true);
    expect(camp.successful).to.equal(false);

    await (await crowdfund.connect(contributor).refund(campaignId)).wait();
    expect(await crowdfund.contributions(campaignId, contributor.address)).to.equal(0n);
  });
});
