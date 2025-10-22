// Kullanıcı bu adresi Görev 4'teki deploy çıktısıyla değiştirmeli
const contractAddress = "0x4fAe93ba1f478c48fC5C05fbF896c4E14d4F54aC";
let contractABI; // ABI'yi yükleyeceğiz

let provider;
let signer;
let contract;

const connectButton = document.getElementById("connectButton");
const walletAddress = document.getElementById("walletAddress");
const gameControls = document.getElementById("gameControls");
const mintHeroButton = document.getElementById("mintHeroButton");
const heroStatus = document.getElementById("heroStatus");
const enterDungeonButton = document.getElementById("enterDungeonButton");
const logOutput = document.getElementById("logOutput");

// Pyth EVM JS SDK (Global scope'tan gelir)
const { EvmPriceServiceConnection } = PythEVM;
const pythConnection = new EvmPriceServiceConnection("https://hermes.pyth.network");
// Optimism Sepolia'da kullanacağımız Price ID'ler
const priceIds = [
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"  // BTC/USD
];

window.addEventListener("load", async () => {
    log("App loaded. Loading ABI...");
    try {
        const response = await fetch("./abi.json");
        contractABI = await response.json();
        log("ABI loaded.");
    } catch (e) {
        log("Error loading ABI: " + e.message);
    }

    connectButton.addEventListener("click", connectWallet);
    mintHeroButton.addEventListener("click", mintHero);
    enterDungeonButton.addEventListener("click", enterDungeon);
});

function log(message) {
    console.log(message);
    logOutput.textContent = `${new Date().toLocaleTimeString()}: ${message}\n${logOutput.textContent}`;
}

async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        log("Metamask is not installed!");
        return;
    }

    try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        provider = new ethers.providers.Web3Provider(window.ethereum);

        // Optimism Sepolia'ya geçişi zorla
        await provider.send("wallet_switchEthereumChain", [{ chainId: "0xaa37dc" }]); // 11155420 (Optimism Sepolia)

        signer = provider.getSigner();
        const address = await signer.getAddress();

        contract = new ethers.Contract(contractAddress, contractABI, signer);

        walletAddress.textContent = `Connected: ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        connectButton.style.display = "none";
        gameControls.style.display = "block";

        log("Wallet connected.");
        checkHeroStatus();
        listenForEvents();
    } catch (e) {
        log(`Error connecting: ${e.message}`);
    }
}

let userHeroId = null;

async function checkHeroStatus() {
    if (!contract) return;
    const address = await signer.getAddress();
    const balance = await contract.balanceOf(address);

    if (balance.toNumber() > 0) {
        userHeroId = await contract.tokenOfOwnerByIndex(address, 0);
        heroStatus.textContent = `Hero ID: ${userHeroId.toString()}`;
        mintHeroButton.disabled = true;
        enterDungeonButton.disabled = false;
    } else {
        heroStatus.textContent = "No hero found. Mint one!";
        mintHeroButton.disabled = false;
        enterDungeonButton.disabled = true;
    }
}

async function mintHero() {
    if (!contract) return;
    log("Minting hero... check wallet.");
    try {
        const tx = await contract.mintHero();
        await tx.wait();
        log("Hero minted successfully!");
        checkHeroStatus();
    } catch (e) {
        log(`Error minting: ${e.message}`);
    }
}

// GÖREV 7'de doldurulacak
async function enterDungeon() {
    log("Entering dungeon... (Not implemented yet)");
}

// GÖREV 7'de doldurulacak
function listenForEvents() {
    log("Event listener setup... (Not implemented yet)");
}