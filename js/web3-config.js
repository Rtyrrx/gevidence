if (typeof ethers === 'undefined') {
    console.warn('ethers not found - ensure CDN is loaded before this script');
}

(function (global) {
    const CHAIN_ID = '0xaa36a7';
    const REWARD_RATE = 100;

    function getProvider() {
        if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
        return ethers.getDefaultProvider('sepolia');
    }

    async function getSigner() {
        const provider = getProvider();
        try { return await provider.getSigner(); } catch (e) { return null; }
    }

    function weiToEth(wei) {
        try { return ethers.formatEther(wei); } catch (e) { return String(wei); }
    }

    function ethToWei(eth) {
        try { return ethers.parseEther(String(eth)); } catch (e) { return eth; }
    }

    function calculateReward(ethAmount) {
        return Number(ethAmount) * REWARD_RATE;
    }

    global.WEB3 = {
        CHAIN_ID,
        getProvider,
        getSigner,
        weiToEth,
        ethToWei,
        calculateReward
    };
})(window);
