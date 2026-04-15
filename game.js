const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- VARIABLES DE ESTADO Y PERSISTENCIA ---
let meters = 0;
let gameState = "PLAYING"; 
let isPaused = false;
let isDead = false;

let score = parseInt(localStorage.getItem('peashooter_exp')) || 0;
let level = parseInt(localStorage.getItem('peashooter_lvl')) || 1;
let totalKills = parseInt(localStorage.getItem('peashooter_kills')) || 0;
let playerCoins = parseInt(localStorage.getItem('peashooter_coins')) || 0;

// Sistema de zonas descubiertas - SOLO 2 ZONAS
let discoveredZones = JSON.parse(localStorage.getItem('peashooter_zones')) || {
    zone1: { 
        unlocked: true, 
        name: "Pradera Verde", 
        spawnPoint: 0,
        description: "Zona inicial pacífica",
        endPoint: 24900
    },
    zone2: { 
        unlocked: false, 
        name: "Desierto del Guardián", 
        spawnPoint: 24000,
        description: "Hogar del Guardián del Desierto",
        endPoint: 50000
    }
};

// Cargar misiones guardadas
let savedMissions = localStorage.getItem('peashooter_missions');
let missions = {
    kills250: { completed: false, claimed: false, reward: 75, name: "Derrota 250 palomas", current: 0, target: 250 },
    kills500: { completed: false, claimed: false, reward: 150, name: "Derrota 500 palomas", current: 0, target: 500 },
    meters2000: { completed: false, claimed: false, reward: 50, name: "Llega a los 2000 Metros", current: 0, target: 2000 },
    defeatBoss: { completed: false, claimed: false, reward: 450, name: "Derrota al Guardián del Desierto", current: 0, target: 1 }
};

if (savedMissions) {
    try {
        const loaded = JSON.parse(savedMissions);
        Object.assign(missions, loaded);
    } catch (e) {
        console.log('Error cargando misiones');
    }
}

// Cargar mejoras guardadas - CORREGIDO
let savedUpgrades = localStorage.getItem('peashooter_upgrades');
let upgrades = {
    damageUpgrade: { purchased: false, cost: 325, damage: 15 },
    healthUpgrade: { purchased: false, cost: 225, health: 40 },
    fireRateUpgrade: { purchased: false, cost: 67, reduction: 15 }
};

if (savedUpgrades) {
    try {
        const loaded = JSON.parse(savedUpgrades);
        // SOLO copiar las propiedades que existen, sin sobrescribir toda la estructura
        if (loaded.damageUpgrade) upgrades.damageUpgrade.purchased = loaded.damageUpgrade.purchased || false;
        if (loaded.healthUpgrade) upgrades.healthUpgrade.purchased = loaded.healthUpgrade.purchased || false;
        if (loaded.fireRateUpgrade) upgrades.fireRateUpgrade.purchased = loaded.fireRateUpgrade.purchased || false;
        console.log('Mejoras cargadas correctamente:', upgrades);
    } catch (e) {
        console.log('Error cargando mejoras, usando valores por defecto');
        upgrades = {
            damageUpgrade: { purchased: false, cost: 325, damage: 15 },
            healthUpgrade: { purchased: false, cost: 225, health: 40 },
            fireRateUpgrade: { purchased: false, cost: 67, reduction: 15 }
        };
    }
}

// 🆕 NUEVA FUNCIÓN: Aplicar mejoras guardadas al jugador
function applyLoadedUpgrades() {
    console.log('Aplicando mejoras cargadas...');
    
    // Aplicar mejora de daño
    if (upgrades.damageUpgrade.purchased) {
        player.projectileDamage = 25 + upgrades.damageUpgrade.damage;
        console.log('✅ Mejora de daño aplicada:', player.projectileDamage);
    } else {
        player.projectileDamage = 25;
    }
    
    // Aplicar mejora de vida
    if (upgrades.healthUpgrade.purchased) {
        player.maxHp = 100 + upgrades.healthUpgrade.health;
        player.hp = player.maxHp; // Curar al máximo al cargar
        console.log('✅ Mejora de vida aplicada. HP máximo:', player.maxHp);
    } else {
        player.maxHp = 100;
        player.hp = Math.min(player.hp, 100);
    }
    
    // Aplicar mejora de velocidad de disparo
    if (upgrades.fireRateUpgrade.purchased) {
        shootCooldown = Math.max(150, 280 - upgrades.fireRateUpgrade.reduction);
        console.log('✅ Mejora de disparo aplicada. Cooldown:', shootCooldown);
    } else {
        shootCooldown = 280;
    }
}

// 🆕 NUEVA FUNCIÓN: Verificar y reparar inconsistencia de mejoras
function validateUpgrades() {
    console.log('Validando mejoras...');
    
    // Si la mejora está comprada pero no tiene efecto, repararla
    if (upgrades.damageUpgrade.purchased && player.projectileDamage <= 25) {
        console.warn('⚠️ Inconsistencia detectada en mejora de daño. Reparando...');
        player.projectileDamage = 25 + upgrades.damageUpgrade.damage;
    }
    
    if (upgrades.healthUpgrade.purchased && player.maxHp <= 100) {
        console.warn('⚠️ Inconsistencia detectada en mejora de vida. Reparando...');
        player.maxHp = 100 + upgrades.healthUpgrade.health;
        player.hp = player.maxHp;
    }
    
    if (upgrades.fireRateUpgrade.purchased && shootCooldown >= 280) {
        console.warn('⚠️ Inconsistencia detectada en mejora de disparo. Reparando...');
        shootCooldown = Math.max(150, 280 - upgrades.fireRateUpgrade.reduction);
    }
}

const gravity = 0.8;
const keys = {};
const projectiles = [];
const enemies = [];
const newEnemies = [];
const enemyProjectiles = []; 
const bossProjectiles = [];
const particles = [];
const clouds = [];
const desertDust = [];

let worldX = 0;
let currentSpeed = 0;
let lastShotTime = 0;
let shootCooldown = 280; 

const playerImg = new Image(); playerImg.src = 'personaje.png';
const enemyImg = new Image(); enemyImg.src = 'paloma.png';
const enemy1Img = new Image(); enemy1Img.src = 'enemy1.png';
const enemy2Img = new Image();
enemy2Img.src = 'enemy2.png';

enemy2Img.onload = () => {
    console.log("enemy2 cargada OK");
};

enemy2Img.onerror = () => {
    console.log("ERROR cargando enemy2.png - usando fallback");
};

const coinImg = new Image();
coinImg.src = 'coin.png';

// --- CONSTANTES DEL MUNDO ---
const GATE_X = 25400;
const SHOP_X = 26400;
const SECOND_GATE_X = 27967;
const JUNGLE_START_X = 29500;
const STORM_START_X = 36000;
const CAVE_X = 50000;

const desertHouses = [];
for(let i = 0; i < 20; i++) {
    desertHouses.push({
        x: GATE_X + 250 + (i * 380),
        w: 120 + Math.random() * 180,
        h: 180 + Math.random() * 250,
        color: `hsl(${25 + Math.random() * 15}, 45%, ${35 + Math.random() * 15}%)`,
        windows: Math.floor(Math.random() * 5) + 3
    });
}

// --- DECORACIÓN ---
const mountains = [];
for(let i = 0; i < 15; i++) {
    mountains.push({ 
        x: i * 400, 
        width: 500 + Math.random() * 300, 
        height: 200 + Math.random() * 250, 
        color: i < 8 ? "#546E7A" : "#8D6E63"
    });
}

// Variables para árboles de jungla - MEJORADOS
const jungleTrees = [];
// Primera capa de árboles (fondo)
for(let i = 0; i < 15; i++) {
    jungleTrees.push({
        x: JUNGLE_START_X + (i * 250) + Math.random() * 150,
        height: 250 + Math.random() * 150,
        width: 40 + Math.random() * 30,
        layer: 'back',
        color: '#1B5E20'
    });
}
// Segunda capa de árboles (frente) - más densa
for(let i = 0; i < 30; i++) {
    jungleTrees.push({
        x: JUNGLE_START_X + (i * 200) + Math.random() * 180,
        height: 300 + Math.random() * 200,
        width: 50 + Math.random() * 40,
        layer: 'front',
        color: '#2E7D32'
    });
}

