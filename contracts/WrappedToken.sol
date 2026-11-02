// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title WrappedToken
 * @notice ERC-20 wrapped token with role-based mint and burn capabilities.
 */
contract WrappedToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @notice Initializes token name, symbol, and default admin.
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     * @param admin The admin address receiving DEFAULT_ADMIN_ROLE.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address admin
    ) ERC20(name_, symbol_) {
        require(admin != address(0), "PG:ZERO_ADDR");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Mints wrapped tokens to a recipient.
     * @param to The recipient address.
     * @param amount The amount to mint.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Burns wrapped tokens from an account.
     * @param from The account whose tokens are burned.
     * @param amount The amount to burn.
     */
    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }
}

