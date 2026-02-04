
// Full-screen canvas setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// DOM Elements
const startScreen = document.getElementById('start-screen');
const upgradeScreen = document.getElementById('upgrade-screen');
const shopScreen = document.getElementById('shop-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startButton = document.getElementById('start-button');
const continueButton = document.getElementById('continue-button');
const restartButton = document.getElementById('restart-button');
const mainMenuButtonGameover = document.getElementById('main-menu-button-gameover');
const upgradeGrid = document.getElementById('upgrade-grid');
const shopGrid = document.getElementById('shop-grid');
const characterCards = document.querySelectorAll('.character-card');

// UI Elements
const healthBar = document.getElementById('health-bar');
const scoreDisplay = document.getElementById('score-display');
const waveDisplay = document.getElementById('wave-display');
const waveDisplayUI = document.getElementById('wave-display-ui');
const levelDisplay = document.getElementById('level-display');
const levelDisplayUI = document.getElementById('level-display-ui');
const experienceBar = document.getElementById('experience-bar');
const killsDisplay = document.getElementById('kills-display');
const damageDisplay = document.getElementById('damage-display');
const firerateDisplay = document.getElementById('firerate-display');
const projectilesDisplay = document.getElementById('projectiles-display');
const bossHealthContainer = document.getElementById('boss-health-container');
const bossHealthBar = document.getElementById('boss-health-bar');
const coinsDisplay = document.getElementById('coins-display');
const finalScoreDisplay = document.getElementById('final-score');
const wavesSurvivedDisplay = document.getElementById('waves-survived');
const enemiesSlainDisplay = document.getElementById('enemies-slain');
const coinsEarnedDisplay = document.getElementById('coins-earned');

// Game state
const gameState = {
    current: 'menu', // menu, playing, upgrading, shopping, gameOver
    running: false,
    currentWave: 1,
    score: 0,
    coins: 0,
    enemiesKilled: 0,
    totalEnemiesKilled: 0,
    enemiesToSpawn: 0,
    enemiesAlive: 0,
    lastEnemySpawn: 0,
    enemySpawnInterval: 500, // Faster spawn rate
    pickups: [],
    damageTexts: [],
    lastShot: 0,
    isBossWave: false,
    boss: null,
    characterClass: 'balanced', // balanced, scout, tank, smg
    gameLoopId: null,
    completedBossWave: false, // Flag for post-boss shop
    waveProgress: 0 // For progress bar
};

// Player properties - will be set based on character class
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 22,
    baseSpeed: 5.0,
    speed: 5.0,
    maxHealth: 100,
    health: 100,
    baseDamage: 15,
    damage: 15,
    baseFireRate: 1.0, // Multiplier for fire rate
    fireRate: 1.0,
    baseProjectileCount: 1, // Number of projectiles per shot
    projectileCount: 1,
    projectileSpread: 0.3, // Angle spread between projectiles
    explosionRadius: 0, // Area damage radius
    explosionDamage: 0, // Area damage amount
    invulnerable: false,
    invulnerableTime: 0,
    facingRight: true,
    wingAngle: 0,
    wingDirection: 1,
    rearCannon: false, // Shoots backward
    sideCannons: false, // Shoots left and right
    piercingShots: false, // Projectiles pierce through enemies
    lifeSteal: 0.10 // 10% life steal
};

// Game objects
let enemies = [];
let projectiles = [];
let particles = [];

// Controls
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    ArrowUp: false,
    ArrowLeft: false,
    ArrowDown: false,
    ArrowRight: false,
    Space: false
};

// Mouse position
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;

// Character class stats
const characterClasses = {
    balanced: {
        speed: 1.0,
        health: 1.0,
        damage: 1.0,
        fireRate: 1.0,
        projectileCount: 1
    },
    scout: {
        speed: 1.4,
        health: 0.7,
        damage: 0.85,
        fireRate: 1.3,
        projectileCount: 1
    },
    tank: {
        speed: 0.75,
        health: 1.6,
        damage: 1.25,
        fireRate: 0.8,
        projectileCount: 1
    },
    smg: {
        speed: 1.0,
        health: 0.75,
        damage: 0.8,
        fireRate: 1.5,
        projectileCount: 3
    }
};

// Upgrade definitions - balanced mix of good and bad upgrades
const upgrades = [
    // Good upgrades
    { id: 'damage_1', name: 'Sharper Beak', type: 'good', icon: '🔪', description: 'Your beak becomes razor sharp, increasing damage per hit.', effect: '+25% DAMAGE', cost: 0, apply: () => { player.damage *= 1.25; } },
    { id: 'health_1', name: 'Thick Blood', type: 'good', icon: '❤️', description: 'Your blood thickens, increasing your maximum health.', effect: '+40 MAX HEALTH', cost: 0, apply: () => { player.maxHealth += 40; player.health = Math.min(player.health + 20, player.maxHealth); } },
    { id: 'speed_1', name: 'Swift Wings', type: 'good', icon: '🕊️', description: 'Your wings grow stronger, increasing your movement speed.', effect: '+30% SPEED', cost: 0, apply: () => { player.speed *= 1.3; } },
    { id: 'firerate_1', name: 'Rapid Peck', type: 'good', icon: '⚡', description: 'Your pecking speed increases dramatically.', effect: '+40% FIRE RATE', cost: 0, apply: () => { player.fireRate *= 1.4; } },
    { id: 'projectiles_1', name: 'Multi-Shot', type: 'good', icon: '🎯', description: 'Your attacks split into multiple projectiles.', effect: '+2 PROJECTILES', cost: 0, apply: () => { player.projectileCount += 2; } },
    { id: 'lifesteal_1', name: 'Blood Sucker', type: 'good', icon: '🧛', description: 'You drain more life from your enemies.', effect: '+15% LIFE STEAL', cost: 0, apply: () => { player.lifeSteal += 0.15; } },
    { id: 'explosion_1', name: 'Explosive Shots', type: 'good', icon: '💥', description: 'Your projectiles explode on impact, damaging nearby enemies.', effect: 'AREA DAMAGE: 15 in 60 radius', cost: 0, apply: () => { player.explosionRadius = 60; player.explosionDamage = 15; } },
    { id: 'pierce_1', name: 'Piercing Beak', type: 'good', icon: '🗡️', description: 'Your projectiles can now pierce through multiple enemies.', effect: 'PROJECTILES PIERCE 2 ENEMIES', cost: 0, apply: () => { player.piercingShots = true; } },
    { id: 'rear_cannon', name: 'Rear Cannon', type: 'good', icon: '🔫', description: 'A magical cannon appears on your back, shooting backward automatically.', effect: 'AUTOMATIC REAR ATTACK', cost: 0, apply: () => { player.rearCannon = true; } },
    { id: 'side_cannons', name: 'Side Cannons', type: 'good', icon: '🔫', description: 'Magical cannons appear on your sides, shooting left and right automatically.', effect: 'AUTOMATIC SIDE ATTACKS', cost: 0, apply: () => { player.sideCannons = true; } },
    
    // Bad upgrades (with trade-offs)
    { id: 'damage_speed', name: 'Heavy Beak', type: 'bad', icon: '⬇️', description: 'Your beak becomes heavier and more damaging, but slows you down.', effect: '+35% DAMAGE, -25% SPEED', cost: 0, apply: () => { player.damage *= 1.35; player.speed *= 0.75; } },
    { id: 'firerate_health', name: 'Adrenaline Rush', type: 'bad', icon: '⬇️', description: 'Your heart pumps faster, increasing fire rate but reducing maximum health.', effect: '+50% FIRE RATE, -30 MAX HEALTH', cost: 0, apply: () => { player.fireRate *= 1.5; player.maxHealth = Math.max(50, player.maxHealth - 30); player.health = Math.min(player.health, player.maxHealth); } },
    { id: 'projectiles_damage', name: 'Scatter Shot', type: 'bad', icon: '⬇️', description: 'Your shots scatter in many directions, but each deals less damage.', effect: '+4 PROJECTILES, -30% DAMAGE PER SHOT', cost: 0, apply: () => { player.projectileCount += 4; player.damage *= 0.7; } },
    { id: 'speed_damage', name: 'Lightweight', type: 'bad', icon: '⬇️', description: 'You become lighter and faster, but your attacks are weaker.', effect: '+40% SPEED, -25% DAMAGE', cost: 0, apply: () => { player.speed *= 1.4; player.damage *= 0.75; } },
    { id: 'lifesteal_speed', name: 'Blood Frenzy', type: 'bad', icon: '⬇️', description: 'You become obsessed with blood, increasing life steal but reducing movement speed.', effect: '+25% LIFE STEAL, -30% SPEED', cost: 0, apply: () => { player.lifeSteal += 0.25; player.speed *= 0.7; } },
    
    // Neutral/interesting upgrades
    { id: 'explosion_radius', name: 'Bigger Boom', type: 'neutral', icon: '🔥', description: 'Your explosive shots now have a larger radius of destruction.', effect: '+30 EXPLOSION RADIUS', cost: 0, apply: () => { player.explosionRadius += 30; } },
    { id: 'explosion_damage', name: 'Hotter Explosion', type: 'neutral', icon: '🔥', description: 'Your explosive shots deal more damage to nearby enemies.', effect: '+10 EXPLOSION DAMAGE', cost: 0, apply: () => { player.explosionDamage += 10; } },
    { id: 'projectile_speed', name: 'Quick Shots', type: 'neutral', icon: '💨', description: 'Your projectiles travel faster, making them harder to dodge.', effect: '+50% PROJECTILE SPEED', cost: 0, apply: () => {} }, // Handled in shoot function
    { id: 'health_regen', name: 'Blood Regeneration', type: 'neutral', icon: '♻️', description: 'Your vampiric blood slowly regenerates over time.', effect: 'HEALTH REGEN: 0.5 HP/S', cost: 0, apply: () => {} }, // Handled in game loop
    { id: 'critical_hit', name: 'Precision Strike', type: 'neutral', icon: '🎯', description: 'Sometimes your attacks hit critical spots for massive damage.', effect: '15% CRIT CHANCE (+100% DAMAGE)', cost: 0, apply: () => {} } // Handled in damage calculation
];

