// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GEvidenceErrors
 * @notice Custom errors for GEvidence core contracts
 * @dev Use: revert GEvidenceErrors.EvidenceNotFound();
 */
library GEvidenceErrors {
    // Auth / roles
    error NotAdmin();
    error NotCompany();
    error NotVerifier();
    error NotIoTOperator();

    // Evidence
    error EvidenceNotFound();
    error NotEvidenceOwner();
    error InvalidStatus();
    error ZeroValue();

    // Linking / relations
    error AlreadyCertified(); // certificate already linked for evidence
}