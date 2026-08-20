// ============================================================
// SPACE SHOOTER - Full Game Logic
// ============================================================

// ---- CANVAS SETUP ----
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ---- CONSTANTS ----
const PLAYER_SPEED = 5;
const BULLET_SPEED = 10;
const MAX_LIVES = 5;

// ---- GAME DATA ----
const SHIP_TYPES = [
  { name: 'Classic', cost: 0, color: '#f6c', hp: 3, desc: 'Standard ship', icon: '🚀' },
  { name: 'Ace', cost: 100, color: '#6cf', hp: 4, desc: 'Faster shooting', icon: '🛩️' },
  { name: 'Titan', cost: 250, color: '#c6f', hp: 6, desc: 'Tanky and strong', icon: '🛡️' },
  { name: 'Phantom', cost: 400, color: '#fc6', hp: 3, desc: 'Evasive maneuvers', icon: '👻' },
  { name: 'Dragon', cost: 600, color: '#6ff', hp: 5, desc: 'Dual cannons', icon: '🐉' },
  { name: 'Omega', cost: 1000, color: '#f9c', hp: 8, desc: 'Ultimate power', icon: '⭐' }
];

const GUN_TYPES = [
  { name: 'Laser', cost: 0, damage: 1, rate: 1, color: '#4af', desc: 'Basic laser', icon: '🔫' },
  { name: 'Plasma', cost: 150, damage: 2, rate: 1.5, color: '#a4f', desc: 'Strong plasma beam', icon: '💠' },
  { name: 'Railgun', cost: 300, damage: 3, rate: 2.5, color: '#fa4', desc: 'Electromagnetic railgun', icon: '⚡' },
  { name: 'VoidRay', cost: 500, damage: 3, rate: 1.8, color: '#4fa', desc: 'Void energy ray', icon: '🌀' }
];

const CONSUMABLE_TYPES = [
  { name: 'Shield', cost: 75, duration: 300, effect: 'shield', desc: 'Invincible for 5s', icon: '🛡️' },
  { name: 'Repair Kit', cost: 100, duration: 1, effect: 'repair', desc: 'Restore 1 HP', icon: '🔧' },
  { name: 'Time Warp', cost: 200, duration: 600, effect: 'timewarp', desc: 'Slow enemies for 10s', icon: '⏱️' },
  { name: 'Bomb', cost: 150, duration: 0, effect: 'bomb', desc: 'Clear all enemies!', icon: '💥' }
];

const BOSS_TYPES = [
  { name: 'Boss Alpha', hp: 30, color: '#f6a', size: 80, score: 500 },
  { name: 'Boss Beta', hp: 50, color: '#a6f', size: 100, score: 800 },
  { name: 'Boss Gamma', hp: 80, color: '#fa6', size: 120, score: 1200 }
];

// ---- GAME STATE ----
let state = {
  player: null,
  bullets: [],
  enemies: [],
  particles: [],
  stars: [],
  score: 0,
  coins: 0,
  lives: MAX_LIVES,
  wave: 1,
  waveTimer: 60,
  gameRunning: false,
  menuMode: true,
  paused: false,
  selectedShip: 0,
  ownedShips: new Set([0]),
  equippedGun: 0,
  ownedGuns: new Set([0]),
  consumablesRemaining: [],
  activePowerups: [],
  enemiesSpawnedThisWave: 0,
  enemiesKilledThisWave: 0,
  shootTimer: 0,
  lastTime: performance.now(),
  playerKeys: { up: false, down: false, left: false, right: false, shoot: false },
  screenShake: 0,
  nebulaSpots: [],
  engineTrail: [],
  waveFlash: 0
};

// ============================================================
// STARS (parallax layers) + NEBULA
// ============================================================
function initStars() {
  state.stars = [];
  // 3 parallax layers: far, medium, near (optimized counts)
  for (let layer = 0; layer < 3; layer++) {
    const count = layer === 0 ? 40 : layer === 1 ? 30 : 20;
    const speedMult = layer === 0 ? 0.15 : layer === 1 ? 0.4 : 0.8;
    const sizeMult = layer === 0 ? 0.5 : layer === 1 ? 0.8 : 1.2;
    for (let i = 0; i < count; i++) {
      state.stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: (Math.random() * 1.5 + 0.3) * sizeMult,
        b: (Math.random() * 0.5 + 0.3) * (1 - layer * 0.15),
        speed: speedMult * (0.5 + Math.random() * 0.5),
        layer
      });
    }
  }

  // Nebula color spots
  state.nebulaSpots = [];
  const nebulaColors = ['rgba(80,40,120,0.04)', 'rgba(20,60,120,0.04)', 'rgba(120,40,80,0.03)', 'rgba(40,80,120,0.03)'];
  for (let i = 0; i < 8; i++) {
    state.nebulaSpots.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 100 + Math.random() * 200,
      color: nebulaColors[i % nebulaColors.length],
      dx: (Math.random() - 0.5) * 0.1,
      dy: -0.05 + Math.random() * 0.05
    });
  }
}

