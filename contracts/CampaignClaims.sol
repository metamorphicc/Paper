// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice One immutable campaign, funded by its publisher. No user deposits or mint.
contract CampaignClaims is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable token;
    bytes32 public immutable merkleRoot;
    bytes32 public immutable campaignId;
    uint256 public immutable budget;
    uint256 public immutable deadline;
    address public immutable recovery;
    uint256 public totalClaimed;
    mapping(uint256 => bool) public claimed;
    event Claimed(uint256 indexed index, address indexed account, uint256 amount);
    event Recovered(uint256 amount);

    constructor(IERC20 token_, bytes32 root_, bytes32 campaign_, uint256 budget_, uint256 deadline_, address recovery_) {
        require(address(token_) != address(0) && root_ != bytes32(0) && campaign_ != bytes32(0), "Invalid campaign");
        require(budget_ > 0 && deadline_ > block.timestamp && recovery_ != address(0), "Invalid limits");
        token = token_; merkleRoot = root_; campaignId = campaign_; budget = budget_; deadline = deadline_; recovery = recovery_;
    }

    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata proof) external nonReentrant {
        require(block.timestamp <= deadline && !claimed[index], "Expired or claimed");
        require(account != address(0) && amount > 0 && totalClaimed + amount <= budget, "Invalid amount");
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(block.chainid, address(this), campaignId, index, account, amount))));
        require(MerkleProof.verifyCalldata(proof, merkleRoot, leaf), "Invalid proof");
        claimed[index] = true;
        totalClaimed += amount;
        token.safeTransfer(account, amount);
        emit Claimed(index, account, amount);
    }

    function recoverExpired() external nonReentrant {
        require(block.timestamp > deadline && msg.sender == recovery, "Recovery unavailable");
        uint256 amount = token.balanceOf(address(this));
        token.safeTransfer(recovery, amount);
        emit Recovered(amount);
    }
}