// Shop items
const shopItems = [
    { id: 'damage_plus', name: 'Enchanted Beak', price: 15, description: 'Magical enchantment that permanently increases your damage.', effect: '+20% DAMAGE', apply: () => { player.damage *= 1.2; } },
    { id: 'health_plus', name: 'Vampire Heart', price: 20, description: 'A powerful vampire heart that increases your maximum health.', effect: '+50 MAX HEALTH', apply: () => { player.maxHealth += 50; player.health = Math.min(player.health + 25, player.maxHealth); } },
    { id: 'firerate_plus', name: 'Quick Blood', price: 18, description: 'Your blood flows faster, increasing attack speed.', effect: '+30% FIRE RATE', apply: () => { player.fireRate *= 1.3; } },
    { id: 'projectiles_plus', name: 'Split Beak', price: 25, description: 'Your attacks magically split into more projectiles.', effect: '+1 PROJECTILE', apply: () => { player.projectileCount += 1; } },
    { id: 'explosion_plus', name: 'Explosive Glands', price: 30, description: 'Magical glands that make your shots explode with greater force.', effect: '+15 EXPLOSION DAMAGE', apply: () => { player.explosionDamage += 15; } },
    { id: 'lifesteal_plus', name: 'Blood Amulet', price: 22, description: 'An amulet that enhances your life-stealing abilities.', effect: '+12% LIFE STEAL', apply: () => { player.lifeSteal += 0.12; } },
    { id: 'speed_plus', name: 'Wind Feathers', price: 16, description: 'Magical feathers that make you faster.', effect: '+25% SPEED', apply: () => { player.speed *= 1.25; } },
    { id: 'armor', name: 'Feather Armor', price: 28, description: 'Magical armor made of hardened feathers that reduces damage taken.', effect: '-20% DAMAGE TAKEN', apply: () => {} }, // Handled in damage calculation
    { id: 'crit_chance', name: 'Sharp Eye', price: 24, description: 'Your aim improves, giving you a better chance to land critical hits.', effect: '+10% CRIT CHANCE', apply: () => {} }, // Handled in damage calculation
    { id: 'crit_damage', name: 'Brutal Beak', price: 26, description: 'Your critical hits become even more devastating.', effect: '+50% CRIT DAMAGE', apply: () => {} } // Handled in damage calculation
];

// Enemy types - 8 unique types with different behaviors
const enemyTypes = [
    { name: 'Slime', color: '#4CAF50', radius: 18, speed: 1.2, health: 40, damage: 2, value: 10, coinValue: 1, spawnChance: 0.2, behavior: 'slow' },
    { name: 'Bat', color: '#2196F3', radius: 15, speed: 3.5, health: 25, damage: 1, value: 8, coinValue: 1, spawnChance: 0.2, behavior: 'fast' },
    { name: 'Zombie', color: '#8BC34A', radius: 22, speed: 0.9, health: 70, damage: 4, value: 18, coinValue: 2, spawnChance: 0.15, behavior: 'tank' },
    { name: 'Ghost', color: '#9C27B0', radius: 20, speed: 2.2, health: 45, damage: 2.5, value: 15, coinValue: 2, spawnChance: 0.1, behavior: 'phase' },
    { name: 'Skeleton', color: '#E91E63', radius: 17, speed: 2.0, health: 50, damage: 3, value: 16, coinValue: 2, spawnChance: 0.12, behavior: 'ranged' },
    { name: 'Spider', color: '#FF9800', radius: 16, speed: 2.8, health: 35, damage: 2, value: 12, coinValue: 1, spawnChance: 0.1, behavior: 'swarm' },
    { name: 'Mage', color: '#3F51B5', radius: 19, speed: 1.5, health: 40, damage: 2, value: 20, coinValue: 3, spawnChance: 0.08, behavior: 'mage' },
    { name: 'Archer', color: '#009688', radius: 18, speed: 2.3, health: 30, damage: 2.5, value: 14, coinValue: 2, spawnChance: 0.05, behavior: 'archer' }
];

// Boss definitions
const bosses = [
    { 
        name: 'Blood Golem', 
        color: '#8B0000', 
        radius: 60, 
        health: 1000, 
        damage: 8, 
        speed: 0.8, 
        value: 500, 
        coinValue: 50,
        attackPattern: 'charge',
        description: 'A massive golem made of congealed blood. It charges at you when enraged!'
    },
    { 
        name: 'Shadow Bat King', 
        color: '#4A148C', 
        radius: 50, 
        health: 1200, 
        damage: 6, 
        speed: 1.8, 
        value: 600, 
        coinValue: 60,
        attackPattern: 'summon',
        description: 'The king of shadow bats. Summons minions to overwhelm you!'
    },
    { 
        name: 'Necromancer', 
        color: '#2E7D32', 
        radius: 45, 
        health: 1500, 
        damage: 5, 
        speed: 1.0, 
        value: 750, 
        coinValue: 75,
        attackPattern: 'resurrect',
        description: 'A powerful necromancer that can resurrect fallen enemies!'
    }
];

// Event listeners
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (gameState.current === 'playing') {
        player.x = Math.min(Math.max(player.x, player.radius), canvas.width - player.radius);
        player.y = Math.min(Math.max(player.y, player.radius), canvas.height - player.radius);
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
        e.preventDefault();
        keys.Space = true;
        return;
    }
    
    const key = e.key.toLowerCase();
    if (key in keys) keys[key] = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
        keys.Space = false;
        return;
    }
    
    const key = e.key.toLowerCase();
    if (key in keys) keys[key] = false;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    player.facingRight = mouseX > player.x;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
    player.facingRight = mouseX > player.x;
});

// Character selection
characterCards.forEach(card => {
    card.addEventListener('click', () => {
        characterCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        gameState.characterClass = card.getAttribute('data-class');
    });
});

// Button event listeners
startButton.addEventListener('click', startGame);
continueButton.addEventListener('click', () => {
    shopScreen.classList.add('hidden');
    gameState.current = 'playing';
    gameState.running = true;
    
    // Start next wave after shop
    gameState.currentWave++;
    startWave();
    gameLoop();
});
restartButton.addEventListener('click', restartGame);
mainMenuButtonGameover.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    gameState.current = 'menu';
});

// Initialize the game
updateHealthBar();
updateExperienceBar();

function applyCharacterClass() {
    const charClass = characterClasses[gameState.characterClass];
    
    // Reset player to base values first
    player.speed = 5.0 * charClass.speed;
    player.maxHealth = 100 * charClass.health;
    player.health = player.maxHealth;
    player.damage = 15 * charClass.damage;
    player.fireRate = 1.0 * charClass.fireRate;
    player.projectileCount = charClass.projectileCount;
    
    // Reset special abilities
    player.explosionRadius = 0;
    player.explosionDamage = 0;
    player.rearCannon = false;
    player.sideCannons = false;
    player.piercingShots = false;
    player.lifeSteal = 0.10;
    
    // Class-specific adjustments
    if (gameState.characterClass === 'tank') {
        player.lifeSteal = 0.15; // Tanks have more lifesteal
    } else if (gameState.characterClass === 'scout') {
        player.projectileSpread = 0.5; // Scouts have wider spread
    } else if (gameState.characterClass === 'smg') {
        player.projectileSpread = 0.2; // SMG has tighter spread
        player.baseFireRate = 1.5;
        player.fireRate = 1.5;
    }
}

