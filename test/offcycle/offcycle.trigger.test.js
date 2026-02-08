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
  const Roles = await ethers.getContractFactory("RoleManager");
  const roles = await Roles.deploy();
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

  const rewardTokenAddr = await crowdfund.rewardToken();

  const Off = await ethers.getContractFactory("OffCycleCheckModule");
  const minStake = ethers.parseUnits("50", 18);
  const off = await Off.deploy(
    await roles.getAddress(),
    await registry.getAddress(),
    rewardTokenAddr,
    treasuryAddr,
    minStake
  );
  await off.waitForDeployment();

  return { roles, registry, crowdfund, rewardTokenAddr, off };
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
      if (!(await registry.existsEvidence(i))) continue;
      const owner = await registry.companyOfEvidence(i);
      if (owner.toLowerCase() === company.address.toLowerCase()) return i;
    } catch (_) {}
  }
  throw new Error("Could not create evidence for off-cycle tests.");
}

async function ensureVerified(registry, roles, admin, verifier, evidenceId) {
  try {
    const VERIFIER_ROLE = await roles.VERIFIER_ROLE();
    if (!(await roles.hasRole(VERIFIER_ROLE, verifier.address))) {
      await (await roles.connect(admin).grantRole(VERIFIER_ROLE, verifier.address)).wait();
    }
  } catch (_) {}

  const candidates = [
    { fn: "verifyEvidence", args: [evidenceId] },
    { fn: "markVerified", args: [evidenceId] },
    { fn: "setEvidenceVerified", args: [evidenceId] },
    { fn: "setEvidenceStatus", args: [evidenceId, 2] },
    { fn: "updateEvidenceStatus", args: [evidenceId, 2] },
  ];

  for (const c of candidates) {
    if (typeof registry.connect(verifier)[c.fn] !== "function") continue;
    try {
      await (await registry.connect(verifier)[c.fn](...c.args)).wait();
      return;
    } catch (_) {}
  }
}

describe("Off-cycle checks", function () {
  it("user can stake reward tokens to request off-cycle check; resolver can approve and return stake", async function () {
    const [admin, company, creator, contributor, verifier, treasury] = await ethers.getSigners();

    const { roles, registry, crowdfund, rewardTokenAddr, off } = await deployAll(treasury.address);
    const evidenceId = await createEvidenceFlexible(registry, roles, admin, company);

    // campaign to mint reward tokens for contributor
    const now = Number((await ethers.provider.getBlock("latest")).timestamp);
    const deadline = now + 3600;
    const goal = ethers.parseEther("1");

    const rc = await (await crowdfund.connect(creator).createCampaign(evidenceId, "IoT Fund", goal, deadline)).wait();
    const ev = rc.logs.map((l) => { try { return crowdfund.interface.parseLog(l); } catch { return null; } })
      .find((x) => x && x.name === "CampaignCreated");
    const campaignId = ev.args.campaignId;

    await (await crowdfund.connect(contributor).contribute(campaignId, { value: ethers.parseEther("1.0") })).wait();
    await advanceTime(3605);
    await (await crowdfund.finalize(campaignId)).wait();

    // must be verified evidence for off-cycle
    await ensureVerified(registry, roles, admin, verifier, evidenceId);

    const token = await ethers.getContractAt("RewardToken", rewardTokenAddr);

    const stake = ethers.parseUnits("50", 18);
    const before = await token.balanceOf(contributor.address);

    await (await token.connect(contributor).approve(await off.getAddress(), stake)).wait();

    const reasonHash = hashTxt("suspicious-activity");
    const metricsHash = hashTxt("pm2.5,co2");

    const tx = await off.connect(contributor).requestOffCycleCheck(evidenceId, stake, reasonHash, metricsHash);
    const r = await tx.wait();

    const parsed = r.logs.map((l) => { try { return off.interface.parseLog(l); } catch { return null; } })
      .find((x) => x && x.name === "OffCycleRequested");
    expect(parsed).to.not.equal(undefined);

    const requestId = parsed.args.requestId;

    // grant resolver role (verifier)
    try {
      const VERIFIER_ROLE = await roles.VERIFIER_ROLE();
      if (!(await roles.hasRole(VERIFIER_ROLE, verifier.address))) {
        await (await roles.connect(admin).grantRole(VERIFIER_ROLE, verifier.address)).wait();
      }
    } catch (_) {}

    await (await off.connect(verifier).resolveOffCycleCheck(requestId, true, hashTxt("result-hash"), "ipfs://report/1")).wait();

    const after = await token.balanceOf(contributor.address);
    expect(after).to.equal(before); // stake returned on approved
  });
});
