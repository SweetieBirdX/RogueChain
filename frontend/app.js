// Kullanıcı bu adresi Görev 4'teki deploy çıktısıyla değiştirmeli
const contractAddress = "0x0EE3F1d60b31b981DA34EB96289f44225C38fB7F";
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

// Pyth EVM JS SDK - güvenli yükleme
let pythConnection;
let priceIds = [
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"  // BTC/USD
];

// Manuel Pyth API entegrasyonu
function initPyth() {
    try {
        log("Initializing manual Pyth API integration...");
        
        // Manuel Pyth connection objesi oluştur
        pythConnection = {
            getPriceFeedsUpdateData: async function(priceIds) {
                log("Fetching price data from Pyth Hermes API...");
                
                try {
                    // Pyth Hermes API'sini direkt çağır
                    const response = await fetch('https://hermes.pyth.network/v2/updates/price/latest', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            ids: priceIds
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    log("Price data fetched successfully from Hermes");
                    
                    // Pyth formatında döndür
                    return data;
                } catch (error) {
                    log(`Error fetching price data: ${error.message}`);
                    throw error;
                }
            }
        };
        
        log("Manual Pyth API integration initialized successfully!");
        return true;
    } catch (e) {
        log(`Error initializing manual Pyth: ${e.message}`);
        return false;
    }
}

window.addEventListener("load", async () => {
    log("App loaded. Loading ABI...");
    
    // DOM elementlerini kontrol et
    if (!connectButton) {
        log("ERROR: Connect button not found!");
        return;
    }
    if (!mintHeroButton) {
        log("ERROR: Mint hero button not found!");
        return;
    }
    if (!enterDungeonButton) {
        log("ERROR: Enter dungeon button not found!");
        return;
    }
    
    try {
        const response = await fetch("./abi.json");
        const abiData = await response.json();
        contractABI = abiData.abi; // ABI array'ini al
        log("ABI loaded successfully.");
    } catch (e) {
        log("Error loading ABI: " + e.message);
        return;
    }

    // Pyth SDK'yı başlat
    initPyth();
    
    log("Setting up event listeners...");
    connectButton.addEventListener("click", connectWallet);
    mintHeroButton.addEventListener("click", mintHero);
    enterDungeonButton.addEventListener("click", enterDungeon);
    log("Event listeners set up successfully.");
});

function log(message) {
    console.log(message);
    logOutput.textContent = `${new Date().toLocaleTimeString()}: ${message}\n${logOutput.textContent}`;
}

async function connectWallet() {
    log("Connect wallet button clicked...");
    
    if (typeof window.ethereum === "undefined") {
        log("MetaMask is not installed!");
        alert("Please install MetaMask to use this app!");
        return;
    }

    log("MetaMask detected, requesting accounts...");
    
    try {
        // 1. Hesap iste
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        log(`Accounts received: ${accounts.length}`);
        
        // 2. Provider oluştur
        provider = new ethers.providers.Web3Provider(window.ethereum);
        log("Provider created");
        
        // 3. Network kontrolü (opsiyonel - şimdilik atla)
        log("Skipping network switch for now...");
        
        // 4. Signer oluştur
        signer = provider.getSigner();
        const address = await signer.getAddress();
        log(`Wallet address: ${address}`);

        // 5. Kontrat oluştur
        if (!contractABI) {
            log("ERROR: ABI not loaded!");
            return;
        }
        
        contract = new ethers.Contract(contractAddress, contractABI, signer);
        log("Contract instance created");

        // 6. UI güncelle
        walletAddress.textContent = `Connected: ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        connectButton.style.display = "none";
        gameControls.style.display = "block";

        log("Wallet connected successfully!");
        checkHeroStatus();
        listenForEvents();
    } catch (e) {
        log(`Error connecting: ${e.message}`);
        console.error("Full error:", e);
    }
}

let userHeroId = null;

async function checkHeroStatus() {
    if (!contract) {
        log("Contract not available for hero status check");
        return;
    }
    
    try {
        const address = await signer.getAddress();
        log(`Checking hero status for address: ${address}`);
        
        const balance = await contract.balanceOf(address);
        log(`Hero balance: ${balance.toString()}`);

        if (balance.toNumber() > 0) {
            userHeroId = await contract.tokenOfOwnerByIndex(address, 0);
            heroStatus.textContent = `Hero ID: ${userHeroId.toString()}`;
            mintHeroButton.disabled = true;
            enterDungeonButton.disabled = false;
            log("Hero found, dungeon button enabled");
        } else {
            heroStatus.textContent = "No hero found. Mint one!";
            mintHeroButton.disabled = false;
            enterDungeonButton.disabled = true;
            log("No hero found, mint button enabled");
        }
    } catch (e) {
        log(`Error checking hero status: ${e.message}`);
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

    if (!pythConnection) {
        log("Pyth connection not available. Cannot enter dungeon.");
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

    log("Setting up event listeners...");

    // Mevcut event'leri dinle
    contract.on("HeroMinted", (heroId, owner, level) => {
        log(`Hero ${heroId} minted for ${owner} at level ${level}`);
        checkHeroStatus();
    });

    contract.on("HeroLeveledUp", (heroId, newLevel) => {
        log(`Hero ${heroId} leveled up to ${newLevel}`);
        checkHeroStatus();
    });

    contract.on("RandomnessRequested", (requestId, requester) => {
        log(`Randomness requested: ${requestId} by ${requester}`);
    });

    contract.on("RandomnessFulfilled", (requestId, randomNumber) => {
        log(`Randomness fulfilled: ${requestId} with ${randomNumber}`);
        enterDungeonButton.disabled = false;
        enterDungeonButton.textContent = "Enter Dungeon";
        checkHeroStatus();
    });
}