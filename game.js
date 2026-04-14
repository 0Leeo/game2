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

// Cargar misiones guardadas
let savedMissions = localStorage.getItem('peashooter_missions');
if (savedMissions) {
    try {
        missions = JSON.parse(savedMissions);
    } catch (e) {
        console.log('Error cargando misiones');
    }
}

// Cargar mejoras guardadas
let savedUpgrades = localStorage.getItem('peashooter_upgrades');
if (savedUpgrades) {
    try {
        upgrades = JSON.parse(savedUpgrades);
    } catch (e) {
        console.log('Error cargando mejoras');
    }
}

const gravity = 0.8;
const keys = {};
const projectiles = [];
const enemies = [];
const enemyProjectiles = []; 
const bossProjectiles = [];
const particles = [];
const clouds = [];
const desertDust = [];

let worldX = 0;
let currentSpeed = 0;
let canShoot = true;
const shootCooldown = 280; 

const playerImg = new Image(); playerImg.src = 'personaje.png';
const enemyImg = new Image(); enemyImg.src = 'paloma.png';
// --- NUEVAS VARIABLES PARA LA CIUDAD Y LA PUERTA ---
const GATE_X = 25400; // La puerta está un poco después del spawn del boss
const SHOP_X = 26400; // Tienda a 2640 metros
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
        
        // Dibujar nube con círculos
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

// Generar nubes iniciales
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

// --- CLASES ---
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
const SECOND_GATE_X = 27967;
// --- SISTEMA DE TIENDA ---
let shopOpen = false;
let upgrades = {
    damageUpgrade: { purchased: false, cost: 325, damage: 15 },
    healthUpgrade: { purchased: false, cost: 225, health: 40 },
    fireRateUpgrade: { purchased: false, cost: 67, reduction: 15 }
};
// --- SISTEMA DE MISIONES ---
let missions = {
    kills250: { completed: false, claimed: false, reward: 75, name: "Derrota 250 palomas", current: 0, target: 250 },
    kills500: { completed: false, claimed: false, reward: 150, name: "Derrota 500 palomas", current: 0, target: 500 },
    meters2000: { completed: false, claimed: false, reward: 50, name: "Llega a los 2000 Metros", current: 0, target: 2000 },
    defeatBoss: { completed: false, claimed: false, reward: 450, name: "Derrota al Guardián del Desierto", current: 0, target: 1 }
};

const coinImg = new Image();
coinImg.src = 'coin.png';

let missionsOpen = false;

class Player {
    constructor() {
        this.width = 60; this.height = 90;
        this.x = 150; this.y = canvas.height - 150;
        this.velY = 0; this.hp = 100;
        this.maxHp = 100;
        this.grounded = false;
        this.animTimer = 0;
        this.trailCounter = 0;
    }

    draw(deltaTime) {
        this.animTimer += deltaTime;
        let squash = 1.0 + Math.sin(this.animTimer * 0.015) * 0.08;
        let stretchX = 1.0 - Math.sin(this.animTimer * 0.015) * 0.03;
        
        drawShadow(ctx, this.x - 5, this.y + this.height - 10, this.width + 10, 8, 0.4);
        
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height);
        ctx.scale(stretchX, squash);
        if (playerImg.complete) ctx.drawImage(playerImg, -this.width/2, -this.height, this.width, this.height);
        else {
            ctx.fillStyle = "#4CAF50";
            ctx.fillRect(-this.width/2, -this.height, this.width, this.height);
        }
        ctx.restore();

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

