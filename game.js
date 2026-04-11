// 1. CONFIGURACIÓN DEL LIENZO
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// 2. VARIABLES DE ESTADO Y PERSISTENCIA
let score = parseInt(localStorage.getItem('peashooter_exp')) || 0;
let level = parseInt(localStorage.getItem('peashooter_lvl')) || 1;

const gravity = 0.8;
const keys = {}; 
const touch = { left: false, right: false, jump: false };
const projectiles = [];
const enemies = [];
const particles = [];

let worldX = 0;
let currentSpeed = 0;
let shootTimer = 0;
let manualShootTimer = 0;
const manualShootDelay = 15; 

// 3. CARGA DE IMÁGENES
const playerImg = new Image();
playerImg.src = 'personaje.png'; 

const enemyImg = new Image();
enemyImg.src = 'paloma.png'; 

// 4. DECORACIÓN (Nubes aleatorias)
const clouds = [];
for(let i = 0; i < 5; i++) {
    clouds.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (canvas.height / 2),
        size: Math.random() * 100 + 50,
        speed: Math.random() * 0.5 + 0.2
    });
}

// 5. CLASE JUGADOR
class Player {
    constructor() {
        this.width = 60; 
        this.height = 90;
        this.x = 100; // Posición fija en pantalla
        this.y = canvas.height - 150;
        this.velX = 0;
        this.velY = 0;
        this.speed = 6;
        this.jumpForce = 17;
        this.grounded = false;
        this.animTimer = 0;
    }

    draw(deltaTime) {
        // Sombra en el suelo
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, this.y + this.height - 5, 25, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        if (playerImg.complete) {
            this.animTimer += deltaTime;
            // Efecto Squash & Stretch (Rebote al caminar)
            let squash = 1.0 + Math.sin(this.animTimer * 0.015) * 0.1;
            let stretch = 1.0 - Math.sin(this.animTimer * 0.015) * 0.05;
            let rotation = (currentSpeed !== 0) ? Math.sin(this.animTimer * 0.015) * 0.05 : 0;

            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height);
            ctx.rotate(rotation);
            ctx.scale(stretch, squash);
            ctx.drawImage(playerImg, -this.width/2, -this.height, this.width, this.height);
            ctx.restore();
        }
    }

    update() {
        // Salto (Teclado o Botón Táctil)
        if ((keys['w'] || keys[' '] || touch.jump) && this.grounded) {
            this.velY = -this.jumpForce;
            this.grounded = false;
            touch.jump = false; 
        }
        
        // Movimiento Lateral
        if (keys['a'] || touch.left) currentSpeed = -this.speed;
        else if (keys['d'] || touch.right) currentSpeed = this.speed;
        else currentSpeed = 0;

        // Impedir retroceder más allá del inicio
        if (worldX <= 0 && currentSpeed < 0) currentSpeed = 0;

        worldX += currentSpeed;
        this.velY += gravity;
        this.y += this.velY;

        // Colisión con el suelo
        if (this.y + this.height > canvas.height - 60) {
            this.y = canvas.height - 60 - this.height;
            this.velY = 0;
            this.grounded = true;
        }
    }
}

// 6. CLASE ENEMIGO (PALOMAS)
class Enemy {
    constructor(isBig = false, isGround = false) {
        this.isBig = isBig;
        this.isGround = isGround;
        this.width = isBig ? 80 : 55; 
        this.height = isBig ? 70 : 50; 
        this.hp = isBig ? 3 : 1;
        
        this.x = canvas.width + 100;
        // Si es de suelo, se ajusta al césped. Si es aire, vuela.
        this.y = isGround ? (canvas.height - 60 - this.height + 5) : (canvas.height - 280 - Math.random() * 150);
        
        this.baseSpeed = isBig ? 2 : (3 + Math.random() * 2);
        this.animTimer = Math.random() * 1000;
    }

    draw(deltaTime) {
        if (enemyImg.complete) {
            this.animTimer += deltaTime;
            let flySquash = 1.0 + Math.sin(this.animTimer * 0.02) * (this.isGround ? 0.1 : 0.3);
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.scale(1.0, flySquash);
            ctx.drawImage(enemyImg, -this.width/2, -this.height/2, this.width, this.height);
            ctx.restore();
        }
        if (this.isBig && this.hp > 0) {
            ctx.fillStyle = "red"; ctx.fillRect(this.x, this.y - 15, this.width * (this.hp/3), 6);
        }
    }

    update() {
        // Movimiento relativo al jugador para evitar bugs
        this.x -= (this.baseSpeed + currentSpeed);
    }
}

