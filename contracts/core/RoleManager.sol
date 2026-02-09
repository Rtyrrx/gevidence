// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract RoleManager is AccessControl {
    bytes32 public constant ADMIN_ROLE        = keccak256("ADMIN_ROLE");
    bytes32 public constant COMPANY_ROLE      = keccak256("COMPANY_ROLE");
    bytes32 public constant VERIFIER_ROLE     = keccak256("VERIFIER_ROLE");
    bytes32 public constant IOT_OPERATOR_ROLE = keccak256("IOT_OPERATOR_ROLE");

    event AdminGranted(address indexed account);
    event AdminRevoked(address indexed account);
    event CompanyGranted(address indexed account);
    event CompanyRevoked(address indexed account);
    event VerifierGranted(address indexed account);
    event VerifierRevoked(address indexed account);
    event IoTOperatorGranted(address indexed account);
    event IoTOperatorRevoked(address indexed account);

    constructor(address initialAdmin) {
        require(initialAdmin != address(0), "RoleManager: zero admin");

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ADMIN_ROLE, initialAdmin);
        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(COMPANY_ROLE, ADMIN_ROLE);
        _setRoleAdmin(VERIFIER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(IOT_OPERATOR_ROLE, ADMIN_ROLE);

        emit AdminGranted(initialAdmin);
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "RoleManager: not admin");
        _;
    }

    function grantAdmin(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ADMIN_ROLE, account);
        emit AdminGranted(account);
    }

    function revokeAdmin(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ADMIN_ROLE, account);
        emit AdminRevoked(account);
    }

    function grantCompany(address account) external onlyAdmin {
        _grantRole(COMPANY_ROLE, account);
        emit CompanyGranted(account);
    }

    function revokeCompany(address account) external onlyAdmin {
        _revokeRole(COMPANY_ROLE, account);
        emit CompanyRevoked(account);
    }

    function grantVerifier(address account) external onlyAdmin {
        _grantRole(VERIFIER_ROLE, account);
        emit VerifierGranted(account);
    }

    function revokeVerifier(address account) external onlyAdmin {
        _revokeRole(VERIFIER_ROLE, account);
        emit VerifierRevoked(account);
    }

    function grantIoTOperator(address account) external onlyAdmin {
        _grantRole(IOT_OPERATOR_ROLE, account);
        emit IoTOperatorGranted(account);
    }

    function revokeIoTOperator(address account) external onlyAdmin {
        _revokeRole(IOT_OPERATOR_ROLE, account);
        emit IoTOperatorRevoked(account);
    }
}

