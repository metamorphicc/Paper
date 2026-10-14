// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Immutable spend limits; deployment must use a reviewed multisig operator.
/// @dev Transfers do not attest to revenue, swaps or burns; receipts must be reconciled separately.
contract TreasuryBudget is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable asset;
    address public immutable operator;
    uint256 public immutable reserve;
    uint256 public immutable dailyLimit;
    mapping(address => bool) public destinationAllowed;
    uint256 public period;
    uint256 public spent;
    event Spent(address indexed destination, uint256 amount, bytes32 indexed purpose);

    constructor(IERC20 asset_, address operator_, uint256 reserve_, uint256 dailyLimit_, address[] memory destinations) {
        require(address(asset_) != address(0) && operator_ != address(0) && dailyLimit_ > 0 && destinations.length > 0, "Invalid policy");
        asset = asset_; operator = operator_; reserve = reserve_; dailyLimit = dailyLimit_;
        for (uint256 i; i < destinations.length; ++i) {
            require(destinations[i] != address(0), "Invalid destination");
            destinationAllowed[destinations[i]] = true;
        }
    }

    function spend(address destination, uint256 amount, bytes32 purpose) external nonReentrant {
        require(msg.sender == operator && destinationAllowed[destination], "Not authorized");
        require(amount > 0 && purpose != bytes32(0), "Invalid spend");
        uint256 day = block.timestamp / 1 days;
        if (period != day) { period = day; spent = 0; }
        require(spent + amount <= dailyLimit, "Daily limit");
        uint256 balance = asset.balanceOf(address(this));
        require(balance >= reserve && amount <= balance - reserve, "Reserve floor");
        spent += amount;
        asset.safeTransfer(destination, amount);
        emit Spent(destination, amount, purpose);
    }
}