// --- FUNCIONES DE UTILIDAD ---
function updateHUD() {
    const metersDisplay = document.getElementById('meters-display');
    const metersOld = document.getElementById('meters');
    const metersValue = Math.floor(worldX / 10);
    
    if (metersDisplay) metersDisplay.textContent = metersValue;
    if (metersOld) metersOld.textContent = metersValue;
    
    const zoneIndicator = document.getElementById('zone-indicator');
    const zoneNameEl = document.getElementById('zone-name');
    const progressBar = document.getElementById('zone-progress-bar');
    const nextMilestoneEl = document.getElementById('next-milestone');
    
    if (zoneIndicator && zoneNameEl) {
        let zoneProgress = 0;
        let nextMilestone = '';
        
        if (metersValue < 2500) {
            zoneIndicator.textContent = '🌿';
            zoneNameEl.textContent = 'Pradera Verde';
            zoneNameEl.style.color = '#81C784';
            zoneProgress = (metersValue / 2500) * 100;
            nextMilestone = '2500m - Desierto';
        } else if (metersValue < 2950) {
            zoneIndicator.textContent = '🏜️';
            zoneNameEl.textContent = 'Desierto del Guardián';
            zoneNameEl.style.color = '#FFB74D';
            zoneProgress = ((metersValue - 2500) / 450) * 100;
            nextMilestone = '2950m - Jungla';
        } else if (metersValue < 3600) {
            zoneIndicator.textContent = '🌳';
            zoneNameEl.textContent = 'Jungla Ancestral';
            zoneNameEl.style.color = '#66BB6A';
            zoneProgress = ((metersValue - 2950) / 650) * 100;
            nextMilestone = '3600m - Tormenta';
        } else if (metersValue < 5000) {
            zoneIndicator.textContent = '⛈️';
            zoneNameEl.textContent = 'Tormenta del Desierto';
            zoneNameEl.style.color = '#90CAF9';
            zoneProgress = ((metersValue - 3600) / 1400) * 100;
            nextMilestone = '5000m - La Cueva';
        } else {
            zoneIndicator.textContent = '🏔️';
            zoneNameEl.textContent = 'La Cueva';
            zoneNameEl.style.color = '#BA68C8';
            zoneProgress = 100;
            nextMilestone = 'Fin del juego';
        }
        
        if (progressBar) {
            progressBar.style.width = Math.min(zoneProgress, 100) + '%';
        }
        
        if (nextMilestoneEl) {
            nextMilestoneEl.textContent = nextMilestone;
        }
    }
}

function showDiscoveryMessage(message) {
    const msg = document.createElement('div');
    msg.style.cssText = `
        position: fixed;
        top: 30%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #FFD700;
        padding: 30px 50px;
        border-radius: 20px;
        font-weight: bold;
        font-size: 24px;
        text-align: center;
        z-index: 20000;
        border: 4px solid #FFD700;
        box-shadow: 0 0 50px rgba(255,215,0,0.5);
        animation: fadeInOut 3s ease-in-out forwards;
        white-space: pre-line;
        pointer-events: none;
    `;
    msg.innerText = message;
    document.body.appendChild(msg);
    
    if (!document.getElementById('zone-animations')) {
        const style = document.createElement('style');
        style.id = 'zone-animations';
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, -40%); }
                15% { opacity: 1; transform: translate(-50%, -50%); }
                85% { opacity: 1; transform: translate(-50%, -50%); }
                100% { opacity: 0; transform: translate(-50%, -60%); }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => msg.remove(), 3000);
}

function checkZoneUnlocks() {
    let zonesUpdated = false;
    
    if (meters >= 2500 && !discoveredZones.zone2.unlocked) {
        discoveredZones.zone2.unlocked = true;
        zonesUpdated = true;
        showDiscoveryMessage("¡NUEVA ZONA DESCUBIERTA!\n🏜️ Desierto del Guardián");
        createExplosion(canvas.width/2, canvas.height/2, "#FFD700", 30);
    }
    
    if (zonesUpdated) {
        saveData();
    }
}

function teleportToZone(zoneKey) {
    const zone = discoveredZones[zoneKey];
    if (!zone || !zone.unlocked) {
        alert("¡Esta zona aún no está descubierta!");
        return;
    }
    
    saveData();
    
    worldX = zone.spawnPoint;
    player.x = 150;
    player.y = canvas.height - 150;
    player.hp = player.maxHp;
    player.velY = 0;
    player.grounded = true;
    player.invulnerable = false;
    
    enemies.length = 0;
    newEnemies.length = 0;
    enemyProjectiles.length = 0;
    bossProjectiles.length = 0;
    projectiles.length = 0;
    
    if (worldX < 25000) {
        gameState = "PLAYING";
        boss = null;
        bossDefeated = false;
        missions.defeatBoss.completed = false;
        missions.defeatBoss.current = 0;
    } else {
        if (meters >= 2500) {
            gameState = "PLAYING";
        }
    }
    
    meters = Math.floor(worldX / 10);
    updateHUD();
    
    showDiscoveryMessage(`✨ Viajando a ${zone.name}... ✨`);
    
    for(let i = 0; i < 30; i++) {
        setTimeout(() => {
            createExplosion(
                player.x + player.width/2, 
                player.y + player.height/2, 
                i % 2 === 0 ? "#FFD700" : "#4CAF50", 
                5
            );
        }, i * 20);
    }
}

