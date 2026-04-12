const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- VARIABLES DE ESTADO Y PERSISTENCIA ---
let meters = 0;
let gameState = "PLAYING"; 
let isPaused = false;
let isDead = false;

// Cargar datos guardados
let score = parseInt(localStorage.getItem('peashooter_exp')) || 0;
let level = parseInt(localStorage.getItem('peashooter_lvl')) || 1;
let totalKills = parseInt(localStorage.getItem('peashooter_kills')) || 0;

const gravity = 0.8;
const keys = {};
const projectiles = [];
const enemies = [];
const enemyProjectiles = []; 
const bossProjectiles = []; 

let worldX = 0;
let currentSpeed = 0;
let canShoot = true;
const shootCooldown = 280; 

const playerImg = new Image(); playerImg.src = 'personaje.png';
const enemyImg = new Image(); enemyImg.src = 'paloma.png';

const mountains = [];
for(let i = 0; i < 15; i++) {
    mountains.push({ 
        x: i * 400, 
        width: 500 + Math.random() * 300, 
        height: 200 + Math.random() * 250, 
        color: i < 8 ? "#546E7A" : "#8D6E63"
    });
}

class Boss {
    constructor() {
        this.width = 350; this.height = 300;
        this.x = canvas.width + 100;
        this.y = canvas.height - 380;
        this.hp = 950; this.maxHp = 950;
        this.speed = 1.5;
        this.attackTimer = 0;
        this.warningCircle = { active: false, timer: 0, worldTargetX: 0, snapWorldX: 0 };
    }

    draw() {
        if (enemyImg.complete) ctx.drawImage(enemyImg, this.x, this.y, this.width, this.height);
        ctx.fillStyle = "black"; ctx.fillRect(canvas.width/2 - 200, 20, 400, 20);
        ctx.fillStyle = "#9C27B0"; ctx.fillRect(canvas.width/2 - 200, 20, 400 * (this.hp / this.maxHp), 20);
        
        if (this.warningCircle.active) {
            let screenX = this.warningCircle.worldTargetX - (worldX - this.warningCircle.snapWorldX);
            ctx.strokeStyle = "red"; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(screenX, canvas.height - 80, 70, 0, Math.PI*2); ctx.stroke();
        }
    }

