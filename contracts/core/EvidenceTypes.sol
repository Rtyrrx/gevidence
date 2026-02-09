// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
        bytes32 dataHash;      
        string uri;             
        EvidenceStatus status;
        uint64 createdAt;
        uint64 updatedAt;
    }

    struct MetricReading {
        uint32 metricId;       
        int256 value;          
        uint64 timestamp;      
    }

}