function updateZonesPanel() {
    const container = document.getElementById('zones-container');
    if (!container) {
        console.error("ERROR: No se encontró el contenedor de zonas");
        return;
    }
    
    container.innerHTML = '';
    
    const progressDiv = document.createElement('div');
    progressDiv.style.cssText = `
        background: rgba(0, 0, 0, 0.3);
        border-radius: 10px;
        padding: 15px;
        margin-bottom: 15px;
        text-align: center;
        color: white;
        border: 1px solid #FFD700;
    `;
    
    let currentZoneName = meters < 2500 ? "Pradera Verde" : "Desierto del Guardián";
    let nextMilestone = meters < 2500 ? "2500m - Desierto" : 
                        meters < 2950 ? "2950m - Jungla" :
                        meters < 3600 ? "3600m - Tormenta" : "5000m - La Cueva";
    
    progressDiv.innerHTML = `
        <div style="font-size: 14px; color: #FFD700;">📍 UBICACIÓN ACTUAL</div>
        <div style="font-size: 20px; font-weight: bold; margin: 5px 0;">${currentZoneName}</div>
        <div style="font-size: 12px; color: #aaa;">Progreso: ${meters}m / 5000m</div>
        <div style="font-size: 12px; color: #81C784; margin-top: 5px;">Próximo hito: ${nextMilestone}</div>
    `;
    container.appendChild(progressDiv);
    
    const zones = [
        { key: 'zone1', icon: '🌿', color: '#4CAF50', safePoint: 'Inicio' },
        { key: 'zone2', icon: '🏜️', color: '#FF9800', safePoint: '2400m' }
    ];
    
    zones.forEach(zoneInfo => {
        const zone = discoveredZones[zoneInfo.key];
        
        const zoneDiv = document.createElement('div');
        zoneDiv.style.cssText = `
            background: ${zone.unlocked ? 'rgba(76, 175, 80, 0.15)' : 'rgba(0, 0, 0, 0.4)'};
            border: 2px solid ${zone.unlocked ? zoneInfo.color : '#666'};
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: white;
            transition: all 0.3s;
        `;
        
        const infoDiv = document.createElement('div');
        infoDiv.style.flex = '1';
        
        let zoneDetails = '';
        if (zoneInfo.key === 'zone1') {
            zoneDetails = '0m - 2499m';
        } else {
            zoneDetails = '2500m - 5000m';
        }
        
        infoDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 28px;">${zoneInfo.icon}</span>
                <div>
                    <div style="font-size: 18px; font-weight: bold; color: ${zone.unlocked ? zoneInfo.color : '#999'};">
                        ${zone.name}
                    </div>
                    <div style="font-size: 11px; color: #aaa;">
                        ${zoneDetails}
                    </div>
                    <div style="font-size: 12px; color: ${zone.unlocked ? '#81C784' : '#FF6B6B'}; margin-top: 5px;">
                        ${zone.unlocked ? '✓ DESCUBIERTA' : '🔒 BLOQUEADA'}
                    </div>
                </div>
            </div>
        `;
        
        zoneDiv.appendChild(infoDiv);
        
        if (zone.unlocked) {
            const teleportBtn = document.createElement('button');
            teleportBtn.innerText = '🚀 VIAJAR';
            teleportBtn.style.cssText = `
                background: linear-gradient(135deg, ${zoneInfo.color}, ${zoneInfo.color}dd);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 10px 20px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
                border: 2px solid #FFD700;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                font-size: 14px;
            `;
            teleportBtn.onmouseover = () => {
                teleportBtn.style.transform = 'scale(1.05)';
                teleportBtn.style.boxShadow = '0 4px 15px rgba(255,215,0,0.3)';
            };
            teleportBtn.onmouseout = () => {
                teleportBtn.style.transform = 'scale(1)';
                teleportBtn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
            };
            teleportBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`¿Viajar a ${zone.name}?\nTu progreso actual se guardará.`)) {
                    teleportToZone(zoneInfo.key);
                    updateZonesPanel();
                    pauseMenu.classList.add('hidden');
                    isPaused = false;
                }
            };
            zoneDiv.appendChild(teleportBtn);
        } else {
            const lockDiv = document.createElement('div');
            lockDiv.style.cssText = `
                background: rgba(0,0,0,0.3);
                padding: 8px 15px;
                border-radius: 20px;
                color: #FFD700;
                font-size: 12px;
                text-align: center;
                border: 1px solid #FF6B6B;
            `;
            lockDiv.innerText = '🔒 BLOQUEADA';
            zoneDiv.appendChild(lockDiv);
        }
        
        container.appendChild(zoneDiv);
    });
    
    const milestonesDiv = document.createElement('div');
    milestonesDiv.style.cssText = `
        margin-top: 15px;
        padding: 10px;
        background: rgba(0,0,0,0.2);
        border-radius: 8px;
        color: #aaa;
        font-size: 12px;
    `;
    milestonesDiv.innerHTML = `
        <div style="color: #FFD700; margin-bottom: 5px;">🎯 HITOS DEL DESIERTO:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
            <div>🌵 2950m - Jungla</div>
            <div>⛈️ 3600m - Tormenta</div>
            <div>🏔️ 5000m - La Cueva</div>
            <div>👑 2500m - Boss</div>
        </div>
    `;
    container.appendChild(milestonesDiv);
}

// --- SISTEMA DE NUBES ---
class Cloud {
    constructor(x, y, size, speed) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.speed = speed;
        this.opacity = 0.6;
    }

    update() {
        this.x += this.speed * 0.3;
        if (this.x > canvas.width + 200) {
            this.x = -200;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = "#FFFFFF";
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(this.x + this.size * 0.5, this.y - this.size * 0.2, this.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(this.x - this.size * 0.5, this.y - this.size * 0.2, this.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

function generateClouds() {
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * canvas.width * 2;
        const y = 50 + Math.random() * 150;
        const size = 30 + Math.random() * 40;
        const speed = 0.3 + Math.random() * 0.8;
        clouds.push(new Cloud(x, y, size, speed));
    }
}

// --- SISTEMA DE POLVO DEL DESIERTO ---
class DesertDust {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = Math.random() * 2 - 1;
        this.life = 60 + Math.random() * 60;
        this.maxLife = this.life;
        this.size = 5 + Math.random() * 10;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1;
        this.life--;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = "rgba(210, 180, 140, 1)";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isAlive() {
        return this.life > 0;
    }
}

// --- SISTEMA DE PARTÍCULAS MEJORADO ---
class Particle {
    constructor(x, y, vx, vy, life, color, size = 5) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2;
        this.life--;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isAlive() {
        return this.life > 0;
    }
}

function createExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const vx = Math.cos(angle) * 6;
        const vy = Math.sin(angle) * 6;
        particles.push(new Particle(x, y, vx, vy, 40, color, 4));
    }
}

function createDustTrail(x, y, color = "rgba(200, 200, 200, 0.5)", count = 3) {
    for (let i = 0; i < count; i++) {
        const vx = (Math.random() - 0.5) * 4;
        const vy = (Math.random() - 0.5) * 4 - 2;
        particles.push(new Particle(x, y, vx, vy, 30, color, 3));
    }
}

function drawGlow(ctx, x, y, radius, color, intensity = 1) {
    ctx.save();
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + '00');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawShadow(ctx, x, y, width, height, intensity = 0.3) {
    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${intensity})`;
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(x, y, width, height);
    ctx.restore();
}

// --- CLASE BOSS ---
class Boss {
    constructor() {
        this.width = 350; this.height = 300;
        this.x = canvas.width + 100;
        this.y = canvas.height - 380;
        this.hp = 950; this.maxHp = 950;
        this.speed = 1.5;
        this.attackTimer = 0;
        this.warningCircle = { active: false, timer: 0, worldTargetX: 0, snapWorldX: 0 };
        this.damageFlash = 0;
    }

    draw() {
        let flashAlpha = 0;
        if (this.damageFlash > 0) { flashAlpha = this.damageFlash / 10; this.damageFlash--; }
        ctx.save();
        if (flashAlpha > 0) ctx.filter = "brightness(3)";
        if (enemyImg.complete) ctx.drawImage(enemyImg, this.x, this.y, this.width, this.height);
        ctx.restore();
        this.drawHealthBar();
        if (this.warningCircle.active) this.drawWarningCircle();
    }

    drawHealthBar() {
        const barWidth = 400; const barHeight = 25;
        const barX = canvas.width/2 - barWidth/2; const barY = 20;
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(barX-5, barY-5, barWidth+10, barHeight+10);
        ctx.fillStyle = "#E91E63"; ctx.fillRect(barX, barY, barWidth * (this.hp / this.maxHp), barHeight);
        ctx.fillStyle = "white"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
        ctx.fillText("EL GUARDIÁN DEL DESIERTO", canvas.width/2, barY + 18);
    }

    drawWarningCircle() {
        let screenX = this.warningCircle.worldTargetX - (worldX - this.warningCircle.snapWorldX);
        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(screenX, canvas.height - 80, 70, 0, Math.PI*2); ctx.stroke();
    }

    update() {
        if (isPaused || isDead) return;
        let targetBossX = (GATE_X - 650) - worldX;
        if (this.x > targetBossX) this.x -= this.speed;
        this.attackTimer++;
        if (this.attackTimer % 120 === 0) bossProjectiles.push({ x: this.x, y: this.y + 150, size: 40, type: "SMALL" });
        if (this.attackTimer % 280 === 0 && !this.warningCircle.active) {
            this.warningCircle.active = true;
            this.warningCircle.worldTargetX = player.x + 30; 
            this.warningCircle.snapWorldX = worldX;
            this.warningCircle.timer = 100; 
        }
        if (this.warningCircle.active) {
            this.warningCircle.timer--;
            if (this.warningCircle.timer <= 0) {
                let finalDropX = this.warningCircle.worldTargetX - (worldX - this.warningCircle.snapWorldX);
                bossProjectiles.push({ x: finalDropX, y: -100, size: 100, type: "BIG" });
                this.warningCircle.active = false;
            }
        }
    }
}

let boss = null;
let bossDefeated = false;
let shopOpen = false;
let missionsOpen = false;

// --- CLASE PLAYER ---
class Player {
    constructor() {
        this.width = 60; this.height = 90;
        this.x = 150; this.y = canvas.height - 150;
        this.velY = 0; this.hp = 100;
        this.maxHp = 100;
        this.grounded = false;
        this.animTimer = 0;
        this.trailCounter = 0;
        this.projectileDamage = 25;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
    }

    draw(deltaTime) {
        this.animTimer += deltaTime;
        let squash = 1.0 + Math.sin(this.animTimer * 0.015) * 0.08;
        let stretchX = 1.0 - Math.sin(this.animTimer * 0.015) * 0.03;
        
        drawShadow(ctx, this.x - 5, this.y + this.height - 10, this.width + 10, 8, 0.4);
        
        if (this.invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height);
        ctx.scale(stretchX, squash);
        if (playerImg.complete) ctx.drawImage(playerImg, -this.width/2, -this.height, this.width, this.height);
        else {
            ctx.fillStyle = "#4CAF50";
            ctx.fillRect(-this.width/2, -this.height, this.width, this.height);
        }
        ctx.restore();
        ctx.globalAlpha = 1.0;

        if (!this.grounded) {
            drawGlow(ctx, this.x + this.width/2, this.y + this.height/2, 40, "#00FF00", 0.3);
        }

        this.drawHealthBar();
        
        if (Math.abs(currentSpeed) > 0 && this.trailCounter++ % 3 === 0) {
            createDustTrail(this.x + this.width/2, this.y + this.height, "rgba(180, 140, 100, 0.6)");
        }
    }

    drawHealthBar() {
        const barWidth = this.width;
        const barHeight = 10;
        const barX = this.x;
        const barY = this.y - 30;

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

        const healthGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
        
        if (this.hp > 50) {
            healthGradient.addColorStop(0, "#4CAF50");
            healthGradient.addColorStop(1, "#8BC34A");
        } else if (this.hp > 25) {
            healthGradient.addColorStop(0, "#FFC107");
            healthGradient.addColorStop(1, "#FF9800");
        } else {
            healthGradient.addColorStop(0, "#F44336");
            healthGradient.addColorStop(1, "#E91E63");
        }

        ctx.fillStyle = healthGradient;
        ctx.fillRect(barX, barY, Math.max(0, barWidth * (this.hp / this.maxHp)), barHeight);

        if (this.hp > 30) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = "white";
            ctx.fillRect(barX, barY, Math.max(0, barWidth * (this.hp / this.maxHp)), barHeight / 2);
            ctx.globalAlpha = 1.0;
        }
    }

    takeDamage(amount) {
        if (this.invulnerable || isDead) return;
        
        this.hp -= amount;
        this.invulnerable = true;
        this.invulnerableTimer = 60;
        
        createExplosion(this.x + this.width/2, this.y + this.height/2, "#FF6B6B", 8);
        
        if (this.hp <= 0 && !isDead) {
            isDead = true;
            this.hp = 0;
            saveData();
            currentSpeed = 0;
            createExplosion(this.x + this.width/2, this.y + this.height/2, "#FF6B6B", 20);
            setTimeout(function() {
                softReset();
            }, 2750);
        }
    }

    update() {
        if (isPaused) return;

        if (this.invulnerable) {
            this.invulnerableTimer--;
            if (this.invulnerableTimer <= 0) {
                this.invulnerable = false;
            }
        }

        if (this.hp <= 0 && !isDead) {
            isDead = true;
            this.hp = 0;
            saveData();
            currentSpeed = 0;
            createExplosion(this.x + this.width/2, this.y + this.height/2, "#FF6B6B", 20);
            setTimeout(function() {
                softReset();
            }, 2750);
            return;
        }
        
        if (isDead) return;

        if ((keys['w'] || keys[' ']) && this.grounded) { 
            this.velY = -18; 
            this.grounded = false;
            createDustTrail(this.x + this.width/2, this.y + this.height, "rgba(100, 100, 100, 0.8)", 8);
        }
        
        if (keys['a']) currentSpeed = -7;
        else if (keys['d']) currentSpeed = 7;
        else currentSpeed = 0;

        if (worldX <= 0 && currentSpeed < 0) currentSpeed = 0;
        
        if (worldX >= 25000 && currentSpeed > 0 && !bossDefeated) {
            currentSpeed = 0;
        }
        if (worldX >= 50000 && currentSpeed > 0) {
            currentSpeed = 0;
        }

        if (Math.abs(worldX - SHOP_X) < 200) {
            if (!document.getElementById('shop-prompt')) {
                const prompt = document.createElement('div');
                prompt.id = 'shop-prompt';
                prompt.style.cssText = `
                    position: fixed;
                    bottom: 200px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.8);
                    color: #FFD700;
                    padding: 15px 30px;
                    border-radius: 10px;
                    font-weight: bold;
                    font-family: Arial;
                    z-index: 100;
                    border: 2px solid #FFD700;
                    pointer-events: none;
                `;
                prompt.innerText = 'Presiona E para ENTRAR a la TIENDA';
                document.body.appendChild(prompt);
            }
        } else {
            const prompt = document.getElementById('shop-prompt');
            if (prompt) prompt.remove();
        }

        if (keys['e'] && Math.abs(worldX - SHOP_X) < 200 && !shopOpen && !missionsOpen) {
            shopOpen = true;
            isPaused = true;
            keys['e'] = false;
        }

        worldX += currentSpeed;
        
        if (worldX > 25000 && !bossDefeated) worldX = 25000;
        if (worldX > 50000) worldX = 50000;
        
        this.velY += gravity;
        this.y += this.velY;
        if (this.y + this.height > canvas.height - 60) {
            this.y = canvas.height - 60 - this.height;
            this.velY = 0; 
            this.grounded = true;
        }
        
        if (gameState === "BOSS") {
            if (worldX >= GATE_X - 250 && currentSpeed > 0) {
                currentSpeed = 0;
            }
            if (worldX > GATE_X - 200) {
                this.takeDamage(this.hp);
            }
        }
    }
}
// --- CLASES ENEMY, ENEMY1, ENEMY2 ---
class Enemy {
    constructor(isBig = false) {
        this.isBig = isBig;
        this.width = isBig ? 90 : 60; 
        this.height = isBig ? 80 : 55;
        this.hp = isBig ? 100 : 50;
        this.maxHp = this.hp;
        this.x = canvas.width + 100;
        this.isGround = Math.random() < 0.3;
        this.y = this.isGround ? canvas.height - 115 : canvas.height - 250 - Math.random() * 120;
        this.hasDropped = false;
        this.animTimer = Math.random() * 1000;
    }
    
    draw(deltaTime) {
        this.animTimer += deltaTime;
        let flySquash = 1.0 + Math.sin(this.animTimer * 0.02) * (this.isGround ? 0.05 : 0.2);
        
        if (this.isGround) {
            drawShadow(ctx, this.x - 10, this.y + this.height, this.width + 20, 6, 0.5);
        }
        
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.scale(1.0, flySquash);
        if (enemyImg.complete) ctx.drawImage(enemyImg, -this.width/2, -this.height/2, this.width, this.height);
        else {
            ctx.fillStyle = "#FF6B6B";
            ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        }
        ctx.restore();

        drawGlow(ctx, this.x + this.width/2, this.y + this.height/2, 50, "#FF0000", 0.2);

        this.drawHealthBar();
    }

    drawHealthBar() {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(this.x - 2, this.y - 17, this.width + 4, 8);
        ctx.strokeStyle = "#FF4444";
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - 2, this.y - 17, this.width + 4, 8);

        const healthGradient = ctx.createLinearGradient(this.x, this.y - 15, this.x + this.width, this.y - 15);
        healthGradient.addColorStop(0, "#FF6B6B");
        healthGradient.addColorStop(1, "#FF1744");

        ctx.fillStyle = healthGradient;
        ctx.fillRect(this.x, this.y - 15, this.width * (this.hp / this.maxHp), 6);
    }

    update() {
        if (isPaused || isDead) return;
        this.x -= (4 + currentSpeed * 0.5);
        
        if (!this.isGround && !this.hasDropped && Math.abs(this.x - (player.x + 30)) < 60) {
            this.hasDropped = true;
            if (Math.random() < 0.15){
                enemyProjectiles.push({ x: this.x + 20, y: this.y + 40, velY: 1, velX: currentSpeed * 0.5 });
            }
        }
    }
}

