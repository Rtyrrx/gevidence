let currentAccount = null;
let allCampaigns = [];

$(document).ready(async function() {
    currentAccount = await WalletManager.autoReconnect();
    if (!currentAccount) {
        window.location.href = 'dashboard.html';
        return;
    }

    $('#walletAddr').text(GEUtils.formatAddress(currentAccount.address));
    $('#disconnectBtn').on('click', async function() {
        await WalletManager.disconnect();
        window.location.href = 'index.html';
    });

    allCampaigns = await CampaignManager.getAllCampaigns();

    const donations = JSON.parse(localStorage.getItem('gevidence_donations') || '[]')
        .filter(d => d.address === currentAccount.address);
    
    const totalInvested = donations.reduce((sum, d) => sum + d.amountEth, 0);
    const totalRewards = donations.reduce((sum, d) => sum + d.rewards, 0);
    const uniqueCampaigns = new Set(donations.map(d => d.campaignId)).size;

    $('#totalInvested').text(totalInvested.toFixed(4));
    $('#totalRewards').text(Math.floor(totalRewards));
    $('#investmentCount').text(donations.length);
    $('#campaignCount').text(uniqueCampaigns);

    if (donations.length === 0) {
        $('#allInvestmentsTable').html('<tr><td colspan="6" class="text-center text-muted py-4">No investments yet. <a href="dashboard.html">Start investing</a></td></tr>');
        $('#activeInvestmentsTable').html('<tr><td colspan="5" class="text-center text-muted py-4">No active investments</td></tr>');
        $('#completedInvestmentsTable').html('<tr><td colspan="5" class="text-center text-muted py-4">No completed investments</td></tr>');
        return;
    }

    const rows = donations.map(d => {
        const campaign = allCampaigns.find(c => String(c.id) === String(d.campaignId));
        const date = new Date(d.timestamp).toLocaleDateString();
        const isActive = campaign && !campaign.finalized;
        
        return {
            donation: d,
            campaign,
            date,
            isActive
        };
    });

    let allHtml = rows.map(r => `
        <tr>
            <td><strong>${r.campaign ? r.campaign.title : 'Unknown'}</strong></td>
            <td>${r.donation.amountEth.toFixed(4)} ETH</td>
            <td><span class="badge bg-ge-green">${Math.floor(r.donation.rewards)} tokens</span></td>
            <td>${r.date}</td>
            <td>${r.isActive ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Ended</span>'}</td>
            <td><a href="campaign.html?id=${r.campaign.id}" class="btn btn-sm btn-outline-secondary">View</a></td>
        </tr>
    `).join('');
    $('#allInvestmentsTable').html(allHtml);

    const activeRows = rows.filter(r => r.isActive);
    let activeHtml = activeRows.length > 0 ? activeRows.map(r => `
        <tr>
            <td><strong>${r.campaign.title}</strong></td>
            <td>${r.donation.amountEth.toFixed(4)} ETH</td>
            <td><span class="badge bg-ge-green">${Math.floor(r.donation.rewards)} tokens</span></td>
            <td>${r.date}</td>
            <td>
                <div class="progress" style="height:20px;">
                    <div class="progress-bar bg-ge-green" style="width:65%"></div>
                </div>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="5" class="text-center text-muted py-4">No active investments</td></tr>';
    $('#activeInvestmentsTable').html(activeHtml);

    const completedRows = rows.filter(r => !r.isActive);
    let completedHtml = completedRows.length > 0 ? completedRows.map(r => `
        <tr>
            <td><strong>${r.campaign.title}</strong></td>
            <td>${r.donation.amountEth.toFixed(4)} ETH</td>
            <td><span class="badge bg-ge-green">${Math.floor(r.donation.rewards)} tokens</span></td>
            <td>${r.date}</td>
            <td>
                ${r.campaign.successful ? '<span class="badge bg-success">✓ Successful</span>' : '<span class="badge bg-secondary">Ended</span>'}
            </td>
        </tr>
    `).join('') : '<tr><td colspan="5" class="text-center text-muted py-4">No completed investments</td></tr>';
    $('#completedInvestmentsTable').html(completedHtml);
});
