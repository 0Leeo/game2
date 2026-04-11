const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let score = parseInt(localStorage.getItem('peashooter_exp')) || 0;
let level = parseInt(localStorage.getItem('peashooter_lvl')) || 1;
let totalKills = parseInt(localStorage.getItem('peashooter_kills')) || 0;
let isPaused = false;

const gravity = 0.8;
const touch = { left: false, right: false, jump: false };
const keys = {};
const projectiles = [];
const enemies = [];
let worldX = 0;
let currentSpeed = 0;
let autoShootTimer = 0;
let manualShootTimer = 0;
const manualShootDelay = 15;

const playerImg = new Image(); playerImg.src = 'personaje.png';
const enemyImg = new Image(); enemyImg.src = 'paloma.png';

// --- NUEVO: SISTEMA DE MONTAÑAS REALISTAS ---
const mountains = [];
for(let i = 0; i < 10; i++) {
    mountains.push({
        x: i * 400,
        width: 500 + Math.random() * 300,
        height: 200 + Math.random() * 250,
        color: i % 2 === 0 ? "#546E7A" : "#78909C", // Colores intercalados
        speedFactor: 0.15 + (Math.random() * 0.1)
    });
}

class Player {
    constructor() {
        this.width = 60; this.height = 90;
        this.x = 150; this.y = canvas.height - 150;
        this.velY = 0; this.speed = 5.5;
        this.maxHp = 100; this.hp = 100;
        this.grounded = false;
        this.animTimer = 0;
    }

    draw(deltaTime) {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, this.y + this.height - 5, 25, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        if (playerImg.complete) {
            this.animTimer += deltaTime;
            let squash = 1.0 + Math.sin(this.animTimer * 0.015) * 0.08;
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height);
            ctx.scale(1.0, squash);
            ctx.drawImage(playerImg, -this.width/2, -this.height, this.width, this.height);
            ctx.restore();
        }

        ctx.fillStyle = "black"; ctx.fillRect(this.x, this.y - 25, this.width, 8);
        ctx.fillStyle = this.hp > 30 ? "#4CAF50" : "#F44336";
        ctx.fillRect(this.x, this.y - 25, this.width * (this.hp / this.maxHp), 8);
    }

    update() {
        if (isPaused) return;
        if ((keys['w'] || keys[' '] || touch.jump) && this.grounded) {
            this.velY = -16; this.grounded = false; touch.jump = false;
        }
        if (keys['a'] || touch.left) currentSpeed = -this.speed;
        else if (keys['d'] || touch.right) currentSpeed = this.speed;
        else currentSpeed = 0;

        if (worldX <= 0 && currentSpeed < 0) currentSpeed = 0;
        worldX += currentSpeed;
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
        this.width = isBig ? 85 : 60;
        this.height = isBig ? 75 : 55;
        this.hp = isBig ? 75 : 50;
        this.x = canvas.width + 100;
        this.isGround = Math.random() < 0.4;
        this.y = this.isGround ? (canvas.height - 60 - this.height + 3) : (canvas.height - 300 - Math.random() * 120);
        this.baseSpeed = isBig ? 1.5 : 3;
        this.animTimer = Math.random() * 1000; // Offset para que no todas aleteen igual
    }

    draw(deltaTime) {
        // SOMBRA
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, canvas.height - 55, this.width/3, 5, 0, 0, Math.PI*2);
        ctx.fill();

        if (enemyImg.complete) {
            this.animTimer += deltaTime;
            // SIMULACIÓN DE ALETEO (Efecto Squash y Stretch)
            let flySquash = 1.0 + Math.sin(this.animTimer * 0.02) * (this.isGround ? 0.05 : 0.25);
            
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.scale(1.0, flySquash);
            ctx.drawImage(enemyImg, -this.width/2, -this.height/2, this.width, this.height);
            ctx.restore();
        }
        ctx.fillStyle = "red";
        ctx.fillRect(this.x, this.y - 12, this.width * (this.hp / (this.isBig ? 75 : 50)), 5);
    }

    update() {
        if (!isPaused) this.x -= (this.baseSpeed + (currentSpeed * 0.65));
    }
}

class Projectile {
    constructor(x, y) { this.x = x; this.y = y; this.damage = 25; this.radius = 12; }
    draw() {
        ctx.fillStyle = "#AEEA00"; ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "white"; ctx.beginPath();
        ctx.arc(this.x - 3, this.y - 3, 4, 0, Math.PI * 2); ctx.fill();
    }
    update() { if (!isPaused) this.x += (13 - (currentSpeed * 0.65)); }
}

const player = new Player();

