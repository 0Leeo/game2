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
        if (this.damageFlash > 0) {
            flashAlpha = this.damageFlash / 10;
            this.damageFlash--;
        }

        drawShadow(ctx, this.x - 20, this.y + this.height - 20, this.width + 40, 30, 0.6);

        if (enemyImg.complete) {
            ctx.save();
            if (flashAlpha > 0) {
                ctx.globalAlpha = 0.5;
            }
            ctx.drawImage(enemyImg, this.x, this.y, this.width, this.height);
            ctx.restore();
        }

        drawGlow(ctx, this.x + this.width/2, this.y + this.height/2, 200, "#9C27B0", 0.4);
        this.drawHealthBar();
        
        if (this.warningCircle.active) {
            this.drawWarningCircle();
        }
    }

    drawHealthBar() {
        const barWidth = 400;
        const barHeight = 25;
        const barX = canvas.width/2 - barWidth/2;
        const barY = 20;

        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);
        
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 3;
        ctx.strokeRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);

        const healthGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
        healthGradient.addColorStop(0, "#E91E63");
        healthGradient.addColorStop(0.5, "#9C27B0");
        healthGradient.addColorStop(1, "#673AB7");

        ctx.fillStyle = healthGradient;
        ctx.fillRect(barX, barY, barWidth * (this.hp / this.maxHp), barHeight);

        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "white";
        ctx.fillRect(barX, barY, barWidth * (this.hp / this.maxHp), barHeight / 3);
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("BOSS", canvas.width/2, barY + barHeight/2 + 6);
    }

    drawWarningCircle() {
        let screenX = this.warningCircle.worldTargetX - (worldX - this.warningCircle.snapWorldX);
        const pulseScale = 1 + Math.sin(this.warningCircle.timer * 0.1) * 0.2;
        const radius = 70 * pulseScale;
        
        ctx.save();
        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(screenX, canvas.height - 80, radius, 0, Math.PI*2);
        ctx.stroke();
        
        ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
        ctx.beginPath();
        ctx.arc(screenX, canvas.height - 80, radius, 0, Math.PI*2);
        ctx.fill();
        
        ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const x = screenX + Math.cos(angle) * (radius + 20);
            const y = canvas.height - 80 + Math.sin(angle) * (radius + 20);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    update() {
        if (isPaused || isDead) return;
        if (this.x > canvas.width - 400) this.x -= this.speed;
        this.attackTimer++;
        if (this.attackTimer % 120 === 0) {
            bossProjectiles.push({ x: this.x, y: this.y + 150, size: 40, type: "SMALL" });
            createExplosion(this.x + this.width/2, this.y + 150, "#FF9800", 6);
        }
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
                createExplosion(finalDropX, canvas.height - 80, "#FF0000", 15);
            }
        }
    }
}

let boss = null;

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
        
        // PARED INVISIBLE EN 25000 WORLDX = 2500 METROS - SOLO BLOQUEA AVANCE, NO RETROCESO
        if (worldX >= 25000 && currentSpeed > 0) currentSpeed = 0;

        worldX += currentSpeed;
        
        // Asegurar que no pase de 25000
        if (worldX > 25000) worldX = 25000;
        
        meters = Math.floor(worldX / 10);
        const metersEl = document.getElementById('meters');
        if(metersEl) metersEl.innerText = meters;

        this.velY += gravity;
        this.y += this.velY;
        if (this.y + this.height > canvas.height - 60) {
            this.y = canvas.height - 60 - this.height;
            this.velY = 0; this.grounded = true;
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
            if (Math.random() < 0.45) {
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

function animate() {
    drawBackground();
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
            gameState = "POST_BOSS"; boss = null; score += 1000; checkLevelUp(); saveData();
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
            boss.hp -= 25;
            boss.damageFlash = 10;
            createExplosion(p.x, p.y, "#FFD700", 8);
            projectiles.splice(idx, 1);
        }
        enemies.forEach((en, eIdx) => {
            if (p.x > en.x && p.x < en.x + en.width && p.y > en.y && p.y < en.y + en.height + 20) {
                en.hp -= 25;
                createExplosion(p.x, p.y, "#AEEA00", 6);
                projectiles.splice(idx, 1);
                if (en.hp <= 0) { 
                    score += en.isBig ? 50 : 20; 
                    totalKills++; 
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
                    projectiles.push({ x: player.x + 60,
                        y: player.y + 40 });
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
        projectiles.push({ x: player.x + 60, y: player.y + 40 });
        canShoot = false;
        setTimeout(() => canShoot = true, shootCooldown);
    }
}, { passive: false });

window.onkeydown = (e) => keys[e.key.toLowerCase()] = true;
window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;

// --- LÓGICA DEL MENÚ ---
const menuBtn = document.getElementById('menu-btn');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');

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