    update() {
        if (isPaused) return;
        if (this.x > canvas.width - 400) this.x -= this.speed;
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

class Player {
    constructor() {
        this.width = 60; this.height = 90;
        this.x = 150; this.y = canvas.height - 150;
        this.velY = 0; this.hp = 100;
        this.grounded = false;
        this.animTimer = 0;
    }

    draw(deltaTime) {
        this.animTimer += deltaTime;
        let squash = 1.0 + Math.sin(this.animTimer * 0.015) * 0.08;
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height);
        ctx.scale(1.0, squash);
        if (playerImg.complete) ctx.drawImage(playerImg, -this.width/2, -this.height, this.width, this.height);
        ctx.restore();

        // Vida del Jugador
        ctx.fillStyle = "black"; ctx.fillRect(this.x, this.y - 30, this.width, 10);
        ctx.fillStyle = this.hp > 30 ? "#4CAF50" : "#F44336";
        ctx.fillRect(this.x, this.y - 30, Math.max(0, this.width * (this.hp/100)), 10);
    }

    update() {
        if (isPaused) return;
        if ((keys['w'] || keys[' ']) && this.grounded) { this.velY = -18; this.grounded = false; }
        if (keys['a']) currentSpeed = -7;
        else if (keys['d']) currentSpeed = 7;
        else currentSpeed = 0;
        if (isPaused || isDead) return;
        if (this.hp <= 0 && !isDead) {
             isDead = true;
             this.hp = 0;
             saveData();
             currentSpeed = 0;
             setTimeout (() => {
                 location.reload();
             }, 2750);
            }

        if (worldX <= 0 && currentSpeed < 0) currentSpeed = 0;
        if (gameState === "POST_BOSS" && worldX >= 25000 && currentSpeed > 0) currentSpeed = 0;

        worldX += currentSpeed;
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
        // Ajuste de altura para que sean alcanzables
        this.y = this.isGround ? canvas.height - 115 : canvas.height - 250 - Math.random() * 120;
        this.hasDropped = false;
        this.animTimer = Math.random() * 1000;
    }

    draw(deltaTime) {
        this.animTimer += deltaTime;
        let flySquash = 1.0 + Math.sin(this.animTimer * 0.02) * (this.isGround ? 0.05 : 0.2);
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.scale(1.0, flySquash);
        if (enemyImg.complete) ctx.drawImage(enemyImg, -this.width/2, -this.height/2, this.width, this.height);
        ctx.restore();

        // Barra de vida individual
        ctx.fillStyle = "black"; ctx.fillRect(this.x, this.y - 15, this.width, 6);
        ctx.fillStyle = "red"; ctx.fillRect(this.x, this.y - 15, this.width * (this.hp/this.maxHp), 6);
    }

    update() {
        if (isPaused) return;
        this.x -= (4 + currentSpeed * 0.5);
        
        // Anti-AFK mejorado
        if (!this.isGround && !this.hasDropped && Math.abs(this.x - (player.x + 30)) < 60) {
            this.hasDropped = true;
            if (Math.random() < 0.45) {
                enemyProjectiles.push({ x: this.x + 20, y: this.y + 40, velY: 1, velX: currentSpeed * 0.5 });
            }
        }
    }
}

const player = new Player();

function drawBackground() {
    let t = Math.min(1, worldX / 25000);
    let r = Math.floor(79 + (t * 84)), g = Math.floor(172 - (t * 66)), b = Math.floor(254 - (t * 254));
    ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    mountains.forEach(m => {
        let xPos = m.x - worldX * 0.2; 
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.moveTo(xPos, canvas.height - 60);
        ctx.lineTo(xPos + m.width/2, canvas.height - 60 - m.height);
        ctx.lineTo(xPos + m.width, canvas.height - 60);
        ctx.fill();
    });

    ctx.fillStyle = worldX < 20000 ? "#2E7D32" : "#795548";
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
}

function animate() {
    drawBackground();
    player.update();
    player.draw(16);
    if (isDead) {
        ctx.fillStyle = "rgba(0,0,0,0,.5)";
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "50px Arial";
        ctx.textAlign = "center";
        ctx.fillText("LAS PALOMAS TE FOLLARON",canvas.width/2, canvas.height/2);
        requestAnimationFrame(animate);
        return;
    }


    if (gameState === "PLAYING" && meters >= 2500) {
        gameState = "BOSS"; boss = new Boss();
    }

    if (boss) {
        boss.update(); boss.draw();
        bossProjectiles.forEach((m, idx) => {
            ctx.fillStyle = "orange"; ctx.beginPath(); ctx.arc(m.x, m.y, m.size/2, 0, Math.PI*2); ctx.fill();
            if (!isPaused) (m.type === "SMALL" ? m.x -= 12 : m.y += 10);
            if (Math.hypot(m.x - (player.x + 30), m.y - (player.y + 45)) < m.size/2 + 25) {
                player.hp -= (m.type === "SMALL" ? 20 : 50);
                bossProjectiles.splice(idx, 1);
            }
        });
        if (boss.hp <= 0) { 
            gameState = "POST_BOSS"; boss = null; score += 1000; bossProjectiles.length = 0; 
            checkLevelUp();
        }
    }

    if (!isPaused && gameState !== "POST_BOSS" && Math.random() < 0.02) {
        enemies.push(new Enemy(Math.random() < 0.2)); // 20% palomas grandes
    }

    enemyProjectiles.forEach((c, idx) => {
        ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(c.x, c.y, 12, 0, Math.PI*2); ctx.fill();
        if(!isPaused) { 
            c.velY += 0.3; c.y += c.velY; 
            c.x -= (2 + currentSpeed * 0.3);
        }
        if (c.y > player.y && c.y < player.y + player.height && c.x > player.x && c.x < player.x + player.width) {
            player.hp -= 15; enemyProjectiles.splice(idx, 1);
        }
        if (c.y > canvas.height) enemyProjectiles.splice(idx, 1);
    });

    projectiles.forEach((p, idx) => {
        p.x += 18;
        ctx.fillStyle = "#AEEA00"; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.fill();
        
        if (boss && p.x > boss.x && p.x < boss.x + boss.width && p.y > boss.y && p.y < boss.y + boss.height) {
            boss.hp -= 25; projectiles.splice(idx, 1);
        }
        
        enemies.forEach((en, eIdx) => {
            // Colisión extendida para detectar palomas altas
            if (p.x > en.x && p.x < en.x + en.width && p.y > en.y && p.y < en.y + en.height + 20) {
                en.hp -= 25; projectiles.splice(idx, 1);
                if (en.hp <= 0) { 
                    score += en.isBig ? 50 : 20; 
                    totalKills++;
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
            player.hp -= 20; enemies.splice(idx, 1);
        }
        if(en.x < -150) enemies.splice(idx, 1);
    });

    requestAnimationFrame(animate);
}

function checkLevelUp() {
    let nextLvlExp = level * 150;
    if (score >= nextLvlExp) {
        score -= nextLvlExp;
        level++;
        player.hp = 100; // Curar al subir nivel
    }
}

function saveData() {
    localStorage.setItem('peashooter_exp', score);
    localStorage.setItem('peashooter_lvl', level);
    localStorage.setItem('peashooter_kills', totalKills);
}
// --- CONTROLES PARA MÓVIL ---

// Referencias a los botones de movimiento
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnJump = document.getElementById('btn-up'); // El ID que tengas para saltar

if (btnLeft && btnRight && btnJump) {
    // Mover a la izquierda
    btnLeft.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys['a'] = true;
    });
    btnLeft.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys['a'] = false;
    });

