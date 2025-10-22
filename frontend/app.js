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

async function enterDungeon() {
    if (!contract || userHeroId === null) {
        log("Not ready to enter dungeon.");
        return;
    }

    log("1. Fetching Pyth price updates from Hermes...");
    enterDungeonButton.disabled = true;
    enterDungeonButton.textContent = "Fetching Data...";

    try {
        // 1. Pyth Hermes'ten imzalı fiyat verilerini al (PULL ORACLE ADIMI)
        const priceUpdateData = await pythConnection.getPriceFeedsUpdateData(priceIds);

        log("2. Price data fetched. Sending transaction... (Check Wallet)");
        enterDungeonButton.textContent = "Waiting for Tx...";

        // 2. Kontratı çağır
        // Pyth Price Feed ve Pyth Entropy için gerekli ücretleri al
        // Bu değerleri kontrattan okumak en doğrusu olurdu ama hackathon hızı için
        // tahmini bir değer (ör: 0.001 ETH) gönderebiliriz.
        // Daha iyisi: Gerekli ücretleri kontrattan okuyalım.
        const pythUpdateFee = await contract.pyth.getUpdateFee(priceUpdateData);
        const entropyFee = await contract.pythEntropy.getFee();
        const totalFee = pythUpdateFee.add(entropyFee);

        log(`Total fee (Update + Entropy): ${ethers.utils.formatEther(totalFee)} ETH`);

        const tx = await contract.enterDungeon(userHeroId, priceUpdateData, {
            value: totalFee
        });

        log(`3. Transaction sent (tx: ${tx.hash.substring(0, 10)}...). Waiting for confirmation...`);
        enterDungeonButton.textContent = "Waiting for Blocks...";

        const receipt = await tx.wait();
        log("4. Dungeon entry confirmed. Waiting for Pyth Entropy callback...");
        enterDungeonButton.textContent = "Waiting for Oracle...";

        // Event'i bekleyip sonucu göstereceğiz (listenForEvents halledecek)

    } catch (e) {
        log(`Error entering dungeon: ${e.message}`);
        enterDungeonButton.disabled = false;
        enterDungeonButton.textContent = "Enter Dungeon";
    }
}

function listenForEvents() {
    if (!contract) return;

    log("Setting up event listeners for DungeonResult...");

    contract.on("DungeonResult", (requestId, player, victory, lootAmount, heroLost) => {
        log("--- DUNGEON RESULT RECEIVED ---");
        log(`Request ID: ${requestId}`);
        log(`Player: ${player}`);

        if (victory) {
            log(`Result: VICTORY!`);
            log(`Loot Won: ${lootAmount.toString()} (simulated)`);
        } else {
            log(`Result: DEFEAT!`);
        }

        if (heroLost) {
            log("!!! YOUR HERO WAS LOST TO THE DUNGEON (PERMADEATH) !!!");
            checkHeroStatus(); // NFT'nin kaybolduğunu UI'da göster
        }

        log("---------------------------------");
        enterDungeonButton.disabled = false;
        enterDungeonButton.textContent = "Enter Dungeon";
    });

    contract.on("DungeonEnter", (requestId, player, heroId) => {
        log(`Event: DungeonEnter detected for Hero ${heroId.toString()}. Request ID: ${requestId}`);
    });
}