class Enemy1 {
    constructor() {
        this.width = 80;
        this.height = 70;
        this.hp = 85;
        this.maxHp = 85;
        this.x = canvas.width + 100;
        this.y = canvas.height - 60 - this.height;
        this.speed = 4;
        this.animTimer = Math.random() * 1000;
    }

    draw(deltaTime) {
        this.animTimer += deltaTime;

        let squash = 1.0 + Math.sin(this.animTimer * 0.015) * 0.08;
        let stretchX = 1.0 - Math.sin(this.animTimer * 0.015) * 0.03;

        drawShadow(ctx, this.x - 10, this.y + this.height, this.width + 20, 10, 0.5);

        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height);
        ctx.scale(stretchX, squash);

        if (enemy1Img.complete) {
            ctx.drawImage(enemy1Img, -this.width / 2, -this.height, this.width, this.height);
        } else {
            ctx.fillStyle = "brown";
            ctx.fillRect(-this.width / 2, -this.height, this.width, this.height);
        }

        ctx.restore();

        this.drawHealthBar();
    }

    drawHealthBar() {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(this.x, this.y - 12, this.width, 6);
        ctx.fillStyle = "red";
        ctx.fillRect(this.x, this.y - 12, this.width * (this.hp / this.maxHp), 6);
    }

    update() {
        if (isPaused || isDead) return;
        
        // 🆕 CORRECCIÓN: Misma fórmula que las palomas (Enemy)
        // Velocidad base (4) + ajuste por movimiento del jugador (0.5)
        this.x -= (4 + currentSpeed * 0.4);
        
        if (!player.invulnerable &&
            player.x < this.x + this.width &&
            player.x + player.width > this.x &&
            player.y < this.y + this.height &&
            player.y + player.height > this.y) {
            player.takeDamage(30);
        }
    }
}

class Enemy2 {
    constructor() {
        this.width = 75;
        this.height = 60;
        this.hp = 50;
        this.maxHp = 50;
        this.x = canvas.width + 100;
        this.baseY = canvas.height - 250 - Math.random() * 80;
        this.y = this.baseY;
        this.speed = 4.5;
        this.animTimer = Math.random() * 1000;
        this.bombChance = 0.005;
        this.hasBombed = false;
    }

