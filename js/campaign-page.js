
$(document).ready(async function() {
    const params = new URLSearchParams(window.location.search);
    const campaignId = parseInt(params.get('id'));

    let account = walletManager.getCurrentAccount();
    if (!account) {
        account = await walletManager.autoReconnect();
        if (!account) {
            utils.showError('Please connect your wallet first');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }
    }

    if (!campaignId) {
        utils.showError('Campaign not found');
        setTimeout(() => window.location.href = 'dashboard.html', 2000);
        return;
    }

    await loadCampaignDetails(campaignId);

    $('#contributionForm').on('submit', async function(e) {
        e.preventDefault();
        await handleContribution(campaignId, account);
    });

    $('#amountInput').on('input', function() {
        const ethAmount = $(this).val();
        if (utils.isValidEthAmount(ethAmount)) {
            const weiAmount = web3Config.ethToWei(ethAmount);
            const reward = campaignManager.calculateReward(weiAmount);
            $('#estimatedRewardDisplay').text(reward + ' tokens');
        } else {
            $('#estimatedRewardDisplay').text('0 tokens');
        }
    });
});

async function loadCampaignDetails(campaignId) {
    try {
        const campaign = await campaignManager.getCampaignById(campaignId);

        $('#campaignTitle').text(campaign.title);
        $('#campaignGoal').text(campaign.goalDisplay);
        $('#campaignRaised').text(campaign.raisedDisplay);
        $('#progressBar').css('width', campaign.progress + '%').text(campaign.progress + '%');
        $('#campaignDeadline').text(utils.formatDate(campaign.deadline));
        $('#campaignCountdown').text(campaign.timeRemaining);
        $('#campaignStatus').text(`Deadline: ${utils.formatDate(campaign.deadline)}`);
        $('#evidenceInfo').text(`Evidence ID: ${campaign.evidenceId}`);

        const badgeClass = campaign.status === 'Active'
            ? 'success'
            : (campaign.status === 'Completed' ? 'info' : 'danger');
        $('#campaignBadge').removeClass('bg-success bg-info bg-danger').addClass(`bg-${badgeClass}`).text(campaign.status);

        if (campaign.isExpired) {
            $('#contributeButton').prop('disabled', true).text('Campaign Ended');
            $('#amountInput').prop('disabled', true);
        }

        const account = walletManager.getCurrentAccount();
        if (account) {
            const userContrib = await campaignManager.getUserContribution(account, campaignId);
            if (userContrib !== '0') {
                $('#userContribution').text(userContrib + ' ETH');
                const weiAmount = web3Config.ethToWei(userContrib);
                const rewards = campaignManager.calculateReward(weiAmount);
                $('#userRewards').text(rewards + ' tokens');
            }
        }

        const contributors = await campaignManager.getCampaignContributors(campaignId);
        $('#contributorCount').text(contributors.length);

        if (contributors.length > 0) {
            let html = '';
            contributors.slice(0, 10).forEach(contrib => {
                html += `
                    <div class="contributor-item">
                        <div class="d-flex justify-content-between">
                            <span>${contrib.address}</span>
                            <small class="text-ge-green fw-bold">${contrib.contribution}</small>
                        </div>
                    </div>
                `;
            });
            if (contributors.length > 10) {
                html += `<div class="contributor-item text-muted">+ ${contributors.length - 10} more contributors</div>`;
            }
            $('#contributorsList').html(html);
        } else {
            $('#contributorsList').html('<p class="text-muted">No contributions yet. Be the first!</p>');
        }
    } catch (error) {
        console.error('Campaign load error:', error);
        utils.showError('Failed to load campaign details');
        setTimeout(() => window.location.href = 'dashboard.html', 2000);
    }
}

async function handleContribution(campaignId, account) {
    try {
        if (!account) {
            utils.showError('Wallet not connected');
            return;
        }

        const ethAmount = $('#amountInput').val();

        if (!utils.isValidEthAmount(ethAmount)) {
            utils.showError('Please enter a valid amount (minimum 0.001 ETH)');
            return;
        }

        if (!window.ethereum) {
            utils.showError('MetaMask is not installed. Please install it first.');
            return;
        }

        $('#contributeButton').prop('disabled', true).text('Processing...');

        try {
            await campaignManager.contributeToCampaign(campaignId, ethAmount);

            await loadCampaignDetails(campaignId);

            $('#amountInput').val('0.1');
            $('#estimatedRewardDisplay').text('100 tokens');

            utils.showSuccess('Contribution successful!');
            $('#contributeButton').prop('disabled', false).text('Contribute Now');
        } catch (innerError) {
            console.error('Contribution transaction error:', innerError);

            if (innerError.code === 4001 || innerError.message?.includes('user rejected')) {
                utils.showError('Transaction cancelled by user');
            } else if (innerError.message?.includes('insufficient funds')) {
                utils.showError('Insufficient ETH balance for this transaction');
            } else {
                utils.showError('Contribution failed: ' + (innerError.message || 'Unknown error'));
            }

            $('#contributeButton').prop('disabled', false).text('Contribute Now');
        }
    } catch (error) {
        console.error('Contribution error:', error);
        utils.showError('Error processing contribution: ' + error.message);
        $('#contributeButton').prop('disabled', false).text('Contribute Now');
    }
}
