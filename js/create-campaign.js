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

    $('#createCampaignForm').on('submit', function(e) {
        e.preventDefault();
        
        const title = $('#inputTitle').val().trim();
        const evidenceId = $('#inputEvidenceId').val().trim();
        const goalEth = $('#inputGoal').val();
        const deadline = $('#inputDeadline').val();
        const type = $('#inputType').val();
        const description = $('#inputDescription').val().trim();

        if (!title) { alert('Please enter campaign title'); return; }
        if (!evidenceId) { alert('Please enter evidence ID'); return; }
        if (!goalEth || parseFloat(goalEth) <= 0) { alert('Please enter valid target'); return; }
        if (!deadline) { alert('Please select deadline'); return; }
        if (!type) { alert('Please select campaign type'); return; }

        try {
            const deadlineTs = new Date(deadline).getTime();
            const now = Date.now();
            if (deadlineTs <= now) {
                alert('Deadline must be in the future');
                return;
            }

            const campaign = CampaignManager.createCampaign({
                title,
                evidenceId,
                goalEth,
                deadlineTs,
                description,
                type
            });

            if (campaign && campaign.id) {
                alert('Campaign created successfully!');
                window.location.href = `campaign.html?id=${campaign.id}`;
            }
        } catch (e) {
            alert('Error creating campaign: ' + e.message);
        }
    });
});
