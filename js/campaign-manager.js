
const campaignManager = {
  campaigns: [],
  userContributions: {},

  getAllCampaigns: async () => {
    try {
      const response = await fetch('data/campaigns.json');
      if (!response.ok) {
        throw new Error('Failed to load campaigns data');
      }
      const data = await response.json();
      let campaigns = data.campaigns || [];

      const savedCampaigns = localStorage.getItem('gevidence_created_campaigns');
      if (savedCampaigns) {
        try {
          const userCampaigns = JSON.parse(savedCampaigns);
          campaigns = [...campaigns, ...userCampaigns];
        } catch (e) {
          console.warn('Could not parse saved campaigns:', e);
        }
      }

      const campaignStates = JSON.parse(localStorage.getItem('gevidence_campaign_states') || '{}');

      campaignManager.campaigns = campaigns.map((campaign, index) => {
        let raisedWei = campaign.raisedWei;

        if (campaignStates[campaign.id]) {
          const campaignState = campaignStates[campaign.id];
          if (campaignState.raisedWei) {
            raisedWei = campaignState.raisedWei;
          }
          if (campaignState.finalized !== undefined) {
            campaign.finalized = campaignState.finalized;
          }
          if (campaignState.successful !== undefined) {
            campaign.successful = campaignState.successful;
          }
        }

        return {
          id: Number(campaign.id),
          evidenceId: Number(campaign.evidenceId),
          title: campaign.title,
          goalWei: campaign.goalWei,
          raisedWei: raisedWei,
          deadline: Number(campaign.deadline),
          finalized: campaign.finalized,
          successful: campaign.successful,
          progress: campaignManager.calculateProgress(raisedWei, campaign.goalWei),
          timeRemaining: utils.formatCountdown(Number(campaign.deadline)),
          isExpired: Number(campaign.deadline) < Math.floor(Date.now() / 1000),
          goalDisplay: utils.formatEth(campaign.goalWei),
          raisedDisplay: utils.formatEth(raisedWei),
          status: campaign.finalized
            ? (campaign.successful ? 'Completed' : 'Failed')
            : 'Active'
        };
      });

      return campaignManager.campaigns;
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      utils.showError('Failed to load campaigns: ' + error.message);
      return [];
    }
  },

  getCampaignById: async (campaignId) => {
    try {
      if (campaignManager.campaigns.length === 0) {
        await campaignManager.getAllCampaigns();
      }

      const campaign = campaignManager.campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      return campaign;
    } catch (error) {
      console.error('Error fetching campaign:', error);
      throw error;
    }
  },

  calculateProgress: (raised, goal) => {
    if (goal === 0n || goal === 0) return 0;
    const raisedNum = typeof raised === 'bigint' ? Number(raised) : raised;
    const goalNum = typeof goal === 'bigint' ? Number(goal) : goal;
    return Math.min(100, Math.round((raisedNum / goalNum) * 100));
  },

  contributeToCampaign: async (campaignId, ethAmount) => {
    try {
      console.log('ContributeToCampaign called with:', { campaignId, ethAmount });

      if (!utils.isValidEthAmount(ethAmount)) {
        throw new Error('Invalid ETH amount. Minimum 0.001 ETH');
      }

      const account = walletManager.getCurrentAccount();
      console.log('Current account:', account);
      if (!account) {
        throw new Error('Wallet not connected');
      }

      console.log('Checking campaign expiration...');
      const campaign = await campaignManager.getCampaignById(campaignId);
      if (campaign.isExpired) {
        throw new Error('Campaign has ended');
      }

      const weiAmount = web3Config.ethToWei(ethAmount);
      console.log('Wei amount:', weiAmount.toString());

      const reward = campaignManager.calculateReward(weiAmount);
      console.log('Calculated reward:', reward, 'tokens');

      utils.showToast(`Contributing ${ethAmount} ETH - opening MetaMask...`, 'info');

      console.log('Getting signer from MetaMask...');
      const signer = await web3Config.getSigner();
      console.log('Got signer, preparing contract call...');

      const contract = web3Config.getContract('VerificationCrowdfund', signer);
      console.log('Contract instance created, calling contribute()...');

      const tx = await contract.contribute(campaignId, { value: weiAmount });
      console.log('Transaction sent:', tx.hash);

      utils.showToast('Transaction submitted. Waiting for confirmation...', 'info');

      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      contributionTracker.recordContribution(account, campaignId, ethAmount);

      const oldCampaign = campaignManager.campaigns.find(c => c.id === campaignId);
      if (oldCampaign) {
        const newRaisedWei = BigInt(oldCampaign.raisedWei) + BigInt(weiAmount.toString());

        campaignManager.campaigns = campaignManager.campaigns.map(c =>
          c.id === campaignId
            ? {
                ...c,
                raisedWei: newRaisedWei.toString(),
                progress: campaignManager.calculateProgress(newRaisedWei.toString(), c.goalWei)
              }
            : c
        );

        const campaignStates = JSON.parse(localStorage.getItem('gevidence_campaign_states') || '{}');

        const hasReachedGoal = newRaisedWei >= BigInt(oldCampaign.goalWei);

        campaignStates[campaignId] = {
          raisedWei: newRaisedWei.toString(),
          finalized: hasReachedGoal ? true : oldCampaign.finalized,
          successful: hasReachedGoal ? true : oldCampaign.successful
        };
        localStorage.setItem('gevidence_campaign_states', JSON.stringify(campaignStates));

        campaignManager.campaigns = campaignManager.campaigns.map(c =>
          c.id === campaignId
            ? {
                ...c,
                finalized: hasReachedGoal ? true : c.finalized,
                successful: hasReachedGoal ? true : c.successful,
                status: hasReachedGoal ? 'Completed' : c.status
              }
            : c
        );

        if (hasReachedGoal) {
          console.log(`Campaign ${campaignId} COMPLETED! Goal of ${web3Config.weiToEth(oldCampaign.goalWei)} ETH reached. Total raised: ${web3Config.weiToEth(newRaisedWei.toString())} ETH`);
        } else {
          console.log(`Campaign ${campaignId} updated: Raised ${web3Config.weiToEth(newRaisedWei.toString())} ETH`);
        }
      }

      utils.showSuccess(`Contribution successful! You earned ${reward} reward tokens.`);

      return receipt;
    } catch (error) {
      console.error('Error contributing to campaign:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      throw error;
    }
  },

  getUserContribution: async (userAddress, campaignId) => {
    try {
      const contract = web3Config.getContract('VerificationCrowdfund');
      const weiAmount = await contract.getUserContributions(userAddress, campaignId);
      return web3Config.weiToEth(weiAmount);
    } catch (error) {
      console.warn('Contract call failed, using localStorage:', error.message);
      return contributionTracker.getUserContribution(userAddress, campaignId);
    }
  },

  getCampaignContributors: async (campaignId) => {
    try {
      const contract = web3Config.getContract('VerificationCrowdfund');
      const [addresses, amounts] = await contract.getCampaignContributors(campaignId);

      return addresses.map((address, index) => ({
        address: utils.formatAddress(address),
        fullAddress: address,
        contribution: utils.formatEth(amounts[index]),
        contributionWei: amounts[index].toString()
      }));
    } catch (error) {
      console.warn('Contract call failed, using localStorage:', error.message);
      const contributions = contributionTracker.getCampaignContributions(campaignId);
      return contributions.map(contrib => ({
        address: utils.formatAddress(contrib.userAddress || contrib.user),
        fullAddress: contrib.userAddress || contrib.user,
        contribution: utils.formatEth(contrib.amountWei),
        contributionWei: contrib.amountWei,
        timestamp: contrib.timestamp
      }));
    }
  },

  calculateReward: (weiAmount) => {
    try {
      const reward = web3Config.calculateReward(
        typeof weiAmount === 'string' ? BigInt(weiAmount) : weiAmount
      );
      const rewardNum = typeof reward === 'bigint' ? Number(reward) : reward;
      return utils.formatNumber(rewardNum);
    } catch (e) {
      return '0';
    }
  },

  createCampaign: async (evidenceId, title, goalEth, deadlineTimestamp) => {
    try {
      if (!title || title.trim().length === 0) {
        throw new Error('Campaign title is required');
      }

      if (!utils.isPositiveNumber(goalEth)) {
        throw new Error('Goal amount must be positive');
      }

      if (!utils.isValidDeadline(deadlineTimestamp)) {
        throw new Error('Deadline must be at least 1 day in future');
      }

      const account = walletManager.getCurrentAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      const goalWei = web3Config.ethToWei(goalEth);

      utils.showToast('Creating campaign...', 'info');

      const newCampaignId = Math.floor(Date.now() / 1000); // Use timestamp as unique ID
      const newCampaign = {
        id: newCampaignId,
        evidenceId: parseInt(evidenceId),
        title: title.trim(),
        goalWei: goalWei.toString(),
        raisedWei: '0',
        deadline: deadlineTimestamp,
        finalized: false,
        successful: false,
        createdAt: Math.floor(Date.now() / 1000)
      };

      let savedCampaigns = [];
      const saved = localStorage.getItem('gevidence_created_campaigns');
      if (saved) {
        try {
          savedCampaigns = JSON.parse(saved);
        } catch (e) {
          console.warn('Could not parse saved campaigns:', e);
          savedCampaigns = [];
        }
      }

      savedCampaigns.push(newCampaign);

      localStorage.setItem('gevidence_created_campaigns', JSON.stringify(savedCampaigns));

      utils.showSuccess('Campaign created successfully!');

      return newCampaignId;
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }
  },

  finalizeCampaign: async (campaignId) => {
    try {
      const account = walletManager.getCurrentAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      utils.showToast('Finalizing campaign...', 'info');

      const receipt = await walletManager.executeContractFunction(
        'VerificationCrowdfund',
        'finalize',
        [campaignId]
      );

      return receipt;
    } catch (error) {
      console.error('Error finalizing campaign:', error);
      throw error;
    }
  },

  withdrawCampaignFunds: async (campaignId) => {
    try {
      const account = walletManager.getCurrentAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      utils.showToast('Withdrawing campaign funds...', 'info');

      const receipt = await walletManager.executeContractFunction(
        'VerificationCrowdfund',
        'withdraw',
        [campaignId]
      );

      return receipt;
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      throw error;
    }
  },

  refundContribution: async (campaignId) => {
    try {
      const account = walletManager.getCurrentAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      const confirmed = confirm('Refund your contribution from this failed campaign?');
      if (!confirmed) return null;

      utils.showToast('Processing refund...', 'info');

      const receipt = await walletManager.executeContractFunction(
        'VerificationCrowdfund',
        'refund',
        [campaignId]
      );

      utils.showSuccess('Refund completed!');
      return receipt;
    } catch (error) {
      console.error('Error refunding contribution:', error);
      throw error;
    }
  },

  getDisplayCampaigns: () => {
    return campaignManager.campaigns;
  },

  filterByStatus: (status) => {
    return campaignManager.campaigns.filter(c => c.status === status);
  },

  searchCampaigns: (searchTerm) => {
    const term = searchTerm.toLowerCase();
    return campaignManager.campaigns.filter(c =>
      c.title.toLowerCase().includes(term)
    );
  }
};

window.campaignManager = campaignManager;

console.log('Campaign Manager initialized');
