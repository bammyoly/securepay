// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, InEuint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

interface IVault {
    function payrollTransfer(address from, address to, euint64 amount) external;
}

/**
 * @title ConfidentialPayroll
 * @notice Stores encrypted salaries and executes payroll via the Vault.
 *
 * Authorization model:
 *   - No on-chain employer registry. Any wallet can call these functions.
 *   - Access control is enforced off-chain by the backend (JWT + employers table).
 *   - The Vault's onlyPayroll modifier is the true financial guard — only this
 *     contract can move funds out of the Vault.
 *   - Each caller's employees are stored under their own address, so wallets
 *     are naturally isolated from each other's data.
 */
contract ConfidentialPayroll {

    IVault public vault;

    struct Employee {
        bool    active;
        euint64 salary;
    }

    // caller (employer wallet) => employee => Employee
    mapping(address => mapping(address => Employee)) private _employees;

    event EmployeeAdded(address indexed employer, address indexed employee);
    event EmployeeDeactivated(address indexed employer, address indexed employee);
    event SalaryUpdated(address indexed employer, address indexed employee);
    event SalaryPaid(address indexed employer, address indexed employee);
    event BatchPaid(address indexed employer, uint256 count);

    constructor(address _vault) {
        require(_vault != address(0), "Payroll: zero vault address");
        vault = IVault(_vault);
    }

    // -------------------------------------------------------------------------
    // Employee management
    // -------------------------------------------------------------------------

    function addEmployee(
        address employee,
        InEuint64 calldata encryptedSalary
    ) external {
        require(employee != address(0), "Payroll: zero address");

        euint64 salary = FHE.asEuint64(encryptedSalary);
        FHE.allowThis(salary);
        FHE.allow(salary, msg.sender);

        _employees[msg.sender][employee] = Employee({ active: true, salary: salary });
        emit EmployeeAdded(msg.sender, employee);
    }

    function updateSalary(
        address employee,
        InEuint64 calldata encryptedSalary
    ) external {
        require(_employees[msg.sender][employee].active, "Payroll: not active");

        euint64 salary = FHE.asEuint64(encryptedSalary);
        FHE.allowThis(salary);
        FHE.allow(salary, msg.sender);

        _employees[msg.sender][employee].salary = salary;
        emit SalaryUpdated(msg.sender, employee);
    }

    function deactivateEmployee(address employee) external {
        require(_employees[msg.sender][employee].active, "Payroll: already inactive");
        _employees[msg.sender][employee].active = false;
        emit EmployeeDeactivated(msg.sender, employee);
    }

    // -------------------------------------------------------------------------
    // Payroll execution
    // -------------------------------------------------------------------------

    function paySalary(address employee) external {
        Employee storage emp = _employees[msg.sender][employee];
        require(emp.active, "Payroll: not active");

        FHE.allow(emp.salary, address(vault));
        vault.payrollTransfer(msg.sender, employee, emp.salary);
        emit SalaryPaid(msg.sender, employee);
    }

    function payBatch(address[] calldata employees) external {
        uint256 len = employees.length;
        require(len > 0, "Payroll: empty batch");

        for (uint256 i = 0; i < len; i++) {
            Employee storage emp = _employees[msg.sender][employees[i]];
            require(emp.active, "Payroll: inactive in batch");

            FHE.allow(emp.salary, address(vault));
            vault.payrollTransfer(msg.sender, employees[i], emp.salary);
            emit SalaryPaid(msg.sender, employees[i]);
        }
        emit BatchPaid(msg.sender, len);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function isActive(address employer, address employee)
        external view returns (bool)
    {
        return _employees[employer][employee].active;
    }

    function salaryOf(address employee)
        external view returns (euint64)
    {
        require(_employees[msg.sender][employee].active, "Payroll: not active");
        return _employees[msg.sender][employee].salary;
    }
}
