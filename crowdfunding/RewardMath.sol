// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RewardMath
 * @notice Pure helpers for reward calculations
 */
library RewardMath {
    /**
     * @notice Calculate reward tokens based on contribution value
     * @param valueWei msg.value in wei
     * @param rate Reward tokens per 1 ETH (1e18 wei)
     * @return rewardAmount Amount of tokens (assumes token has 18 decimals)
     */
    function calcReward(uint256 valueWei, uint256 rate) internal pure returns (uint256 rewardAmount) {
        // reward = valueWei * rate / 1e18
        rewardAmount = (valueWei * rate) / 1e18;
    }
}