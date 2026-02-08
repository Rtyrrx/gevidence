// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title RewardToken
 * @notice Internal reward token minted to contributors
 * @dev Minting is restricted to a single minter (crowdfunding contract)
 */
contract RewardToken is ERC20 {
    address public minter;

    event MinterChanged(address indexed oldMinter, address indexed newMinter);

    error NotMinter();
    error ZeroAddress();

    constructor(string memory name_, string memory symbol_, address minter_) ERC20(name_, symbol_) {
        if (minter_ == address(0)) revert ZeroAddress();
        minter = minter_;
    }

    modifier onlyMinter() {
        if (msg.sender != minter) revert NotMinter();
        _;
    }

    function setMinter(address newMinter) external onlyMinter {
        if (newMinter == address(0)) revert ZeroAddress();
        address old = minter;
        minter = newMinter;
        emit MinterChanged(old, newMinter);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
}