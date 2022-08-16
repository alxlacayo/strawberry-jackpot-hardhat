// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract Strawberry is ERC20Burnable {
    constructor(address user) ERC20("Strawberry", "STRAWBERRY") {
        _mint(user, 500 ether);
    }
}
