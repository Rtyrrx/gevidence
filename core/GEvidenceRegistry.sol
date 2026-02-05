// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EvidenceTypes} from "./EvidenceTypes.sol";
import {RoleManager} from "./RoleManager.sol";

/**
 * @title GEvidenceRegistry
 * @notice Main registry for ESG evidence lifecycle and cross-module linking
 *
 * Frontend-friendly design:
 *  - explicit events for every state change
 *  - simple getters and list helpers
 *  - external "link" functions for modules (crowdfunding/NFT/off-cycle)
 */
contract GEvidenceRegistry {
    using EvidenceTypes for EvidenceTypes.Evidence;

    // Roles source
    RoleManager public immutable roles;

    // Storage
    uint256 private _nextEvidenceId = 1;

    mapping(uint256 => EvidenceTypes.Evidence) private _evidenceById;
    mapping(address => uint256[]) private _evidenceIdsByCompany;

    // evidenceId -> campaignId (optional)
    mapping(uint256 => uint256) public campaignOfEvidence;

    // evidenceId -> certificate NFT tokenId (optional)
    mapping(uint256 => uint256) public certificateTokenOfEvidence;

    // evidenceId -> list of off-cycle requestIds (optional; filled by OffCycle module)
    mapping(uint256 => uint256[]) private _offCycleRequestsByEvidence;

    // --- Events ---
    event EvidenceCreated(
        uint256 indexed evidenceId,
        address indexed company,
        bytes32 indexed dataHash,
        string uri
    );

    event EvidenceSubmitted(uint256 indexed evidenceId, address indexed company);
    event EvidenceStatusChanged(
        uint256 indexed evidenceId,
        EvidenceTypes.EvidenceStatus previousStatus,
        EvidenceTypes.EvidenceStatus newStatus,
        address indexed actor,
        string note
    );

    event EvidenceUpdated(
        uint256 indexed evidenceId,
        bytes32 indexed newDataHash,
        string newUri
    );

    event CampaignLinked(uint256 indexed evidenceId, uint256 indexed campaignId, address indexed linker);
    event CertificateLinked(uint256 indexed evidenceId, uint256 indexed tokenId, address indexed linker);
    event OffCycleRequestRecorded(uint256 indexed evidenceId, uint256 indexed requestId, address indexed recorder);

    // --- Errors (simple & readable for UI) ---
    error NotCompany();
    error NotVerifier();
    error NotAdmin();
    error NotEvidenceOwner();
    error EvidenceNotFound();
    error InvalidStatus();
    error AlreadyLinked();
    error ZeroValue();

    constructor(address roleManager) {
        require(roleManager != address(0), "GEvidenceRegistry: zero roleManager");
        roles = RoleManager(roleManager);
    }

    // --- Modifiers ---
    modifier onlyAdmin() {
        if (!roles.hasRole(roles.ADMIN_ROLE(), msg.sender)) revert NotAdmin();
        _;
    }

    modifier onlyCompany() {
        if (!roles.hasRole(roles.COMPANY_ROLE(), msg.sender)) revert NotCompany();
        _;
    }

    modifier onlyVerifier() {
        if (!roles.hasRole(roles.VERIFIER_ROLE(), msg.sender)) revert NotVerifier();
        _;
    }

    modifier evidenceExists(uint256 evidenceId) {
        if (_evidenceById[evidenceId].id == 0) revert EvidenceNotFound();
        _;
    }

    // --- Core: create/submit/update ---
    function createEvidence(bytes32 dataHash, string calldata uri)
        external
        onlyCompany
        returns (uint256 evidenceId)
    {
        if (dataHash == bytes32(0)) revert ZeroValue();

        evidenceId = _nextEvidenceId++;
        uint64 nowTs = uint64(block.timestamp);

        EvidenceTypes.Evidence memory e = EvidenceTypes.Evidence({
            id: evidenceId,
            company: msg.sender,
            dataHash: dataHash,
            uri: uri,
            status: EvidenceTypes.EvidenceStatus.Draft,
            createdAt: nowTs,
            updatedAt: nowTs
        });

        _evidenceById[evidenceId] = e;
        _evidenceIdsByCompany[msg.sender].push(evidenceId);

        emit EvidenceCreated(evidenceId, msg.sender, dataHash, uri);
    }

    function updateEvidence(uint256 evidenceId, bytes32 newDataHash, string calldata newUri)
        external
        onlyCompany
        evidenceExists(evidenceId)
    {
        EvidenceTypes.Evidence storage e = _evidenceById[evidenceId];
        if (e.company != msg.sender) revert NotEvidenceOwner();
        if (e.status != EvidenceTypes.EvidenceStatus.Draft) revert InvalidStatus();
        if (newDataHash == bytes32(0)) revert ZeroValue();

        e.dataHash = newDataHash;
        e.uri = newUri;
        e.updatedAt = uint64(block.timestamp);

        emit EvidenceUpdated(evidenceId, newDataHash, newUri);
    }

    function submitEvidence(uint256 evidenceId)
        external
        onlyCompany
        evidenceExists(evidenceId)
    {
        EvidenceTypes.Evidence storage e = _evidenceById[evidenceId];
        if (e.company != msg.sender) revert NotEvidenceOwner();
        if (e.status != EvidenceTypes.EvidenceStatus.Draft) revert InvalidStatus();

        _setStatus(evidenceId, EvidenceTypes.EvidenceStatus.Submitted, "submitted");
        emit EvidenceSubmitted(evidenceId, msg.sender);
    }

    // --- Verifier actions ---
    function moveToUnderReview(uint256 evidenceId, string calldata note)
        external
        onlyVerifier
        evidenceExists(evidenceId)
    {
        EvidenceTypes.Evidence storage e = _evidenceById[evidenceId];
        if (e.status != EvidenceTypes.EvidenceStatus.Submitted) revert InvalidStatus();
        _setStatus(evidenceId, EvidenceTypes.EvidenceStatus.UnderReview, note);
    }

    function verifyEvidence(uint256 evidenceId, bool approved, string calldata note)
        external
        onlyVerifier
        evidenceExists(evidenceId)
    {
        EvidenceTypes.Evidence storage e = _evidenceById[evidenceId];
        if (e.status != EvidenceTypes.EvidenceStatus.UnderReview) revert InvalidStatus();

        _setStatus(
            evidenceId,
            approved ? EvidenceTypes.EvidenceStatus.Verified : EvidenceTypes.EvidenceStatus.Rejected,
            note
        );
    }

    // --- Admin: emergency/manual status change (optional but practical) ---
    function adminSetStatus(uint256 evidenceId, EvidenceTypes.EvidenceStatus newStatus, string calldata note)
        external
        onlyAdmin
        evidenceExists(evidenceId)
    {
        _setStatus(evidenceId, newStatus, note);
    }

    // --- Cross-module linking (crowdfunding, NFT cert, off-cycle checks) ---

    /**
     * @notice Link a crowdfunding campaign to an evidence item
     * @dev Usually called by the crowdfunding module right after campaign creation
     */
    function linkCampaign(uint256 evidenceId, uint256 campaignId)
        external
        evidenceExists(evidenceId)
    {
        if (campaignId == 0) revert ZeroValue();
        if (campaignOfEvidence[evidenceId] != 0) revert AlreadyLinked();

        campaignOfEvidence[evidenceId] = campaignId;
        emit CampaignLinked(evidenceId, campaignId, msg.sender);
    }

    /**
     * @notice Link certificate NFT tokenId to evidence
     * @dev Usually called by NFT contract/minter module after minting
     */
    function linkCertificate(uint256 evidenceId, uint256 tokenId)
        external
        evidenceExists(evidenceId)
    {
        if (tokenId == 0) revert ZeroValue();
        if (certificateTokenOfEvidence[evidenceId] != 0) revert AlreadyLinked();

        certificateTokenOfEvidence[evidenceId] = tokenId;
        emit CertificateLinked(evidenceId, tokenId, msg.sender);
    }

    /**
     * @notice Record an off-cycle request id associated with an evidence
     * @dev Called by OffCycleCheckModule when a request is created
     */
    function recordOffCycleRequest(uint256 evidenceId, uint256 requestId)
        external
        evidenceExists(evidenceId)
    {
        if (requestId == 0) revert ZeroValue();

        _offCycleRequestsByEvidence[evidenceId].push(requestId);
        emit OffCycleRequestRecorded(evidenceId, requestId, msg.sender);
    }

    // Getters (UI friendly)

    function nextEvidenceId() external view returns (uint256) {
        return _nextEvidenceId;
    }

    function getEvidence(uint256 evidenceId)
        external
        view
        evidenceExists(evidenceId)
        returns (EvidenceTypes.Evidence memory)
    {
        return _evidenceById[evidenceId];
    }

    function evidenceCountOf(address company) external view returns (uint256) {
        return _evidenceIdsByCompany[company].length;
    }

    function evidenceIdOf(address company, uint256 index) external view returns (uint256) {
        return _evidenceIdsByCompany[company][index];
    }

    function listEvidenceIds(address company) external view returns (uint256[] memory) {
        return _evidenceIdsByCompany[company];
    }

    function offCycleRequestCount(uint256 evidenceId) external view evidenceExists(evidenceId) returns (uint256) {
        return _offCycleRequestsByEvidence[evidenceId].length;
    }

    function offCycleRequestIdAt(uint256 evidenceId, uint256 index)
        external
        view
        evidenceExists(evidenceId)
        returns (uint256)
    {
        return _offCycleRequestsByEvidence[evidenceId][index];
    }

    function listOffCycleRequests(uint256 evidenceId)
        external
        view
        evidenceExists(evidenceId)
        returns (uint256[] memory)
    {
        return _offCycleRequestsByEvidence[evidenceId];
    }

    function existsEvidence(uint256 evidenceId) external view returns (bool) {
        return _evidenceById[evidenceId].id != 0;
    }

    function companyOfEvidence(uint256 evidenceId) external view evidenceExists(evidenceId) returns (address) {
        return _evidenceById[evidenceId].company;
    }

    function statusOfEvidence(uint256 evidenceId)
        external
        view
        evidenceExists(evidenceId)
        returns (EvidenceTypes.EvidenceStatus)
    {
        return _evidenceById[evidenceId].status;
    }

    // Internal helper
    function _setStatus(uint256 evidenceId, EvidenceTypes.EvidenceStatus newStatus, string memory note) internal {
        EvidenceTypes.Evidence storage e = _evidenceById[evidenceId];
        EvidenceTypes.EvidenceStatus prev = e.status;
        e.status = newStatus;
        e.updatedAt = uint64(block.timestamp);

        emit EvidenceStatusChanged(evidenceId, prev, newStatus, msg.sender, note);
    }
}