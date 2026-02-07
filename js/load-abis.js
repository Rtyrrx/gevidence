
(function (global) {
    const ABI_SOURCES = {
        RoleManager: 'artifacts/contracts/core/RoleManager.sol/RoleManager.json',
        GEvidenceRegistry: 'artifacts/contracts/core/GEvidenceRegistry.sol/GEvidenceRegistry.json',
        IoTOracleMock: 'artifacts/contracts/core/IoTOracleMock.sol/IoTOracleMock.json',
        VerificationCrowdfund: 'artifacts/contracts/modules/crowdfunding/VerificationCrowdfund.sol/VerificationCrowdfund.json',
        RewardToken: 'artifacts/contracts/modules/crowdfunding/RewardToken.sol/RewardToken.json',
        CompanyCertificateNFT: 'artifacts/contracts/modules/certificates/CompanyCertificateNFT.sol/CompanyCertificateNFT.json',
        OffCycleCheckModule: 'artifacts/contracts/modules/checks/OffCycleCheckModule.sol/OffCycleCheckModule.json',
    };

    async function loadABI(contractName, callback) {
        if (!ABI_SOURCES[contractName]) {
            const msg = `Unknown contract: ${contractName}`;
            console.error(msg);
            if (callback) callback(new Error(msg), null);
            return;
        }

        try {
            const path = ABI_SOURCES[contractName];
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load ${contractName} artifact: ${response.status}`);
            }
            const artifact = await response.json();
            const abi = artifact.abi || [];
            
            if (ContractConfig) {
                ContractConfig.setContractABI(contractName, abi);
                console.log(`✓ Loaded ABI for ${contractName}`);
            }
            
            if (callback) callback(null, abi);
            return abi;
        } catch (error) {
            console.error(`Failed to load ABI for ${contractName}:`, error);
            if (callback) callback(error, null);
        }
    }

    async function loadAllABIs(onComplete) {
        const contractNames = Object.keys(ABI_SOURCES);
        const results = {};
        let completed = 0;

        for (const name of contractNames) {
            loadABI(name, (err, abi) => {
                if (err) {
                    console.warn(`Could not load ${name}: ${err.message}`);
                    results[name] = null;
                } else {
                    results[name] = abi;
                }
                completed++;
                if (completed === contractNames.length && onComplete) {
                    console.log('✓ All ABIs loaded', results);
                    onComplete(results);
                }
            });
        }
    }

    async function getContractInstance(contractName, provider, signer) {
        if (!ContractConfig) {
            throw new Error('ContractConfig not initialized');
        }

        const address = ContractConfig.getContractAddress(contractName);
        if (!address) {
            throw new Error(`Contract address not set for ${contractName}`);
        }

        const abi = ContractConfig.ABIS[contractName];
        if (!abi || abi.length === 0) {
            throw new Error(`ABI not loaded for ${contractName}. Call loadABI() first.`);
        }

        if (typeof ethers === 'undefined') {
            throw new Error('ethers library not loaded');
        }

        const signerOrProvider = signer || provider;
        return new ethers.Contract(address, abi, signerOrProvider);
    }

    global.ABILoader = {
        loadABI,
        loadAllABIs,
        getContractInstance,
        ABI_SOURCES
    };

    console.log('[ABILoader] Ready. Call ABILoader.loadAllABIs() or ABILoader.loadABI(name) to load contract ABIs');
})(window);
