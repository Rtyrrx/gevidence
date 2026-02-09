// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RoleManager} from "./RoleManager.sol";
import {EvidenceTypes} from "./EvidenceTypes.sol";

contract IoTOracleMock {
    RoleManager public immutable roles;
    mapping(uint256 => EvidenceTypes.MetricReading[]) private _readings;

    event ReadingPushed(
        uint256 indexed evidenceId,
        uint32 indexed metricId,
        int256 value,
        uint64 timestamp,
        address indexed operator
    );

    error NotIoTOperator();
    error ZeroEvidence();

    constructor(address roleManager) {
        require(roleManager != address(0), "IoTOracleMock: zero roleManager");
        roles = RoleManager(roleManager);
    }

    modifier onlyIoTOperator() {
        if (!roles.hasRole(roles.IOT_OPERATOR_ROLE(), msg.sender)) revert NotIoTOperator();
        _;
    }

    function pushReading(
        uint256 evidenceId,
        uint32 metricId,
        int256 value,
        uint64 timestamp
    ) external onlyIoTOperator {
        if (evidenceId == 0) revert ZeroEvidence();
        if (timestamp == 0) timestamp = uint64(block.timestamp);

        EvidenceTypes.MetricReading memory r = EvidenceTypes.MetricReading({
            metricId: metricId,
            value: value,
            timestamp: timestamp
        });

        _readings[evidenceId].push(r);

        emit ReadingPushed(evidenceId, metricId, value, timestamp, msg.sender);
    }

    function readingCount(uint256 evidenceId) external view returns (uint256) {
        return _readings[evidenceId].length;
    }

    function readingAt(uint256 evidenceId, uint256 index) external view returns (EvidenceTypes.MetricReading memory) {
        return _readings[evidenceId][index];
    }

    function listReadings(uint256 evidenceId) external view returns (EvidenceTypes.MetricReading[] memory) {
        return _readings[evidenceId];
    }

}
