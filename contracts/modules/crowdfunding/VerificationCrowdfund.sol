// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RewardToken} from "./RewardToken.sol";
import {RewardMath} from "./RewardMath.sol";
import {GEvidenceRegistry} from "../../core/GEvidenceRegistry.sol";
import {RoleManager} from "../../core/RoleManager.sol";

contract VerificationCrowdfund {
    using RewardMath for uint256;

    enum CampaignKind {
        CompanyOrAdmin, // created by company/admin
        Community       // created by regular user
    }

    struct Campaign {
        uint256 id;
        uint256 evidenceId;

        address creator;       // who opened campaign (user/admin/company)
        address beneficiary;   // where ETH goes if successful (treasury / IoT operator)

        CampaignKind kind;

        string title;
        uint256 goalWei;
        uint64 deadline;

        uint256 raisedWei;
        bool finalized;
        bool successful;
    }

    GEvidenceRegistry public immutable registry;
    RoleManager public immutable roles;

    RewardToken public immutable rewardToken;
    uint256 public immutable rewardRate; // tokens per 1 ETH (1e18 wei)

    address public treasury;             // payout address (IoT operator / platform)
    uint256 public minGoalWei;           // optional anti-spam
    uint256 public minDurationSeconds;   // optional anti-spam

    uint256 private _nextCampaignId = 1;

    mapping(uint256 => Campaign) private _campaignById;
    mapping(uint256 => mapping(address => uint256)) public contributions; // campaignId => contributor => wei

    // evidenceId -> campaignIds history
    mapping(uint256 => uint256[]) private _campaignIdsByEvidence;

    event CampaignCreated(
        uint256 indexed campaignId,
        uint256 indexed evidenceId,
        address indexed creator,
        address beneficiary,
        CampaignKind kind,
        string title,
        uint256 goalWei,
        uint64 deadline
    );

    event Contributed(
        uint256 indexed campaignId,
        address indexed contributor,
        uint256 amountWei,
        uint256 rewardMinted
    );

    event Finalized(uint256 indexed campaignId, bool successful, uint256 raisedWei);

    event Withdrawn(uint256 indexed campaignId, address indexed beneficiary, uint256 amountWei);

    event Refunded(uint256 indexed campaignId, address indexed contributor, uint256 amountWei);

    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    event MinGoalChanged(uint256 oldMinGoalWei, uint256 newMinGoalWei);
    event MinDurationChanged(uint256 oldMinDuration, uint256 newMinDuration);

    error CampaignNotFound();
    error EvidenceNotFound();
    error DeadlinePassed();
    error CampaignActive();
    error AlreadyFinalized();
    error ZeroValue();
    error TransferFailed();
    error NothingToWithdraw();
    error NothingToRefund();
    error NotAuthorized();
    error GoalTooSmall();
    error DurationTooShort();
    error ActiveCampaignExists();

    modifier onlyAdmin() {
        if (!roles.hasRole(roles.ADMIN_ROLE(), msg.sender)) revert NotAuthorized();
        _;
    }

    constructor(
        address roleManager,
        address registryAddress,
        uint256 rewardRateTokensPerEth,
        string memory rewardName,
        string memory rewardSymbol,
        address treasuryAddress
    ) {
        require(roleManager != address(0), "VerificationCrowdfund: zero roleManager");
        require(registryAddress != address(0), "VerificationCrowdfund: zero registry");
        require(rewardRateTokensPerEth > 0, "VerificationCrowdfund: zero rate");
        require(treasuryAddress != address(0), "VerificationCrowdfund: zero treasury");

        roles = RoleManager(roleManager);
        registry = GEvidenceRegistry(registryAddress);
        rewardRate = rewardRateTokensPerEth;

        treasury = treasuryAddress;

        // optional defaults (anti-spam; can be changed by admin)
        minGoalWei = 0;
        minDurationSeconds = 0;

        RewardToken t = new RewardToken(rewardName, rewardSymbol, address(this));
        rewardToken = t;
    }

    // -------- Admin controls (optional, but useful) --------

    function setTreasury(address newTreasury) external onlyAdmin {
        if (newTreasury == address(0)) revert ZeroValue();
        address old = treasury;
        treasury = newTreasury;
        emit TreasuryChanged(old, newTreasury);
    }

    function setMinGoalWei(uint256 newMinGoalWei) external onlyAdmin {
        uint256 old = minGoalWei;
        minGoalWei = newMinGoalWei;
        emit MinGoalChanged(old, newMinGoalWei);
    }

    function setMinDurationSeconds(uint256 newMinDurationSeconds) external onlyAdmin {
        uint256 old = minDurationSeconds;
        minDurationSeconds = newMinDurationSeconds;
        emit MinDurationChanged(old, newMinDurationSeconds);
    }

    // -------- Core actions (final requirements) --------

    /**
     * @notice ANY user can create a campaign (community can speed up IoT verification)
     * @dev Funds payout is ALWAYS to treasury (IoT operator / platform), not the creator.
     */
    function createCampaign(
        uint256 evidenceId,
        string calldata title,
        uint256 goalWei,
        uint64 deadline
    ) external returns (uint256 campaignId) {
        if (evidenceId == 0) revert ZeroValue();
        if (goalWei == 0) revert ZeroValue();
        if (deadline <= uint64(block.timestamp)) revert DeadlinePassed();

        if (!registry.existsEvidence(evidenceId)) revert EvidenceNotFound();

        if (minGoalWei > 0 && goalWei < minGoalWei) revert GoalTooSmall();

        uint256 duration = uint256(deadline) - block.timestamp;
        if (minDurationSeconds > 0 && duration < minDurationSeconds) revert DurationTooShort();

        // Optional: prevent multiple active campaigns per evidence (clean UX)
        uint256 lastId = _latestCampaignIdForEvidence(evidenceId);
        if (lastId != 0) {
            Campaign storage last = _campaignById[lastId];
            bool lastActive = (!last.finalized) && (block.timestamp <= last.deadline);
            if (lastActive) revert ActiveCampaignExists();
        }

        CampaignKind kind = _classifyCreator(msg.sender);

        campaignId = _nextCampaignId++;

        Campaign memory c = Campaign({
            id: campaignId,
            evidenceId: evidenceId,
            creator: msg.sender,
            beneficiary: treasury,
            kind: kind,
            title: title,
            goalWei: goalWei,
            deadline: deadline,
            raisedWei: 0,
            finalized: false,
            successful: false
        });

        _campaignById[campaignId] = c;
        _campaignIdsByEvidence[evidenceId].push(campaignId);

        // update latest link in registry (we patched registry to allow updates)
        registry.linkCampaign(evidenceId, campaignId);

        emit CampaignCreated(campaignId, evidenceId, msg.sender, treasury, kind, title, goalWei, deadline);
    }

    function contribute(uint256 campaignId) external payable {
        Campaign storage c = _getCampaign(campaignId);
        if (c.finalized) revert AlreadyFinalized();
        if (block.timestamp > c.deadline) revert DeadlinePassed();
        if (msg.value == 0) revert ZeroValue();

        contributions[campaignId][msg.sender] += msg.value;
        c.raisedWei += msg.value;

        uint256 reward = RewardMath.calcReward(msg.value, rewardRate);
        if (reward > 0) {
            rewardToken.mint(msg.sender, reward);
        }

        emit Contributed(campaignId, msg.sender, msg.value, reward);
    }

    function finalize(uint256 campaignId) external {
        Campaign storage c = _getCampaign(campaignId);
        if (c.finalized) revert AlreadyFinalized();
        if (block.timestamp <= c.deadline) revert CampaignActive();

        c.finalized = true;
        c.successful = (c.raisedWei >= c.goalWei);

        emit Finalized(campaignId, c.successful, c.raisedWei);
    }

    /**
     * @notice Withdraw raised ETH to beneficiary (treasury) if campaign succeeded
     * @dev creator cannot withdraw; only treasury/admin can withdraw
     */
    function withdraw(uint256 campaignId) external {
        Campaign storage c = _getCampaign(campaignId);

        bool isAdmin = roles.hasRole(roles.ADMIN_ROLE(), msg.sender);
        if (!isAdmin && msg.sender != c.beneficiary) revert NotAuthorized();

        if (!c.finalized) revert CampaignActive();
        if (!c.successful) revert NothingToWithdraw();
        if (c.raisedWei == 0) revert NothingToWithdraw();

        uint256 amount = c.raisedWei;
        c.raisedWei = 0;

        (bool ok, ) = payable(c.beneficiary).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(campaignId, c.beneficiary, amount);
    }

    /**
     * @notice Refund contributor if campaign failed
     */
    function refund(uint256 campaignId) external {
        Campaign storage c = _getCampaign(campaignId);
        if (!c.finalized) revert CampaignActive();
        if (c.successful) revert NothingToRefund();

        uint256 contributed = contributions[campaignId][msg.sender];
        if (contributed == 0) revert NothingToRefund();

        contributions[campaignId][msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: contributed}("");
        if (!ok) revert TransferFailed();

        emit Refunded(campaignId, msg.sender, contributed);
    }

    // -------- Frontend helpers --------

    function getCampaign(uint256 campaignId) external view returns (Campaign memory) {
        return _campaignById[campaignId];
    }

    function nextCampaignId() external view returns (uint256) {
        return _nextCampaignId;
    }

    function campaignCountForEvidence(uint256 evidenceId) external view returns (uint256) {
        return _campaignIdsByEvidence[evidenceId].length;
    }

    function campaignIdForEvidenceAt(uint256 evidenceId, uint256 index) external view returns (uint256) {
        return _campaignIdsByEvidence[evidenceId][index];
    }

    function listCampaignIdsForEvidence(uint256 evidenceId) external view returns (uint256[] memory) {
        return _campaignIdsByEvidence[evidenceId];
    }

    function isActive(uint256 campaignId) external view returns (bool) {
        Campaign memory c = _campaignById[campaignId];
        if (c.id == 0) return false;
        if (c.finalized) return false;
        return block.timestamp <= c.deadline;
    }

    function remainingTime(uint256 campaignId) external view returns (uint256) {
        Campaign memory c = _campaignById[campaignId];
        if (c.id == 0) revert CampaignNotFound();
        if (block.timestamp >= c.deadline) return 0;
        return uint256(c.deadline) - block.timestamp;
    }

    // -------- Internal --------

    function _getCampaign(uint256 campaignId) internal view returns (Campaign storage) {
        Campaign storage c = _campaignById[campaignId];
        if (c.id == 0) revert CampaignNotFound();
        return c;
    }

    function _latestCampaignIdForEvidence(uint256 evidenceId) internal view returns (uint256) {
        uint256 n = _campaignIdsByEvidence[evidenceId].length;
        if (n == 0) return 0;
        return _campaignIdsByEvidence[evidenceId][n - 1];
    }

    function _classifyCreator(address a) internal view returns (CampaignKind) {
        bool isAdmin = roles.hasRole(roles.ADMIN_ROLE(), a);
        bool isCompany = roles.hasRole(roles.COMPANY_ROLE(), a);
        return (isAdmin || isCompany) ? CampaignKind.CompanyOrAdmin : CampaignKind.Community;
    }
}
