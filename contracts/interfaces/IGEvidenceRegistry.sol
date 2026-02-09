// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EvidenceTypes} from "../core/EvidenceTypes.sol";

interface IGEvidenceRegistry {
    function existsEvidence(uint256 evidenceId) external view returns (bool);
    function getEvidence(uint256 evidenceId) external view returns (EvidenceTypes.Evidence memory);
    function companyOfEvidence(uint256 evidenceId) external view returns (address);
    function statusOfEvidence(uint256 evidenceId) external view returns (EvidenceTypes.EvidenceStatus);
    function campaignOfEvidence(uint256 evidenceId) external view returns (uint256);
    function certificateTokenOfEvidence(uint256 evidenceId) external view returns (uint256);
    function linkCampaign(uint256 evidenceId, uint256 campaignId) external;
    function linkCertificate(uint256 evidenceId, uint256 tokenId) external;
    function recordOffCycleRequest(uint256 evidenceId, uint256 requestId) external;
    function listOffCycleRequests(uint256 evidenceId) external view returns (uint256[] memory);
    function offCycleRequestCount(uint256 evidenceId) external view returns (uint256);
    function offCycleRequestIdAt(uint256 evidenceId, uint256 index) external view returns (uint256);
}