function fire() { projectiles.push(new Projectile(player.x + player.width - 10, player.y + 45)); }

window.addEventListener('mousedown', (e) => {
    if (!isPaused && manualShootTimer <= 0 && e.clientX > 100) {
        fire(); manualShootTimer = manualShootDelay;
    }
});

const menu = document.getElementById('pause-menu');
const menuBtn = document.getElementById('menu-btn');
const resumeBtn = document.getElementById('resume-btn');

function toggleMenu() {
    isPaused = !isPaused;
    menu.classList.toggle('hidden');
    if (isPaused) {
        document.getElementById('menu-lvl').innerText = level;
        document.getElementById('menu-exp').innerText = score;
        document.getElementById('menu-next-lvl').innerText = level * 100;
        document.getElementById('kills').innerText = totalKills;
    }
}

menuBtn.onclick = toggleMenu;
resumeBtn.onclick = toggleMenu;

function drawBackground() {
    // Cielo gradiente (se dibuja cada frame)
    let sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#4facfe"); sky.addColorStop(1, "#00f2fe");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // DIBUJO DE MONTAÑAS INFINITAS
    mountains.forEach(m => {
        // El movimiento es relativo al worldX y su propia velocidad
        let xPos = (m.x - worldX * m.speedFactor) % (canvas.width + 600);
        if (xPos < -500) xPos += (canvas.width + 1100);

        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.moveTo(xPos, canvas.height - 60);
        ctx.lineTo(xPos + m.width / 2, canvas.height - 60 - m.height);
        ctx.lineTo(xPos + m.width, canvas.height - 60);
        ctx.fill();
        
        // Efecto de nieve o luz en la cima
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.moveTo(xPos + m.width/2 - 20, canvas.height - 60 - m.height + 40);
        ctx.lineTo(xPos + m.width/2, canvas.height - 60 - m.height);
        ctx.lineTo(xPos + m.width/2 + 20, canvas.height - 60 - m.height + 40);
        ctx.fill();
    });

    // Suelo
    ctx.fillStyle = "#2E7D32"; ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
}

function animate(currentTime) {
    const deltaTime = 16; // Aproximación
    drawBackground();
    player.update();
    player.draw(deltaTime);

    if (!isPaused) {
        autoShootTimer++;
        if (manualShootTimer > 0) manualShootTimer--;
        if (autoShootTimer > Math.max(25, 50 - (level * 2))) { fire(); autoShootTimer = 0; }
        if (Math.random() < 0.015) enemies.push(new Enemy(Math.random() < 0.2));
    }

    projectiles.forEach((p, pIdx) => {
        p.update(); p.draw();
        if (p.x > canvas.width + 50 || p.x < -50) projectiles.splice(pIdx, 1);

        enemies.forEach((en, eIdx) => {
            let hitboxExtra = en.isGround ? 22 : 12;
            if (p.x + p.radius > en.x - hitboxExtra && p.x - p.radius < en.x + en.width + hitboxExtra && 
                p.y + p.radius > en.y - hitboxExtra && p.y - p.radius < en.y + en.height + hitboxExtra) {
                en.hp -= p.damage;
                projectiles.splice(pIdx, 1);
                if (en.hp <= 0) {
                    enemies.splice(eIdx, 1);
                    totalKills++;
                    player.hp = Math.min(100, player.hp + 5);
                    score += 35;
                    if(score >= level*100) { score -= level*100; level++; }
                    localStorage.setItem('peashooter_kills', totalKills);
                }
            }
        });
    });

    enemies.forEach((en, eIdx) => {
        en.update(); en.draw(deltaTime);
        if (player.x < en.x + en.width - 15 && player.x + player.width - 15 > en.x &&
            player.y < en.y + en.height - 15 && player.y + player.height > en.y) {
            player.hp -= 25;
            enemies.splice(eIdx, 1);
            if (player.hp <= 0) { player.hp = 100; worldX = 0; enemies.length = 0; }
        }
        if (en.x < -200) enemies.splice(eIdx, 1);
    });

    requestAnimationFrame(animate);
}

function setupTouch(id, key) {
    let b = document.getElementById(id);
    if (!b) return;
    b.ontouchstart = (e) => { e.preventDefault(); touch[key] = true; };
    b.ontouchend = (e) => { e.preventDefault(); touch[key] = false; };
}
setupTouch('btn-left', 'left'); setupTouch('btn-right', 'right'); setupTouch('btn-jump', 'jump');

window.addEventListener('keydown', (e) => { 
    keys[e.key.toLowerCase()] = true; 
    if(e.key === "escape") toggleMenu();
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

animate();