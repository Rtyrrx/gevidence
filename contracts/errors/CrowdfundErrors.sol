// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library CrowdfundErrors {
    error ZeroValue();
    error TransferFailed();
    error CampaignNotFound();
    error EvidenceNotFound();
    error DeadlinePassed();
    error CampaignActive();      
    error AlreadyFinalized();
    error NotAuthorized();       
    error NothingToWithdraw();
    error NothingToRefund();
    error GoalTooSmall();
    error DurationTooShort();
    error ActiveCampaignExists();
}
