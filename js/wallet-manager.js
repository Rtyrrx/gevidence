
(function (global) {
    const STORAGE_KEY = 'gevidence_connected_wallet';

    async function connectWallet() {
        if (!window.ethereum) {
            throw new Error('MetaMask not installed. Please install MetaMask extension.');
        }
        try {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length > 0) {
                    localStorage.setItem(STORAGE_KEY, accounts[0]);
                }
            });

            let accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts returned from MetaMask');
            }
            
            const address = accounts[0];
            localStorage.setItem(STORAGE_KEY, address);
            
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            
            return { provider, signer, address };
        } catch (error) {
            console.error('Wallet connection error:', error);
            throw error;
        }
    }

    async function autoReconnect() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return null;
        try {
            if (!window.ethereum) return null;
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.listAccounts();
            if (!accounts || accounts.length === 0) return null;
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            if (address.toLowerCase() !== saved.toLowerCase()) {
                localStorage.setItem(STORAGE_KEY, address);
            }
            return { provider, signer, address };
        } catch (e) { return null; }
    }

    async function disconnect() {
        localStorage.removeItem(STORAGE_KEY);
    }

    async function getBalance(address) {
        const provider = WEB3.getProvider();
        try {
            const bal = await provider.getBalance(address);
            return bal;
        } catch (e) { return null; }
    }

    global.WalletManager = {
        connectWallet,
        autoReconnect,
        disconnect,
        getBalance
    };
})(window);
