// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library RewardMath {
    function calcReward(uint256 valueWei, uint256 rate) internal pure returns (uint256 rewardAmount) {
        rewardAmount = (valueWei * rate) / 1e18;
    }
}
