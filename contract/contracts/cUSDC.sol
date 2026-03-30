// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title cUSDC
 * @notice Plain ERC20 wrapper for Circle USDC.
 *         1 cUSDC = 1 USDC always.
 *         No FHE here — FHE encryption happens in the Vault.
 *
 * Flow: Circle USDC → wrap() → cUSDC (visible ERC20 balance)
 *       cUSDC → unwrap() → Circle USDC
 *       cUSDC → Vault.depositToVault() → encrypted vault balance
 */
contract cUSDC is ERC20 {

    IERC20 public immutable usdc;
    address public owner;
    address public vault; // set after Vault deployment

    event VaultSet(address indexed vault);

    modifier onlyOwner() {
        require(msg.sender == owner, "cUSDC: not owner");
        _;
    }

    constructor(address _usdc) ERC20("Confidential USDC", "cUSDC") {
        require(_usdc != address(0), "cUSDC: zero address");
        usdc  = IERC20(_usdc);
        owner = msg.sender;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setVault(address _vault) external onlyOwner {
        require(vault == address(0), "cUSDC: vault already set");
        require(_vault != address(0), "cUSDC: zero address");
        vault = _vault;
        emit VaultSet(_vault);
    }

    // -------------------------------------------------------------------------
    // Wrap — Circle USDC → cUSDC (1:1)
    // -------------------------------------------------------------------------

    /**
     * @notice Wrap `amount` Circle USDC into cUSDC.
     *         Caller must approve this contract for `amount` USDC first.
     */
    function wrap(uint256 amount) external {
        require(amount > 0, "cUSDC: zero amount");
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "cUSDC: USDC transfer failed"
        );
        _mint(msg.sender, amount);
    }

    // -------------------------------------------------------------------------
    // Unwrap — cUSDC → Circle USDC (1:1)
    // -------------------------------------------------------------------------

    /**
     * @notice Unwrap `amount` cUSDC back into Circle USDC.
     */
    function unwrap(uint256 amount) external {
        require(amount > 0, "cUSDC: zero amount");
        _burn(msg.sender, amount);
        require(
            usdc.transfer(msg.sender, amount),
            "cUSDC: USDC transfer failed"
        );
    }

    // -------------------------------------------------------------------------
    // Vault transfer — called by Vault contract when employees withdraw
    // -------------------------------------------------------------------------

    /**
     * @notice Transfer cUSDC from vault to a recipient (employee unwrap).
     * @dev    Only callable by the Vault contract.
     */
    function vaultTransfer(address to, uint256 amount) external {
        require(msg.sender == vault, "cUSDC: not vault");
        require(amount > 0, "cUSDC: zero amount");
        _mint(to, amount); // mint to employee — vault holds the USDC backing
    }
}
