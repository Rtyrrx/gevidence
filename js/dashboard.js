let currentCampaignId = null;
let currentAccount = null;
let allCampaigns = [];

function campaignIdToContractId(stringId) {
    if (typeof stringId === 'number') return stringId;
    const match = stringId.match(/\d+$/);
    if (!match) throw new Error(`Invalid campaign ID format: ${stringId}`);
    return BigInt(match[0]);
}

$(document).ready(async function() {
    currentAccount = await WalletManager.autoReconnect();
    if (!currentAccount) {
        const $container = $('#projectList');
        $container.html(`
            <div class="col-12 text-center py-5">
                <div class="card border-0 shadow-lg p-5">
                    <i class="fas fa-wallet fa-3x text-ge-blue mb-3"></i>
                    <h3 class="text-ge-blue mb-3">Connect Your Wallet</h3>
                    <p class="text-muted mb-4">Please connect MetaMask to view campaigns and invest.</p>
                    <button id="connectWalletBtn" class="btn btn-ge-primary btn-lg">
                        <i class="fab fa-ethereum me-2"></i> Connect MetaMask
                    </button>
                </div>
            </div>
        `);
        $('#connectWalletBtn').on('click', async function() {
            try {
                const result = await WalletManager.connectWallet();
                if (result) window.location.reload();
            } catch (e) { alert('Connection failed'); }
        });
        return;
    }

    $('#walletAddr').text(GEUtils.formatAddress(currentAccount.address));
    $('#disconnectBtn').on('click', async function() {
        await WalletManager.disconnect();
        window.location.href = 'index.html';
    });

    const balance = await WalletManager.getBalance(currentAccount.address);
    const balEth = balance ? GEUtils.formatEth(balance) : '0.00';
    $('#ethBalance').text(balEth);

    allCampaigns = await CampaignManager.getAllCampaigns();
    updateStats();
    renderCampaigns(allCampaigns);

    $('#donationAmount').on('input', function() {
        const amount = parseFloat($(this).val()) || 0;
        const reward = WEB3.calculateReward(amount);
        $('#rewardEstimate').text(Math.floor(reward));
    });

    $('#submitDonationBtn').on('click', async function() {
        if (!currentCampaignId || !currentAccount) {
            alert('Please connect wallet first');
            return;
        }
        const amount = parseFloat($('#donationAmount').val());
        if (amount <= 0) { alert('Enter valid amount'); return; }
        
        $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Processing...');
        
        try {
            if (!ContractConfig.ABIS.VerificationCrowdfund || ContractConfig.ABIS.VerificationCrowdfund.length === 0) {
                await ABILoader.loadABI('VerificationCrowdfund');
            }
            
            const provider = WEB3.getProvider();
            const signer = await WEB3.getSigner();
            
            if (!signer) {
                throw new Error('Could not get wallet signer');
            }
            
            const cfContract = await ABILoader.getContractInstance('VerificationCrowdfund', provider, signer);
            
            const contractCampaignId = campaignIdToContractId(currentCampaignId);
            
            const amountWei = WEB3.ethToWei(amount);
            
            const tx = await cfContract.contribute(contractCampaignId, { value: amountWei });
            
            alert(`⏳ Waiting for transaction confirmation...\nHash: ${tx.hash}`);
            
            const receipt = await tx.wait();
            
            const reward = WEB3.calculateReward(amount);
            const donations = JSON.parse(localStorage.getItem('gevidence_donations') || '[]');
            donations.push({
                campaignId: currentCampaignId,
                address: currentAccount.address,
                amountEth: amount,
                rewards: reward,
                timestamp: Date.now(),
                txHash: tx.hash
            });
            localStorage.setItem('gevidence_donations', JSON.stringify(donations));
            
            const campaigns = JSON.parse(localStorage.getItem('gevidence_created_campaigns') || '[]');
            const campaignIdx = campaigns.findIndex(c => c.id === currentCampaignId);
            if (campaignIdx >= 0) {
                const currentRaisedWei = BigInt(campaigns[campaignIdx].raisedWei);
                const newRaisedWei = currentRaisedWei + amountWei;
                campaigns[campaignIdx].raisedWei = newRaisedWei.toString();
                localStorage.setItem('gevidence_created_campaigns', JSON.stringify(campaigns));
            }
            
            alert(`✅ Invested ${amount} ETH! You earned ${Math.floor(reward)} reward tokens.\n\nTransaction: ${receipt.transactionHash}`);
            bootstrap.Modal.getInstance(document.getElementById('donationModal')).hide();
            $('#donationAmount').val('0.1');
            
            allCampaigns = await CampaignManager.getAllCampaigns();
            updateStats();
            renderCampaigns(allCampaigns);
        } catch (e) {
            if (e.code === 4001) {
                alert('❌ Transaction rejected by user');
            } else if (e.message.includes('insufficient funds')) {
                alert('❌ Insufficient ETH balance');
            } else {
                alert('❌ Donation failed: ' + e.message);
            }
        } finally {
            $(this).prop('disabled', false).html('Confirm Donation');
        }
    });

    $('#searchBar, #typeFilter, #statusFilter').on('change keyup', function() {
        const search = $('#searchBar').val().toLowerCase();
        const type = $('#typeFilter').val();
        const status = $('#statusFilter').val();
        
        const filtered = allCampaigns.filter(c => {
            const matchSearch = c.title.toLowerCase().includes(search);
            const matchType = !type || c.type === type;
            const isActive = !c.finalized || (c.finalized && !c.successful);
            const isCompleted = c.finalized && c.successful;
            const matchStatus = !status || (status === 'active' && isActive) || (status === 'completed' && isCompleted);
            return matchSearch && matchType && matchStatus;
        });
        renderCampaigns(filtered);
    });
});

