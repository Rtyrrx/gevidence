// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EvidenceTypes
 * @notice Shared types for GEvidence core
 */
library EvidenceTypes {
    enum EvidenceStatus {
        Draft,
        Submitted,
        UnderReview,
        Verified,
        Rejected
    }

    struct Evidence {
        uint256 id;
        address company;
        bytes32 dataHash;       // hash of report/dataset
        string uri;             // off-chain pointer (IPFS/HTTPS)
        EvidenceStatus status;
        uint64 createdAt;
        uint64 updatedAt;
    }

    struct MetricReading {
        uint32 metricId;        // e.g. 1=CO2,2=PM2.5,...
        int256 value;           // scaled value (your choice)
        uint64 timestamp;       // unix seconds
    }
}