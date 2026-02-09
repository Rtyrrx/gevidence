// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library OffCycleErrors {
    error ZeroAddress();
    error NotAuthorized();
    error TokenTransferFailed();
    error EvidenceNotFound();
    error EvidenceNotVerified();
    error RequestNotFound();
    error NotPending();
    error StakeTooLow();
}
