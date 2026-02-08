
(function (global) {
    function formatAddress(addr) {
        if (!addr) return '';
        return addr.slice(0,6) + '...' + addr.slice(-4);
    }

    function formatEth(wei) {
        try { return Number(ethers.formatEther(wei)).toFixed(4); } catch (e) { return wei; }
    }

    function saveJSON(key, obj) {
        localStorage.setItem(key, JSON.stringify(obj));
    }

    function loadJSON(key) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }

    function showToast(msg) {
        console.log('Toast:', msg);
    }

    global.GEUtils = {
        formatAddress,
        formatEth,
        saveJSON,
        loadJSON,
        showToast
    };
})(window);
