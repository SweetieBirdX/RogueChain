// RogueChain Frontend Application
class RogueChainApp {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.contractAddress = '0x4fAe93ba1f478c48fC5C05fbF896c4E14d4F54aC';
        this.abi = null;
        
        this.init();
    }

    async init() {
        this.log('RogueChain App initialized');
        this.setupEventListeners();
        await this.loadABI();
    }

    async loadABI() {
        try {
            const response = await fetch('./abi.json');
            this.abi = await response.json();
            this.log('Contract ABI loaded successfully');
        } catch (error) {
            this.log('Error loading ABI: ' + error.message);
        }
    }

    setupEventListeners() {
        document.getElementById('connectButton').addEventListener('click', () => this.connectWallet());
        document.getElementById('mintHeroButton').addEventListener('click', () => this.mintHero());
        document.getElementById('enterDungeonButton').addEventListener('click', () => this.enterDungeon());
    }

    async connectWallet() {
        try {
            if (typeof window.ethereum !== 'undefined') {
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                this.signer = this.provider.getSigner();
                
                // Request account access
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                
                const address = await this.signer.getAddress();
                document.getElementById('walletAddress').textContent = `Connected: ${address}`;
                document.getElementById('connectButton').textContent = 'Connected';
                document.getElementById('connectButton').disabled = true;
                document.getElementById('gameControls').style.display = 'block';
                
                // Initialize contract
                this.contract = new ethers.Contract(this.contractAddress, this.abi, this.signer);
                
                this.log(`Wallet connected: ${address}`);
                await this.loadHeroData();
            } else {
                this.log('MetaMask not found! Please install MetaMask.');
            }
        } catch (error) {
            this.log('Error connecting wallet: ' + error.message);
        }
    }

    async mintHero() {
        try {
            this.log('Minting hero...');
            const tx = await this.contract.mintHero();
            this.log(`Transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            this.log(`Hero minted! Transaction confirmed: ${receipt.transactionHash}`);
            
            await this.loadHeroData();
        } catch (error) {
            this.log('Error minting hero: ' + error.message);
        }
    }

    async loadHeroData() {
        try {
            const userHeroes = await this.contract.getUserHeroes(await this.signer.getAddress());
            if (userHeroes.length > 0) {
                const heroId = userHeroes[0];
                const hero = await this.contract.getHero(heroId);
                const stats = await this.contract.getHeroStats(heroId);
                
                document.getElementById('heroStatus').innerHTML = `
                    <strong>Hero #${heroId}</strong><br>
                    Level: ${stats.level}<br>
                    Experience: ${stats.experience}<br>
                    Strength: ${stats.strength} | Agility: ${stats.agility}<br>
                    Intelligence: ${stats.intelligence} | Vitality: ${stats.vitality}<br>
                    Luck: ${stats.luck}
                `;
                
                document.getElementById('enterDungeonButton').disabled = false;
            } else {
                document.getElementById('heroStatus').textContent = 'No hero found. Mint one first!';
            }
        } catch (error) {
            this.log('Error loading hero data: ' + error.message);
        }
    }

    async enterDungeon() {
        try {
            this.log('Entering dungeon...');
            const userHeroes = await this.contract.getUserHeroes(await this.signer.getAddress());
            const heroId = userHeroes[0];
            
            const tx = await this.contract.startGameSession(heroId);
            this.log(`Dungeon entered! Transaction: ${tx.hash}`);
            
            const receipt = await tx.wait();
            this.log(`Game session started! Transaction confirmed: ${receipt.transactionHash}`);
            
        } catch (error) {
            this.log('Error entering dungeon: ' + error.message);
        }
    }

    log(message) {
        const logOutput = document.getElementById('logOutput');
        const timestamp = new Date().toLocaleTimeString();
        logOutput.textContent += `[${timestamp}] ${message}\n`;
        logOutput.scrollTop = logOutput.scrollHeight;
        console.log(message);
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new RogueChainApp();
});
