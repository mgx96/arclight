// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUsyc
 * @author Malek Sharabi
 * @notice A 6 decimal ERC20 we use in tests to stand in for the yield bearing USYC token on Arc. The yield is modelled
 * by the teller's price rather than by the token itself, so this stays a plain mintable token.
 */
contract MockUsyc is ERC20 {
    constructor() ERC20("Mock USYC", "USYC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
