// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @notice Fixed initial supply, no privileged mint, upgrade, tax or pause.
contract ClubToken is ERC20Burnable {
    uint256 public immutable cap;
    constructor(string memory name_, string memory symbol_, uint256 cap_, address[] memory recipients, uint256[] memory allocations)
        ERC20(name_, symbol_)
    {
        require(cap_ > 0 && recipients.length > 0 && recipients.length == allocations.length, "Invalid allocation");
        cap = cap_;
        uint256 sum;
        for (uint256 i; i < recipients.length; ++i) {
            require(recipients[i] != address(0) && allocations[i] > 0, "Invalid recipient");
            sum += allocations[i];
            _mint(recipients[i], allocations[i]);
        }
        require(sum == cap_, "Cap mismatch");
    }
}