    draw(deltaTime) {
        this.animTimer += deltaTime;

        let squash = 1.0 + Math.sin(this.animTimer * 0.02) * 0.12;

        drawGlow(ctx, this.x + this.width / 2, this.y + this.height / 2, 40, "#FF4444", 0.2);

        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.scale(1, squash);

        if (enemy2Img.complete && enemy2Img.naturalWidth > 0) {
            ctx.drawImage(enemy2Img, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            ctx.fillStyle = "#FF5722";
            ctx.beginPath();
            ctx.arc(0, 0, this.width/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#FF0000";
            ctx.beginPath();
            ctx.arc(-10, -5, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(10, -5, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        this.drawHealthBar();
    }

    drawHealthBar() {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(this.x, this.y - 12, this.width, 6);
        ctx.fillStyle = "orange";
        ctx.fillRect(this.x, this.y - 12, this.width * (this.hp / this.maxHp), 6);
    }

    update() {
        if (isPaused || isDead) return;

        // 🆕 CORRECCIÓN: Misma fórmula que las palomas (Enemy)
        // Velocidad base (4.5) + ajuste por movimiento del jugador (0.5)
        this.x -= (4.5 + currentSpeed * 0.4);
        this.y = this.baseY + Math.sin(Date.now() * 0.003) * 10;

        if (!player.invulnerable &&
            player.x < this.x + this.width &&
            player.x + player.width > this.x &&
            player.y < this.y + this.height &&
            player.y + player.height > this.y) {
            player.takeDamage(30);
        }

        if (!this.hasBombed && Math.random() < this.bombChance) {
            if (this.y < player.y && Math.abs(this.x - player.x) < 100) {
                enemyProjectiles.push({
                    x: this.x + this.width/2,
                    y: this.y + this.height/2,
                    velY: 3,
                    velX: -2,
                    size: 20,
                    damage: 50,
                    type: "BOMB"
                });
                this.hasBombed = true;
            }
        }
    }
}

const player = new Player();
applyLoadedUpgrades(); // 🆕 Aplicar mejoras guardadas al jugador
validateUpgrades();    // 🆕 Validar que no haya inconsistencias
// --- FUNCIONES DE DIBUJO DEL FONDO ---
function drawBackground() {
    let transitionStart = 19000;
    let transitionEnd = 21000;
    let transitionProgress = 0;
    let stormLevel = 0;

    if (worldX > JUNGLE_START_X) stormLevel = 1;
    if (worldX > STORM_START_X) stormLevel = 2;
    
    if (worldX >= transitionStart && worldX <= transitionEnd) {
        transitionProgress = (worldX - transitionStart) / (transitionEnd - transitionStart);
    } else if (worldX > transitionEnd) {
        transitionProgress = 1;
    }

    let r = Math.floor(79 + (transitionProgress * 120));
    let g = Math.floor(172 - (transitionProgress * 90));
    let b = Math.floor(254 - (transitionProgress * 200));
    
    let baseSky = `rgb(${r},${g},${b})`;

    if (stormLevel === 1) {
        baseSky = "#5C6B73";
    }
    if (stormLevel === 2) {
        baseSky = "#2F3E46";
    }

    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, baseSky);
    skyGradient.addColorStop(1, "#1C262B");
    
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar nubes
    clouds.forEach(cloud => {
        cloud.update();
        cloud.draw(ctx);
    });

    // Dibujar montañas
    mountains.forEach((m, idx) => {
        let xPos = m.x - worldX * 0.2;
        
        const mountainGradient = ctx.createLinearGradient(xPos, canvas.height - 60 - m.height, xPos + m.width/2, canvas.height - 60);
        
        if (idx < 8) {
            mountainGradient.addColorStop(0, "#7E90B0");
            mountainGradient.addColorStop(1, "#546E7A");
        } else {
            mountainGradient.addColorStop(0, "#A1887F");
            mountainGradient.addColorStop(1, "#8D6E63");
        }
        
        ctx.fillStyle = mountainGradient;
        ctx.beginPath();
        ctx.moveTo(xPos, canvas.height - 60);
        ctx.lineTo(xPos + m.width/2, canvas.height - 60 - m.height);
        ctx.lineTo(xPos + m.width, canvas.height - 60);
        ctx.fill();
        
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xPos + m.width/2, canvas.height - 60 - m.height);
        ctx.lineTo(xPos + m.width, canvas.height - 60);
        ctx.stroke();
    });

    // --- ÁRBOLES DE JUNGLA MEJORADOS ---
    if (worldX >= JUNGLE_START_X) {
        // Capa de fondo (parallax)
        jungleTrees.filter(t => t.layer === 'back').forEach(tree => {
            let treeScreenX = tree.x - worldX * 0.7;
            
            if (treeScreenX > -150 && treeScreenX < canvas.width + 150) {
                ctx.fillStyle = "#4E342E";
                ctx.fillRect(treeScreenX, canvas.height - 60 - tree.height, tree.width, tree.height);
                
                ctx.fillStyle = "#1B5E20";
                ctx.beginPath();
                ctx.arc(treeScreenX + tree.width/2, canvas.height - 60 - tree.height - 20, 60, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = "#0D5302";
                ctx.beginPath();
                ctx.arc(treeScreenX + tree.width/2 - 20, canvas.height - 60 - tree.height, 45, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(treeScreenX + tree.width/2 + 20, canvas.height - 60 - tree.height, 45, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        // Capa frontal
        jungleTrees.filter(t => t.layer === 'front').forEach(tree => {
            let treeScreenX = tree.x - worldX * 0.9;
            
            if (treeScreenX > -200 && treeScreenX < canvas.width + 200) {
                const gradient = ctx.createLinearGradient(treeScreenX, canvas.height - 60 - tree.height, 
                                                           treeScreenX + tree.width, canvas.height - 60);
                gradient.addColorStop(0, "#5D4037");
                gradient.addColorStop(1, "#3E2723");
                ctx.fillStyle = gradient;
                ctx.fillRect(treeScreenX, canvas.height - 60 - tree.height, tree.width, tree.height);
                
                ctx.strokeStyle = "#2E1B0E";
                ctx.lineWidth = 2;
                for(let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    ctx.moveTo(treeScreenX + 5 + i*10, canvas.height - 60 - tree.height + 20);
                    ctx.lineTo(treeScreenX + 5 + i*10, canvas.height - 60 - 20);
                    ctx.stroke();
                }
                
                ctx.fillStyle = "#2E7D32";
                ctx.beginPath();
                ctx.arc(treeScreenX + tree.width/2, canvas.height - 60 - tree.height - 30, 70, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = "#388E3C";
                ctx.beginPath();
                ctx.arc(treeScreenX + tree.width/2 - 25, canvas.height - 60 - tree.height - 10, 55, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(treeScreenX + tree.width/2 + 25, canvas.height - 60 - tree.height - 10, 55, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = "#4CAF50";
                ctx.beginPath();
                ctx.arc(treeScreenX + tree.width/2, canvas.height - 60 - tree.height - 50, 50, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = "#66BB6A";
                ctx.beginPath();
                ctx.arc(treeScreenX + tree.width/2 - 15, canvas.height - 60 - tree.height - 70, 35, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(treeScreenX + tree.width/2 + 15, canvas.height - 60 - tree.height - 70, 35, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = "#81C784";
                for(let i = 0; i < 8; i++) {
                    ctx.beginPath();
                    ctx.arc(treeScreenX + tree.width/2 - 30 + i*15, 
                           canvas.height - 60 - tree.height - 40 + Math.sin(i)*10, 
                           15, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                ctx.strokeStyle = "#33691E";
                ctx.lineWidth = 3;
                for(let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    ctx.moveTo(treeScreenX + 10 + i*15, canvas.height - 60 - tree.height - 20);
                    ctx.lineTo(treeScreenX + 15 + i*15, canvas.height - 60 - tree.height + 40);
                    ctx.stroke();
                }
            }
        });
        
        // Niebla en la jungla
        if (worldX >= JUNGLE_START_X + 1000) {
            ctx.fillStyle = "rgba(200, 230, 200, 0.05)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // CIUDAD DESÉRTICA
    if (worldX < 28500) {
        desertHouses.forEach(h => {
            let hX = h.x - worldX;
            if (hX + h.w > 0 && hX < canvas.width) {
                ctx.fillStyle = h.color;
                ctx.fillRect(hX, canvas.height - 60 - h.h, h.w, h.h);
                ctx.fillStyle = "rgba(0,0,0,0.2)";
                for(let i = 0; i < h.windows; i++) {
                    ctx.fillRect(hX + 20 + (i * 35), canvas.height - 60 - h.h + 30, 25, 20);
                }
            }
        });
    }

    // PUERTA PRINCIPAL
    let gateScreenX = GATE_X - worldX;
    if (gateScreenX > -400 && gateScreenX < canvas.width + 400) {
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(gateScreenX - 30, 0, 60, canvas.height - 60);
        ctx.fillRect(gateScreenX + 270, 0, 60, canvas.height - 60);
        ctx.fillStyle = "#3E2723";
        ctx.fillRect(gateScreenX - 50, 40, 400, 70);
        
        if (!bossDefeated) {
            ctx.fillStyle = "#4E342E";
            ctx.fillRect(gateScreenX + 30, 110, 240, canvas.height - 170);
        }
    }

    // SEGUNDA PUERTA
    let secondGateScreenX = SECOND_GATE_X - worldX;
    if (secondGateScreenX > -400 && secondGateScreenX < canvas.width + 400) {
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(secondGateScreenX - 30, 0, 60, canvas.height - 60);
        ctx.fillRect(secondGateScreenX + 270, 0, 60, canvas.height - 60);
        ctx.fillStyle = "#3E2723";
        ctx.fillRect(secondGateScreenX - 50, 40, 400, 70);
        ctx.fillStyle = "#4E342E";
        ctx.fillRect(secondGateScreenX + 30, 110, 240, canvas.height - 170);
    }

    // TIENDA
    let shopScreenX = SHOP_X - worldX;
    if (shopScreenX > -400 && shopScreenX < canvas.width + 400) {
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(shopScreenX - 100, canvas.height - 200, 200, 140);
        
        ctx.fillStyle = "#6D4C41";
        ctx.beginPath();
        ctx.moveTo(shopScreenX - 100, canvas.height - 200);
        ctx.lineTo(shopScreenX, canvas.height - 240);
        ctx.lineTo(shopScreenX + 100, canvas.height - 200);
        ctx.fill();
        
        ctx.fillStyle = "#8D6E63";
        ctx.fillRect(shopScreenX - 30, canvas.height - 160, 60, 120);
        
        ctx.fillStyle = "#FFDBAC";
        ctx.beginPath();
        ctx.arc(shopScreenX + 60, canvas.height - 120, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#4CAF50";
        ctx.fillRect(shopScreenX + 45, canvas.height - 95, 30, 40);
        
        ctx.strokeStyle = "#FFDBAC";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(shopScreenX + 35, canvas.height - 80);
        ctx.lineTo(shopScreenX + 20, canvas.height - 75);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(shopScreenX + 75, canvas.height - 80);
        ctx.lineTo(shopScreenX + 90, canvas.height - 75);
        ctx.stroke();
        
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(shopScreenX + 53, canvas.height - 125, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(shopScreenX + 67, canvas.height - 125, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Suelo
    let groundColor = "#2E7D32";
    if (transitionProgress > 0) {
        const greenR = 46, greenG = 125, greenB = 50;
        const desertR = 212, desertG = 175, desertB = 11;
        
        const r = Math.floor(greenR + (desertR - greenR) * transitionProgress);
        const g = Math.floor(greenG + (desertG - greenG) * transitionProgress);
        const b = Math.floor(greenB + (desertB - greenB) * transitionProgress);
        
        groundColor = `rgb(${r}, ${g}, ${b})`;
    }
    
    const groundGradient = ctx.createLinearGradient(0, canvas.height - 60, 0, canvas.height);
    groundGradient.addColorStop(0, groundColor);
    
    if (transitionProgress > 0) {
        const baseColor = transitionProgress > 0.5 ? "#B8860B" : "#2E7D32";
        groundGradient.addColorStop(0.5, baseColor);
        groundGradient.addColorStop(1, transitionProgress > 0.5 ? "#8B7500" : "#1B5E20");
    } else {
        groundGradient.addColorStop(0.5, "#27632A");
        groundGradient.addColorStop(1, "#1B5E20");
    }
    
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 60);
    ctx.lineTo(canvas.width, canvas.height - 60);
    ctx.stroke();

    // Efectos de tormenta
    if (stormLevel === 2) {
        ctx.fillStyle = "rgba(100, 120, 140, 0.08)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < 50; i++) {
            let x = Math.random() * canvas.width;
            let y = Math.random() * canvas.height;
            ctx.strokeStyle = "rgba(200,200,255,0.3)";
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 2, y + 10);
            ctx.stroke();
        }
    }

    // Polvo del desierto
    if (transitionProgress > 0 && Math.random() < 0.1) {
        for (let i = 0; i < 3; i++) {
            desertDust.push(new DesertDust(Math.random() * canvas.width, canvas.height - 80));
        }
    }

    for (let i = desertDust.length - 1; i >= 0; i--) {
        desertDust[i].update();
        desertDust[i].draw(ctx);
        if (!desertDust[i].isAlive()) {
            desertDust.splice(i, 1);
        }
    }
}

// --- FUNCIONES DE TIENDA Y MEJORAS ---
function drawShop() {
    if (!shopOpen) return;
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const shopWidth = 500;
    const shopHeight = 450;
    const shopX = canvas.width / 2 - shopWidth / 2;
    const shopY = canvas.height / 2 - shopHeight / 2;
    
    ctx.fillStyle = "#2E7D32";
    ctx.fillRect(shopX, shopY, shopWidth, shopHeight);
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.strokeRect(shopX, shopY, shopWidth, shopHeight);
    
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.fillText("MEJORAS", canvas.width / 2, shopY + 40);
    
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    
    if (coinImg.complete) {
        ctx.drawImage(coinImg, shopX + 20, shopY + 50, 25, 25);
        ctx.fillText("Monedas: " + playerCoins, shopX + 55, shopY + 70);
    } else {
        ctx.fillText("Monedas: " + playerCoins + " 🪙", shopX + 20, shopY + 70);
    }
    
    drawUpgradeItem(
        shopX + 20, shopY + 110,
        "Daño +15",
        "Costo: " + upgrades.damageUpgrade.cost,
        upgrades.damageUpgrade.purchased,
        0
    );
    
    drawUpgradeItem(
        shopX + 20, shopY + 200,
        "Vida +40",
        "Costo: " + upgrades.healthUpgrade.cost,
        upgrades.healthUpgrade.purchased,
        1
    );
    
    drawUpgradeItem(
        shopX + 20, shopY + 290,
        "Disparo Rápido",
        "Costo: " + upgrades.fireRateUpgrade.cost,
        upgrades.fireRateUpgrade.purchased,
        2
    );
    
    ctx.fillStyle = "#FF6B6B";
    ctx.fillRect(shopX + 350, shopY + 380, 130, 40);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Cerrar [ESC]", shopX + 415, shopY + 405);
}

function drawMissions() {
    if (!missionsOpen) return;
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const panelWidth = 550;
    const panelHeight = 500;
    const panelX = canvas.width / 2 - panelWidth / 2;
    const panelY = canvas.height / 2 - panelHeight / 2;
    
    ctx.fillStyle = "#1A237E";
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText("MISIONES", canvas.width / 2, panelY + 40);
    
    const missionsList = [
        missions.kills250,
        missions.kills500,
        missions.meters2000,
        missions.defeatBoss
    ];
    
    let yOffset = panelY + 80;
    
    for (let i = 0; i < missionsList.length; i++) {
        drawMissionItem(panelX + 20, yOffset, missionsList[i], i);
        yOffset += 100;
    }
    
    ctx.fillStyle = "#FF6B6B";
    ctx.fillRect(panelX + 200, panelY + 430, 150, 40);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Cerrar [ESC]", panelX + 275, panelY + 455);
}

function drawMissionItem(x, y, mission, index) {
    if (mission.claimed) {
        ctx.fillStyle = "#1B5E20";
    } else if (mission.completed) {
        ctx.fillStyle = "#FFA500";
    } else {
        ctx.fillStyle = "#283593";
    }
    
    ctx.fillRect(x, y, 510, 85);
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 510, 85);
    
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.fillText(mission.name, x + 15, y + 25);
    
    ctx.font = "14px Arial";
    ctx.fillStyle = "#FFD700";
    if (mission.target > 1) {
        ctx.fillText(`Progreso: ${mission.current}/${mission.target}`, x + 15, y + 50);
    } else if (mission.completed) {
        ctx.fillText("✓ Completada", x + 15, y + 50);
    }
    
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#FFD700";
    ctx.textAlign = "right";
    
    if (coinImg.complete) {
        ctx.drawImage(coinImg, x + 430, y + 30, 30, 30);
        ctx.fillText("+" + mission.reward, x + 420, y + 50);
    } else {
        ctx.fillText("+" + mission.reward + " 🪙", x + 470, y + 50);
    }
    
    if (mission.claimed) {
        ctx.fillStyle = "#66BB6A";
        ctx.fillRect(x + 400, y + 55, 100, 20);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("RECLAMADA", x + 450, y + 68);
    } else if (mission.completed) {
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(x + 400, y + 55, 100, 20);
        ctx.fillStyle = "#000";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("RECLAMAR", x + 450, y + 68);
    } else {
        ctx.fillStyle = "#999";
        ctx.fillRect(x + 400, y + 55, 100, 20);
        ctx.fillStyle = "#FFF";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("EN PROGRESO", x + 450, y + 68);
    }
}

function claimMission(index) {
    const missionsList = [
        missions.kills250,
        missions.kills500,
        missions.meters2000,
        missions.defeatBoss
    ];
    
    const mission = missionsList[index];
    
    if (mission.completed && !mission.claimed) {
        playerCoins += mission.reward;
        mission.claimed = true;
        saveData();
    }
}

function drawUpgradeItem(x, y, name, cost, purchased, index) {
    ctx.fillStyle = purchased ? "#1B5E20" : "#388E3C";
    ctx.fillRect(x, y, 460, 70);
    ctx.strokeStyle = purchased ? "#66BB6A" : "#FFD700";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 460, 70);
    
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "left";
    ctx.fillText(name, x + 15, y + 25);
    
    ctx.font = "16px Arial";
    ctx.fillStyle = "#FFD700";
    
    if (coinImg.complete) {
        ctx.drawImage(coinImg, x + 15, y + 38, 20, 20);
        ctx.fillText(cost, x + 40, y + 50);
    } else {
        ctx.fillText(cost + " 🪙", x + 15, y + 50);
    }
    
    if (purchased) {
        ctx.fillStyle = "#66BB6A";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "right";
        ctx.fillText("✓ COMPRADO", x + 445, y + 35);
    } else {
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(x + 380, y + 10, 70, 50);
        ctx.fillStyle = "#000";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("COMPRAR", x + 415, y + 42);
    }
}

function buyUpgrade(index) {
    const upgradeCosts = [325, 225, 67];
    const upgradeKeys = ['damageUpgrade', 'healthUpgrade', 'fireRateUpgrade'];
    
    if (upgrades[upgradeKeys[index]].purchased) {
        alert("¡Ya tienes esta mejora!");
        return;
    }
    
    if (playerCoins >= upgradeCosts[index]) {
        playerCoins -= upgradeCosts[index];
        upgrades[upgradeKeys[index]].purchased = true;
        
        if (index === 0) {
            player.projectileDamage = (player.projectileDamage || 25) + 15;
        } else if (index === 1) {
            player.maxHp += 40;
            player.hp += 40;
        } else if (index === 2) {
            shootCooldown = Math.max(150, shootCooldown - 15);
        }
        
        saveData();
    } else {
        alert("¡No tienes suficientes monedas!");
    }
}

function tryShoot() {
    const now = performance.now();

    if (isPaused || isDead || shopOpen || missionsOpen) return;

    if (now - lastShotTime < shootCooldown) return;

    projectiles.push({
        x: player.x + 60,
        y: player.y + 40,
        damage: player.projectileDamage || 25
    });

    lastShotTime = now;
}

// 🆕 Función de reinicio suave (mantiene progreso y mejoras)
function softReset() {
    console.log('🔄 Ejecutando reinicio suave...');
    
    // Resetear posición del jugador
    player.x = 150;
    player.y = canvas.height - 150;
    player.velY = 0;
    player.grounded = true;
    player.invulnerable = false;
    
    // Resetear mundo
    worldX = 0;
    meters = 0;
    currentSpeed = 0;
    
    // Limpiar enemigos y proyectiles
    enemies.length = 0;
    newEnemies.length = 0;
    enemyProjectiles.length = 0;
    bossProjectiles.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    
    // Resetear estado del juego
    gameState = "PLAYING";
    boss = null;
    bossDefeated = false;
    isDead = false;
    
    // Restaurar vida del jugador con mejoras aplicadas
    if (upgrades.healthUpgrade.purchased) {
        player.maxHp = 100 + upgrades.healthUpgrade.health;
    } else {
        player.maxHp = 100;
    }
    player.hp = player.maxHp;
    
    // Reaplicar mejoras
    applyLoadedUpgrades();
    validateUpgrades();
    
    // Actualizar HUD
    updateHUD();
    
    console.log('✅ Reinicio suave completado. Mejoras intactas.');
}
// --- BUCLE PRINCIPAL DE ANIMACIÓN ---
function animate() {
    drawBackground();
    
    if (shopOpen) {
        drawShop();
    }
    if (missionsOpen) {
        drawMissions();
    }
    
    player.update();
    player.draw(16);

    if (isDead) {
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0,0,canvas.width,canvas.height);
        
        ctx.save();
        ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "#FF6B6B";
        ctx.font = "bold 80px Arial";
        ctx.textAlign = "center";
        ctx.fillText("¡LAS PALOMAS GANARON!", canvas.width/2, canvas.height/2);
        ctx.restore();
        
        requestAnimationFrame(animate);
        return;
    }

    if (gameState === "PLAYING" && meters >= 2500) {
        gameState = "BOSS"; 
        boss = new Boss();
        createExplosion(canvas.width / 2, 200, "#9C27B0", 30);
    }
    
    meters = Math.floor(worldX / 10);
    updateHUD();
    checkZoneUnlocks();
    
    missions.meters2000.current = meters;
    if (meters >= 2000) missions.meters2000.completed = true;
    
    if (boss) {
        boss.update(); 
        boss.draw();
        bossProjectiles.forEach((m, idx) => {
            drawGlow(ctx, m.x, m.y, m.size, "#FF9800", 0.6);
            
            ctx.fillStyle = "rgba(255, 152, 0, 0.9)";
            ctx.beginPath(); 
            ctx.arc(m.x, m.y, m.size/2, 0, Math.PI*2); 
            ctx.fill();
            
            ctx.strokeStyle = "#FFD700";
            ctx.lineWidth = 2;
            ctx.stroke();
            
            if (!isPaused) (m.type === "SMALL" ? m.x -= 12 : m.y += 10);
            
            if (!player.invulnerable && 
                Math.hypot(m.x - (player.x + 30), m.y - (player.y + 45)) < m.size/2 + 25) {
                player.takeDamage(m.type === "SMALL" ? 20 : 50);
                createExplosion(m.x, m.y, "#FF6B6B", 10);
                bossProjectiles.splice(idx, 1);
            }
        });
        
        if (boss.hp <= 0) { 
            gameState = "POST_BOSS"; 
            boss = null;
            bossDefeated = true;
            missions.defeatBoss.completed = true;
            score += 1000; 
            checkLevelUp(); 
            saveData();
            createExplosion(canvas.width/2, 200, "#FFD700", 40);
        }
    }

    if (!isPaused && (gameState === "PLAYING" || gameState === "POST_BOSS")) {
        if (gameState === "PLAYING" && worldX < 25000) {
            if (Math.random() < 0.02) {
                enemies.push(new Enemy(Math.random() < 0.2));
            }
        }
        else if (worldX >= 28300) {
            if (Math.random() < 0.015) {
                newEnemies.push(new Enemy1());
            }
            if (Math.random() < 0.015) {
                newEnemies.push(new Enemy2());
            }
        }
    }

    enemyProjectiles.forEach((c, idx) => {
        drawGlow(ctx, c.x, c.y, 15, "#FFFFFF", 0.4);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath(); 
        ctx.arc(c.x, c.y, 12, 0, Math.PI*2); 
        ctx.fill();
        
        ctx.strokeStyle = "#E0E0E0";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if(!isPaused) { 
            c.velY += 0.3; 
            c.y += c.velY; 
            c.x -= (2 + currentSpeed * 0.3); 
        }
        
        if (!player.invulnerable && 
            c.y > player.y && c.y < player.y + player.height && 
            c.x > player.x && c.x < player.x + player.width) {
            player.takeDamage(c.type === "BOMB" ? 50 : 15);
            createExplosion(c.x, c.y, "#FF6B6B", 8);
            enemyProjectiles.splice(idx, 1);
        }
        if (c.y > canvas.height) enemyProjectiles.splice(idx, 1);
    });

    projectiles.forEach((p, idx) => {
        p.x += 18;

        drawGlow(ctx, p.x, p.y, 20, "#AEEA00", 0.5);

        ctx.fillStyle = "#AEEA00";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#7CB342";
        ctx.lineWidth = 2;
        ctx.stroke();

        if (boss && p.x > boss.x && p.x < boss.x + boss.width && p.y > boss.y && p.y < boss.y + boss.height) {
            boss.hp -= (p.damage || 25);
            boss.damageFlash = 10;
            createExplosion(p.x, p.y, "#FFD700", 8);
            projectiles.splice(idx, 1);
        }

        enemies.forEach((en, eIdx) => {
            if (p.x > en.x && p.x < en.x + en.width && p.y > en.y && p.y < en.y + en.height + 20) {
                en.hp -= (p.damage || 25);
                createExplosion(p.x, p.y, "#AEEA00", 6);
                projectiles.splice(idx, 1);

                if (en.hp <= 0) {
                    score += en.isBig ? 50 : 20;
                    totalKills++;
                    enemies.splice(eIdx, 1);
                     // 🆕 CURACIÓN AL DERROTAR ENEMIGO
            player.hp = Math.min(player.hp + 5, player.maxHp);
                    missions.kills250.current = totalKills;
                    missions.kills500.current = totalKills;
                    
                    if (totalKills >= 250) missions.kills250.completed = true;
                    if (totalKills >= 500) missions.kills500.completed = true;
                    
                    checkLevelUp();
                    saveData();
                }
            }
        });

        newEnemies.forEach((en, eIdx) => {
            if (p.x > en.x && p.x < en.x + en.width && p.y > en.y && p.y < en.y + en.height) {
                en.hp -= (p.damage || 25);
                createExplosion(p.x, p.y, "#AEEA00", 6);
                projectiles.splice(idx, 1);

                if (en.hp <= 0) {
                    totalKills++;
                    score += 30;
                    newEnemies.splice(eIdx, 1);
                    // 🆕 CURACIÓN AL DERROTAR ENEMIGO
            player.hp = Math.min(player.hp + 5, player.maxHp);
                    missions.kills250.current = totalKills;
                    missions.kills500.current = totalKills;
                    
                    if (totalKills >= 250) missions.kills250.completed = true;
                    if (totalKills >= 500) missions.kills500.completed = true;
                    
                    checkLevelUp();
                    saveData();
                }
            }
        });

        if (p.x > canvas.width) {
            projectiles.splice(idx, 1);
        }
    });

    enemies.forEach((en, idx) => {
        en.update(); 
        en.draw(16);
        if (!player.invulnerable &&
            player.x < en.x + en.width && 
            player.x + 60 > en.x && 
            player.y < en.y + en.height && 
            player.y + 90 > en.y) {
            player.takeDamage(20);
            createExplosion(en.x + en.width/2, en.y + en.height/2, "#FF6B6B", 10);
        }
        if(en.x < -150) enemies.splice(idx, 1);
    });

    newEnemies.forEach((en, idx) => {
        en.update();
        en.draw(16);

        if (en.x < -150) newEnemies.splice(idx, 1);
    });
    
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(ctx);
        if (!particles[i].isAlive()) {
            particles.splice(i, 1);
        }
    }

    requestAnimationFrame(animate);
}

function checkLevelUp() {
    let nextLvlExp = level * 150;
    if (score >= nextLvlExp) { 
        score -= nextLvlExp; 
        level++; 
        player.maxHp += 20;
        player.hp = player.maxHp;
        saveData();
    }
}

function saveData() {
    localStorage.setItem('peashooter_exp', score);
    localStorage.setItem('peashooter_lvl', level);
    localStorage.setItem('peashooter_kills', totalKills);
    localStorage.setItem('peashooter_coins', playerCoins);
    localStorage.setItem('peashooter_missions', JSON.stringify(missions));
    localStorage.setItem('peashooter_upgrades', JSON.stringify(upgrades));
    localStorage.setItem('peashooter_zones', JSON.stringify(discoveredZones));
    console.log('✅ Datos guardados correctamente');
}
// 🆕 Función para aplicar mejoras guardadas al jugador
function applyLoadedUpgrades() {
    console.log('Aplicando mejoras cargadas...');
    
    // Aplicar mejora de daño
    if (upgrades.damageUpgrade.purchased) {
        player.projectileDamage = 25 + upgrades.damageUpgrade.damage;
        console.log('✅ Mejora de daño aplicada:', player.projectileDamage);
    } else {
        player.projectileDamage = 25;
    }
    
    // Aplicar mejora de vida
    if (upgrades.healthUpgrade.purchased) {
        player.maxHp = 100 + upgrades.healthUpgrade.health;
        player.hp = player.maxHp;
        console.log('✅ Mejora de vida aplicada. HP máximo:', player.maxHp);
    } else {
        player.maxHp = 100;
        player.hp = Math.min(player.hp, 100);
    }
    
    // Aplicar mejora de velocidad de disparo
    if (upgrades.fireRateUpgrade.purchased) {
        shootCooldown = Math.max(150, 280 - upgrades.fireRateUpgrade.reduction);
        console.log('✅ Mejora de disparo aplicada. Cooldown:', shootCooldown);
    } else {
        shootCooldown = 280;
    }
}

// 🆕 Función para verificar y reparar inconsistencia de mejoras
function validateUpgrades() {
    console.log('Validando mejoras...');
    
    // Si la mejora está comprada pero no tiene efecto, repararla
    if (upgrades.damageUpgrade.purchased && player.projectileDamage <= 25) {
        console.warn('⚠️ Inconsistencia detectada en mejora de daño. Reparando...');
        player.projectileDamage = 25 + upgrades.damageUpgrade.damage;
    }
    
    if (upgrades.healthUpgrade.purchased && player.maxHp <= 100) {
        console.warn('⚠️ Inconsistencia detectada en mejora de vida. Reparando...');
        player.maxHp = 100 + upgrades.healthUpgrade.health;
        player.hp = player.maxHp;
    }
    
    if (upgrades.fireRateUpgrade.purchased && shootCooldown >= 280) {
        console.warn('⚠️ Inconsistencia detectada en mejora de disparo. Reparando...');
        shootCooldown = Math.max(150, 280 - upgrades.fireRateUpgrade.reduction);
    }
}
// --- CONTROLES ---
function configurarBoton(id, tecla) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            keys[tecla] = true;

            if ((id === 'btn-jump' || tecla === 'w') && player.grounded && !isPaused && !isDead) {
                player.velY = -18;
                player.grounded = false;
                createDustTrail(player.x + player.width/2, player.y + player.height, "rgba(100, 100, 100, 0.8)", 8);
            }
        }, { passive: false });

        const detener = (e) => {
            e.preventDefault();
            keys[tecla] = false;
        };

        elemento.addEventListener('pointerup', detener, { passive: false });
        elemento.addEventListener('pointerleave', detener, { passive: false });
        elemento.addEventListener('pointercancel', detener, { passive: false });
    }
}

configurarBoton('btn-left', 'a');
configurarBoton('btn-right', 'd');
configurarBoton('btn-jump', 'w');

canvas.addEventListener('pointerdown', (e) => {
    if (isPaused || isDead || shopOpen || missionsOpen) return;
    if (e.target === canvas) {
        tryShoot();
    }
}, { passive: false });

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    if (shopOpen) {
        const shopWidth = 500;
        const shopHeight = 450;
        const shopX = canvas.width / 2 - shopWidth / 2;
        const shopY = canvas.height / 2 - shopHeight / 2;
        
        if (clickX > shopX + 350 && clickX < shopX + 480 && clickY > shopY + 380 && clickY < shopY + 420) {
            shopOpen = false;
            isPaused = false;
            return;
        }
        
        const itemsY = [shopY + 110, shopY + 200, shopY + 290];
        for (let i = 0; i < 3; i++) {
            if (clickX > shopX + 380 && clickX < shopX + 450 && clickY > itemsY[i] + 10 && clickY < itemsY[i] + 60) {
                if (!upgrades[['damageUpgrade', 'healthUpgrade', 'fireRateUpgrade'][i]].purchased) {
                    buyUpgrade(i);
                }
            }
        }
    }
    
    if (missionsOpen) {
        const panelWidth = 550;
        const panelHeight = 500;
        const panelX = canvas.width / 2 - panelWidth / 2;
        const panelY = canvas.height / 2 - panelHeight / 2;
        
        if (clickX > panelX + 200 && clickX < panelX + 350 && clickY > panelY + 430 && clickY < panelY + 470) {
            missionsOpen = false;
            isPaused = false;
            return;
        }
        
        const missionsList = [
            missions.kills250,
            missions.kills500,
            missions.meters2000,
            missions.defeatBoss
        ];
        
        let yOffset = panelY + 80;
        for (let i = 0; i < missionsList.length; i++) {
            if (clickX > panelX + 400 && clickX < panelX + 500 && clickY > yOffset + 55 && clickY < yOffset + 75) {
                if (missionsList[i].completed && !missionsList[i].claimed) {
                    claimMission(i);
                }
            }
            yOffset += 100;
        }
    }
}, { passive: false });

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (shopOpen) {
            shopOpen = false;
            isPaused = false;
        } else if (missionsOpen) {
            missionsOpen = false;
            isPaused = false;
        }
    }
});

window.onkeydown = (e) => keys[e.key.toLowerCase()] = true;
window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;

// --- MENÚ Y MISIONES ---
const menuBtn = document.getElementById('menu-btn');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');

// ELIMINAR botón viejo si existe
const oldMissionsBtn = document.getElementById('missions-btn');
if (oldMissionsBtn) {
    oldMissionsBtn.remove();
}

// CREAR NUEVO botón de misiones a la izquierda
const missionsBtn = document.createElement('button');
missionsBtn.id = 'missions-btn';
missionsBtn.innerText = '📋 Misiones';
missionsBtn.style.cssText = `
    position: fixed;
    top: 80px;
    left: 20px;
    padding: 10px 18px;
    background: #FF9800;
    color: white;
    border: 2px solid #FFD700;
    border-radius: 10px;
    font-weight: bold;
    font-size: 14px;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    pointer-events: auto;
    transition: all 0.2s;
    font-family: Arial, sans-serif;
`;
missionsBtn.onmouseover = () => {
    missionsBtn.style.transform = 'scale(1.05)';
    missionsBtn.style.background = '#FFA726';
};
missionsBtn.onmouseout = () => {
    missionsBtn.style.transform = 'scale(1)';
    missionsBtn.style.background = '#FF9800';
};
document.body.appendChild(missionsBtn);

missionsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (shopOpen) return;
    missionsOpen = !missionsOpen;
    isPaused = missionsOpen;
});

function toggleMenu() {
    console.log("Toggle menu llamado"); // Para depuración
    if (isDead) return;
    if (missionsOpen || shopOpen) return;
    
    isPaused = !isPaused;
    
    if (isPaused) {
        document.getElementById('menu-lvl').innerText = level;
        document.getElementById('menu-exp').innerText = score;
        document.getElementById('menu-next-lvl').innerText = level * 150;
        document.getElementById('kills').innerText = totalKills;
        setTimeout(() => {
            updateZonesPanel();
        }, 10);
        pauseMenu.classList.remove('hidden');
    } else { 
        pauseMenu.classList.add('hidden'); 
    }
}

// Asegurar que el botón de menú funcione
if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("Botón menú clickeado");
        toggleMenu();
    });
    
    menuBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("Botón menú pointerdown");
        toggleMenu();
    });
}

