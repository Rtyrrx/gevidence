// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RoleManager} from "../../core/RoleManager.sol";
import {GEvidenceRegistry} from "../../core/GEvidenceRegistry.sol";
import {EvidenceTypes} from "../../core/EvidenceTypes.sol";

contract OffCycleCheckModule {
    enum RequestStatus {
        Pending,
        Resolved
    }

    struct OffCycleRequest {
        uint256 id;
        uint256 evidenceId;
        address requester;
        uint256 stakeAmount;
        uint64 createdAt;
        uint64 resolvedAt;
        RequestStatus status;
        bool approved;
        bytes32 reasonHash;   
        bytes32 metricsHash;  
        bytes32 resultHash;   
    }

    RoleManager public immutable roles;
    GEvidenceRegistry public immutable registry;
    IERC20 public immutable rewardToken;

    address public treasury;
    uint256 public minStake;

    uint256 private _nextRequestId = 1;
    mapping(uint256 => OffCycleRequest) private _reqById;

    event OffCycleRequested(
        uint256 indexed requestId,
        uint256 indexed evidenceId,
        address indexed requester,
        uint256 stakeAmount,
        bytes32 reasonHash,
        bytes32 metricsHash
    );

    event OffCycleResolved(
        uint256 indexed requestId,
        uint256 indexed evidenceId,
        bool approved,
        bytes32 resultHash,
        address resolver,
        string resultUri
    );

    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    event MinStakeChanged(uint256 oldMinStake, uint256 newMinStake);

    error NotAuthorized();
    error EvidenceNotFound();
    error EvidenceNotVerified();
    error RequestNotFound();
    error NotPending();
    error StakeTooLow();
    error ZeroAddress();
    error TokenTransferFailed();

    constructor(
        address roleManager,
        address registryAddress,
        address rewardTokenAddress,
        address treasuryAddress,
        uint256 minStakeAmount
    ) {
        require(roleManager != address(0), "OffCycle: zero roles");
        require(registryAddress != address(0), "OffCycle: zero registry");
        require(rewardTokenAddress != address(0), "OffCycle: zero token");
        require(treasuryAddress != address(0), "OffCycle: zero treasury");

        roles = RoleManager(roleManager);
        registry = GEvidenceRegistry(registryAddress);
        rewardToken = IERC20(rewardTokenAddress);

        treasury = treasuryAddress;
        minStake = minStakeAmount;
    }

    modifier onlyAdmin() {
        if (!roles.hasRole(roles.ADMIN_ROLE(), msg.sender)) revert NotAuthorized();
        _;
    }

    modifier onlyResolver() {
        bool isVerifier = roles.hasRole(roles.VERIFIER_ROLE(), msg.sender);
        bool isIoT = roles.hasRole(roles.IOT_OPERATOR_ROLE(), msg.sender);
        bool isAdmin = roles.hasRole(roles.ADMIN_ROLE(), msg.sender);
        if (!isVerifier && !isIoT && !isAdmin) revert NotAuthorized();
        _;
    }

    modifier requestExists(uint256 requestId) {
        if (_reqById[requestId].id == 0) revert RequestNotFound();
        _;
    }

    function setTreasury(address newTreasury) external onlyAdmin {
        if (newTreasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = newTreasury;
        emit TreasuryChanged(old, newTreasury);
    }

    function setMinStake(uint256 newMinStake) external onlyAdmin {
        uint256 old = minStake;
        minStake = newMinStake;
        emit MinStakeChanged(old, newMinStake);
    }

    function requestOffCycleCheck(
        uint256 evidenceId,
        uint256 stakeAmount,
        bytes32 reasonHash,
        bytes32 metricsHash
    ) external returns (uint256 requestId) {
        if (!registry.existsEvidence(evidenceId)) revert EvidenceNotFound();
        if (registry.statusOfEvidence(evidenceId) != EvidenceTypes.EvidenceStatus.Verified) {
            revert EvidenceNotVerified();
        }
        if (stakeAmount < minStake) revert StakeTooLow();

        bool ok = rewardToken.transferFrom(msg.sender, address(this), stakeAmount);
        if (!ok) revert TokenTransferFailed();

        requestId = _nextRequestId++;
        _reqById[requestId] = OffCycleRequest({
            id: requestId,
            evidenceId: evidenceId,
            requester: msg.sender,
            stakeAmount: stakeAmount,
            createdAt: uint64(block.timestamp),
            resolvedAt: 0,
            status: RequestStatus.Pending,
            approved: false,
            reasonHash: reasonHash,
            metricsHash: metricsHash,
            resultHash: bytes32(0)
        });

        registry.recordOffCycleRequest(evidenceId, requestId);

        emit OffCycleRequested(requestId, evidenceId, msg.sender, stakeAmount, reasonHash, metricsHash);
    }

    function resolveOffCycleCheck(
        uint256 requestId,
        bool approved,
        bytes32 resultHash,
        string calldata resultUri
    ) external onlyResolver requestExists(requestId) {
        OffCycleRequest storage r = _reqById[requestId];
        if (r.status != RequestStatus.Pending) revert NotPending();

        r.status = RequestStatus.Resolved;
        r.approved = approved;
        r.resultHash = resultHash;
        r.resolvedAt = uint64(block.timestamp);

        address to = approved ? r.requester : treasury;
        bool ok = rewardToken.transfer(to, r.stakeAmount);
        if (!ok) revert TokenTransferFailed();

        emit OffCycleResolved(requestId, r.evidenceId, approved, resultHash, msg.sender, resultUri);
    }

    function nextRequestId() external view returns (uint256) {
        return _nextRequestId;
    }

    function getRequest(uint256 requestId)
        external
        view
        requestExists(requestId)
        returns (OffCycleRequest memory)
    {
        return _reqById[requestId];
    }

    function isPending(uint256 requestId) external view requestExists(requestId) returns (bool) {
        return _reqById[requestId].status == RequestStatus.Pending;
    }
}

