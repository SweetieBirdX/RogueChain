// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

contract RogueChain is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard {
    
    // Events
    event HeroMinted(uint256 indexed heroId, address indexed owner, uint256 level);
    event HeroLeveledUp(uint256 indexed heroId, uint256 newLevel);
    event RandomnessRequested(bytes32 indexed requestId, address indexed requester);
    event RandomnessFulfilled(bytes32 indexed requestId, uint64 randomNumber);
    
    // Structs
    struct Hero {
        uint256 id;
        address owner;
        uint256 level;
        uint256 experience;
        uint256 strength;
        uint256 agility;
        uint256 intelligence;
        uint256 vitality;
        uint256 luck;
    }
    
    struct GameSession {
        uint256 heroId;
        uint256 startTime;
        bool isActive;
        uint256 currentFloor;
        uint256 monstersDefeated;
    }
    
    // State variables
    mapping(uint256 => Hero) public heroes;
    mapping(address => uint256[]) public userHeroes;
    mapping(bytes32 => address) public randomnessRequests;
    mapping(uint256 => GameSession) public gameSessions;
    
    IPyth public pyth;
    uint256 private _nextTokenId;
    uint256 public constant MAX_LEVEL = 100;
    uint256 public constant BASE_EXPERIENCE = 100;
    
    // Modifiers
    modifier onlyHeroOwner(uint256 heroId) {
        require(ownerOf(heroId) == msg.sender, "Not the owner of this hero");
        _;
    }
    
    modifier validHeroId(uint256 heroId) {
        require(_ownerOf(heroId) != address(0), "Hero does not exist");
        _;
    }
    
    // Constructor
    constructor(
        address _pyth,
        address _pythEntropy,
        bytes32 _ethPriceId,
        bytes32 _btcPriceId
    ) ERC721("RogueChain Heroes", "RCH") Ownable(msg.sender) {
        pyth = IPyth(_pyth);
        // Store additional Pyth parameters for future use
        // _pythEntropy, _ethPriceId, _btcPriceId can be used for price feeds
    }
    
    // Core functions
    function mintHero() external {
        uint256 heroId = _nextTokenId++;
        _safeMint(msg.sender, heroId);
        
        // Initialize hero with random stats
        heroes[heroId] = Hero({
            id: heroId,
            owner: msg.sender,
            level: 1,
            experience: 0,
            strength: _generateRandomStat(10, 20),
            agility: _generateRandomStat(10, 20),
            intelligence: _generateRandomStat(10, 20),
            vitality: _generateRandomStat(10, 20),
            luck: _generateRandomStat(5, 15)
        });
        
        userHeroes[msg.sender].push(heroId);
        emit HeroMinted(heroId, msg.sender, 1);
    }
    
    function startGameSession(uint256 heroId) external onlyHeroOwner(heroId) validHeroId(heroId) {
        require(!gameSessions[heroId].isActive, "Game session already active");
        
        gameSessions[heroId] = GameSession({
            heroId: heroId,
            startTime: block.timestamp,
            isActive: true,
            currentFloor: 1,
            monstersDefeated: 0
        });
    }
    
    function endGameSession(uint256 heroId) external onlyHeroOwner(heroId) validHeroId(heroId) {
        require(gameSessions[heroId].isActive, "No active game session");
        
        GameSession storage session = gameSessions[heroId];
        session.isActive = false;
        
        // Award experience based on monsters defeated
        uint256 experienceGained = session.monstersDefeated * 10;
        heroes[heroId].experience += experienceGained;
        
        // Check for level up
        _checkLevelUp(heroId);
    }
    
    function requestRandomness() external payable {
        require(msg.value >= 0.001 ether, "Insufficient payment for randomness");
        
        // For now, we'll use block-based randomness
        // In production, this would integrate with Pyth's randomness service
        uint256 randomNumber = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, msg.sender)));
        
        emit RandomnessRequested(bytes32(randomNumber), msg.sender);
        
        // Process randomness immediately
        _processRandomness(msg.sender, uint64(randomNumber));
    }
    
    // Internal functions
    function _checkLevelUp(uint256 heroId) internal {
        Hero storage hero = heroes[heroId];
        uint256 requiredExp = hero.level * BASE_EXPERIENCE;
        
        if (hero.experience >= requiredExp && hero.level < MAX_LEVEL) {
            hero.level++;
            hero.strength += _generateRandomStat(1, 3);
            hero.agility += _generateRandomStat(1, 3);
            hero.intelligence += _generateRandomStat(1, 3);
            hero.vitality += _generateRandomStat(1, 3);
            hero.luck += _generateRandomStat(0, 2);
            
            emit HeroLeveledUp(heroId, hero.level);
        }
    }
    
    function _generateRandomStat(uint256 min, uint256 max) internal view returns (uint256) {
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, msg.sender)));
        return min + (random % (max - min + 1));
    }
    
    function _processRandomness(address requester, uint64 randomNumber) internal {
        // Implement game mechanics using randomness
        // This could be for combat, loot generation, etc.
    }
    
    // View functions
    function getHero(uint256 heroId) external view validHeroId(heroId) returns (Hero memory) {
        return heroes[heroId];
    }
    
    function getUserHeroes(address user) external view returns (uint256[] memory) {
        return userHeroes[user];
    }
    
    function getGameSession(uint256 heroId) external view validHeroId(heroId) returns (GameSession memory) {
        return gameSessions[heroId];
    }
    
    function getHeroStats(uint256 heroId) external view validHeroId(heroId) returns (
        uint256 level,
        uint256 experience,
        uint256 strength,
        uint256 agility,
        uint256 intelligence,
        uint256 vitality,
        uint256 luck
    ) {
        Hero memory hero = heroes[heroId];
        return (
            hero.level,
            hero.experience,
            hero.strength,
            hero.agility,
            hero.intelligence,
            hero.vitality,
            hero.luck
        );
    }
    
    // Game functions
    function enterDungeon(uint256 heroId, bytes[] memory priceUpdateData) external payable onlyHeroOwner(heroId) nonReentrant {
        require(heroes[heroId].level > 0, "Hero does not exist");
        require(msg.value >= 0.001 ether, "Insufficient fee");
        
        // Basit dungeon logic (Pyth entegrasyonu için placeholder)
        uint256 randomResult = _generateRandomStat(1, 100);
        bool victory = (randomResult % 2) == 0; // %50 şans
        
        if (victory) {
            // Hero level up
            heroes[heroId].level += 1;
            heroes[heroId].experience += 100;
            emit HeroLeveledUp(heroId, heroes[heroId].level);
        }
        
        // Kalan ETH'i geri gönder
        if (msg.value > 0.001 ether) {
            payable(msg.sender).transfer(msg.value - 0.001 ether);
        }
    }
    
    // Admin functions
    function setPyth(address _pyth) external onlyOwner {
        pyth = IPyth(_pyth);
    }
    
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // Override functions
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        address from = _ownerOf(tokenId);
        
        if (from != address(0)) {
            // Remove from old owner's heroes list
            uint256[] storage fromHeroes = userHeroes[from];
            for (uint256 i = 0; i < fromHeroes.length; i++) {
                if (fromHeroes[i] == tokenId) {
                    fromHeroes[i] = fromHeroes[fromHeroes.length - 1];
                    fromHeroes.pop();
                    break;
                }
            }
        }
        
        if (to != address(0)) {
            // Add to new owner's heroes list
            userHeroes[to].push(tokenId);
        }
        
        return super._update(to, tokenId, auth);
    }
    
    // ERC721Enumerable override functions
    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}