function drawStars() {
  // Draw nebula as simple arcs (optimized - no gradient per frame)
  ctx.save();
  state.nebulaSpots.forEach(n => {
    const alphaMatch = String(n.color).match(/([\d.]+)\)$/);
    const alpha = alphaMatch ? parseFloat(alphaMatch[1]) * 1.5 : 0.04;
    ctx.fillStyle = `rgba(80,40,120,${alpha})`;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // Draw stars (skip twinkle if too many stars for performance)
  const now = Date.now();
  state.stars.forEach(s => {
    ctx.fillStyle = `rgba(255,255,255,${s.b})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    // Twinkle for distant stars (use frame-based calc instead of Date.now)
    if (s.layer === 0 && state.stars.length < 100) {
      const twinkle = Math.sin(now / 1000 + s.x) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(200,220,255,${s.b * 0.3 * twinkle})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function updateStars() {
  state.stars.forEach(s => {
    s.y += s.speed;
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
  });
  state.nebulaSpots.forEach(n => {
    n.x += n.dx;
    n.y += n.dy;
    if (n.x < -n.r) n.x = canvas.width + n.r;
    if (n.x > canvas.width + n.r) n.x = -n.r;
    if (n.y < -n.r) n.y = canvas.height + n.r;
    if (n.y > canvas.height + n.r) n.y = -n.r;
  });
}

// ============================================================
// PLAYER
// ============================================================
function createPlayer(shipIndex) {
  const st = SHIP_TYPES[shipIndex];
  return {
    x: canvas.width / 2,
    y: canvas.height - 120,
    w: 30,
    h: 40,
    hp: st.hp,
    maxHp: st.hp,
    shipType: shipIndex,
    invincible: 0,
    shootCooldown: 0
  };
}

function drawPlayer() {
  const p = state.player;
  if (!p) return;

  ctx.save();
  // Smooth tilt based on movement
  const targetTilt = mouseTarget
    ? Math.max(-0.3, Math.min(0.3, (mouseTarget.x - p.x) * 0.01))
    : 0;
  const dx = state.playerKeys.right ? 1 : state.playerKeys.left ? -1 : 0;
  const tilt = dx * 0.25 + targetTilt * 0.5;
  ctx.translate(p.x, p.y);
  ctx.rotate(tilt);

  const st = SHIP_TYPES[p.shipType];

  // Engine glow - animated deterministic glow
  const glowPhase = (Date.now() / 150) % (Math.PI * 2);
  ctx.fillStyle = `rgba(255,${150 + Math.floor(Math.sin(glowPhase) * 50)},50,0.7)`;
  ctx.beginPath();
  ctx.ellipse(0, 22, 5 + Math.sin(glowPhase) * 2, 4 + Math.cos(glowPhase * 1.3) * 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ship body by type
  ctx.fillStyle = st.color;
  switch (p.shipType) {
    case 0: // Classic - triangle
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(15, 10);
      ctx.lineTo(8, 18);
      ctx.lineTo(-8, 18);
      ctx.lineTo(-15, 10);
      ctx.closePath();
      ctx.fill();
      break;
    case 1: // Ace - arrow with wings
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(12, 8);
      ctx.lineTo(6, 16);
      ctx.lineTo(-6, 16);
      ctx.lineTo(-12, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#aaf';
      ctx.fillRect(-18, 5, 6, 4);
      ctx.fillRect(12, 5, 6, 4);
      break;
    case 2: // Titan - wide body
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(20, 5);
      ctx.lineTo(18, 18);
      ctx.lineTo(-18, 18);
      ctx.lineTo(-20, 5);
      ctx.closePath();
      ctx.fill();
      break;
    case 3: // Phantom - sleek
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(10, 0);
      ctx.lineTo(6, 14);
      ctx.lineTo(-6, 14);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(200,150,255,${Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(Math.random() * 20 - 10, Math.random() * 10 + 5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 4: // Dragon - dual wings
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(14, 5);
      ctx.lineTo(18, 14);
      ctx.lineTo(-18, 14);
      ctx.lineTo(-14, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff6';
      ctx.beginPath();
      ctx.arc(0, -26, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 5: // Omega - large with rings
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(16, 0);
      ctx.lineTo(22, 12);
      ctx.lineTo(14, 20);
      ctx.lineTo(-14, 20);
      ctx.lineTo(-22, 12);
      ctx.lineTo(-16, 0);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(255,${150 + i * 30},100,${0.3 - i * 0.1})`;
        ctx.beginPath();
        ctx.arc(0, 0, 25 + i * 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
  }

  // Invincibility shield
  if (p.invincible > 0) {
    ctx.strokeStyle = `rgba(100,200,255,${Math.min(p.invincible / 30, 0.6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // HP bar below ship
  if (p.hp < p.maxHp) {
    const hpW = 24;
    const hpH = 4;
    ctx.fillStyle = '#f84';
    ctx.fillRect(-hpW / 2, -35, hpW * (p.hp / p.maxHp), hpH);
  }

  ctx.restore();
}

function updatePlayerPosition() {
  const p = state.player;
  if (!p) return;
  const k = state.playerKeys;

  let dx = 0, dy = 0;

  // Mouse/follow movement takes priority when active
  if (mouseTarget) {
    const diffX = mouseTarget.x - p.x;
    const diffY = mouseTarget.y - p.y;
    const dist = Math.sqrt(diffX * diffX + diffY * diffY);
    if (dist > 5) {
      dx = diffX / dist;
      dy = diffY / dist;
    }
  } else {
    if (k.left) dx -= 1;
    if (k.right) dx += 1;
    if (k.up) dy -= 1;
    if (k.down) dy += 1;
  }

  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
  }

  p.x += dx * PLAYER_SPEED;
  p.y += dy * PLAYER_SPEED;

  // Clamp to canvas
  p.x = Math.max(30, Math.min(canvas.width - 30, p.x));
  p.y = Math.max(50, Math.min(canvas.height - 100, p.y));

  if (state.playerKeys.shoot) {
    handleShoot();
  }
}

// ============================================================
// BULLETS
// ============================================================
function shoot(damage, color) {
  const p = state.player;
  if (!p) return;
  const gunColor = color || (state.equippedGun >= 0 ? GUN_TYPES[state.equippedGun].color : '#4af');
  const dmg = damage || (state.equippedGun >= 0 ? GUN_TYPES[state.equippedGun].damage : 1);

  // Dual cannons for Dragon ship
  if (p.shipType === 4) {
    state.bullets.push({ x: p.x - 10, y: p.y - p.h / 2, vy: -BULLET_SPEED, damage: dmg, color: gunColor });
    state.bullets.push({ x: p.x + 10, y: p.y - p.h / 2, vy: -BULLET_SPEED, damage: dmg, color: gunColor });
  } else {
    state.bullets.push({ x: p.x, y: p.y - p.h / 2, vy: -BULLET_SPEED, damage: dmg, color: gunColor });
  }
}

function handleShoot() {
  const p = state.player;
  if (!p) return;

  // Fire rate: lower = faster
  const fireRate = state.equippedGun >= 0 ? GUN_TYPES[state.equippedGun].rate : 1;
  const shootInterval = Math.max(4, 14 - fireRate * 3);

  if (p.shootCooldown <= 0) {
    shoot();
    p.shootCooldown = shootInterval;
  }
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.y += b.vy * dt;
    if (b.vx) b.x += b.vx * dt;
    if (b.y < -10 || b.y > canvas.height + 10) {
      state.bullets.splice(i, 1);
    }
  }
}

function drawBullets() {
  // Limit bullet drawing for performance
  const maxDrawBullets = Math.min(state.bullets.length, 150);
  for (let i = 0; i < maxDrawBullets; i++) {
    const b = state.bullets[i];
    const col = b.color || '#4af';

    // Bullet core (simplified - no gradient per bullet)
    ctx.fillStyle = '#fff';
    ctx.fillRect(b.x - 2, b.y - 10, 4, 8);
    // Bullet colored shell
    ctx.fillStyle = col;
    ctx.fillRect(b.x - 3, b.y - 9, 6, 18);

    // Trail (shorter for performance)
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(b.x - 1, b.y + 5, 2, 8);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// ENEMIES
// ============================================================
function spawnEnemy(waveNum) {
  const types = ['basic', 'fast', 'tank'];
  const maxIdx = Math.min(types.length - 1, Math.ceil(waveNum / 3));
  const type = types[Math.floor(Math.random() * (maxIdx + 1))];

  const e = {
    x: Math.random() * (canvas.width - 80) + 40,
    y: -30,
    w: 28,
    h: 28,
    type,
    hp: 1,
    maxHp: 1,
    vy: 0.8,
    vx: 0,
    score: 10
  };

  switch (type) {
    case 'basic':
      e.hp = 1;
      e.maxHp = 1;
      e.vy = 0.8 + waveNum * 0.05;
      e.vx = (Math.random() - 0.5) * 0.8;
      e.score = 10;
      e.w = 28;
      e.h = 28;
      break;
    case 'fast':
      e.hp = 1;
      e.maxHp = 1;
      e.vy = 1.5 + waveNum * 0.08;
      e.vx = (Math.random() - 0.5) * 2;
      e.score = 20;
      e.w = 20;
      e.h = 20;
      break;
    case 'tank':
      e.hp = 2 + Math.floor(waveNum / 5);
      e.maxHp = e.hp;
      e.vy = 0.5 + waveNum * 0.03;
      e.vx = (Math.random() - 0.5) * 0.8;
      e.score = 50;
      e.w = 40;
      e.h = 40;
      break;
  }

  return e;
}

function spawnBoss(waveNum) {
  const bossIdx = Math.min(Math.floor((waveNum - 10) / 10), BOSS_TYPES.length - 1);
  const bt = BOSS_TYPES[bossIdx];
  return {
    x: canvas.width / 2,
    y: -60,
    w: bt.size,
    h: bt.size,
    type: 'boss',
    hp: bt.hp + Math.floor(waveNum / 5),
    maxHp: bt.hp + Math.floor(waveNum / 5),
    vy: 0.4,
    vx: 1.5,
    score: bt.score + waveNum * 50,
    name: bt.name,
    color: bt.color,
    isBoss: true,
    attackTimer: 0
  };
}

function updateEnemies(dt) {
  const timeWarpActive = state.activePowerups.some(p => p.effect === 'timewarp');
  const speedMult = timeWarpActive ? 0.4 : 1;

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    e.y += e.vy * dt * speedMult;
    e.x += e.vx * dt * speedMult;

    // Boss shooting
    if (e.isBoss) {
      e.attackTimer += dt;
      if (e.attackTimer > 60) {
        state.bullets.push({
          x: e.x,
          y: e.y + e.h / 2,
          vy: BULLET_SPEED * 0.5,
          damage: 1,
          color: '#f4a',
          enemyBullet: true
        });
        // Boss fires spread in later waves
        if (state.wave >= 20) {
          state.bullets.push({
            x: e.x - 15,
            y: e.y + e.h / 2,
            vy: BULLET_SPEED * 0.4,
            vx: -0.5,
            damage: 1,
            color: '#f4a',
            enemyBullet: true
          });
          state.bullets.push({
            x: e.x + 15,
            y: e.y + e.h / 2,
            vy: BULLET_SPEED * 0.4,
            vx: 0.5,
            damage: 1,
            color: '#f4a',
            enemyBullet: true
          });
        }
        e.attackTimer = 0;
      }
    }

    // Off-screen handling
    if (e.y > canvas.height + 50) {
      if (e.isBoss) {
        e.y = -60;
        e.x = canvas.width / 2;
      } else {
        state.enemies.splice(i, 1);
      }
      continue;
    }

    // Bounce off walls
    if (e.x < e.w / 2) { e.x = e.w / 2; e.vx *= -1; }
    if (e.x > canvas.width - e.w / 2) { e.x = canvas.width - e.w / 2; e.vx *= -1; }
  }
}

function drawEnemies() {
  state.enemies.forEach(e => {
    const col = e.type === 'tank' ? '#f4a' : e.type === 'fast' ? '#fa2' : '#a5f';
    ctx.fillStyle = col;

    if (e.type === 'basic') {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(14, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (e.type === 'fast') {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Date.now() / 300);
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const a = j * Math.PI / 3;
        ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (e.type === 'tank') {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
      // HP dots
      ctx.fillStyle = '#fff';
      for (let k = 0; k < Math.min(e.hp, 5); k++) {
        ctx.fillRect(-e.w / 2 + 4 + k * 7, -e.h / 2 + 4, 4, 4);
      }
      ctx.restore();
    } else if (e.isBoss) {
      ctx.save();
      ctx.translate(e.x, e.y);
      const s = e.w / 2;
      // Draw star shape
      ctx.beginPath();
      for (let j = 0; j < 5; j++) {
        const a = j * Math.PI * 2 / 5 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      }
      ctx.closePath();
      ctx.fillStyle = e.color || '#f6a';
      ctx.fill();

      // Boss HP bar
      const hpPct = e.hp / e.maxHp;
      ctx.fillStyle = `rgb(255,${Math.floor(100 + 155 * hpPct)},50)`;
      ctx.fillRect(-s, -s - 15, s * 2 * hpPct, 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(-s, -s - 15, s * 2, 8);

      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(e.name || 'BOSS', 0, -s - 25);
      ctx.restore();
    }
  });
}

// ============================================================
// PARTICLES / EXPLOSIONS
// ============================================================
function spawnExplosion(x, y, count = 12, color = '#fff', intense = false) {
  // Limit particles per explosion for performance
  const maxParticles = Math.min(count, 25);
  for (let i = 0; i < maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * 4 + 1;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 25 + Math.random() * 15,
      color: i % 2 === 0 ? color : '#ffa',
      size: Math.random() * 2.5 + 0.5
    });
  }
  if (intense || count > 20) {
    applyShake(count * 0.15);
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function drawParticles() {
  // Limit particle drawing for performance
  const maxDrawParticles = Math.min(state.particles.length, 200);
  ctx.save();
  for (let i = 0; i < maxDrawParticles; i++) {
    const p = state.particles[i];
    const alpha = Math.min(1, p.life / 15);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.size * (p.life / 40)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Trim excess particles array for performance
  if (state.particles.length > 200) {
    state.particles.splice(0, state.particles.length - 200);
  }
}

// ============================================================
// COLLISIONS
// ============================================================
function handleCollisions() {
  // Bullets vs Enemies
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    if (b.enemyBullet) continue;

    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (Math.abs(b.x - e.x) < e.w / 2 + 4 && Math.abs(b.y - e.y) < e.h / 2 + 8) {
        e.hp -= b.damage || 1;
        spawnExplosion(b.x, b.y, 5, b.color || '#4af');
        state.bullets.splice(i, 1);

        if (e.hp <= 0) {
          spawnExplosion(e.x, e.y, 18, e.isBoss ? '#ff6' : '#fff');
          state.score += e.score;
          state.coins += Math.floor(e.score / 2);
          state.enemiesKilledThisWave++;

          if (e.isBoss) {
            state.coins += 500;
            spawnExplosion(e.x, e.y, 40, '#ff6', true);
            applyShake(12);
          }
          state.enemies.splice(j, 1);
        }
        break;
      }
    }
  }

  // Enemy bullets vs Player
  const p = state.player;
  if (!p) return;

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    if (b.enemyBullet && p.invincible <= 0) {
      if (Math.abs(b.x - p.x) < 12 && Math.abs(b.y - p.y) < p.h / 2 + 4) {
        playerHit();
        state.bullets.splice(i, 1);
      }
    }
  }

  // Enemy body vs Player
  if (p.invincible <= 0) {
    for (const e of state.enemies) {
      if (!e.isBoss &&
        Math.abs(p.x - e.x) < p.w / 2 + e.w / 2 - 4 &&
        Math.abs(p.y - e.y) < p.h / 2 + e.h / 2 - 4) {
        playerHit();
        break;
      }
    }
  }
}

// FIX: previously this decremented BOTH state.lives and p.hp on every hit,
// so the ship's HP stat (3-8 depending on ship) never mattered - the player
// always died after exactly MAX_LIVES (5) hits, and repair kits couldn't
// prevent it since they only restored p.hp, not state.lives.
// Now: state.lives only drops when a ship is fully destroyed (hp reaches 0),
// and the player respawns at full HP if lives remain.
function playerHit() {
  const p = state.player;
  if (!p || p.invincible > 0) return;

  p.hp--;
  spawnExplosion(p.x, p.y, 15, '#f6c');
  p.invincible = 90; // 1.5 seconds

  // Auto-use repair kit
  const repairIdx = state.consumablesRemaining.findIndex(c => c.effect === 'repair');
  if (p.hp < p.maxHp && repairIdx >= 0) {
    p.hp++;
    state.consumablesRemaining.splice(repairIdx, 1);
  }

  // Auto-use shield
  const shieldIdx = state.consumablesRemaining.findIndex(c => c.effect === 'shield');
  if (shieldIdx >= 0 && p.invincible < 60) {
    p.invincible = 300; // 5 seconds
    state.consumablesRemaining.splice(shieldIdx, 1);
    state.activePowerups.push({ effect: 'shield', duration: 300 });
  }

  if (p.hp <= 0) {
    state.lives--;
    if (state.lives <= 0) {
      gameOver();
      return true;
    }
    // Respawn with a fresh hull
    p.hp = p.maxHp;
    p.invincible = 120; // brief grace period after respawn
  }

  return false;
}

// ============================================================
// WAVE SYSTEM
// ============================================================
function updateWave() {
  // Boss alive? wait
  if (state.enemies.some(e => e.isBoss)) return;

  // Timer expired and all non-boss enemies cleared
  if (state.waveTimer <= 0 && state.enemies.filter(e => !e.isBoss).length === 0) {
    advanceWave();
  }
}

function advanceWave() {
  state.wave++;
  state.enemiesSpawnedThisWave = 0;
  state.enemiesKilledThisWave = 0;
  state.waveFlash = 20;

  // Boss wave every 10 waves
  if (state.wave % 10 === 0) {
    state.waveTimer = 90;
    const boss = spawnBoss(state.wave);
    state.enemies.push(boss);
    applyShake(8);
    return;
  }

  // Normal wave
  const spawnCount = Math.min(2 + Math.floor(state.wave / 2), 12);
  state.waveTimer = Math.max(60, 180 - state.wave * 2);

  // Spawn enemies over time
  for (let i = 0; i < spawnCount; i++) {
    setTimeout(() => {
      if (state.gameRunning) {
        state.enemies.push(spawnEnemy(state.wave));
        state.enemiesSpawnedThisWave++;
      }
    }, i * 500);
  }
}

// ============================================================
// HUD
// ============================================================
function drawHUD() {
  const p = state.player;
  if (!p) return;

  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';

  // Top left info
  ctx.fillText(`SCORE: ${state.score}`, 15, 28);
  ctx.fillText(`COINS: ${state.coins}`, 15, 52);
  ctx.fillText(`WAVE: ${state.wave}`, 15, 76);

  // Lives as hearts
  const lvText = '❤️'.repeat(Math.max(0, state.lives));
  ctx.font = '14px monospace';
  ctx.fillText(`${lvText}`, 15, 100);

  // HP bar (top right)
  ctx.font = '16px monospace';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.fillText('HP', canvas.width - 130, 28);

  ctx.fillStyle = '#f84';
  ctx.fillRect(canvas.width - 130, 33, 120 * (p.hp / p.maxHp), 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.strokeRect(canvas.width - 130, 33, 120, 8);

  // Wave countdown or boss warning
  ctx.textAlign = 'center';
  const boss = state.enemies.find(e => e.isBoss);
  if (boss) {
    ctx.fillStyle = `rgba(255,100,80,${Math.sin(Date.now() / 200) * 0.3 + 0.5})`;
    ctx.font = '18px monospace';
    ctx.fillText(`⚠ BOSS ${boss.name} ⚠`, canvas.width / 2, 120);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#f88';
    ctx.fillText(`HP: ${boss.hp}/${boss.maxHp}`, canvas.width / 2, 142);
  } else if (state.waveTimer > 0 && state.waveTimer < 100) {
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText(`Next wave in ${Math.ceil(state.waveTimer / 60)}s`, canvas.width / 2, 120);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px monospace';
    ctx.fillText('WASD/Arrows: Move | SPACE: Shoot | P: Pause | B: Shop', canvas.width / 2, 120);
  }
}

function updateHUDExtra() {
  // Weapon display
  const weaponEl = document.getElementById('weaponDisplay');
  if (weaponEl && state.equippedGun >= 0) {
    const gun = GUN_TYPES[state.equippedGun];
    weaponEl.textContent = `🔫 ${gun.name} (DMG:${gun.damage})`;
  } else if (weaponEl) {
    weaponEl.textContent = '🔫 Laser (DMG:1)';
  }

  // Consumables display
  const consEl = document.getElementById('consumableDisplay');
  if (consEl) {
    if (state.consumablesRemaining.length > 0) {
      consEl.textContent = `Items: ${state.consumablesRemaining.map(c => c.icon || '📦').join(' ')}`;
    } else {
      consEl.textContent = '';
    }
  }

  // Current ship in shop footer
  const shipDisplay = document.getElementById('currentShipDisplay');
  if (shipDisplay) {
    const ship = SHIP_TYPES[state.selectedShip];
    shipDisplay.textContent = `Selected: ${ship.name}`;
  }
}

// ============================================================
// GAME OVER
// ============================================================
function gameOver() {
  state.gameRunning = false;
  document.getElementById('finalScore').textContent = state.score;
  document.getElementById('finalCoins').textContent = state.coins;
  document.getElementById('finalWaves').textContent = state.wave;
  document.getElementById('gameOverOverlay').classList.add('active');
}

// ============================================================
// SHOP SYSTEM (HTML-based)
// ============================================================
function renderShop() {
  document.getElementById('shopCoins').textContent = state.coins;

  renderShopItems('shipsContainer', SHIP_TYPES, state.selectedShip, state.ownedShips, 'ship');
  renderShopItems('gunsContainer', GUN_TYPES, state.equippedGun, state.ownedGuns, 'gun');
  renderConsumablesShop();
  updateHUDExtra();
}

function renderShopItems(containerId, items, selectedIdx, ownedSet, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'shop-card';

    const owned = ownedSet.has(idx);
    const isSelected = idx === selectedIdx;
    const canAfford = state.coins >= item.cost;

    if (isSelected) card.classList.add('selected');
    if (owned) card.classList.add('owned');
    if (!owned && !canAfford) card.classList.add('locked');

    const badgeHtml = isSelected
      ? '<span class="shop-card-badge badge-equipped">EQUIPPED</span>'
      : owned
        ? '<span class="shop-card-badge badge-owned">OWNED</span>'
        : '';

    card.innerHTML = `
      ${badgeHtml}
      <span class="shop-card-icon">${item.icon || '🚀'}</span>
      <div class="shop-card-name" style="color:${item.color || '#fff'}">${item.name}</div>
      <div class="shop-card-cost">${item.cost > 0 ? `${item.cost}c` : 'FREE'}</div>
      <div class="shop-card-desc">${item.desc}</div>
    `;

    card.addEventListener('click', () => {
      if (state.gameRunning) {
        handleShopBuy(type, idx, item, owned, isSelected, ownedSet);
      }
    });

    container.appendChild(card);
  });
}

function renderConsumablesShop() {
  const container = document.getElementById('consumablesContainer');
  if (!container) return;

  container.innerHTML = '';
  CONSUMABLE_TYPES.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'shop-card';
    const canAfford = state.coins >= item.cost;
    if (!canAfford) card.classList.add('locked');

    card.innerHTML = `
      <span class="shop-card-icon">${item.icon || '📦'}</span>
      <div class="shop-card-name" style="color:#fa5">${item.name}</div>
      <div class="shop-card-cost">${item.cost}c</div>
      <div class="shop-card-desc">${item.desc}</div>
    `;

    card.addEventListener('click', () => {
      if (state.gameRunning && state.coins >= item.cost) {
        state.coins -= item.cost;
        // Bomb is instant use
        if (item.effect === 'bomb') {
          state.enemiesKilledThisWave += state.enemies.filter(e => !e.isBoss).length;
          state.enemies.forEach(e => {
            spawnExplosion(e.x, e.y, 15, '#ff6');
          });
          state.coins += state.enemies.reduce((sum, e) => sum + Math.floor(e.score / 2), 0);
          state.enemies = [];
        } else {
          state.consumablesRemaining.push({ ...item, durationLeft: item.duration });
        }
        renderShop();
      }
    });

    container.appendChild(card);
  });
}

function handleShopBuy(type, idx, item, owned, isSelected, ownedSet) {
  if (isSelected) return;

  if (owned) {
    // Switch to owned item
    if (type === 'ship') {
      state.selectedShip = idx;
    } else if (type === 'gun') {
      state.equippedGun = idx;
    }
    renderShop();
    return;
  }

  // Buy new
  if (state.coins >= item.cost) {
    state.coins -= item.cost;
    ownedSet.add(idx);
    if (type === 'ship') {
      state.selectedShip = idx;
    } else if (type === 'gun') {
      state.equippedGun = idx;
    }
    renderShop();
  }
}

// ============================================================
// POWERUPS
// ============================================================
function updatePowerups(dt) {
  for (let i = state.activePowerups.length - 1; i >= 0; i--) {
    state.activePowerups[i].duration -= dt;
    if (state.activePowerups[i].duration <= 0) {
      state.activePowerups.splice(i, 1);
    }
  }
}

// ============================================================
// SCREEN SHAKE + VIGNETTE + ENGINE TRAIL
// ============================================================
function applyShake(intensity) {
  state.screenShake = Math.max(state.screenShake, intensity);
}

function updateShake() {
  if (state.screenShake > 0) {
    state.screenShake *= 0.88;
    if (state.screenShake < 0.3) state.screenShake = 0;
  }
}

function applyVignette() {
  const w = canvas.width, h = canvas.height;
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(1, 'rgba(0,0,10,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function updateEngineTrail() {
  const p = state.player;
  if (!p) return;
  // Add trail particle every other frame for performance
  if (Math.random() < 0.5) {
    state.engineTrail.push({
      x: p.x + (Math.random() - 0.5) * 6,
      y: p.y + 20,
      r: 2 + Math.random() * 3,
      life: 20 + Math.random() * 10,
      maxLife: 30
    });
  }
  if (state.engineTrail.length > 30) state.engineTrail.splice(30);
}

function updateEngineTrailParticles() {
  state.engineTrail.forEach(t => t.life--);
  state.engineTrail = state.engineTrail.filter(t => t.life > 0);
}

function drawEngineTrail() {
  state.engineTrail.forEach((t) => {
    const progress = t.life / t.maxLife;
    const alpha = progress * 0.5;
    const r = t.r * progress;
    const hue = 25 + Math.floor(progress * 20);
    ctx.fillStyle = `rgba(255,${150 + hue},50,${alpha})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.fill();
  });
}

// ============================================================
// GAME LOOP
// ============================================================
function gameLoop() {
  if (state.menuMode || !state.gameRunning) {
    // Still draw starfield behind overlays
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateStars();
    drawStars();

    requestAnimationFrame(gameLoop);
    return;
  }

  if (state.paused) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateStars();
    updateEngineTrailParticles();
    drawStars();
    drawParticles();
    drawEngineTrail();
    drawBullets();
    drawEnemies();
    drawPlayer();
    drawHUD();
    applyVignette();
    ctx.restore();
    updateHUDExtra();
    requestAnimationFrame(gameLoop);
    return;
  }

  const now = performance.now();
  const dt = Math.min((now - state.lastTime) / 16.67, 3); // Cap delta time
  state.lastTime = now;

  // ---- UPDATE ----
  updateStars();
  updateParticles(dt);
  updateEngineTrailParticles();

  // Player movement from held keys
  updatePlayerPosition();

  // Shoot cooldown
  const p = state.player;
  if (p) {
    if (p.shootCooldown > 0) p.shootCooldown -= dt;
    if (p.invincible > 0) p.invincible -= dt;
    updateEngineTrail();
  }

  updateBullets(dt);
  updateEnemies(dt);
  handleCollisions();

  // Wave timer
  if (state.waveTimer > 0) state.waveTimer -= dt;

  updatePowerups(dt);
  updateWave();

  // Screen shake
  updateShake();

  // Wave flash decay
  if (state.waveFlash > 0) state.waveFlash -= dt;

  // ---- DRAW ----
  ctx.save();
  const shakeX = (Math.random() - 0.5) * state.screenShake;
  const shakeY = (Math.random() - 0.5) * state.screenShake;
  ctx.translate(shakeX, shakeY);

  ctx.clearRect(-10, -10, canvas.width + 20, canvas.height + 20);

  drawStars();
  drawParticles();
  drawEngineTrail();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawHUD();
  applyVignette();

  // Wave flash overlay
  if (state.waveFlash > 0) {
    ctx.fillStyle = `rgba(100,150,255,${Math.min(state.waveFlash / 30, 0.15)})`;
    ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);
  }

  ctx.restore();

  updateHUDExtra();

  requestAnimationFrame(gameLoop);
}

