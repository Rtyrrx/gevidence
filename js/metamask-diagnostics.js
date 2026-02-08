(function (global) {
    const diagnostics = {
        checkMetaMask: function() {
            const installed = !!window.ethereum;
            const status = installed 
                ? '✅ MetaMask is installed'
                : '❌ MetaMask NOT installed';
            console.log(status);
            return installed;
        },

        checkEthers: function() {
            const loaded = typeof ethers !== 'undefined';
            const status = loaded
                ? '✅ ethers library loaded'
                : '❌ ethers library NOT loaded';
            console.log(status);
            return loaded;
        },

        checkContractConfig: function() {
            const loaded = typeof ContractConfig !== 'undefined';
            const status = loaded
                ? '✅ ContractConfig loaded'
                : '❌ ContractConfig NOT loaded';
            console.log(status);
            return loaded;
        },

        async checkNetwork() {
            try {
                if (!window.ethereum) {
                    console.log('❌ Cannot check network: MetaMask not found');
                    return false;
                }
                const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                const chainIdDec = parseInt(chainId, 16);
                console.log(`Current network ChainID: ${chainId} (${chainIdDec})`);
                
                if (chainIdDec === 31337) {
                    console.log('✅ Connected to Hardhat Local (31337)');
                } else if (chainIdDec === 11155111) {
                    console.log('⚠️  Connected to Sepolia (11155111) - Should use Hardhat (31337) for local testing');
                } else {
                    console.log(`⚠️  Connected to unknown network (${chainIdDec})`);
                }
                return true;
            } catch (e) {
                console.error('❌ Could not check network:', e.message);
                return false;
            }
        },

        async checkAccounts() {
            try {
                if (!window.ethereum) {
                    console.log('❌ Cannot check accounts: MetaMask not found');
                    return false;
                }
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    console.log(`✅ Accounts connected: ${accounts.length}`);
                    console.log(`   First account: ${accounts[0]}`);
                } else {
                    console.log('⚠️  No accounts connected. User needs to click "Connect"');
                }
                return accounts.length > 0;
            } catch (e) {
                console.error('❌ Could not check accounts:', e.message);
                return false;
            }
        },

        checkProvider: function() {
            try {
                const provider = WEB3.getProvider();
                console.log('✅ Web3 provider accessible');
                return !!provider;
            } catch (e) {
                console.error('❌ Could not access provider:', e.message);
                return false;
            }
        },

        async testConnectPopup() {
            console.log('\n📢 Testing MetaMask popup...');
            try {
                if (!window.ethereum) {
                    console.error('❌ MetaMask not found');
                    return false;
                }
                
                console.log('⏳ Waiting for MetaMask popup... Check your browser!');
                
                const accounts = await window.ethereum.request({ 
                    method: 'eth_requestAccounts',
                    params: []
                });
                
                if (accounts.length > 0) {
                    console.log(`✅ Connection successful! Account: ${accounts[0]}`);
                    return true;
                } else {
                    console.log('❌ No accounts returned');
                    return false;
                }
            } catch (error) {
                if (error.code === 4001) {
                    console.log('⚠️  User rejected the connection request');
                } else if (error.code === -32002) {
                    console.log('⚠️  Connection request already pending');
                } else {
                    console.error('❌ Connection error:', error.message);
                }
                return false;
            }
        },

        async runAll() {
            console.clear();
            console.log('%c=== MetaMask Diagnostic Check ===', 'color: blue; font-weight: bold; font-size: 14px;');
            console.log('');
            
            this.checkMetaMask();
            this.checkEthers();
            this.checkContractConfig();
            this.checkProvider();
            
            console.log('');
            await this.checkNetwork();
            await this.checkAccounts();
            
            console.log('');
            console.log('%c=== Recommendations ===', 'color: green; font-weight: bold;');
            
            if (!this.checkMetaMask()) {
                console.log('1. Install MetaMask: https://metamask.io');
            } else {
                console.log('1. ✅ MetaMask installed');
            }
            
            const hasHardhatNode = await this.checkNetwork();
            if (!hasHardhatNode) {
                console.log('2. ❌ Start Hardhat node in a separate terminal: npx hardhat node');
            } else {
                console.log('2. ✅ Hardhat node running');
            }
            
            const connected = await this.checkAccounts();
            if (!connected) {
                console.log('3. 📌 Click "Connect MetaMask" button to connect wallet');
            } else {
                console.log('3. ✅ Wallet connected');
            }
            
            console.log('');
            console.log('%c>>> Next: Try MetaMaskDiagnostics.testConnectPopup()', 'color: orange;');
        }
    };

    global.MetaMaskDiagnostics = diagnostics;
    
    console.log('%cMetaMask Diagnostics loaded. Run: MetaMaskDiagnostics.runAll()', 'color: purple;');
})(window);
