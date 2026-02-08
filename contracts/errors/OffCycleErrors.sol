// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OffCycleErrors
 * @notice Custom errors for off-cycle verification module
 * @dev Use: revert OffCycleErrors.RequestNotFound();
 */
library OffCycleErrors {
    // Common
    error ZeroAddress();
    error NotAuthorized();
    error TokenTransferFailed();

    // Evidence
    error EvidenceNotFound();
    error EvidenceNotVerified();

    // Requests
    error RequestNotFound();
    error NotPending();
    error StakeTooLow();
}