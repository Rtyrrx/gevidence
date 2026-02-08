let currentAccount = null;

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

    const donations = JSON.parse(localStorage.getItem('gevidence_donations') || '[]')
        .filter(d => d.address === currentAccount.address);
    const totalRewards = donations.reduce((sum, d) => sum + d.rewards, 0);
    
    const offcycleRequests = JSON.parse(localStorage.getItem('gevidence_offcycle_requests') || '[]')
        .filter(r => r.address === currentAccount.address);

    const pending = offcycleRequests.filter(r => r.status === 0).length;
    const approved = offcycleRequests.filter(r => r.status === 1).length;

    let rewardsUsed = 0;
    offcycleRequests.forEach(r => {
        if (r.status === 1) {
        } else if (r.status === 2) {
            rewardsUsed += r.stakeAmount;
        } else {
            rewardsUsed += r.stakeAmount;
        }
    });

    const availableRewards = Math.max(0, Math.floor(totalRewards) - rewardsUsed);
    $('#rewardBalance').text(availableRewards);
    $('#pendingCount').text(pending);
    $('#approvedCount').text(approved);
    $('#stakeAvailable').text(availableRewards);

    $('#offcycleForm').on('submit', function(e) {
        e.preventDefault();
        
        const evidenceId = $('#inputEvidenceId').val().trim();
        const stakeAmount = parseInt($('#inputStake').val()) || 0;
        const reason = $('#inputReason').val().trim();

        if (!evidenceId) { alert('Please enter evidence ID'); return; }
        if (stakeAmount < 10) { alert('Minimum stake is 10 tokens'); return; }
        if (stakeAmount > availableRewards) { alert('Insufficient reward tokens'); return; }

        try {
            const request = {
                id: Date.now(),
                evidenceId,
                address: currentAccount.address,
                stakeAmount,
                reason,
                status: 0,
                timestamp: Date.now()
            };

            offcycleRequests.push(request);
            localStorage.setItem('gevidence_offcycle_requests', JSON.stringify(offcycleRequests));
            alert(`Off-cycle check requested! Your ${stakeAmount} tokens are staked.`);
            $('#offcycleForm')[0].reset();
            location.reload();
        } catch (e) {
            alert('Failed to submit request: ' + e.message);
        }
    });

    if (offcycleRequests.length > 0) {
        const pendingChecks = offcycleRequests.filter(r => r.status === 0);
        if (pendingChecks.length > 0) {
            let html = pendingChecks.map(r => `
                <div class="alert alert-info mb-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="fw-bold mb-1">${r.evidenceId}</h6>
                            <p class="mb-1"><strong>Staked:</strong> ${r.stakeAmount} tokens</p>
                            <p class="mb-0 small text-muted">${r.reason || 'No reason provided'}</p>
                            <small class="text-muted">Requested: ${new Date(r.timestamp).toLocaleDateString()}</small>
                        </div>
                        <span class="badge bg-warning">Pending</span>
                    </div>
                </div>
            `).join('');
            $('#pendingChecks').html(html);
        }

        const approvedChecks = offcycleRequests.filter(r => r.status === 1);
        if (approvedChecks.length > 0) {
            let html = approvedChecks.map(r => `
                <div class="alert alert-success mb-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="fw-bold mb-1">${r.evidenceId}</h6>
                            <p class="mb-1"><strong>Staked:</strong> ${r.stakeAmount} tokens (returned)</p>
                            <small class="text-muted">Approved: ${new Date(r.timestamp).toLocaleDateString()}</small>
                        </div>
                        <span class="badge bg-success">Approved</span>
                    </div>
                </div>
            `).join('');
            $('#approvedChecks').html(html);
        }

        const rejectedChecks = offcycleRequests.filter(r => r.status === 2);
        if (rejectedChecks.length > 0) {
            let html = rejectedChecks.map(r => `
                <div class="alert alert-danger mb-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="fw-bold mb-1">${r.evidenceId}</h6>
                            <p class="mb-1"><strong>Staked:</strong> ${r.stakeAmount} tokens (lost)</p>
                            <small class="text-muted">Rejected: ${new Date(r.timestamp).toLocaleDateString()}</small>
                        </div>
                        <span class="badge bg-danger">Rejected</span>
                    </div>
                </div>
            `).join('');
            $('#rejectedChecks').html(html);
        }
    }
});