// 7. CLASE PROYECTIL
class Projectile {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = 10;
        this.speed = 12;
    }
    draw() {
        ctx.fillStyle = "#AEEA00"; ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "white"; ctx.beginPath();
        ctx.arc(this.x - 3, this.y - 3, 3, 0, Math.PI * 2); ctx.fill();
    }
    update() { 
        this.x += (this.speed - currentSpeed); 
    }
}

// 8. FUNCIONES DE APOYO
function fire() {
    projectiles.push(new Projectile(player.x + player.width, player.y + 50));
}

function gainExp(amount) {
    score += amount;
    if (score >= level * 100) { score -= level * 100; level++; }
    document.getElementById('lvl').innerText = level;
    document.getElementById('exp').innerText = score;
    document.getElementById('next-lvl').innerText = level * 100;
    localStorage.setItem('peashooter_exp', score);
    localStorage.setItem('peashooter_lvl', level);
}

function drawBackground() {
    // Cielo
    let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#87CEEB");
    gradient.addColorStop(1, "#E0F7FA");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Montañas (Parallax)
    ctx.fillStyle = "#90A4AE";
    for (let i = 0; i < 4; i++) {
        let mX = ((i * 600) - (worldX * 0.3)) % (canvas.width + 600);
        if (mX < -600) mX += (canvas.width + 1200);
        ctx.beginPath();
        ctx.moveTo(mX, canvas.height - 60);
        ctx.lineTo(mX + 300, canvas.height - 350);
        ctx.lineTo(mX + 600, canvas.height - 60);
        ctx.fill();
    }

    // Nubes
    ctx.fillStyle = "white";
    clouds.forEach(c => {
        c.x -= (c.speed + currentSpeed * 0.1);
        if (c.x + c.size < -100) c.x = canvas.width + 100;
        if (c.x > canvas.width + 100) c.x = -100;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.size/2, 0, Math.PI*2); ctx.fill();
    });

    // Suelo
    ctx.fillStyle = "#43A047";
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
}

// 9. CONFIGURACIÓN DE CONTROLES
const player = new Player();

// Teclado
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// Táctil (Botones)
function setupTouchBtn(btnId, touchKey) {
    const btn = document.getElementById(btnId);
    if(!btn) return;
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); touch[touchKey] = true; }, {passive: false});
    btn.addEventListener('touchend', (e) => { e.preventDefault(); touch[touchKey] = false; }, {passive: false});
}
setupTouchBtn('btn-left', 'left');
setupTouchBtn('btn-right', 'right');
setupTouchBtn('btn-jump', 'jump');

// Disparo manual (Click o Tap en pantalla)
window.addEventListener('mousedown', () => {
    if (manualShootTimer <= 0) { fire(); manualShootTimer = manualShootDelay; }
});

// 10. BUCLE PRINCIPAL
let lastTime = 0;
function animate(currentTime) {
    const deltaTime = currentTime - lastTime || 0;
    lastTime = currentTime;

    drawBackground();
    player.update();
    player.draw(deltaTime);

    // Disparos
    shootTimer++;
    if (manualShootTimer > 0) manualShootTimer--;
    if (shootTimer >= Math.max(12, 60 - (level * 4))) { fire(); shootTimer = 0; }

    projectiles.forEach((p, index) => {
        p.update(); p.draw();
        if (p.x > canvas.width || p.x < -50) projectiles.splice(index, 1);
    });

    // Enemigos
    if (Math.random() < 0.02 + (level * 0.001)) {
        enemies.push(new Enemy(Math.random() < 0.15, Math.random() < 0.4));
    }
    
    enemies.forEach((en, eIdx) => {
        en.update(); en.draw(deltaTime);
        
        // Colisión Proyectil - Enemigo (Hitbox Generosa)
        projectiles.forEach((p, pIdx) => {
            if (p.x + p.radius > en.x - 15 && p.x - p.radius < en.x + en.width + 15 && 
                p.y + p.radius > en.y - 15 && p.y - p.radius < en.y + en.height + 15) {
                en.hp--; projectiles.splice(pIdx, 1);
                if (en.hp <= 0) { enemies.splice(eIdx, 1); gainExp(en.isBig ? 120 : 35); }
            }
        });

        // Colisión Jugador - Enemigo (Muerte)
        if (player.x < en.x + en.width - 15 && player.x + player.width - 15 > en.x &&
            player.y < en.y + en.height - 15 && player.y + player.height > en.y) {
            worldX = 0;
            enemies.length = 0;
            player.y = canvas.height - 150;
            // El nivel y la exp no se resetean por tu petición
        }

        if (en.x < -200 || en.x > canvas.width + 500) enemies.splice(eIdx, 1);
    });

    requestAnimationFrame(animate);
}

window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
gainExp(0); 
requestAnimationFrame(animate);