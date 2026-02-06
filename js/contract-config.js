
(function (global) {
    const NETWORK = {
        SEPOLIA: {
            chainId: '0xaa36a7',
            chainIdDec: 11155111,
            name: 'Sepolia Testnet',
            rpcUrl: 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
            blockExplorer: 'https://sepolia.etherscan.io'
        }
    };

    const CONTRACT_ADDRESSES = {
        GEvidenceRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        RoleManager: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        IoTOracleMock: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        VerificationCrowdfund: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        RewardToken: '0xa16E02E87b7454126E5E10d957A927A7F5B5d2be',
        CompanyCertificateNFT: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        OffCycleCheckModule: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        treasury: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    };
    
    const DEPLOYMENT_CONFIG = {
        rewardRateTokensPerEth: 1000,
        offCycleMinStake: 50,
        chainId: 31337,
        deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
    };

    const CONTRACT_ABIS = {
        VerificationCrowdfund: [],
        RewardToken: [],
        GEvidenceRegistry: [],
        CompanyCertificateNFT: [],
        OffCycleCheckModule: [],
    };

    function isAddressSet(address) {
        return address && address !== '0x0000000000000000000000000000000000000000';
    }

    function getContractAddress(contractName) {
        if (!CONTRACT_ADDRESSES[contractName]) {
            console.warn(`Contract ${contractName} not found in CONTRACT_ADDRESSES`);
            return null;
        }
        const address = CONTRACT_ADDRESSES[contractName];
        if (!isAddressSet(address)) {
            console.warn(`Contract ${contractName} address not set. Deploy with Hardhat first.`);
            return null;
        }
        return address;
    }

    function setContractAddress(contractName, address) {
        if (!CONTRACT_ADDRESSES.hasOwnProperty(contractName)) {
            console.warn(`Contract ${contractName} not recognized`);
            return false;
        }
        CONTRACT_ADDRESSES[contractName] = address;
        console.log(`✓ Updated ${contractName}: ${address}`);
        return true;
    }

    function setContractABI(contractName, abi) {
        if (!CONTRACT_ABIS.hasOwnProperty(contractName)) {
            console.warn(`ABI for ${contractName} not found`);
            return false;
        }
        CONTRACT_ABIS[contractName] = abi;
        console.log(`✓ Updated ABI for ${contractName}`);
        return true;
    }

    global.ContractConfig = {
        NETWORK,
        ADDRESSES: CONTRACT_ADDRESSES,
        ABIS: CONTRACT_ABIS,
        DEPLOYMENT: DEPLOYMENT_CONFIG,
        getContractAddress,
        setContractAddress,
        setContractABI,
        isAddressSet
    };
})(window);