function updateStats() {
    const active = allCampaigns.filter(c => !c.finalized).length;
    const completed = allCampaigns.filter(c => c.finalized && c.successful).length;
    const donations = JSON.parse(localStorage.getItem('gevidence_donations') || '[]')
        .filter(d => d.address === currentAccount.address);
    const totalRewards = donations.reduce((sum, d) => sum + d.rewards, 0);
    
    $('#totalCampaigns').text(allCampaigns.length);
    $('#activeCampaigns').text(active);
    $('#myRewards').text(Math.floor(totalRewards));
}

function renderCampaigns(data) {
    const $container = $('#projectList');
    $container.empty();
    if (!data || data.length === 0) {
        $container.html('<p class="text-center w-100">No campaigns found.</p>');
        return;
    }

    data.forEach(campaign => {
        const raised = parseFloat(campaign.raisedWei) / 1e18 || 0;
        const goal = parseFloat(campaign.goalWei) / 1e18 || 1;
        const progress = Math.min(100, (raised / goal) * 100);
        const isActive = !campaign.finalized;
        const img = campaign.img || 'https://placehold.co/400x250/6C757D/FFFFFF?text=Campaign';
        
        const card = `
            <div class="col">
                <div class="card campaign-card h-100 border-0 shadow-sm">
                    <img src="${img}" class="card-img-top" alt="${campaign.title}" style="height:200px;object-fit:cover;">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title text-ge-blue fw-bold">${campaign.title}</h5>
                        <p class="card-text small text-muted mb-3">${campaign.description || ''}</p>
                        
                        <div class="mb-2">
                            <small class="text-muted">${raised.toFixed(2)} / ${goal.toFixed(2)} ETH</small>
                            <div class="progress" style="height:6px;">
                                <div class="progress-bar bg-ge-green" style="width:${progress}%"></div>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <span class="badge bg-secondary me-1">${campaign.type || 'Project'}</span>
                            <span class="badge ${isActive ? 'bg-success' : 'bg-secondary'}">
                                ${isActive ? 'Active' : campaign.successful ? 'Success' : 'Ended'}
                            </span>
                        </div>
                        
                        <div class="d-flex gap-2 mt-auto">
                            <a href="campaign.html?id=${campaign.id}" class="btn btn-sm btn-outline-secondary flex-grow-1">
                                <i class="fas fa-eye me-1"></i> Details
                            </a>
                            ${isActive ? `<button class="btn btn-sm btn-ge-primary flex-grow-1 donate-btn" data-id="${campaign.id}" data-title="${campaign.title}">
                                <i class="fas fa-hand-holding-heart me-1"></i> Invest
                            </button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        $container.append(card);
    });

    $('.donate-btn').on('click', function() {
        currentCampaignId = $(this).data('id');
        $('#modalCampaignTitle').text($(this).data('title'));
        $('#donationAmount').val('0.1').trigger('input');
        new bootstrap.Modal(document.getElementById('donationModal')).show();
    });
}