function startGame() {
    // Cancel any existing animation frame
    if (gameState.gameLoopId) {
        cancelAnimationFrame(gameState.gameLoopId);
        gameState.gameLoopId = null;
    }
    
    startScreen.classList.add('hidden');
    gameState.current = 'playing';
    gameState.running = true;
    gameState.currentWave = 1;
    gameState.score = 0;
    gameState.coins = 0;
    gameState.enemiesKilled = 0;
    gameState.totalEnemiesKilled = 0;
    gameState.enemiesAlive = 0;
    gameState.lastEnemySpawn = Date.now();
    gameState.enemySpawnInterval = 500; // Faster spawn
    gameState.pickups = [];
    gameState.damageTexts = [];
    gameState.isBossWave = false;
    gameState.boss = null;
    gameState.completedBossWave = false;
    gameState.waveProgress = 0;
    
    // Apply character class
    applyCharacterClass();
    
    // Reset player position
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.invulnerable = false;
    player.invulnerableTime = 0;
    
    // Reset objects
    enemies = [];
    projectiles = [];
    particles = [];
    
    // Update UI
    updateHealthBar();
    updateExperienceBar();
    scoreDisplay.textContent = `SCORE: ${gameState.score}`;
    waveDisplay.textContent = `WAVE ${gameState.currentWave}`;
    waveDisplayUI.textContent = gameState.currentWave;
    levelDisplay.textContent = `LEVEL 1`;
    levelDisplayUI.textContent = 1;
    killsDisplay.textContent = gameState.totalEnemiesKilled;
    damageDisplay.textContent = Math.round(player.damage);
    firerateDisplay.textContent = `${player.fireRate.toFixed(1)}x`;
    projectilesDisplay.textContent = player.projectileCount;
    coinsDisplay.textContent = gameState.coins;
    
    // Start first wave
    startWave();
    
    // Start game loop
    gameLoop();
}

function restartGame() {
    gameOverScreen.classList.add('hidden');
    startGame();
}

function startWave() {
    // Reset wave progress
    gameState.enemiesKilled = 0;
    gameState.waveProgress = 0;
    updateExperienceBar();
    
    if (gameState.currentWave % 5 === 0) {
        // Boss wave
        gameState.isBossWave = true;
        bossHealthContainer.style.display = 'block';
        
        const bossIndex = Math.min(Math.floor(gameState.currentWave / 5) - 1, bosses.length - 1);
        const bossTemplate = bosses[bossIndex];
        
        // Scale boss stats with wave number
        const scaleMultiplier = 1 + (gameState.currentWave / 5) * 0.5;
        
        gameState.boss = {
            x: canvas.width / 2,
            y: 100,
            radius: bossTemplate.radius,
            health: bossTemplate.health * scaleMultiplier,
            maxHealth: bossTemplate.health * scaleMultiplier,
            damage: bossTemplate.damage * scaleMultiplier,
            speed: bossTemplate.speed,
            color: bossTemplate.color,
            name: bossTemplate.name,
            attackPattern: bossTemplate.attackPattern,
            value: bossTemplate.value,
            coinValue: bossTemplate.coinValue,
            lastAttack: 0,
            attackCooldown: 2000,
            enrageThreshold: bossTemplate.health * scaleMultiplier * 0.5,
            isEnraged: false,
            minions: []
        };
        
        // Update boss health bar
        updateBossHealthBar();
    } else {
        // Regular wave
        gameState.isBossWave = false;
        bossHealthContainer.style.display = 'none';
        gameState.boss = null;
        
        // Calculate enemies to spawn based on wave - more aggressive scaling
        gameState.enemiesToSpawn = Math.floor(10 + gameState.currentWave * 4.5);
        gameState.enemiesAlive = 0;
        gameState.enemiesKilled = 0;
        
        // Spawn initial enemies
        spawnEnemies(Math.min(gameState.enemiesToSpawn));
    }
}

function updateBossHealthBar() {
    if (!gameState.boss) return;
    
    const healthPercent = (gameState.boss.health / gameState.boss.maxHealth) * 100;
    bossHealthBar.style.width = `${healthPercent}%`;
    
    // Change color based on health
    if (healthPercent > 60) {
        bossHealthBar.style.background = 'linear-gradient(90deg, #ff1744, #d50000)';
    } else if (healthPercent > 30) {
        bossHealthBar.style.background = 'linear-gradient(90deg, #FF5722, #E64A19)';
    } else {
        bossHealthBar.style.background = 'linear-gradient(90deg, #F44336, #C62828)';
    }
}

function spawnEnemies(count) {
    const now = Date.now();
    if (now - gameState.lastEnemySpawn < gameState.enemySpawnInterval) return;
    
    for (let i = 0; i < count; i++) {
        if (gameState.enemiesKilled + gameState.enemiesAlive >= gameState.enemiesToSpawn) break;
        
        // Determine enemy type based on spawn chances
        const rand = Math.random();
        let cumulativeChance = 0;
        let enemyType = enemyTypes[0];
        
        for (const type of enemyTypes) {
            cumulativeChance += type.spawnChance;
            if (rand < cumulativeChance) {
                enemyType = type;
                break;
            }
        }
        
        // Random position around the edges
        let x, y;
        const side = Math.floor(Math.random() * 4);
        const padding = 50;
        
        switch(side) {
            case 0: // top
                x = padding + Math.random() * (canvas.width - padding * 2);
                y = -30;
                break;
            case 1: // right
                x = canvas.width + 30;
                y = padding + Math.random() * (canvas.height - padding * 2);
                break;
            case 2: // bottom
                x = padding + Math.random() * (canvas.width - padding * 2);
                y = canvas.height + 30;
                break;
            case 3: // left
                x = -30;
                y = padding + Math.random() * (canvas.height - padding * 2);
                break;
        }
        
        // Scale stats with wave - much more aggressive scaling
        const waveScale = 1 + (gameState.currentWave - 1) * 0.45;
        // After boss waves, enemies get a significant boost
        const postBossMultiplier = (gameState.currentWave > 5 && (gameState.currentWave - 1) % 5 === 0) ? 1.8 : 1.0;
        
        const enemy = {
            x: x,
            y: y,
            radius: enemyType.radius,
            speed: enemyType.speed * waveScale * postBossMultiplier,
            health: enemyType.health * waveScale * postBossMultiplier,
            maxHealth: enemyType.health * waveScale * postBossMultiplier,
            damage: enemyType.damage * waveScale * postBossMultiplier,
            value: enemyType.value,
            coinValue: enemyType.coinValue,
            color: enemyType.color,
            type: enemyType.name,
            behavior: enemyType.behavior,
            vx: 0,
            vy: 0,
            isSlowed: false,
            slowDuration: 0,
            lastAttack: 0,
            attackCooldown: 1500,
            target: null, // For swarm behavior
            isPhased: false,
            lastPhase: 0,
            phaseCooldown: 5000,
            phaseDuration: 1000
        };
        
        // Special behavior initialization
        if (enemy.behavior === 'mage') {
            enemy.projectileSpeed = 4;
            enemy.projectileDamage = enemy.damage * 0.7;
        } else if (enemy.behavior === 'archer') {
            enemy.attackRange = 300;
            enemy.projectileSpeed = 6;
            enemy.projectileDamage = enemy.damage * 0.8;
        }
        
        enemies.push(enemy);
        gameState.enemiesAlive++;
    }
    
    gameState.lastEnemySpawn = now;
}

function shootWeapon() {
    const now = Date.now();
    const fireRateMultiplier = player.fireRate;
    const minShootInterval = 300 / fireRateMultiplier; // Base 300ms cooldown, modified by fire rate
    
    if (now - gameState.lastShot < minShootInterval) return;
    
    // Calculate direction to mouse
    const dx = mouseX - player.x;
    const dy = mouseY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist === 0) return;
    
    // Determine number of projectiles and spread
    const projectileCount = player.projectileCount;
    const baseAngle = Math.atan2(dy, dx);
    const spread = player.projectileSpread;
    
    // Create projectiles
    for (let i = 0; i < projectileCount; i++) {
        // Calculate angle for this projectile
        let angle;
        if (projectileCount === 1) {
            angle = baseAngle;
        } else {
            // Distribute projectiles evenly around the base angle
            const spreadOffset = spread * (projectileCount - 1) / 2;
            angle = baseAngle - spreadOffset + (i * spread);
        }
        
        const speed = 14; // Base projectile speed
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        
        projectiles.push({
            x: player.x + (player.facingRight ? player.radius : -player.radius),
            y: player.y,
            vx: vx,
            vy: vy,
            radius: 7,
            damage: player.damage,
            color: '#ff5252',
            pierces: player.piercingShots ? 2 : 0,
            explosionRadius: player.explosionRadius,
            explosionDamage: player.explosionDamage
        });
    }
    
    // Rear cannon shots
    if (player.rearCannon) {
        const rearAngle = baseAngle + Math.PI; // Opposite direction
        const rearSpeed = 10;
        const rearVx = Math.cos(rearAngle) * rearSpeed;
        const rearVy = Math.sin(rearAngle) * rearSpeed;
        
        projectiles.push({
            x: player.x - (player.facingRight ? player.radius : -player.radius),
            y: player.y,
            vx: rearVx,
            vy: rearVy,
            radius: 6,
            damage: player.damage * 0.7,
            color: '#4da6ff',
            pierces: player.piercingShots ? 1 : 0,
            explosionRadius: player.explosionRadius * 0.7,
            explosionDamage: player.explosionDamage * 0.7
        });
    }
    
    // Side cannon shots
    if (player.sideCannons) {
        const leftAngle = baseAngle - Math.PI/2;
        const rightAngle = baseAngle + Math.PI/2;
        const sideSpeed = 9;
        
        // Left side
        projectiles.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(leftAngle) * sideSpeed,
            vy: Math.sin(leftAngle) * sideSpeed,
            radius: 6,
            damage: player.damage * 0.6,
            color: '#ffd700',
            pierces: 0,
            explosionRadius: 0,
            explosionDamage: 0
        });
        
        // Right side
        projectiles.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(rightAngle) * sideSpeed,
            vy: Math.sin(rightAngle) * sideSpeed,
            radius: 6,
            damage: player.damage * 0.6,
            color: '#ffd700',
            pierces: 0,
            explosionRadius: 0,
            explosionDamage: 0
        });
    }
    
    gameState.lastShot = now;
}