// ============================================================
// INPUT HANDLING
// ============================================================
const keys = {};

document.addEventListener('keydown', e => {
  const key = e.key;

  // Prevent scrolling with arrow keys / space
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space'].includes(key)) {
    e.preventDefault();
  }

  // Game Over -> restart
  if (!state.gameRunning && !state.menuMode && (key === ' ' || key === 'Space')) {
    document.getElementById('gameOverOverlay').classList.remove('active');
    startGame();
    return;
  }

  // Shop open/close (B key)
  if (key.toLowerCase() === 'b' && state.gameRunning && !state.menuMode) {
    if (document.getElementById('shopOverlay').classList.contains('active')) {
      closeShop();
    } else {
      openShop();
    }
    return;
  }

  // Pause (P or Escape) - only when the shop isn't open
  if (
    (key.toLowerCase() === 'p' || key === 'Escape') &&
    state.gameRunning && !state.menuMode &&
    !document.getElementById('shopOverlay').classList.contains('active')
  ) {
    if (state.paused) {
      resumeGame();
    } else {
      pauseGame();
    }
    return;
  }

  // FIX: this used to be "if (state.paused) return;" placed BEFORE the shop
  // overlay check below, which made the shop's keyboard shortcuts (1-6 for
  // ships) completely unreachable, since opening the shop also sets
  // state.paused = true. Now the shop overlay is checked first.
  if (document.getElementById('shopOverlay').classList.contains('active')) {
    handleShopKey(key);
    return;
  }

  // If paused (and shop is not open), ignore gameplay keys
  if (state.paused) return;

  // Movement keys (track held state)
  if (key === 'ArrowUp' || key.toLowerCase() === 'w') state.playerKeys.up = true;
  if (key === 'ArrowDown' || key.toLowerCase() === 's') state.playerKeys.down = true;
  if (key === 'ArrowLeft' || key.toLowerCase() === 'a') state.playerKeys.left = true;
  if (key === 'ArrowRight' || key.toLowerCase() === 'd') state.playerKeys.right = true;

  // Shoot
  if (key === ' ' || key === 'Space') {
    state.playerKeys.shoot = true;
  }

  keys[key] = true;
});

