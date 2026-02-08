// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CrowdfundErrors
 * @notice Custom errors for crowdfunding module
 * @dev Use: revert CrowdfundErrors.CampaignNotFound();
 */
library CrowdfundErrors {
    // Common
    error ZeroValue();
    error TransferFailed();

    // Campaign / evidence
    error CampaignNotFound();
    error EvidenceNotFound();

    // Timing / lifecycle
    error DeadlinePassed();
    error CampaignActive();      // used when action requires ended campaign
    error AlreadyFinalized();

    // Access / permissions
    error NotAuthorized();       // e.g. only admin/treasury allowed

    // Funds logic
    error NothingToWithdraw();
    error NothingToRefund();

    // Anti-spam / constraints (optional)
    error GoalTooSmall();
    error DurationTooShort();
    error ActiveCampaignExists();
}