    // Mover a la derecha
    btnRight.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys['d'] = true;
    });
    btnRight.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys['d'] = false;
    });

    // Saltar
    btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys['w'] = true; // O ' ' (espacio) según tu configuración
    });
    btnJump.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys['w'] = false;
    });
}

window.onkeydown = (e) => keys[e.key.toLowerCase()] = true;
window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;
window.addEventListener('mousedown', (e) => { 
    if(e.button === 0 && canShoot && !isPaused) {
        projectiles.push({ x: player.x + 60, y: player.y + 40 });
        canShoot = false;
        setTimeout(() => canShoot = true, shootCooldown);
    }
});

animate();
// --- LÓGICA DEL MENÚ Y PAUSA ---

const menuBtn = document.getElementById('menu-btn');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');

// Elementos del perfil dentro del menú
const menuLvl = document.getElementById('menu-lvl');
const menuExp = document.getElementById('menu-exp');
const menuNextLvl = document.getElementById('menu-next-lvl');
const menuKills = document.getElementById('kills');

function toggleMenu() {
    isPaused = !isPaused;
    if (isPaused) {
        // Actualizar datos del perfil antes de mostrar
        menuLvl.innerText = level;
        menuExp.innerText = score;
        menuNextLvl.innerText = level * 100;
        menuKills.innerText = totalKills;
        
        pauseMenu.classList.remove('hidden');
    } else {
        pauseMenu.classList.add('hidden');
    }
}

// Eventos de click
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Evita que al hacer click se dispare un guisante
    toggleMenu();
});

resumeBtn.addEventListener('click', () => {
    toggleMenu();
});

// Evento de tecla ESC
window.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        toggleMenu();
    }
});

// Cerrar menú si se hace click fuera del contenido (opcional)
pauseMenu.addEventListener('click', (e) => {
    if (e.target === pauseMenu) {
        toggleMenu();
    }
});