    update() {
        if (isPaused) return;

        if (this.hp <= 0 && !isDead) {
            isDead = true;
            this.hp = 0;
            saveData();
            currentSpeed = 0;
            
            createExplosion(this.x + this.width/2, this.y + this.height/2, "#FF6B6B", 20);
            
            setTimeout(() => { location.reload(); }, 2750);
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
        if (worldX >= 28000 && currentSpeed > 0) {
            currentSpeed = 0;
        }

        // DETECCIÓN TIENDA: Si está en rango de la tienda (26400 ± 200)
        if (Math.abs(worldX - SHOP_X) < 200) {
            // Mostrar botón E o móvil
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
                `;
                prompt.innerText = 'Presiona E para ENTRAR a la TIENDA';
                document.body.appendChild(prompt);
            }
        } else {
            const prompt = document.getElementById('shop-prompt');
            if (prompt) prompt.remove();
        }

        // Abrir tienda con E
        if (keys['e'] && Math.abs(worldX - SHOP_X) < 200) {
            shopOpen = true;
            isPaused = true;
            keys['e'] = false; // Prevenir múltiples aperturas
        }

        worldX += currentSpeed;
        
        if (worldX > 25000 && !bossDefeated) worldX = 25000;
        if (worldX > 28000) worldX = 28000;
        
        meters = Math.floor(worldX / 10);
        const metersEl = document.getElementById('meters');
        if(metersEl) metersEl.innerText = meters;

        this.velY += gravity;
        this.y += this.velY;
        if (this.y + this.height > canvas.height - 60) {
            this.y = canvas.height - 60 - this.height;
            this.velY = 0; 
            this.grounded = true;
        }
            // --- LÓGICA DE LA PUERTA DENTRO DE PLAYER.UPDATE ---
if (gameState === "BOSS") {
    // Si el boss está vivo, hay una pared invisible
    if (worldX >= GATE_X - 250 && currentSpeed > 0) {
        currentSpeed = 0;
    }
    // Si de alguna forma intenta cruzar (o está muy pegado), muere
    if (worldX > GATE_X - 200) {
        this.hp = 0; 
    }
}
        }
    }


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

const player = new Player();

// --- FUNCIONES CORE MEJORADAS ---
function drawBackground() {
    // CAMBIO DE COLOR: Empieza a cambiar entre 19000-21000 WORLDX = 1900-2100 METROS
    let transitionStart = 19000;
    let transitionEnd = 21000;
    let transitionProgress = 0;
    
    if (worldX >= transitionStart && worldX <= transitionEnd) {
        transitionProgress = (worldX - transitionStart) / (transitionEnd - transitionStart);
    } else if (worldX > transitionEnd) {
        transitionProgress = 1;
    }
    
    // Color del cielo: Azul -> Naranja/Rojo
    let r = Math.floor(79 + (transitionProgress * 120));
    let g = Math.floor(172 - (transitionProgress * 90));
    let b = Math.floor(254 - (transitionProgress * 200));
    
    // Crear gradiente vertical para el cielo
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.7);
    skyGradient.addColorStop(0, `rgb(${r},${g},${b})`);
    skyGradient.addColorStop(1, `rgb(${Math.floor(r * 1.2)},${Math.floor(g * 0.9)},${Math.floor(b * 0.8)})`);
    
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar nubes
    clouds.forEach(cloud => {
        cloud.update();
        cloud.draw(ctx);
    });

    // Dibujar montañas mejoradas con degradado
    mountains.forEach((m, idx) => {
        let xPos = m.x - worldX * 0.2;
        
        // Gradiente para las montañas
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
        
        // Línea de sombra en las montañas
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xPos + m.width/2, canvas.height - 60 - m.height);
        ctx.lineTo(xPos + m.width, canvas.height - 60);
        ctx.stroke();
    });
// --- CIUDAD DESÉRTICA DETRÁS DE LA PUERTA ---
desertHouses.forEach(h => {
    let hX = h.x - worldX;
    if (hX + h.w > 0 && hX < canvas.width) {
        ctx.fillStyle = h.color;
        ctx.fillRect(hX, canvas.height - 60 - h.h, h.w, h.h);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        for(let i = 0; i < h.windows; i++) ctx.fillRect(hX + 20, canvas.height - 60 - h.h + 30 + (i * 40), 30, 25);
    }
});

// --- LA GRAN PUERTA (ENTRADA - 2500m) ---
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

// --- SEGUNDA PUERTA GIGANTE (SALIDA - 2790m) SIEMPRE CERRADA ---
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

// --- TIENDA DE MADERA (2640 metros) ---
let shopScreenX = SHOP_X - worldX;
if (shopScreenX > -400 && shopScreenX < canvas.width + 400) {
    // Estructura de madera
    ctx.fillStyle = "#5D4037"; // Madera marrón
    ctx.fillRect(shopScreenX - 100, canvas.height - 200, 200, 140);
    
    // Techo
    ctx.fillStyle = "#6D4C41";
    ctx.beginPath();
    ctx.moveTo(shopScreenX - 100, canvas.height - 200);
    ctx.lineTo(shopScreenX, canvas.height - 240);
    ctx.lineTo(shopScreenX + 100, canvas.height - 200);
    ctx.fill();
    
    // Puerta
    ctx.fillStyle = "#8D6E63";
    ctx.fillRect(shopScreenX - 30, canvas.height - 160, 60, 120);
    
    // NPC - Cabeza (círculo)
    ctx.fillStyle = "#FFDBAC";
    ctx.beginPath();
    ctx.arc(shopScreenX + 60, canvas.height - 120, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // NPC - Cuerpo (rectángulo)
    ctx.fillStyle = "#4CAF50";
    ctx.fillRect(shopScreenX + 45, canvas.height - 95, 30, 40);
    
    // NPC - Brazos
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
    
    // Ojos del NPC
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(shopScreenX + 53, canvas.height - 125, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(shopScreenX + 67, canvas.height - 125, 3, 0, Math.PI * 2);
    ctx.fill();
}

     // Suelo/Arena - Transición basada en proximidad al boss


    // Suelo/Arena - Transición basada en proximidad al boss
    let groundColor = "#2E7D32";
    if (transitionProgress > 0) {
        // Interpolación entre verde y dorado
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

    // Línea del horizonte
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 60);
    ctx.lineTo(canvas.width, canvas.height - 60);
    ctx.stroke();

    // Generar polvo del desierto cuando estamos acercando al boss
    if (transitionProgress > 0 && Math.random() < 0.1) {
        for (let i = 0; i < 3; i++) {
            desertDust.push(new DesertDust(Math.random() * canvas.width, canvas.height - 80));
        }
    }

    // Actualizar y dibujar polvo del desierto
    for (let i = desertDust.length - 1; i >= 0; i--) {
        desertDust[i].update();
        desertDust[i].draw(ctx);
        if (!desertDust[i].isAlive()) {
            desertDust.splice(i, 1);
        }
    }
}
function drawShop() {
    if (!shopOpen) return;
    
    // Fondo oscuro
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Panel de tienda
    const shopWidth = 500;
    const shopHeight = 450;
    const shopX = canvas.width / 2 - shopWidth / 2;
    const shopY = canvas.height / 2 - shopHeight / 2;
    
    ctx.fillStyle = "#2E7D32";
    ctx.fillRect(shopX, shopY, shopWidth, shopHeight);
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.strokeRect(shopX, shopY, shopWidth, shopHeight);
    
    // Título
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.fillText("MEJORAS", canvas.width / 2, shopY + 40);
    
        // Monedas del jugador con imagen
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    
    if (coinImg.complete) {
        ctx.drawImage(coinImg, shopX + 20, shopY + 50, 25, 25);
        ctx.fillText("Monedas: " + playerCoins, shopX + 55, shopY + 70);
    } else {
        ctx.fillText("Monedas: " + playerCoins + " 🪙", shopX + 20, shopY + 70);
    }
    
    // Mejora 1: Daño
    drawUpgradeItem(
        shopX + 20, shopY + 110,
        "Daño +15",
        "Costo: " + upgrades.damageUpgrade.cost,
        upgrades.damageUpgrade.purchased,
        0
    );
    
    // Mejora 2: Vida
    drawUpgradeItem(
        shopX + 20, shopY + 200,
        "Vida +40",
        "Costo: " + upgrades.healthUpgrade.cost,
        upgrades.healthUpgrade.purchased,
        1
    );
    
    // Mejora 3: Velocidad de disparo
    drawUpgradeItem(
        shopX + 20, shopY + 290,
        "Disparo Rápido",
        "Costo: " + upgrades.fireRateUpgrade.cost,
        upgrades.fireRateUpgrade.purchased,
        2
    );
    
    // Botón Cerrar
    ctx.fillStyle = "#FF6B6B";
    ctx.fillRect(shopX + 350, shopY + 380, 130, 40);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Cerrar [ESC]", shopX + 415, shopY + 405);
}
function drawMissions() {
    if (!missionsOpen) return;
    
    // Fondo oscuro
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Panel de misiones
    const panelWidth = 550;
    const panelHeight = 500;
    const panelX = canvas.width / 2 - panelWidth / 2;
    const panelY = canvas.height / 2 - panelHeight / 2;
    
    ctx.fillStyle = "#1A237E";
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    // Título
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText("MISIONES", canvas.width / 2, panelY + 40);
    
    // Misiones
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
    
    // Botón Cerrar
    ctx.fillStyle = "#FF6B6B";
    ctx.fillRect(panelX + 200, panelY + 430, 150, 40);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Cerrar [ESC]", panelX + 275, panelY + 455);
}

function drawMissionItem(x, y, mission, index) {
    // Fondo
    if (mission.claimed) {
        ctx.fillStyle = "#1B5E20"; // Verde si fue reclamada
    } else if (mission.completed) {
        ctx.fillStyle = "#FFA500"; // Naranja si está completada
    } else {
        ctx.fillStyle = "#283593"; // Azul si no está completada
    }
    
    ctx.fillRect(x, y, 510, 85);
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 510, 85);
    
    // Nombre de misión
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.fillText(mission.name, x + 15, y + 25);
    
    // Progreso
    ctx.font = "14px Arial";
    ctx.fillStyle = "#FFD700";
    if (mission.target > 1) {
        ctx.fillText(`Progreso: ${mission.current}/${mission.target}`, x + 15, y + 50);
    } else if (mission.completed) {
        ctx.fillText("✓ Completada", x + 15, y + 50);
    }
    
    // Recompensa con imagen de moneda
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#FFD700";
    ctx.textAlign = "right";
    
    // Dibujar imagen de moneda si está cargada
    if (coinImg.complete) {
        ctx.drawImage(coinImg, x + 430, y + 30, 30, 30);
        ctx.fillText("+" + mission.reward, x + 420, y + 50);
    } else {
        ctx.fillText("+" + mission.reward + " 🪙", x + 470, y + 50);
    }
    
    // Botón Reclamar o estado
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
    // Fondo del item
    ctx.fillStyle = purchased ? "#1B5E20" : "#388E3C";
    ctx.fillRect(x, y, 460, 70);
    ctx.strokeStyle = purchased ? "#66BB6A" : "#FFD700";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 460, 70);
    
    // Nombre
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "left";
    ctx.fillText(name, x + 15, y + 25);
    
       // Costo con imagen de moneda
    ctx.font = "16px Arial";
    ctx.fillStyle = "#FFD700";
    
    // Dibujar imagen de moneda si está cargada
    if (coinImg.complete) {
        ctx.drawImage(coinImg, x + 15, y + 38, 20, 20);
        ctx.fillText(cost, x + 40, y + 50);
    } else {
        ctx.fillText(cost + " 🪙", x + 15, y + 50);
    }
    
    // Estado
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
        
        // Aplicar mejoras
        if (index === 0) {
            // Daño: cambiar el daño de proyectiles
            player.projectileDamage = (player.projectileDamage || 25) + 15;
        } else if (index === 1) {
            // Vida: aumentar HP máximo
            player.maxHp += 40;
            player.hp += 40;
        } else if (index === 2) {
            // Velocidad disparo: reducir cooldown
            shootCooldown = Math.max(150, shootCooldown - 15);
        }
        
        saveData();
    } else {
        alert("¡No tienes suficientes monedas!");
    }
}


function animate() {
    drawBackground();
    
    // Dibujar tienda si está abierta
    if (shopOpen) {
        drawShop();
    }
    // Dibujar misiones si está abierto
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
        gameState = "BOSS"; boss = new Boss();
        createExplosion(canvas.width / 2, 200, "#9C27B0", 30);
    }
    // Actualizar misión de metros
    missions.meters2000.current = meters;
    if (meters >= 2000) missions.meters2000.completed = true;
    if (boss) {
        boss.update(); boss.draw();
        bossProjectiles.forEach((m, idx) => {
            drawGlow(ctx, m.x, m.y, m.size, "#FF9800", 0.6);
            
            ctx.fillStyle = "rgba(255, 152, 0, 0.9)";
            ctx.beginPath(); ctx.arc(m.x, m.y, m.size/2, 0, Math.PI*2); ctx.fill();
            
            ctx.strokeStyle = "#FFD700";
            ctx.lineWidth = 2;
            ctx.stroke();
            
            if (!isPaused) (m.type === "SMALL" ? m.x -= 12 : m.y += 10);
            if (Math.hypot(m.x - (player.x + 30), m.y - (player.y + 45)) < m.size/2 + 25) {
                player.hp -= (m.type === "SMALL" ? 20 : 50);
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

    if (!isPaused && gameState === "PLAYING" && Math.random() < 0.02) {
        enemies.push(new Enemy(Math.random() < 0.2));
    }

    enemyProjectiles.forEach((c, idx) => {
        drawGlow(ctx, c.x, c.y, 15, "#FFFFFF", 0.4);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath(); ctx.arc(c.x, c.y, 12, 0, Math.PI*2); ctx.fill();
        
        ctx.strokeStyle = "#E0E0E0";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if(!isPaused) { c.velY += 0.3; c.y += c.velY; c.x -= (2 + currentSpeed * 0.3); }
        if (c.y > player.y && c.y < player.y + player.height && c.x > player.x && c.x < player.x + player.width) {
            player.hp -= 15;
            createExplosion(c.x, c.y, "#FF6B6B", 8);
            enemyProjectiles.splice(idx, 1);
        }
        if (c.y > canvas.height) enemyProjectiles.splice(idx, 1);
    });

    projectiles.forEach((p, idx) => {
        p.x += 18;
        
        drawGlow(ctx, p.x, p.y, 20, "#AEEA00", 0.5);
        
        ctx.fillStyle = "#AEEA00";
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.fill();
        
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
                                        // Actualizar misión de matar 250 y 500 palomas
                    missions.kills250.current = totalKills;
                    missions.kills500.current = totalKills;
                    if (totalKills >= 250) missions.kills250.completed = true;
                    if (totalKills >= 500) missions.kills500.completed = true;
                    createExplosion(en.x + en.width/2, en.y + en.height/2, "#FF6B6B", 12);
                    enemies.splice(eIdx, 1); 
                    checkLevelUp(); 
                    saveData(); 
                }
            }
        });
        if(p.x > canvas.width) projectiles.splice(idx, 1);
    });

    enemies.forEach((en, idx) => {
        en.update(); en.draw(16);
        if (player.x < en.x + en.width && player.x + 60 > en.x && player.y < en.y + en.height && player.y + 90 > en.y) {
            player.hp -= 20;
            createExplosion(en.x + en.width/2, en.y + en.height/2, "#FF6B6B", 10);
            enemies.splice(idx, 1);
        }
        if(en.x < -150) enemies.splice(idx, 1);
    });

    // Actualizar y dibujar partículas
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
    if (score >= nextLvlExp) { score -= nextLvlExp; level++; player.hp = 100; }
}

function saveData() {
    localStorage.setItem('peashooter_exp', score);
    localStorage.setItem('peashooter_lvl', level);
    localStorage.setItem('peashooter_kills', totalKills);
    localStorage.setItem('peashooter_coins', playerCoins);
    localStorage.setItem('peashooter_missions', JSON.stringify(missions));
    localStorage.setItem('peashooter_upgrades', JSON.stringify(upgrades));
}


// --- SISTEMA DE CONTROLES REFORZADO (MULTITOUCH) ---
function configurarBoton(id, tecla) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.target.tagName !== 'BUTTON' &&
                canShoot && !isPaused && !isDead) {
                                        projectiles.push({ 
                        x: player.x + 60,
                        y: player.y + 40,
                        damage: player.projectileDamage || 25
                    });
                        canShoot = false;
                        setTimeout(() => canShoot = true,
                        shootCooldown);                    
                }
            
            
            keys[tecla] = true;

            if (id === 'btn-jump' || tecla === 'w') {
                if (player.grounded && !isPaused && !isDead) {
                    player.velY = -18;
                    player.grounded = false;
                }
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
    if (e.target === canvas && canShoot && !isPaused && !isDead) {
        projectiles.push({ 
            x: player.x + 60, 
            y: player.y + 40,
            damage: player.projectileDamage || 25
        });
        canShoot = false;
        setTimeout(() => canShoot = true, shootCooldown);
    }
}, { passive: false });

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // --- LÓGICA DE TIENDA ---
    if (shopOpen) {
        const shopWidth = 500;
        const shopHeight = 450;
        const shopX = canvas.width / 2 - shopWidth / 2;
        const shopY = canvas.height / 2 - shopHeight / 2;
        
        // Botón Cerrar tienda
        if (clickX > shopX + 350 && clickX < shopX + 480 && clickY > shopY + 380 && clickY < shopY + 420) {
            shopOpen = false;
            isPaused = false;
            return;
        }
        
        // Botones de compra
        const itemsY = [shopY + 110, shopY + 200, shopY + 290];
        for (let i = 0; i < 3; i++) {
            if (clickX > shopX + 380 && clickX < shopX + 450 && clickY > itemsY[i] + 10 && clickY < itemsY[i] + 60) {
                if (!upgrades[['damageUpgrade', 'healthUpgrade', 'fireRateUpgrade'][i]].purchased) {
                    buyUpgrade(i);
                }
            }
        }
    }
    
    // --- LÓGICA DE MISIONES ---
    if (missionsOpen) {
        const panelWidth = 550;
        const panelHeight = 500;
        const panelX = canvas.width / 2 - panelWidth / 2;
        const panelY = canvas.height / 2 - panelHeight / 2;
        
        // Botón Cerrar misiones
        if (clickX > panelX + 200 && clickX < panelX + 350 && clickY > panelY + 430 && clickY < panelY + 470) {
            missionsOpen = false;
            isPaused = false;
            return;
        }
        
        // Botones Reclamar de misiones
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

// Cerrar tienda y misiones con ESC
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

// --- LÓGICA DEL MENÚ ---
const menuBtn = document.getElementById('menu-btn');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
// Botón de Misiones
const missionsBtn = document.createElement('button');
missionsBtn.id = 'missions-btn';
missionsBtn.innerText = 'Misiones';
missionsBtn.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 12px 20px;
    background: #FF9800;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    font-size: 14px;
    cursor: pointer;
    z-index: 50;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
`;
document.body.appendChild(missionsBtn);

missionsBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    missionsOpen = !missionsOpen;
    if (missionsOpen) isPaused = true;
    else isPaused = false;
});
function toggleMenu() {
    if (isDead) return;
    isPaused = !isPaused;
    if (isPaused) {
        document.getElementById('menu-lvl').innerText = level;
        document.getElementById('menu-exp').innerText = score;
        document.getElementById('menu-next-lvl').innerText = level * 150;
        document.getElementById('kills').innerText = totalKills;
        pauseMenu.classList.remove('hidden');
    } else { pauseMenu.classList.add('hidden'); }
}

menuBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleMenu(); });
resumeBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleMenu(); });

// Inicializar
generateClouds();
animate();