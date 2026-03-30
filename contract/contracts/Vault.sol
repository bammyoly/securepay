// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool, InEuint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IcUSDC {
    function vaultTransfer(address to, uint256 amount) external;
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function burn(address from, uint256 amount) external;
}

/**
 * @title Vault
 * @notice FHE-encrypted payroll vault.
 *         Employer deposits cUSDC → encrypted balance stored on-chain.
 *         Payroll contract executes encrypted salary transfers from here.
 *         Employees can withdraw their received cUSDC back to plaintext.
 *
 * Flow:
 *   Employer: cUSDC.approve(vault) → vault.depositToVault(amount)
 *   Payroll:  vault.payrollTransfer(from, to, encAmount)
 *   Employee: vault.withdraw(amount, encAmount) → receives plain cUSDC
 */
contract Vault {

    IERC20   public immutable cusdc;
    address  public owner;
    address  public payroll;

    mapping(address => euint64) private _balances;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event PayrollSet(address indexed payroll);

    modifier onlyOwner() {
        require(msg.sender == owner, "Vault: not owner");
        _;
    }

    modifier onlyPayroll() {
        require(msg.sender == payroll, "Vault: not payroll");
        _;
    }

    constructor(address _cusdc) {
        require(_cusdc != address(0), "Vault: zero address");
        cusdc = IERC20(_cusdc);
        owner = msg.sender;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setPayroll(address _payroll) external onlyOwner {
        require(payroll == address(0), "Vault: payroll already set");
        require(_payroll != address(0), "Vault: zero address");
        payroll = _payroll;
        emit PayrollSet(_payroll);
    }

    // -------------------------------------------------------------------------
    // Internal: zero-initialise balance handle on first use
    // -------------------------------------------------------------------------

    function _getBalance(address user) internal returns (euint64) {
        if (euint64.unwrap(_balances[user]) == bytes32(0)) {
            euint64 zero = FHE.asEuint64(0);
            FHE.allowThis(zero);
            _balances[user] = zero;
        }
        return _balances[user];
    }

    // -------------------------------------------------------------------------
    // Deposit — employer moves cUSDC into encrypted vault balance
    // -------------------------------------------------------------------------

    /**
     * @notice Deposit `amount` cUSDC into the vault.
     *         Amount is encrypted inside the contract.
     *         Caller must approve this contract for `amount` cUSDC first.
     */
    function depositToVault(uint256 amount) external {
        require(amount > 0, "Vault: zero amount");
        require(amount <= type(uint64).max, "Vault: overflow");

        require(
            cusdc.transferFrom(msg.sender, address(this), amount),
            "Vault: cUSDC transfer failed"
        );

        euint64 encAmount = FHE.asEuint64(uint64(amount));
        FHE.allowThis(encAmount);

        euint64 newBal = FHE.add(_getBalance(msg.sender), encAmount);
        FHE.allowThis(newBal);
        FHE.allow(newBal, msg.sender);
        _balances[msg.sender] = newBal;

        emit Deposited(msg.sender, amount);
    }

    // -------------------------------------------------------------------------
    // Withdraw — user converts encrypted vault balance back to plain cUSDC
    // -------------------------------------------------------------------------

    /**
     * @notice Withdraw `amount` from encrypted vault balance back to cUSDC.
     * @param  amount          Plaintext amount (frontend reads from sealed balance).
     * @param  encryptedAmount FHE-encrypted version of amount from cofhejs.
     */
    function withdraw(uint256 amount, InEuint64 calldata encryptedAmount) external {
        require(amount > 0, "Vault: zero amount");
        require(amount <= type(uint64).max, "Vault: overflow");

        euint64 encAmt = FHE.asEuint64(encryptedAmount);
        FHE.allowThis(encAmt);

        euint64 bal = _getBalance(msg.sender);

        // Clamp to available balance — FHE.req not available in cofhe-contracts v0.1.1
        ebool sufficient  = FHE.lte(encAmt, bal);
        FHE.allowThis(sufficient);

        euint64 actualDebit = FHE.select(sufficient, encAmt, FHE.asEuint64(0));
        FHE.allowThis(actualDebit);

        euint64 newBal = FHE.sub(bal, actualDebit);
        FHE.allowThis(newBal);
        FHE.allow(newBal, msg.sender);
        _balances[msg.sender] = newBal;

        require(
            cusdc.transfer(msg.sender, amount),
            "Vault: cUSDC transfer failed"
        );

        emit Withdrawn(msg.sender, amount);
    }

    // -------------------------------------------------------------------------
    // Payroll transfer — called by ConfidentialPayroll
    // -------------------------------------------------------------------------

    /**
     * @notice Move encrypted salary from employer to employee.
     * @dev    encAmount handle must be FHE.allow'd to this contract
     *         by ConfidentialPayroll.paySalary() before this call.
     */
    function payrollTransfer(
        address from,
        address to,
        euint64 encAmount
    ) external onlyPayroll {
        euint64 fromBal = _getBalance(from);

        ebool sufficient = FHE.lte(encAmount, fromBal);
        FHE.allowThis(sufficient);

        euint64 actualDebit = FHE.select(sufficient, encAmount, FHE.asEuint64(0));
        FHE.allowThis(actualDebit);

        euint64 newFromBal = FHE.sub(fromBal, actualDebit);
        FHE.allowThis(newFromBal);
        FHE.allow(newFromBal, from);
        _balances[from] = newFromBal;

        euint64 newToBal = FHE.add(_getBalance(to), actualDebit);
        FHE.allowThis(newToBal);
        FHE.allow(newToBal, to);
        _balances[to] = newToBal;
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the raw ctHash handle.
     * @dev    Decrypt client-side: cofhejs.unseal(ctHash, FheTypes.Uint64)
     *         FHE.allow is set on deposit/payrollTransfer so the user can unseal.
     */
    function balanceOf(address user) external view returns (euint64) {
        return _balances[user];
    }
}