if (resumeBtn) {
    resumeBtn.addEventListener('click', (e) => { 
        e.stopPropagation();
        e.preventDefault();
        toggleMenu(); 
    });
}
// --- BOTÓN DE RESETEO PARCIAL (Monedas, Mejoras, Misiones) ---
const resetPartialBtn = document.getElementById('reset-partial-btn');
if (resetPartialBtn) {
    resetPartialBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('⚠️ ¿Reiniciar economía?\n\nSe borrarán:\n• Monedas\n• Mejoras compradas\n• Progreso de misiones\n\nSe mantendrá:\n• Nivel\n• Experiencia\n• Palomas eliminadas\n• Zonas descubiertas')) {
            
            // Resetear monedas
            playerCoins = 0;
            
            // Resetear mejoras
            upgrades = {
                damageUpgrade: { purchased: false, cost: 325, damage: 15 },
                healthUpgrade: { purchased: false, cost: 225, health: 40 },
                fireRateUpgrade: { purchased: false, cost: 67, reduction: 15 }
            };
            
            // Resetear atributos del jugador afectados por mejoras
            player.projectileDamage = 25;
            player.maxHp = 100;
            player.hp = Math.min(player.hp, 100);
            shootCooldown = 280;
            
            // Resetear misiones (mantener estructura pero reiniciar progreso)
            missions = {
                kills250: { completed: false, claimed: false, reward: 75, name: "Derrota 250 palomas", current: 0, target: 250 },
                kills500: { completed: false, claimed: false, reward: 150, name: "Derrota 500 palomas", current: 0, target: 500 },
                meters2000: { completed: false, claimed: false, reward: 50, name: "Llega a los 2000 Metros", current: 0, target: 2000 },
                defeatBoss: { completed: false, claimed: false, reward: 450, name: "Derrota al Guardián del Desierto", current: 0, target: 1 }
            };
            
            // Actualizar misiones con kills actuales
            missions.kills250.current = totalKills;
            missions.kills500.current = totalKills;
            if (totalKills >= 250) missions.kills250.completed = true;
            if (totalKills >= 500) missions.kills500.completed = true;
            
            // Actualizar misión de metros
            missions.meters2000.current = meters;
            if (meters >= 2000) missions.meters2000.completed = true;
            
            // Misión del boss (si ya fue derrotado, marcarla)
            if (bossDefeated) {
                missions.defeatBoss.completed = true;
                missions.defeatBoss.current = 1;
            }
            
            // Guardar datos
            saveData();
            
            // Actualizar UI del menú
            document.getElementById('menu-lvl').innerText = level;
            document.getElementById('menu-exp').innerText = score;
            document.getElementById('menu-next-lvl').innerText = level * 150;
            document.getElementById('kills').innerText = totalKills;
            
            alert('✅ Economía reiniciada correctamente.\nNivel, EXP y kills mantenidos.');
            
            // Cerrar menú y reanudar
            pauseMenu.classList.add('hidden');
            isPaused = false;
        }
    });
}