document.addEventListener('keyup', e => {
  const key = e.key;

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space'].includes(key)) {
    e.preventDefault();
  }

  if (key === 'ArrowUp' || key.toLowerCase() === 'w') state.playerKeys.up = false;
  if (key === 'ArrowDown' || key.toLowerCase() === 's') state.playerKeys.down = false;
  if (key === 'ArrowLeft' || key.toLowerCase() === 'a') state.playerKeys.left = false;
  if (key === 'ArrowRight' || key.toLowerCase() === 'd') state.playerKeys.right = false;
  if (key === ' ' || key === 'Space') state.playerKeys.shoot = false;

  keys[key] = false;
});

// Mouse support for movement
let mouseTarget = null;

canvas.addEventListener('mousedown', e => {
  if (state.gameRunning && !state.paused && !state.menuMode) {
    mouseTarget = { x: e.clientX, y: e.clientY };
    state.playerKeys.shoot = true;
  }
});

canvas.addEventListener('mousemove', e => {
  if (mouseTarget && state.gameRunning) {
    mouseTarget = { x: e.clientX, y: e.clientY };
  }
});

canvas.addEventListener('mouseup', () => {
  mouseTarget = null;
  state.playerKeys.shoot = false;
});

// Touch support
canvas.addEventListener('touchstart', e => {
  if (state.gameRunning && !state.paused && !state.menuMode) {
    const t = e.touches[0];
    mouseTarget = { x: t.clientX, y: t.clientY };
    state.playerKeys.shoot = true;
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (mouseTarget && state.gameRunning) {
    const t = e.touches[0];
    mouseTarget = { x: t.clientX, y: t.clientY };
  }
}, { passive: false });

canvas.addEventListener('touchend', () => {
  mouseTarget = null;
  state.playerKeys.shoot = false;
});

function handleShopKey(key) {
  // Number keys for ships (1-6)
  const shipIdx = parseInt(key) - 1;
  if (shipIdx >= 0 && shipIdx < SHIP_TYPES.length) {
    if (state.ownedShips.has(shipIdx)) {
      state.selectedShip = shipIdx;
      renderShop();
    }
    return;
  }
}

// ============================================================
// SHOP OPEN/CLOSE
// ============================================================
function openShop() {
  state.paused = true;
  renderShop();
  document.getElementById('shopOverlay').classList.add('active');
  updateHUDExtra();
}

function closeShop() {
  document.getElementById('shopOverlay').classList.remove('active');
  state.paused = false;
}

// ============================================================
// PAUSE / RESUME
// ============================================================
function pauseGame() {
  state.paused = true;
  document.getElementById('pauseOverlay').classList.add('active');
}

function resumeGame() {
  state.paused = false;
  document.getElementById('pauseOverlay').classList.remove('active');
  document.getElementById('shopOverlay').classList.remove('active');
}

// ============================================================
// START / RESTART
// ============================================================
function startGame() {
  const shipIdx = state.selectedShip;
  state.player = createPlayer(shipIdx);
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  state.score = 0;
  state.coins = 0;
  state.lives = MAX_LIVES;
  state.wave = 0;
  state.waveTimer = 30;
  state.gameRunning = true;
  state.menuMode = false;
  state.paused = false;
  state.shootTimer = 0;
  state.enemiesSpawnedThisWave = 0;
  state.enemiesKilledThisWave = 0;
  state.playerKeys = { up: false, down: false, left: false, right: false, shoot: false };
  state.consumablesRemaining = [];
  state.activePowerups = [];
  state.lastTime = performance.now();

  // Close all overlays
  document.getElementById('gameOverOverlay').classList.remove('active');
  document.getElementById('shopOverlay').classList.remove('active');
  document.getElementById('pauseOverlay').classList.remove('active');

  mouseTarget = null;
}

// ============================================================
// BUTTON EVENT LISTENERS
// ============================================================
document.getElementById('closeShopBtn').addEventListener('click', closeShop);
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('gameOverOverlay').classList.remove('active');
  startGame();
});
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('quitBtn').addEventListener('click', () => {
  document.getElementById('pauseOverlay').classList.remove('active');
  state.menuMode = true;
  state.gameRunning = false;
});

// ============================================================
// INIT
// ============================================================
initStars();
state.player = createPlayer(0);
state.menuMode = true;

// Start the game loop
gameLoop();

// Show shop initially, then start
setTimeout(() => {
  state.menuMode = false;
  startGame();
}, 3000);