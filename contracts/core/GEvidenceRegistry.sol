// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EvidenceTypes} from "./EvidenceTypes.sol";
import {RoleManager} from "./RoleManager.sol";

contract GEvidenceRegistry {
    using EvidenceTypes for EvidenceTypes.Evidence;

    RoleManager public immutable roles;

    uint256 private _nextEvidenceId = 1;

    mapping(uint256 => EvidenceTypes.Evidence) private _evidenceById;
    mapping(address => uint256[]) private _evidenceIdsByCompany;

    mapping(uint256 => uint256) public campaignOfEvidence;

    mapping(uint256 => uint256) public certificateTokenOfEvidence;

    mapping(uint256 => uint256[]) private _offCycleRequestsByEvidence;

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

    function adminSetStatus(uint256 evidenceId, EvidenceTypes.EvidenceStatus newStatus, string calldata note)
        external
        onlyAdmin
        evidenceExists(evidenceId)
    {
        _setStatus(evidenceId, newStatus, note);
    }

    function linkCampaign(uint256 evidenceId, uint256 campaignId)
    external
    evidenceExists(evidenceId)
    {
    if (campaignId == 0) revert ZeroValue();


    campaignOfEvidence[evidenceId] = campaignId;
    emit CampaignLinked(evidenceId, campaignId, msg.sender);
    }

    function linkCertificate(uint256 evidenceId, uint256 tokenId)
        external
        evidenceExists(evidenceId)
    {
        if (tokenId == 0) revert ZeroValue();
        if (certificateTokenOfEvidence[evidenceId] != 0) revert AlreadyLinked();

        certificateTokenOfEvidence[evidenceId] = tokenId;
        emit CertificateLinked(evidenceId, tokenId, msg.sender);
    }

    function recordOffCycleRequest(uint256 evidenceId, uint256 requestId)
        external
        evidenceExists(evidenceId)
    {
        if (requestId == 0) revert ZeroValue();

        _offCycleRequestsByEvidence[evidenceId].push(requestId);
        emit OffCycleRequestRecorded(evidenceId, requestId, msg.sender);
    }

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

    function _setStatus(uint256 evidenceId, EvidenceTypes.EvidenceStatus newStatus, string memory note) internal {
        EvidenceTypes.Evidence storage e = _evidenceById[evidenceId];
        EvidenceTypes.EvidenceStatus prev = e.status;
        e.status = newStatus;
        e.updatedAt = uint64(block.timestamp);

        emit EvidenceStatusChanged(evidenceId, prev, newStatus, msg.sender, note);
    }
}