// Redimensionar canvas al cambiar tamaño de ventana
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Inicializar
generateClouds();
animate();
// 🆕 Función de reinicio suave (mantiene progreso y mejoras)
function softReset() {
    console.log('🔄 Ejecutando reinicio suave...');
    
    // Resetear posición del jugador
    player.x = 150;
    player.y = canvas.height - 150;
    player.velY = 0;
    player.grounded = true;
    player.invulnerable = false;
    
    // Resetear mundo
    worldX = 0;
    meters = 0;
    currentSpeed = 0;
    
    // Limpiar enemigos y proyectiles
    enemies.length = 0;
    newEnemies.length = 0;
    enemyProjectiles.length = 0;
    bossProjectiles.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    
    // Resetear estado del juego
    gameState = "PLAYING";
    boss = null;
    bossDefeated = false;
    isDead = false;
    
    // Restaurar vida del jugador con mejoras aplicadas
    player.maxHp = upgrades.healthUpgrade.purchased ? 100 + upgrades.healthUpgrade.health : 100;
    player.hp = player.maxHp;
    
    // Reaplicar mejoras
    applyLoadedUpgrades();
    validateUpgrades();
    
    // Actualizar HUD
    updateHUD();
    
    // Actualizar panel de zonas
    updateZonesPanel();
    
    console.log('✅ Reinicio suave completado. Mejoras intactas.');
}