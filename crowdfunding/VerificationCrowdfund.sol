// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RewardToken} from "./RewardToken.sol";
import {RewardMath} from "./RewardMath.sol";
import {GEvidenceRegistry} from "../../core/GEvidenceRegistry.sol";

/**
 * @title VerificationCrowdfund
 * @notice Crowdfunding campaigns that finance IoT verification for a GEvidence evidenceId
 *
 * Key features (requirements):
 *  - Users contribute test ETH via MetaMask
 *  - Accurate tracking of individual contributions
 *  - Deadline-based finalize
 *  - Reward tokens minted proportional to contributions (ERC-20)
 *
 * Integration:
 *  - Each campaign is linked to evidenceId
 *  - Registry is informed via linkCampaign(evidenceId, campaignId)
 */
contract VerificationCrowdfund {
    using RewardMath for uint256;

    struct Campaign {
        uint256 id;
        uint256 evidenceId;
        address owner;       // campaign creator (company or admin)
        string title;
        uint256 goalWei;
        uint64 deadline;     // unix seconds
        uint256 raisedWei;
        bool finalized;
        bool successful;
    }

    GEvidenceRegistry public immutable registry;
    RewardToken public immutable rewardToken;

    uint256 public immutable rewardRate; // tokens per 1 ETH (1e18 wei)

    uint256 private _nextCampaignId = 1;

    mapping(uint256 => Campaign) private _campaignById;
    mapping(uint256 => mapping(address => uint256)) public contributions; // campaignId => contributor => wei

    // --- Events (front-end friendly) ---
    event CampaignCreated(
        uint256 indexed campaignId,
        uint256 indexed evidenceId,
        address indexed owner,
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

    event Finalized(
        uint256 indexed campaignId,
        bool successful,
        uint256 raisedWei
    );

    event Withdrawn(
        uint256 indexed campaignId,
        address indexed owner,
        uint256 amountWei
    );

    event Refunded(
        uint256 indexed campaignId,
        address indexed contributor,
        uint256 amountWei
    );

    // --- Errors ---
    error CampaignNotFound();
    error EvidenceNotFound();
    error NotOwner();
    error DeadlinePassed();
    error CampaignActive();
    error AlreadyFinalized();
    error ZeroValue();
    error TransferFailed();
    error NothingToWithdraw();
    error NothingToRefund();

    constructor(
        address registryAddress,
        uint256 rewardRateTokensPerEth,
        string memory rewardName,
        string memory rewardSymbol
    ) {
        require(registryAddress != address(0), "VerificationCrowdfund: zero registry");
        require(rewardRateTokensPerEth > 0, "VerificationCrowdfund: zero rate");

        registry = GEvidenceRegistry(registryAddress);
        rewardRate = rewardRateTokensPerEth;

        // deploy reward token and set this contract as minter
        RewardToken t = new RewardToken(rewardName, rewardSymbol, address(this));
        rewardToken = t;
    }

    // --- Core actions ---

    function createCampaign(
        uint256 evidenceId,
        string calldata title,
        uint256 goalWei,
        uint64 deadline
    ) external returns (uint256 campaignId) {
        if (evidenceId == 0) revert ZeroValue();
        if (goalWei == 0) revert ZeroValue();
        if (deadline <= uint64(block.timestamp)) revert DeadlinePassed();

        // must exist in registry
        if (!registry.existsEvidence(evidenceId)) revert EvidenceNotFound();

        campaignId = _nextCampaignId++;

        Campaign memory c = Campaign({
            id: campaignId,
            evidenceId: evidenceId,
            owner: msg.sender,
            title: title,
            goalWei: goalWei,
            deadline: deadline,
            raisedWei: 0,
            finalized: false,
            successful: false
        });

        _campaignById[campaignId] = c;

        // Link campaign to evidence in registry (one campaign per evidence in current core)
        // If you later want multiple campaigns per evidence, update registry mapping to arrays.
        registry.linkCampaign(evidenceId, campaignId);

        emit CampaignCreated(campaignId, evidenceId, msg.sender, title, goalWei, deadline);
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
     * @notice Owner withdraws collected ETH if campaign successful
     */
    function withdraw(uint256 campaignId) external {
        Campaign storage c = _getCampaign(campaignId);
        if (msg.sender != c.owner) revert NotOwner();
        if (!c.finalized) revert CampaignActive();
        if (!c.successful) revert NothingToWithdraw();
        if (c.raisedWei == 0) revert NothingToWithdraw();

        uint256 amount = c.raisedWei;
        c.raisedWei = 0; // effects first

        (bool ok, ) = payable(c.owner).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(campaignId, c.owner, amount);
    }

    /**
     * @notice Contributor refunds if campaign failed
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

    // --- View helpers for frontend ---

    function nextCampaignId() external view returns (uint256) {
        return _nextCampaignId;
    }

    function getCampaign(uint256 campaignId) external view returns (Campaign memory) {
        return _campaignById[campaignId];
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

    // --- Internal ---
    function _getCampaign(uint256 campaignId) internal view returns (Campaign storage) {
        Campaign storage c = _campaignById[campaignId];
        if (c.id == 0) revert CampaignNotFound();
        return c;
    }
}