function updateHealthBar() {
    const healthPercent = (player.health / player.maxHealth) * 100;
    healthBar.style.width = `${healthPercent}%`;
    
    // Change color based on health
    if (healthPercent > 60) {
        healthBar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
    } else if (healthPercent > 30) {
        healthBar.style.background = 'linear-gradient(90deg, #FFC107, #FF9800)';
    } else {
        healthBar.style.background = 'linear-gradient(90deg, #F44336, #E91E63)';
    }
}

function updateExperienceBar() {
    // Show wave progress instead of experience
    const progressPercent = (gameState.enemiesKilled / gameState.enemiesToSpawn) * 100;
    experienceBar.style.width = `${Math.min(100, progressPercent)}%`;
    
    // Change color based on progress
    if (progressPercent > 70) {
        experienceBar.style.background = 'linear-gradient(90deg, #FF9800, #FF5722)';
    } else if (progressPercent > 30) {
        experienceBar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
    } else {
        experienceBar.style.background = 'linear-gradient(90deg, #2196F3, #03A9F4)';
    }
}

function showUpgradeScreen() {
    upgradeScreen.classList.remove('hidden');
    gameState.current = 'upgrading';
    gameState.running = false;
    
    // Generate 3 random upgrades (mix of good, bad, and neutral)
    gameState.upgradeChoices = [];
    const allUpgrades = [...upgrades];
    
    // Ensure at least one good upgrade
    const goodUpgrades = allUpgrades.filter(u => u.type === 'good');
    if (goodUpgrades.length > 0 && Math.random() > 0.3) {
        const randomGood = goodUpgrades[Math.floor(Math.random() * goodUpgrades.length)];
        gameState.upgradeChoices.push(randomGood);
        allUpgrades.splice(allUpgrades.indexOf(randomGood), 1);
    }
    
    // Fill the rest with random upgrades
    while (gameState.upgradeChoices.length < 3 && allUpgrades.length > 0) {
        const index = Math.floor(Math.random() * allUpgrades.length);
        gameState.upgradeChoices.push(allUpgrades.splice(index, 1)[0]);
    }
    
    // Render upgrade choices
    upgradeGrid.innerHTML = '';
    gameState.upgradeChoices.forEach(upgrade => {
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
            <div class="upgrade-header">
                <div class="upgrade-name">
                    ${upgrade.icon} ${upgrade.name}
                </div>
                <div class="upgrade-type type-${upgrade.type}">
                    ${upgrade.type.toUpperCase()}
                </div>
            </div>
            <div class="upgrade-description">${upgrade.description}</div>
            <div class="upgrade-effect effect-${upgrade.type}">${upgrade.effect}</div>
        `;
        card.addEventListener('click', () => {
            upgrade.apply();
            // Update UI
            damageDisplay.textContent = Math.round(player.damage);
            firerateDisplay.textContent = `${player.fireRate.toFixed(1)}x`;
            projectilesDisplay.textContent = player.projectileCount;
            
            // Check if we just defeated a boss
            if (gameState.completedBossWave) {
                gameState.completedBossWave = false;
                // Show shop after boss upgrade
                setTimeout(() => {
                    showShopScreen();
                }, 300);
            } else {
                // Start next wave
                gameState.currentWave++;
                startWave();
            }
            
            upgradeScreen.classList.add('hidden');
            gameState.current = 'playing';
            gameState.running = true;
            gameLoop();
        });
        upgradeGrid.appendChild(card);
    });
}

function showShopScreen() {
    shopScreen.classList.remove('hidden');
    gameState.current = 'shopping';
    gameState.running = false;
    
    // Update coins display
    coinsDisplay.textContent = gameState.coins;
    coinsEarnedDisplay.textContent = gameState.coins;
    
    // Generate shop items
    shopGrid.innerHTML = '';
    const availableItems = [...shopItems];
    
    // Show 4 random items
    for (let i = 0; i < 4 && availableItems.length > 0; i++) {
        const index = Math.floor(Math.random() * availableItems.length);
        const item = availableItems.splice(index, 1)[0];
        
        const card = document.createElement('div');
        card.className = `shop-item ${item.price > gameState.coins ? 'sold-out' : ''}`;
        card.innerHTML = `
            <div class="shop-header">
                <div class="shop-name">${item.name}</div>
                <div class="shop-price">${item.price} 💰</div>
            </div>
            <div class="shop-description">${item.description}</div>
            <div class="shop-effect">${item.effect}</div>
        `;
        
        if (item.price <= gameState.coins) {
            card.addEventListener('click', () => {
                if (gameState.coins >= item.price) {
                    gameState.coins -= item.price;
                    item.apply();
                    card.classList.add('sold-out');
                    card.style.opacity = '0.5';
                    card.style.cursor = 'not-allowed';
                    coinsDisplay.textContent = gameState.coins;
                    
                    // Update UI
                    damageDisplay.textContent = Math.round(player.damage);
                    firerateDisplay.textContent = `${player.fireRate.toFixed(1)}x`;
                    projectilesDisplay.textContent = player.projectileCount;
                }
            });
        }
        
        shopGrid.appendChild(card);
    }
}

function createBloodSplatter(x, y, size) {
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        const radius = 2 + Math.random() * 5;
        
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: radius,
            color: '#8a0303',
            alpha: 0.9,
            life: 25 + Math.random() * 35
        });
    }
}

function createDamageText(x, y, amount, isCritical) {
    gameState.damageTexts.push({
        x: x,
        y: y,
        text: isCritical ? `CRITICAL ${amount}` : amount.toString(),
        alpha: 1,
        life: 60,
        vy: -1.5,
        color: isCritical ? '#ffd700' : '#ff5252',
        scale: isCritical ? 1.3 : 1.0
    });
}

function createHitFlash(x, y) {
    particles.push({
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        radius: 15,
        color: '#ff0000',
        alpha: 0.7,
        life: 10,
        expand: true
    });
}

function gameLoop(timestamp) {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameState.running) {
        // Handle player movement
        let moveX = 0;
        let moveY = 0;
        
        if (keys.w || keys.ArrowUp) moveY -= 1;
        if (keys.s || keys.ArrowDown) moveY += 1;
        if (keys.a || keys.ArrowLeft) moveX -= 1;
        if (keys.d || keys.ArrowRight) moveX += 1;
        
        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.7071;
            moveY *= 0.7071;
        }
        
        // Apply movement
        player.x += moveX * player.speed;
        player.y += moveY * player.speed;
        
        // Keep player in bounds with padding
        const padding = player.radius + 10;
        player.x = Math.max(padding, Math.min(canvas.width - padding, player.x));
        player.y = Math.max(padding, Math.min(canvas.height - padding, player.y));
        
        // Animate wings
        player.wingAngle += 0.1 * player.wingDirection;
        if (Math.abs(player.wingAngle) > 0.5) {
            player.wingDirection *= -1;
        }
        
        // Handle shooting
        if (keys.Space) {
            shootWeapon();
        }
        
        // Health regeneration (if upgrade applied)
        if (player.health < player.maxHealth && Math.random() < 0.01) {
            player.health = Math.min(player.maxHealth, player.health + 0.5);
            updateHealthBar();
        }
        
        // Update projectiles
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            
            // Move projectile
            p.x += p.vx;
            p.y += p.vy;
            
            // Remove if out of bounds
            if (p.x < -50 || p.x > canvas.width + 50 || p.y < -50 || p.y > canvas.height + 50) {
                projectiles.splice(i, 1);
                continue;
            }
            
            // Check collision with enemies
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                const dx = p.x - e.x;
                const dy = p.y - e.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < e.radius + p.radius) {
                    // Determine if this is a critical hit (15% chance)
                    const isCritical = Math.random() < 0.15;
                    const damageAmount = isCritical ? Math.round(p.damage * 2) : Math.round(p.damage);
                    
                    // Damage enemy
                    e.health -= damageAmount;
                    
                    // Create damage text
                    createDamageText(e.x, e.y - e.radius, damageAmount, isCritical);
                    
                    // Create blood splatter if enemy dies
                    if (e.health <= 0) {
                        createBloodSplatter(e.x, e.y, e.radius);
                        gameState.score += e.value;
                        gameState.coins += e.coinValue;
                        gameState.enemiesKilled++;
                        gameState.totalEnemiesKilled++;
                        gameState.waveProgress = (gameState.enemiesKilled / gameState.enemiesToSpawn) * 100;
                        updateExperienceBar();
                        
                        // 15% chance to drop an extra coin
                        if (Math.random() < 0.15) {
                            gameState.coins += 1;
                        }
                        
                        enemies.splice(j, 1);
                        gameState.enemiesAlive--;
                    }
                    
                    // Heal player based on life steal
                    const healAmount = damageAmount * player.lifeSteal;
                    player.health = Math.min(player.maxHealth, player.health + healAmount);
                    updateHealthBar();
                    
                    // Handle explosion if applicable
                    if (p.explosionRadius > 0 && e.health <= 0) {
                        // Damage nearby enemies
                        for (let k = enemies.length - 1; k >= 0; k--) {
                            const e2 = enemies[k];
                            const ex = p.x - e2.x;
                            const ey = p.y - e2.y;
                            const dist = Math.sqrt(ex * ex + ey * ey);
                            
                            if (dist < p.explosionRadius + e2.radius) {
                                const explosionDamage = p.explosionDamage * (1 - dist / p.explosionRadius);
                                e2.health -= explosionDamage;
                                
                                if (e2.health <= 0) {
                                    createBloodSplatter(e2.x, e2.y, e2.radius);
                                    gameState.score += e2.value * 0.5;
                                    gameState.coins += Math.floor(e2.coinValue * 0.5);
                                    gameState.enemiesKilled++;
                                    gameState.totalEnemiesKilled++;
                                    gameState.waveProgress = (gameState.enemiesKilled / gameState.enemiesToSpawn) * 100;
                                    updateExperienceBar();
                                    enemies.splice(k, 1);
                                    gameState.enemiesAlive--;
                                } else {
                                    createDamageText(e2.x, e2.y - e2.radius, Math.round(explosionDamage), false);
                                }
                            }
                        }
                        
                        // Create explosion particles
                        for (let k = 0; k < 15; k++) {
                            const angle = Math.random() * Math.PI * 2;
                            const speed = 1 + Math.random() * 3;
                            
                            particles.push({
                                x: p.x,
                                y: p.y,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed,
                                radius: 2 + Math.random() * 4,
                                color: '#ff9800',
                                alpha: 0.8,
                                life: 20 + Math.random() * 20
                            });
                        }
                    }
                    
                    // Handle projectile piercing
                    if (p.pierces > 0) {
                        p.pierces--;
                    } else {
                        projectiles.splice(i, 1);
                        break;
                    }
                }
            }
            
            // Check collision with boss
            if (gameState.boss && !gameState.boss.isDead) {
                const dx = p.x - gameState.boss.x;
                const dy = p.y - gameState.boss.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < gameState.boss.radius + p.radius) {
                    // Damage boss
                    gameState.boss.health -= p.damage;
                    updateBossHealthBar();
                    
                    // Create damage text
                    createDamageText(gameState.boss.x, gameState.boss.y - gameState.boss.radius, Math.round(p.damage), false);
                    
                    // Create hit flash
                    createHitFlash(gameState.boss.x, gameState.boss.y);
                    
                    // Heal player based on life steal
                    const healAmount = p.damage * player.lifeSteal;
                    player.health = Math.min(player.maxHealth, player.health + healAmount);
                    updateHealthBar();
                    
                    // Handle explosion if applicable
                    if (p.explosionRadius > 0) {
                        // Create explosion particles
                        for (let k = 0; k < 10; k++) {
                            const angle = Math.random() * Math.PI * 2;
                            const speed = 1 + Math.random() * 3;
                            
                            particles.push({
                                x: p.x,
                                y: p.y,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed,
                                radius: 2 + Math.random() * 4,
                                color: '#ff9800',
                                alpha: 0.8,
                                life: 20 + Math.random() * 20
                            });
                        }
                    }
                    
                    // Remove projectile
                    projectiles.splice(i, 1);
                    
                    // Check if boss is dead
                    if (gameState.boss.health <= 0) {
                        gameState.boss.isDead = true;
                        gameState.score += gameState.boss.value;
                        gameState.coins += gameState.boss.coinValue;
                        gameState.enemiesKilled++; // Count boss as an enemy kill
                        gameState.totalEnemiesKilled++;
                        gameState.waveProgress = 100;
                        updateExperienceBar();
                        
                        // Create massive blood splatter
                        for (let k = 0; k < 30; k++) {
                            const angle = Math.random() * Math.PI * 2;
                            const speed = 2 + Math.random() * 5;
                            const radius = 3 + Math.random() * 6;
                            
                            particles.push({
                                x: gameState.boss.x,
                                y: gameState.boss.y,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed,
                                radius: radius,
                                color: '#8a0303',
                                alpha: 0.9,
                                life: 30 + Math.random() * 40
                            });
                        }
                        
                        // Set flag for post-boss shop
                        gameState.completedBossWave = true;
                        
                        // Show upgrade screen after boss defeat
                        setTimeout(() => {
                            showUpgradeScreen();
                        }, 1000);
                    }
                }
            }
        }
        
        // Update boss
        if (gameState.boss && !gameState.boss.isDead) {
            // Boss behavior based on attack pattern
            if (gameState.boss.attackPattern === 'charge') {
                // Boss charges at player when enraged
                if (gameState.boss.health < gameState.boss.enrageThreshold && !gameState.boss.isEnraged) {
                    gameState.boss.isEnraged = true;
                    gameState.boss.speed *= 2;
                }
                
                // Move towards player
                const dx = player.x - gameState.boss.x;
                const dy = player.y - gameState.boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0) {
                    gameState.boss.x += (dx / dist) * gameState.boss.speed;
                    gameState.boss.y += (dy / dist) * gameState.boss.speed;
                }
                
                // Check collision with player
                const playerDist = Math.sqrt((player.x - gameState.boss.x) ** 2 + (player.y - gameState.boss.y) ** 2);
                if (playerDist < player.radius + gameState.boss.radius) {
                    if (!player.invulnerable) {
                        player.health -= gameState.boss.damage * 0.4; // Significant damage
                        updateHealthBar();
                        createHitFlash(player.x, player.y);
                        
                        // Make player invulnerable briefly
                        player.invulnerable = true;
                        player.invulnerableTime = timestamp;
                        
                        // Create damage text
                        createDamageText(player.x, player.y - player.radius, Math.round(gameState.boss.damage * 0.4), false);
                    }
                    
                    // Knockback effect
                    const knockback = 4;
                    player.x += (player.x - gameState.boss.x) / playerDist * knockback;
                    player.y += (player.y - gameState.boss.y) / playerDist * knockback;
                    
                    // Keep player in bounds after knockback
                    player.x = Math.max(padding, Math.min(canvas.width - padding, player.x));
                    player.y = Math.max(padding, Math.min(canvas.height - padding, player.y));
                }
            } else if (gameState.boss.attackPattern === 'summon') {
                // Boss summons minions periodically
                const now = Date.now();
                if (now - gameState.boss.lastAttack > gameState.boss.attackCooldown) {
                    // Summon 3-5 minions around the boss
                    const minionCount = 3 + Math.floor(Math.random() * 3);
                    for (let i = 0; i < minionCount; i++) {
                        const angle = (i / minionCount) * Math.PI * 2;
                        const spawnRadius = gameState.boss.radius + 40;
                        
                        enemies.push({
                            x: gameState.boss.x + Math.cos(angle) * spawnRadius,
                            y: gameState.boss.y + Math.sin(angle) * spawnRadius,
                            radius: 12,
                            speed: 2.5,
                            health: 30,
                            maxHealth: 30,
                            damage: 1.5,
                            value: 5,
                            coinValue: 1,
                            color: '#7B1FA2',
                            type: 'Shadow Minion',
                            behavior: 'fast',
                            vx: 0,
                            vy: 0,
                            isSlowed: false,
                            slowDuration: 0
                        });
                        
                        gameState.enemiesAlive++;
                    }
                    
                    gameState.boss.lastAttack = now;
                }
                
                // Boss slowly moves towards player
                const dx = player.x - gameState.boss.x;
                const dy = player.y - gameState.boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0) {
                    gameState.boss.x += (dx / dist) * gameState.boss.speed * 0.5;
                    gameState.boss.y += (dy / dist) * gameState.boss.speed * 0.5;
                }
            } else if (gameState.boss.attackPattern === 'resurrect') {
                // Boss occasionally resurrects dead enemies
                const now = Date.now();
                if (now - gameState.boss.lastAttack > gameState.boss.attackCooldown && Math.random() < 0.3) {
                    // Find a recently killed enemy position
                    if (particles.length > 10) {
                        const bloodParticle = particles[Math.floor(Math.random() * particles.length)];
                        if (bloodParticle.color === '#8a0303') {
                            enemies.push({
                                x: bloodParticle.x,
                                y: bloodParticle.y,
                                radius: 18,
                                speed: 1.5,
                                health: 40,
                                maxHealth: 40,
                                damage: 2,
                                value: 8,
                                coinValue: 1,
                                color: '#2E7D32',
                                type: 'Zombie',
                                behavior: 'slow',
                                vx: 0,
                                vy: 0,
                                isSlowed: false,
                                slowDuration: 0
                            });
                            
                            gameState.enemiesAlive++;
                        }
                    }
                    
                    gameState.boss.lastAttack = now;
                }
                
                // Boss stays in place but has a large aura
                // Damage player if they get too close
                const playerDist = Math.sqrt((player.x - gameState.boss.x) ** 2 + (player.y - gameState.boss.y) ** 2);
                if (playerDist < player.radius + gameState.boss.radius + 100) {
                    if (!player.invulnerable && Date.now() - gameState.boss.lastAttack > 300) {
                        player.health -= gameState.boss.damage * 0.3;
                        updateHealthBar();
                        createHitFlash(player.x, player.y);
                        
                        player.invulnerable = true;
                        player.invulnerableTime = timestamp;
                        
                        createDamageText(player.x, player.y - player.radius, Math.round(gameState.boss.damage * 0.3), false);
                        gameState.boss.lastAttack = Date.now();
                    }
                }
            }
            
            // Reset invulnerability after time
            if (player.invulnerable && timestamp - player.invulnerableTime > 300) { // Reduced to 300ms
                player.invulnerable = false;
            }
        }
        
        // Update enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            
            // Enemy AI improvements - prevent stacking and add smarter behavior
            let separationForceX = 0;
            let separationForceY = 0;
            let separationCount = 0;
            
            // Calculate separation force from other enemies
            for (let j = 0; j < enemies.length; j++) {
                if (i === j) continue;
                
                const other = enemies[j];
                const dx = e.x - other.x;
                const dy = e.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // If enemies are too close, push them apart
                if (distance > 0 && distance < e.radius + other.radius + 40) { // Increased separation distance
                    separationForceX += dx / distance;
                    separationForceY += dy / distance;
                    separationCount++;
                }
            }
            
            // Apply separation force
            if (separationCount > 0) {
                separationForceX /= separationCount;
                separationForceY /= separationCount;
            }
            
            // Special enemy behaviors
            if (e.behavior === 'ranged' || e.behavior === 'mage' || e.behavior === 'archer') {
                // Ranged enemies try to keep distance
                const distToPlayer = Math.hypot(e.x - player.x, e.y - player.y);
                
                // For mages and archers, attack from range
                if ((e.behavior === 'mage' || e.behavior === 'archer') && distToPlayer < (e.attackRange || 250)) {
                    const now = Date.now();
                    if (now - e.lastAttack > e.attackCooldown) {
                        // Shoot projectile at player
                        const dx = player.x - e.x;
                        const dy = player.y - e.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist > 0) {
                            const speed = e.projectileSpeed || 5;
                            projectiles.push({
                                x: e.x,
                                y: e.y,
                                vx: (dx / dist) * speed,
                                vy: (dy / dist) * speed,
                                radius: 6,
                                damage: e.projectileDamage || e.damage * 0.7,
                                color: e.behavior === 'mage' ? '#7B1FA2' : '#009688',
                                pierces: 0,
                                explosionRadius: 0,
                                explosionDamage: 0
                            });
                            
                            e.lastAttack = now;
                        }
                    }
                }
                
                // Keep distance from player if too close
                if (distToPlayer < 150) {
                    const dx = e.x - player.x;
                    const dy = e.y - player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 0) {
                        e.x += (dx / dist) * e.speed * 1.5;
                        e.y += (dy / dist) * e.speed * 1.5;
                    }
                }
            } else if (e.behavior === 'swarm') {
                // Spiders try to surround the player
                if (!e.target) {
                    // Find a position around the player to target
                    const angle = Math.random() * Math.PI * 2;
                    e.target = {
                        x: player.x + Math.cos(angle) * 150,
                        y: player.y + Math.sin(angle) * 150
                    };
                }
                
                // Move towards target position
                const dx = e.target.x - e.x;
                const dy = e.target.y - e.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0) {
                    e.vx = (dx / dist) * e.speed;
                    e.vy = (dy / dist) * e.speed;
                    
                    // Add separation force
                    e.vx += separationForceX * 0.5;
                    e.vy += separationForceY * 0.5;
                    
                    e.x += e.vx;
                    e.y += e.vy;
                }
                
                // Reset target if reached or if player moved far
                if (dist < 20 || Math.hypot(e.target.x - player.x, e.target.y - player.y) > 200) {
                    e.target = null;
                }
                
                continue; // Skip normal movement
            } else if (e.behavior === 'phase') {
                // Ghosts occasionally phase (become invulnerable and move faster)
                const now = Date.now();
                if (!e.isPhased && now - e.lastPhase > e.phaseCooldown) {
                    e.isPhased = true;
                    e.lastPhase = now;
                    e.phaseEndTime = now + e.phaseDuration;
                    e.originalSpeed = e.speed;
                    e.speed *= 2;
                }
                
                if (e.isPhased && now > e.phaseEndTime) {
                    e.isPhased = false;
                    e.speed = e.originalSpeed;
                }
            }
            
            // Normal movement towards player with separation
            const dx = player.x - e.x;
            const dy = player.y - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0) {
                // Base movement towards player
                e.vx = (dx / dist) * e.speed;
                e.vy = (dy / dist) * e.speed;
                
                // Add separation force to prevent stacking
                e.vx += separationForceX * 0.4; // Increased separation influence
                e.vy += separationForceY * 0.4;
                
                // Add some randomness for more natural movement
                e.vx += (Math.random() - 0.5) * e.speed * 0.3;
                e.vy += (Math.random() - 0.5) * e.speed * 0.3;
                
                e.x += e.vx;
                e.y += e.vy;
            }
            
            // Check collision with player
            const playerDist = Math.sqrt((player.x - e.x) ** 2 + (player.y - e.y) ** 2);
            if (playerDist < player.radius + e.radius) {
                if (!player.invulnerable) {
                    player.health -= e.damage * 0.4; // Increased damage significantly
                    updateHealthBar();
                    createHitFlash(player.x, player.y);
                    
                    // Make player invulnerable briefly
                    player.invulnerable = true;
                    player.invulnerableTime = timestamp;
                    
                    // Create damage text
                    createDamageText(player.x, player.y - player.radius, Math.round(e.damage * 0.4), false);
                }
                
                // Knockback effect
                const knockback = 2.5;
                player.x += (player.x - e.x) / playerDist * knockback;
                player.y += (player.y - e.y) / playerDist * knockback;
                
                // Keep player in bounds after knockback
                player.x = Math.max(padding, Math.min(canvas.width - padding, player.x));
                player.y = Math.max(padding, Math.min(canvas.height - padding, player.y));
            }
            
            // Reset invulnerability after time
            if (player.invulnerable && timestamp - player.invulnerableTime > 300) { // Reduced to 300ms
                player.invulnerable = false;
            }
            
            // Remove enemy if dead
            if (e.health <= 0) {
                enemies.splice(i, 1);
                gameState.enemiesAlive--;
            }
        }
        
        // Update damage texts
        for (let i = gameState.damageTexts.length - 1; i >= 0; i--) {
            const text = gameState.damageTexts[i];
            text.y += text.vy;
            text.vy += 0.15; // gravity
            text.life--;
            text.alpha = text.life / 60;
            
            if (text.life <= 0) {
                gameState.damageTexts.splice(i, 1);
            }
        }
        
        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            
            if (p.expand) {
                p.radius += 0.5;
            }
            
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // gravity
            p.life--;
            p.alpha = p.life / 50;
            
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
        
        // Spawn enemies if needed (for regular waves)
        if (!gameState.isBossWave && gameState.enemiesAlive < 20 && gameState.enemiesKilled + gameState.enemiesAlive < gameState.enemiesToSpawn) {
            spawnEnemies(4); // Spawn more enemies at once
        }
        
        // Check if wave is complete (for regular waves)
        if (!gameState.isBossWave && gameState.enemiesAlive === 0 && gameState.enemiesKilled >= gameState.enemiesToSpawn) {
            // Wave complete - show upgrade screen
            showUpgradeScreen();
        }
        
        // Check game over
        if (player.health <= 0) {
            gameState.running = false;
            gameState.current = 'gameOver';
            gameOverScreen.classList.remove('hidden');
            finalScoreDisplay.textContent = gameState.score;
            wavesSurvivedDisplay.textContent = gameState.currentWave;
            enemiesSlainDisplay.textContent = gameState.totalEnemiesKilled;
            coinsEarnedDisplay.textContent = gameState.coins;
        }
        
        // Update UI
        scoreDisplay.textContent = `SCORE: ${gameState.score}`;
        killsDisplay.textContent = gameState.totalEnemiesKilled;
        coinsDisplay.textContent = gameState.coins;
        updateExperienceBar();
    }
    
    // Draw everything
    drawGame();
    
    // Continue game loop
    gameState.gameLoopId = requestAnimationFrame(gameLoop);
}

function drawGame() {
    // Draw particles
    particles.forEach(p => {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });
    
    // Draw projectiles
    projectiles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw trail
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 0.5, p.y - p.vy * 0.5);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    });
    
    // Draw enemies
    enemies.forEach(e => {
        // Enemy body
        if (e.isPhased) {
            ctx.globalAlpha = 0.6;
        }
        
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (e.isPhased) {
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#9C27B0';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Enemy details based on type
        ctx.fillStyle = '#000';
        if (e.type === 'Slime') {
            // Slime eyes
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 0.3, e.y - e.radius * 0.2, e.radius * 0.2, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 0.3, e.y - e.radius * 0.2, e.radius * 0.2, 0, Math.PI * 2);
            ctx.fill();
            
            // Slime mouth
            ctx.beginPath();
            ctx.arc(e.x, e.y + e.radius * 0.2, e.radius * 0.25, 0, Math.PI);
            ctx.stroke();
        } else if (e.type === 'Bat') {
            // Bat wings
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.quadraticCurveTo(
                e.x - e.radius * 1.5, e.y - e.radius,
                e.x - e.radius * 0.5, e.y + e.radius * 0.5
            );
            ctx.quadraticCurveTo(
                e.x - e.radius * 1.5, e.y + e.radius * 1.5,
                e.x, e.y
            );
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.quadraticCurveTo(
                e.x + e.radius * 1.5, e.y - e.radius,
                e.x + e.radius * 0.5, e.y + e.radius * 0.5
            );
            ctx.quadraticCurveTo(
                e.x + e.radius * 1.5, e.y + e.radius * 1.5,
                e.x, e.y
            );
            ctx.fill();
            
            // Bat face
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 0.2, e.y - e.radius * 0.3, e.radius * 0.15, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 0.2, e.y - e.radius * 0.3, e.radius * 0.15, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 0.2, e.y - e.radius * 0.3, e.radius * 0.08, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 0.2, e.y - e.radius * 0.3, e.radius * 0.08, 0, Math.PI * 2);
            ctx.fill();
        } else if (e.type === 'Zombie') {
            // Zombie body
            ctx.fillStyle = '#4CAF50';
            ctx.beginPath();
            ctx.arc(e.x, e.y + e.radius * 0.3, e.radius * 0.9, 0, Math.PI * 2);
            ctx.fill();
            
            // Zombie arms
            ctx.fillStyle = '#8BC34A';
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 1.2, e.y, e.radius * 0.5, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 1.2, e.y, e.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Zombie face
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 0.3, e.y - e.radius * 0.3, e.radius * 0.15, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 0.3, e.y - e.radius * 0.3, e.radius * 0.15, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(e.x, e.y + e.radius * 0.1, e.radius * 0.2, 0, Math.PI);
            ctx.stroke();
        } else if (e.type === 'Ghost') {
            // Ghost body
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(e.x, e.y - e.radius * 0.2, e.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Ghost bottom
            ctx.fillStyle = e.color;
            for (let i = -1; i <= 1; i += 0.5) {
                ctx.beginPath();
                ctx.arc(e.x + i * e.radius * 0.6, e.y + e.radius * 0.8, e.radius * 0.4, Math.PI, Math.PI * 2);
                ctx.fill();
            }
            
            // Ghost eyes
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 0.3, e.y - e.radius * 0.3, e.radius * 0.25, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 0.3, e.y - e.radius * 0.3, e.radius * 0.25, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 0.3, e.y - e.radius * 0.3, e.radius * 0.1, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 0.3, e.y - e.radius * 0.3, e.radius * 0.1, 0, Math.PI * 2);
            ctx.fill();
        } else if (e.type === 'Skeleton') {
            // Skeleton body
            ctx.fillStyle = '#E91E63';
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius * 0.9, 0, Math.PI * 2);
            ctx.fill();
            
            // Skeleton head
            ctx.fillStyle = '#F8BBD0';
            ctx.beginPath();
            ctx.arc(e.x, e.y - e.radius * 0.6, e.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Skeleton eyes
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 0.2, e.y - e.radius * 0.7, e.radius * 0.15, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 0.2, e.y - e.radius * 0.7, e.radius * 0.15, 0, Math.PI * 2);
            ctx.fill();
            
            // Skeleton arms
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 1.3, e.y, e.radius * 0.4, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 1.3, e.y, e.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        } else if (e.type === 'Spider') {
            // Spider body
            ctx.fillStyle = '#FF9800';
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius * 0.8, 0, Math.PI * 2);
            ctx.fill();
            
            // Spider legs
            ctx.strokeStyle = '#BF360C';
            ctx.lineWidth = 2;
            for (let i = -1; i <= 1; i += 0.5) {
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(
                    e.x + Math.cos(i * Math.PI / 2) * e.radius * 1.5,
                    e.y + Math.sin(i * Math.PI / 2) * e.radius * 1.2
                );
                ctx.stroke();
            }
            
            // Spider eyes
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 0.2, e.y - e.radius * 0.2, e.radius * 0.1, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 0.2, e.y - e.radius * 0.2, e.radius * 0.1, 0, Math.PI * 2);
            ctx.fill();
        } else if (e.type === 'Mage') {
            // Mage body
            ctx.fillStyle = '#3F51B5';
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius * 0.9, 0, Math.PI * 2);
            ctx.fill();
            
            // Mage hat
            ctx.fillStyle = '#1A237E';
            ctx.beginPath();
            ctx.moveTo(e.x - e.radius * 0.8, e.y - e.radius * 0.8);
            ctx.lineTo(e.x + e.radius * 0.8, e.y - e.radius * 0.8);
            ctx.lineTo(e.x, e.y - e.radius * 1.8);
            ctx.closePath();
            ctx.fill();
            
            // Mage face
            ctx.fillStyle = '#FFCCBC';
            ctx.beginPath();
            ctx.arc(e.x, e.y - e.radius * 0.5, e.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 0.15, e.y - e.radius * 0.6, e.radius * 0.1, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 0.15, e.y - e.radius * 0.6, e.radius * 0.1, 0, Math.PI * 2);
            ctx.fill();
        } else if (e.type === 'Archer') {
            // Archer body
            ctx.fillStyle = '#009688';
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius * 0.85, 0, Math.PI * 2);
            ctx.fill();
            
            // Archer head
            ctx.fillStyle = '#FFCCBC';
            ctx.beginPath();
            ctx.arc(e.x, e.y - e.radius * 0.6, e.radius * 0.45, 0, Math.PI * 2);
            ctx.fill();
            
            // Archer eyes
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(e.x - e.radius * 0.15, e.y - e.radius * 0.7, e.radius * 0.12, 0, Math.PI * 2);
            ctx.arc(e.x + e.radius * 0.15, e.y - e.radius * 0.7, e.radius * 0.12, 0, Math.PI * 2);
            ctx.fill();
            
            // Bow
            ctx.strokeStyle = '#8D6E63';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(e.x + e.radius * 0.7, e.y, e.radius * 0.6, Math.PI * 0.3, Math.PI * 0.7);
            ctx.stroke();
        }
        
        // Health bar
        const healthPercent = e.health / e.maxHealth;
        const barWidth = e.radius * 2;
        const barHeight = 4;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(e.x - barWidth/2, e.y - e.radius - 12, barWidth, barHeight);
        
        ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#FFC107' : '#F44336';
        ctx.fillRect(e.x - barWidth/2, e.y - e.radius - 12, barWidth * healthPercent, barHeight);
    });
    
    // Draw boss
    if (gameState.boss && !gameState.boss.isDead) {
        ctx.fillStyle = gameState.boss.color;
        ctx.beginPath();
        ctx.arc(gameState.boss.x, gameState.boss.y, gameState.boss.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Boss details based on type
        ctx.fillStyle = '#000';
        if (gameState.boss.name === 'Blood Golem') {
            // Golem body details
            ctx.fillStyle = '#5D4037';
            ctx.beginPath();
            ctx.arc(gameState.boss.x, gameState.boss.y + gameState.boss.radius * 0.3, gameState.boss.radius * 0.9, 0, Math.PI * 2);
            ctx.fill();
            
            // Golem arms
            ctx.fillStyle = '#3E2723';
            ctx.beginPath();
            ctx.arc(gameState.boss.x - gameState.boss.radius * 1.4, gameState.boss.y, gameState.boss.radius * 0.7, 0, Math.PI * 2);
            ctx.arc(gameState.boss.x + gameState.boss.radius * 1.4, gameState.boss.y, gameState.boss.radius * 0.7, 0, Math.PI * 2);
            ctx.fill();
            
            // Golem eyes
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(gameState.boss.x - gameState.boss.radius * 0.3, gameState.boss.y - gameState.boss.radius * 0.2, gameState.boss.radius * 0.2, 0, Math.PI * 2);
            ctx.arc(gameState.boss.x + gameState.boss.radius * 0.3, gameState.boss.y - gameState.boss.radius * 0.2, gameState.boss.radius * 0.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (gameState.boss.name === 'Shadow Bat King') {
            // Bat wings
            ctx.fillStyle = '#4A148C';
            ctx.beginPath();
            ctx.moveTo(gameState.boss.x, gameState.boss.y);
            ctx.quadraticCurveTo(
                gameState.boss.x - gameState.boss.radius * 2, gameState.boss.y - gameState.boss.radius,
                gameState.boss.x - gameState.boss.radius * 0.8, gameState.boss.y + gameState.boss.radius * 0.8
            );
            ctx.quadraticCurveTo(
                gameState.boss.x - gameState.boss.radius * 2, gameState.boss.y + gameState.boss.radius * 1.8,
                gameState.boss.x, gameState.boss.y
            );
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(gameState.boss.x, gameState.boss.y);
            ctx.quadraticCurveTo(
                gameState.boss.x + gameState.boss.radius * 2, gameState.boss.y - gameState.boss.radius,
                gameState.boss.x + gameState.boss.radius * 0.8, gameState.boss.y + gameState.boss.radius * 0.8
            );
            ctx.quadraticCurveTo(
                gameState.boss.x + gameState.boss.radius * 2, gameState.boss.y + gameState.boss.radius * 1.8,
                gameState.boss.x, gameState.boss.y
            );
            ctx.fill();
            
            // Crown
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(gameState.boss.x - gameState.boss.radius * 0.5, gameState.boss.y - gameState.boss.radius * 1.2);
            ctx.lineTo(gameState.boss.x - gameState.boss.radius * 0.3, gameState.boss.y - gameState.boss.radius * 1.5);
            ctx.lineTo(gameState.boss.x, gameState.boss.y - gameState.boss.radius * 1.3);
            ctx.lineTo(gameState.boss.x + gameState.boss.radius * 0.3, gameState.boss.y - gameState.boss.radius * 1.5);
            ctx.lineTo(gameState.boss.x + gameState.boss.radius * 0.5, gameState.boss.y - gameState.boss.radius * 1.2);
            ctx.closePath();
            ctx.fill();
            
            // Bat face
            ctx.fillStyle = '#7B1FA2';
            ctx.beginPath();
            ctx.arc(gameState.boss.x, gameState.boss.y - gameState.boss.radius * 0.3, gameState.boss.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(gameState.boss.x - gameState.boss.radius * 0.25, gameState.boss.y - gameState.boss.radius * 0.4, gameState.boss.radius * 0.2, 0, Math.PI * 2);
            ctx.arc(gameState.boss.x + gameState.boss.radius * 0.25, gameState.boss.y - gameState.boss.radius * 0.4, gameState.boss.radius * 0.2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(gameState.boss.x - gameState.boss.radius * 0.25, gameState.boss.y - gameState.boss.radius * 0.4, gameState.boss.radius * 0.1, 0, Math.PI * 2);
            ctx.arc(gameState.boss.x + gameState.boss.radius * 0.25, gameState.boss.y - gameState.boss.radius * 0.4, gameState.boss.radius * 0.1, 0, Math.PI * 2);
            ctx.fill();
        } else if (gameState.boss.name === 'Necromancer') {
            // Robe
            ctx.fillStyle = '#2E7D32';
            ctx.beginPath();
            ctx.arc(gameState.boss.x, gameState.boss.y + gameState.boss.radius * 0.4, gameState.boss.radius * 0.95, 0, Math.PI * 2);
            ctx.fill();
            
            // Hood
            ctx.fillStyle = '#1B5E20';
            ctx.beginPath();
            ctx.arc(gameState.boss.x, gameState.boss.y - gameState.boss.radius * 0.2, gameState.boss.radius * 0.8, 0, Math.PI * 2);
            ctx.fill();
            
            // Staff
            ctx.strokeStyle = '#8D6E63';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(gameState.boss.x + gameState.boss.radius * 0.8, gameState.boss.y + gameState.boss.radius * 0.5);
            ctx.lineTo(gameState.boss.x + gameState.boss.radius * 1.8, gameState.boss.y + gameState.boss.radius * 1.5);
            ctx.stroke();
            
            // Staff orb
            ctx.fillStyle = '#4FC3F7';
            ctx.beginPath();
            ctx.arc(gameState.boss.x + gameState.boss.radius * 1.8, gameState.boss.y + gameState.boss.radius * 1.5, gameState.boss.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
            
            // Face (glowing eyes in hood)
            ctx.fillStyle = '#FF5722';
            ctx.beginPath();
            ctx.arc(gameState.boss.x - gameState.boss.radius * 0.2, gameState.boss.y - gameState.boss.radius * 0.3, gameState.boss.radius * 0.15, 0, Math.PI * 2);
            ctx.arc(gameState.boss.x + gameState.boss.radius * 0.2, gameState.boss.y - gameState.boss.radius * 0.3, gameState.boss.radius * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Boss health bar above
        const healthPercent = gameState.boss.health / gameState.boss.maxHealth;
        const barWidth = gameState.boss.radius * 3;
        const barHeight = 8;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(gameState.boss.x - barWidth/2, gameState.boss.y - gameState.boss.radius - 25, barWidth, barHeight);
        
        ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#FFC107' : '#F44336';
        ctx.fillRect(gameState.boss.x - barWidth/2, gameState.boss.y - gameState.boss.radius - 25, barWidth * healthPercent, barHeight);
        
        // Boss name
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(gameState.boss.name, gameState.boss.x, gameState.boss.y - gameState.boss.radius - 35);
    }
    
    // Draw player (bird)
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Determine facing direction
    if (!player.facingRight) {
        ctx.scale(-1, 1);
    }
    
    // Body
    ctx.fillStyle = '#4da6ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, player.radius * 0.9, player.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Wing (animated)
    ctx.fillStyle = '#2a75cc';
    ctx.beginPath();
    ctx.ellipse(
        -player.radius * 0.3, 
        player.radius * 0.3 + Math.sin(Date.now() / 100) * 3, 
        player.radius * 0.8, 
        player.radius * 0.4 + Math.abs(Math.sin(Date.now() / 150)) * 5, 
        player.wingAngle, 
        0, Math.PI * 2
    );
    ctx.fill();
    
    // Head
    ctx.fillStyle = '#6ab9ff';
    ctx.beginPath();
    ctx.arc(0, -player.radius * 0.4, player.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Beak
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(player.radius * 0.3, -player.radius * 0.4);
    ctx.lineTo(player.radius * 0.8, -player.radius * 0.5);
    ctx.lineTo(player.radius * 0.8, -player.radius * 0.3);
    ctx.closePath();
    ctx.fill();
    
    // Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(player.radius * 0.1, -player.radius * 0.5, player.radius * 0.15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(player.radius * 0.15, -player.radius * 0.5, player.radius * 0.08, 0, Math.PI * 2);
    ctx.fill();
    
    // Tail feathers
    ctx.fillStyle = '#2a75cc';
    for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-player.radius * 0.7, player.radius * 0.2);
        ctx.lineTo(-player.radius * 1.2, player.radius * 0.2 + i * 8);
        ctx.lineTo(-player.radius * 0.9, player.radius * 0.5 + i * 5);
        ctx.closePath();
        ctx.fill();
    }
    
    // Draw rear cannon if active
    if (player.rearCannon) {
        ctx.fillStyle = '#ff5252';
        ctx.beginPath();
        ctx.arc(-player.radius * 0.8, 0, player.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw side cannons if active
    if (player.sideCannons) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, -player.radius * 0.7, player.radius * 0.25, 0, Math.PI * 2);
        ctx.arc(0, player.radius * 0.7, player.radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw invulnerability effect
    if (player.invulnerable) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, player.radius * 1.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    ctx.restore();
    
    // Draw damage texts
    gameState.damageTexts.forEach(text => {
        ctx.globalAlpha = text.alpha;
        ctx.fillStyle = text.color;
        ctx.font = `bold ${text.scale * (text.text.includes('CRITICAL') ? 18 : 16)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(text.text, text.x, text.y);
        ctx.globalAlpha = 1.0;
    });
}
                    