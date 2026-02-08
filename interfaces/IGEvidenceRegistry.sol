// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EvidenceTypes} from "../core/EvidenceTypes.sol";

/**
 * @title IGEvidenceRegistry
 * @notice Minimal interface for GEvidenceRegistry used by modules + frontend
 */
interface IGEvidenceRegistry {
    // --- Core reads ---
    function existsEvidence(uint256 evidenceId) external view returns (bool);

    function getEvidence(uint256 evidenceId) external view returns (EvidenceTypes.Evidence memory);

    function companyOfEvidence(uint256 evidenceId) external view returns (address);

    function statusOfEvidence(uint256 evidenceId) external view returns (EvidenceTypes.EvidenceStatus);

    // Mappings exposed as getter functions (Solidity auto-getters)
    function campaignOfEvidence(uint256 evidenceId) external view returns (uint256);

    function certificateTokenOfEvidence(uint256 evidenceId) external view returns (uint256);

    // --- Cross-module links (important for integrations) ---

    /**
     * @notice Link or update the latest campaignId for an evidenceId
     * @dev With community campaigns, evidence may have multiple campaigns over time
     */
    function linkCampaign(uint256 evidenceId, uint256 campaignId) external;

    /**
     * @notice Link minted certificate tokenId for an evidenceId (typically 1 per evidence)
     */
    function linkCertificate(uint256 evidenceId, uint256 tokenId) external;

    /**
     * @notice Record an off-cycle check requestId for an evidenceId
     */
    function recordOffCycleRequest(uint256 evidenceId, uint256 requestId) external;

    // Optional convenience reads for frontend
    function listOffCycleRequests(uint256 evidenceId) external view returns (uint256[] memory);

    function offCycleRequestCount(uint256 evidenceId) external view returns (uint256);

    function offCycleRequestIdAt(uint256 evidenceId, uint256 index) external view returns (uint256);
}