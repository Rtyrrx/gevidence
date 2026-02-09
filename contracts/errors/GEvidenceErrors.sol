// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library GEvidenceErrors {
    error NotAdmin();
    error NotCompany();
    error NotVerifier();
    error NotIoTOperator();
    error EvidenceNotFound();
    error NotEvidenceOwner();
    error InvalidStatus();
    error ZeroValue();
    error AlreadyCertified(); 
}

