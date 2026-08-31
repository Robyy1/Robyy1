(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const creditsEl = document.getElementById("credits");
  const keysEl = document.getElementById("keys");
  const creditIconCanvas = document.getElementById("credit-icon");

  const overlay = document.getElementById("overlay");
  const titleEl = document.getElementById("title");
  const subtitleEl = document.getElementById("subtitle");
  const startBtn = document.getElementById("start-btn");
  const pauseScreen = document.getElementById("pause-screen");
  const resumeBtn = document.getElementById("resume-btn");
  const hangarEl = document.getElementById("hangar");
  const shopEl = document.getElementById("shop");
  const invEl = document.getElementById("inventory");

  function loadSave() {
    try { const s = JSON.parse(localStorage.getItem("space_save")); if (s) return s; } catch {}
    return { credits: 0, keys: 0, ownedShips: [0], ownedGuns: [0], ownedConsumables: [0], loadout: { shipId: 0, weapons: [0, -1], consumables: [0, -1] } };
  }
  function saveSave() {
    localStorage.setItem("space_save", JSON.stringify({ credits: save.credits, keys: save.keys, ownedShips: save.ownedShips, ownedGuns: save.ownedGuns, ownedConsumables: save.ownedConsumables, loadout: save.loadout }));
  }
  const save = loadSave();

  const state = {
    running: false,
    paused: false,
    score: 0,
    lives: 3,
    level: 1,
    credits: save.credits,
    keys: save.keys,
  };

  const keys = {};

  // ---- Starfield ----
  const stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + 0.4,
      speed: Math.random() * 1.4 + 0.3,
    });
  }

  function updateStars() {
    for (const s of stars) {
      s.y += s.speed;
      if (s.y > H) {
        s.y = 0;
        s.x = Math.random() * W;
      }
    }
  }

  function drawStars() {
    ctx.fillStyle = "#dfe8ff";
    for (const s of stars) {
      ctx.globalAlpha = 0.4 + s.r / 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Entities ----
  const player = {
    w: 34,
    h: 30,
    x: W / 2 - 17,
    y: H - 60,
    speed: 5,
    cooldown: 0,
    fireRate: 12,
    invuln: 0,
    hp: 3,
    maxHp: 3,
  };

  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let particles = [];
  let powerups = [];

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * 3 + 1;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        color,
      });
    }
  }

  function resetGame() {
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    save.credits = state.credits;
    save.keys = state.keys;
    boss = null;
    const ship = window.DATA.SHIPS.find(s => s.id === save.loadout.shipId) || window.DATA.SHIPS[0];
    player.maxHp = ship.maxHp; player.hp = ship.maxHp;
    player.x = W / 2 - 17;
    player.y = H - 60;
    player.cooldown = 0;
    player.invuln = 0;
    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    powerups = [];
    initCharges();
    shieldT = 0; overdriveT = 0; thrusterT = 0;
    spawnWave();
    updateHud();
  }

  function drawCreditIconMini() {
    if (!creditIconCanvas) return;
    const c = creditIconCanvas.getContext("2d");
    c.clearRect(0, 0, 14, 14);
    c.strokeStyle = "#8fdcff"; c.lineWidth = 1.3; c.fillStyle = "rgba(143,220,255,0.18)";
    c.beginPath(); c.arc(7, 7, 6, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = "#8fdcff"; c.lineWidth = 1.4; c.lineCap = "round";
    c.beginPath();
    c.moveTo(7, 3); c.lineTo(7, 9);
    c.moveTo(4.2, 4.2); c.lineTo(7, 6.2); c.moveTo(9.8, 4.2); c.lineTo(7, 6.2);
    c.moveTo(4.2, 6.2); c.lineTo(4.2, 9); c.arc(7, 9, 2.8, Math.PI, 0, false);
    c.lineTo(9.8, 6.2);
    c.stroke();
  }
  drawCreditIconMini();

  function updateHud() {
    scoreEl.textContent = state.score;
    livesEl.textContent = state.lives + " (HP " + player.hp + "/" + player.maxHp + ")";
    levelEl.textContent = state.level + (boss ? " BOSS!" : "");
    if (creditsEl) creditsEl.textContent = state.credits;
    if (keysEl) keysEl.textContent = state.keys;
  }

  let boss = null;
  // ---- Enemies ----
  function pickEnemyType() {
    const D = window.DATA.ENEMY_TYPES;
    const pool = state.level < 2 ? ["drone", "zigzag"] : state.level < 4 ? ["drone", "zigzag", "speeder", "shooter"] : ["drone", "zigzag", "speeder", "shooter", "tank", "splitter"];
    return D[pool[Math.floor(Math.random() * pool.length)]];
  }
  function spawnWave() {
    if (state.level % 3 === 0) { spawnBoss(); return; }
    const cols = 6;
    const rows = Math.min(3 + Math.floor(state.level / 2), 6);
    const spacingX = 60; const spacingY = 50;
    const startX = (W - cols * spacingX) / 2 + 20;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = pickEnemyType();
        enemies.push({
          x: startX + c * spacingX + (Math.random() * 10 - 5),
          y: -80 - r * spacingY,
          w: t.w, h: t.h, hp: t.hp + Math.floor(state.level / 4), maxHp: t.hp + Math.floor(state.level / 4),
          color: t.color, accent: t.accent, credits: t.credits,
          phase: Math.random() * Math.PI * 2, baseX: startX + c * spacingX,
          speed: t.speed, sineAmp: t.sineAmp || 0, sineFreq: t.sineFreq || 0.05,
          shoot: t.shoot, fireRate: t.fireRate || 90, fireCd: Math.random() * 60,
        });
      }
    }
  }

  function spawnBoss() {
    const keys = Object.keys(window.DATA.BOSS_TYPES);
    const k = keys[(Math.floor(state.level / 3) - 1) % keys.length];
    const t = window.DATA.BOSS_TYPES[k];
    boss = { key: k, name: t.name, color: t.color, x: W / 2 - t.w / 2, y: 28, w: t.w, h: t.h, hp: t.hp + state.level * 8, maxHp: t.hp + state.level * 8, dir: 1, tNext: 60, cur: null, credits: t.credits, keysReward: t.keys, warn: null };
    enemies = [];
  }
  function bossAttack(kind) {
    if (!boss) return;
    const bx = boss.x + boss.w / 2, by = boss.y + boss.h;
    if (kind === "burst") {
      boss.warn = { kind: "burst", t: 32, x: bx };
      boss.cur = { kind, t: 32, exec: () => { for (let i = -2; i <= 2; i++) enemyBullets.push({ x: bx - 2, y: by, w: 4, h: 10, vy: 5.5, vx: i * 1.8, color: "#7fd1ff" }); } };
    } else if (kind === "sweep") {
      boss.warn = { kind: "sweep", t: 38, y: 220 + Math.random() * 200 };
      boss.cur = { kind, t: 38, exec: () => { const y = boss.warn.y; enemyBullets.push({ x: 0, y, w: W, h: 6, vy: 0, vx: 0, color: "#ff3040", sweep: true }); setTimeout(() => { const idx = enemyBullets.findIndex(b => b.sweep); if (idx !== -1) enemyBullets.splice(idx, 1); }, 420); } };
    } else if (kind === "punchL" || kind === "punchR") {
      const side = kind === "punchL" ? -1 : 1;
      boss.warn = { kind, t: 34, side };
      boss.cur = { kind, t: 34, exec: () => { const pw = 160, ph = 140; const px = side === -1 ? 0 : W - pw; enemyBullets.push({ x: px, y: by - 10, w: pw, h: ph, vy: 0, color: "#ffb347", punch: true, life: 22 }); } };
    } else if (kind === "slam") {
      boss.warn = { kind: "slam", t: 36 };
      boss.cur = { kind, t: 36, exec: () => { for (let r = 0; r < 3; r++) enemyBullets.push({ x: W / 2 - 90 - r * 22, y: by, w: 180 + r * 44, h: 10, vy: 2 + r, color: "#ffb347", ring: true }); } };
    } else if (kind === "homingSwarm") {
      boss.warn = { kind, t: 30 };
      boss.cur = { kind, t: 30, exec: () => { for (let i = 0; i < 3; i++) enemyBullets.push({ x: bx + (i - 1) * 22 - 4, y: by, w: 8, h: 12, vy: 2.2, homing: true, color: "#ff6bff" }); } };
    } else if (kind === "barrage") {
      boss.warn = { kind, t: 28 };
      boss.cur = { kind, t: 28, exec: () => { for (let i = 0; i < 6; i++) enemyBullets.push({ x: 40 + i * 68, y: by, w: 6, h: 14, vy: 4 + Math.random(), vx: (Math.random() - 0.5) * 2, color: "#ff6bff" }); } };
    } else if (kind === "stream") {
      boss.warn = { kind: "stream", t: 50 };
      boss.cur = { kind, t: 50, exec: null, tick: 0 };
    } else if (kind === "heatBurst") {
      boss.warn = { kind, t: 28 };
      boss.cur = { kind, t: 28, exec: () => { for (let a = 0; a < 8; a++) { const ang = (a / 8) * Math.PI * 2; enemyBullets.push({ x: bx, y: by, w: 5, h: 5, vy: Math.sin(ang) * 4, vx: Math.cos(ang) * 4, color: "#7fffb0" }); } } };
    }
  }
  function updateBoss() {
    if (!boss) return;
    boss.x += boss.dir * 1.1;
    if (boss.x <= 8) boss.dir = 1;
    if (boss.x + boss.w >= W - 8) boss.dir = -1;
    if (boss.warn) boss.warn.t--;
    if (boss.cur) {
      boss.cur.t--;
      if (boss.cur.kind === "stream") {
        boss.cur.tick = (boss.cur.tick || 0) + 1;
        if (boss.cur.tick % 5 === 0) {
          const tx = player.x + player.w / 2, ty = player.y + player.h / 2;
          const sx = boss.x + boss.w / 2, sy = boss.y + boss.h;
          const ang = Math.atan2(ty - sy, tx - sx);
          enemyBullets.push({ x: sx - 2, y: sy, w: 4, h: 8, vy: Math.sin(ang) * 6, vx: Math.cos(ang) * 6, color: "#7fffb0" });
        }
        if (boss.cur.t <= 0) { boss.warn = null; boss.cur = null; boss.tNext = 70; }
        return;
      }
      if (boss.cur.t <= 0) { if (boss.cur.exec) boss.cur.exec(); boss.warn = null; boss.cur = null; boss.tNext = 72; }
    } else {
      boss.tNext--;
      if (boss.tNext <= 0) {
        const pool = window.DATA.BOSS_TYPES[boss.key].patterns;
        bossAttack(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (b.punch || b.ring) { b.life = (b.life || 20) - 1; if (b.life <= 0) enemyBullets.splice(i, 1); }
      if (b.sweep && rectsOverlap(player, b) && player.invuln <= 0) damagePlayer();
      if ((b.punch || b.ring) && rectsOverlap(player, b) && player.invuln <= 0) damagePlayer();
    }
    if (boss.hp <= 0) {
      spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, boss.color, 38);
      state.score += 180; state.credits += boss.credits; state.keys += boss.keysReward;
      save.credits = state.credits; save.keys = state.keys; saveSave();
      boss = null; enemyBullets = []; state.level++; updateHud(); spawnWave();
    }
  }
  function drawBoss() {
    if (!boss) return;
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(boss.x - 4, boss.y - 4, boss.w + 8, boss.h + 8);
    ctx.fillStyle = boss.color; ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
    ctx.fillStyle = "#fff"; ctx.fillRect(boss.x + boss.w * 0.18, boss.y + 10, boss.w * 0.64, 10);
    ctx.fillStyle = "#04050e"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(boss.name, boss.x + boss.w / 2, boss.y + 18);
    const pct = boss.hp / boss.maxHp;
    ctx.fillStyle = "#333"; ctx.fillRect(boss.x, boss.y - 10, boss.w, 7);
    ctx.fillStyle = boss.color; ctx.fillRect(boss.x, boss.y - 10, boss.w * pct, 7);
    if (boss.warn) {
      ctx.strokeStyle = "rgba(255,60,80,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      if (boss.warn.kind === "sweep") { ctx.strokeRect(0, boss.warn.y, W, 6); ctx.fillStyle = "rgba(255,60,80,0.2)"; ctx.fillRect(0, boss.warn.y, W, 6); }
      else if (boss.warn.kind === "punchL" || boss.warn.kind === "punchR") { const px = boss.warn.side === -1 ? 0 : W - 160; ctx.strokeRect(px, boss.y + 20, 160, 140); }
      else if (boss.warn.kind === "burst") { ctx.beginPath(); ctx.arc(boss.warn.x, boss.y + boss.h, 18, 0, Math.PI * 2); ctx.stroke(); }
      ctx.setLineDash([]);
    }
  }

  let enemyDir = 1;
  let enemySpeed = 0.4;

  function updateEnemies() {
    for (const e of enemies) {
      e.phase += e.sineFreq || 0.05;
      if (e.sineAmp) e.x = e.baseX + Math.sin(e.phase) * e.sineAmp; else e.x = e.baseX;
      e.y += e.speed || 1;
      if (e.shoot) {
        e.fireCd--;
        if (e.fireCd <= 0) {
          e.fireCd = e.fireRate;
          enemyBullets.push({ x: e.x + e.w / 2 - 2, y: e.y + e.h, w: 4, h: 10, vy: 3.5, color: "#ff9a4d" });
        }
      }
    }

    // enemies reached bottom
    for (const e of enemies) {
      if (e.y > H) {
        state.lives--;
        removeEnemy(e);
        flashDamage();
        updateHud();
        if (state.lives <= 0) endGame(false);
      }
    }

    if (enemies.length === 0) {
      state.level++;
      enemySpeed += 0.25;
      spawnWave();
      updateHud();
    }
  }

  function removeEnemy(e) {
    const idx = enemies.indexOf(e);
    if (idx !== -1) enemies.splice(idx, 1);
  }

  // ---- Player shooting ----
  function playerShoot() {
    if (player.cooldown > 0) return;
    const guns = save.loadout.weapons.filter(id => id !== -1).map(id => window.DATA.GUNS.find(g => g.id === id)).filter(Boolean);
    const list = guns.length ? guns : [window.DATA.GUNS[0]];
    const cx = player.x + player.w / 2;
    list.forEach(g => {
      const offs = g.offset || [0];
      const spreads = g.spread || [0];
      for (let i = 0; i < spreads.length; i++) {
        const ox = offs[i] !== undefined ? offs[i] : (offs[0] || 0);
        const sp = spreads[i];
        bullets.push({ x: cx + ox - g.size[0] / 2, y: player.y, w: g.size[0], h: g.size[1], vy: -g.speed, vx: sp * 6, dmg: g.dmg, color: g.color, homing: g.homing, penetrate: g.penetrate });
      }
    });
    player.cooldown = player.fireRate;
  }

  // ---- Collisions ----
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  let shieldT = 0, overdriveT = 0, thrusterT = 0;
  let charges = {};
  function initCharges() { charges = {}; window.DATA.CONSUMABLES.forEach(c => charges[c.id] = 3); }
  initCharges();
  function useConsumable(slotIdx) {
    const cid = save.loadout.consumables[slotIdx];
    if (cid === -1 || cid === undefined) return;
    if ((charges[cid] || 0) <= 0) return;
    charges[cid]--;
    const co = window.DATA.CONSUMABLES.find(x => x.id === cid);
    if (!co) return;
    if (co.name.includes("Shield")) { shieldT = 180; spawnParticles(player.x + player.w / 2, player.y + player.h / 2, "#8fdcff", 18); }
    else if (co.name.includes("Repair")) { player.hp = Math.min(player.hp + 3, (window.DATA.SHIPS.find(s => s.id === save.loadout.shipId).maxHp)); spawnParticles(player.x + player.w / 2, player.y + player.h / 2, "#7fffb0", 14); }
    else if (co.name.includes("Thrusters")) thrusterT = 480;
    else if (co.name.includes("Ion Bomb")) { enemyBullets = []; enemies.forEach(e => e.hp -= 2); spawnParticles(W / 2, H / 2, "#ff6bff", 30); }
    else if (co.name.includes("Overdrive")) overdriveT = 480;
  }
  function updateConsumables() {
    if (shieldT > 0) shieldT--;
    if (overdriveT > 0) { overdriveT--; if (overdriveT % 6 === 0) playerShoot(); }
    if (thrusterT > 0) thrusterT--;
  }

  function handleCollisions() {
    // bullets vs boss
    if (boss) {
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (rectsOverlap(b, boss)) {
          boss.hp -= (b.dmg || 1);
          if (!b.penetrate) bullets.splice(i, 1);
          spawnParticles(b.x, b.y, b.color || "#8fdcff", 5);
        }
      }
    }
    // player bullets vs enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (rectsOverlap(b, e)) {
          e.hp -= (b.dmg || 1);
          if (!b.penetrate) bullets.splice(i, 1); else { b._hit = (b._hit || 0) + 1; if (b._hit > 2) bullets.splice(i, 1); }
          spawnParticles(b.x, b.y, b.color || "#8fdcff", 4);
          if (e.hp <= 0) {
            state.score += 10;
            state.credits += 2 + Math.floor(state.level / 2);
            save.credits = state.credits;
            saveSave();
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, "#ff9a4d", 16);
            removeEnemy(e);
            updateHud();
          }
          break;
        }
      }
    }

    // enemies vs player
    if (player.invuln <= 0) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (rectsOverlap(player, e)) {
          removeEnemy(e);
          damagePlayer();
          break;
        }
      }
    }

    // enemy bullets vs player
    if (player.invuln <= 0) {
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        if (rectsOverlap(player, b)) {
          enemyBullets.splice(i, 1);
          damagePlayer();
        }
      }
    }
  }

  function damagePlayer() {
    if (shieldT > 0) { spawnParticles(player.x + player.w / 2, player.y + player.h / 2, "#8fdcff", 12); return; }
    player.hp--;
    if (player.hp <= 0) {
      state.lives--;
      if (state.lives <= 0) { updateHud(); endGame(false); return; }
      const ship = window.DATA.SHIPS.find(s => s.id === save.loadout.shipId) || window.DATA.SHIPS[0];
      player.maxHp = ship.maxHp; player.hp = ship.maxHp;
      player.invuln = 90;
    } else player.invuln = 50;
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, "#ff5b6e", 20);
    flashDamage();
    updateHud();
  }

  let damageFlash = 0;
  function flashDamage() {
    damageFlash = 8;
  }

  // ---- Update ----
  function update() {
    updateStars();

    if (player.cooldown > 0) player.cooldown--;
    if (player.invuln > 0) player.invuln--;

    // movement
    const spd = player.speed * (thrusterT > 0 ? 1.55 : 1);
    if ((keys["ArrowLeft"] || keys["a"]) && player.x > 0) player.x -= spd;
    if ((keys["ArrowRight"] || keys["d"]) && player.x < W - player.w) player.x += spd;
    if ((keys["ArrowUp"] || keys["w"]) && player.y > H / 2) player.y -= spd;
    if ((keys["ArrowDown"] || keys["s"]) && player.y < H - player.h) player.y += spd;
    if (keys[" "]) playerShoot();
    if (shieldT > 0) {
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        if (Math.hypot(b.x - (player.x + player.w / 2), b.y - (player.y + player.h / 2)) < 34) {
          enemyBullets.splice(i, 1); spawnParticles(b.x, b.y, "#8fdcff", 6);
        }
      }
    }

    for (const b of bullets) { b.y += b.vy; if (b.vx) b.x += b.vx; if (b.homing && enemies.length) { const t = enemies.reduce((a, e) => { const d = Math.hypot(e.x - b.x, e.y - b.y); return !a || d < a.d ? { e, d } : a; }, null); if (t && t.d < 220) b.x += Math.sign(t.e.x + t.e.w / 2 - b.x) * 1.6; } }
    bullets = bullets.filter((b) => b.y > -20 && b.x > -20 && b.x < W + 20);

    for (const b of enemyBullets) { b.y += b.vy; if (b.vx) b.x += b.vx; if (b.homing) { const dx = player.x + player.w / 2 - b.x; b.x += Math.sign(dx) * 0.9; } }
    enemyBullets = enemyBullets.filter((b) => b.y < H + 20 && b.x > -20 && b.x < W + 20);

    if (boss) updateBoss(); else updateEnemies();
    handleCollisions();
    updateConsumables();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (damageFlash > 0) damageFlash--;
  }

  // ---- Draw ----
  function drawPlayer() {
    ctx.save();
    if (player.invuln > 0 && Math.floor(player.invuln / 5) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    const cx = player.x + player.w / 2;
    const px = player.x;
    const py = player.y;
    const pw = player.w;
    const ph = player.h;
    ctx.fillStyle = player.color || "#8fdcff";
    ctx.beginPath();
    ctx.moveTo(cx, py);
    ctx.lineTo(px + pw, py + ph);
    ctx.lineTo(px + pw * 0.72, py + ph * 0.72);
    ctx.lineTo(px + pw * 0.58, py + ph * 0.58);
    ctx.lineTo(px + pw * 0.42, py + ph * 0.58);
    ctx.lineTo(px + pw * 0.28, py + ph * 0.72);
    ctx.lineTo(px, py + ph);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e6faff";
    ctx.beginPath();
    ctx.moveTo(cx, py + 4);
    ctx.lineTo(cx + 4, py + 14);
    ctx.lineTo(cx, py + 18);
    ctx.lineTo(cx - 4, py + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0b1e3a";
    ctx.fillRect(cx - 1.5, py + 7, 3, 7);
    ctx.fillStyle = Math.random() > 0.5 ? "#ffb347" : "#ff7043";
    const fh = 6 + Math.random() * 8;
    ctx.beginPath();
    ctx.moveTo(cx - 5, py + ph * 0.58);
    ctx.lineTo(cx + 5, py + ph * 0.58);
    ctx.lineTo(cx, py + ph * 0.58 + fh);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEnemies() {
    for (const e of enemies) {
      ctx.fillStyle = e.color || "#ff6b6b";
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.w, e.y);
      ctx.lineTo(e.x + e.w - 6, e.y + e.h);
      ctx.lineTo(e.x + 6, e.y + e.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = e.accent || "#ffd166";
      ctx.fillRect(e.x + e.w / 2 - 3, e.y + 6, 6, 6);
      if (e.maxHp > 1) { ctx.fillStyle = "#333"; ctx.fillRect(e.x, e.y - 5, e.w, 3); ctx.fillStyle = "#7fffb0"; ctx.fillRect(e.x, e.y - 5, e.w * (e.hp / e.maxHp), 3); }
    }
  }

  function drawBullets() {
    for (const b of bullets) { ctx.fillStyle = b.color || "#7fd1ff"; ctx.fillRect(b.x, b.y, b.w, b.h); }
    for (const b of enemyBullets) { ctx.fillStyle = b.color || "#ff5b6e"; ctx.beginPath(); if (b.w > 6) { ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(b.x, b.y, b.w, b.h); }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawStars();
    drawBullets();
    drawBoss();
    drawEnemies();
    drawPlayer();
    if (shieldT > 0) { ctx.strokeStyle = "rgba(143,220,255,0.85)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x + player.w / 2, player.y + player.h / 2, 30 + Math.sin(Date.now() / 90) * 3, 0, Math.PI * 2); ctx.stroke(); }
    drawParticles();
    if (damageFlash > 0) {
      ctx.fillStyle = `rgba(255, 60, 80, ${damageFlash / 20})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---- Main loop ----
  function loop() {
    if (!state.running) return;
    if (!state.paused) {
      update();
      render();
    }
    requestAnimationFrame(loop);
  }

  // ---- Game flow ----
  function startGame() {
    resetGame();
    state.running = true;
    state.paused = false;
    overlay.classList.add("hidden");
    pauseScreen.classList.add("hidden");
    loop();
  }

  function endGame(won) {
    state.running = false;
    save.credits = state.credits; save.keys = state.keys; saveSave();
    titleEl.textContent = "GAME OVER";
    subtitleEl.textContent = "Score: " + state.score + "  |  +" + state.credits + " credits";
    startBtn.textContent = "PLAY AGAIN";
    overlay.classList.remove("hidden");
    updateHud();
  }

  // ---- Input ----
  window.addEventListener("keydown", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = true;
    if (e.key === " ") e.preventDefault();
    if (k === "p" && state.running) togglePause();
    if (state.running && !state.paused) {
      if (k === "1") useConsumable(0);
      if (k === "2") useConsumable(1);
    }
  });

  window.addEventListener("keyup", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = false;
  });

  function togglePause() {
    state.paused = !state.paused;
    if (state.paused) pauseScreen.classList.remove("hidden");
    else pauseScreen.classList.add("hidden");
  }

  function applyLoadout() {
    const ship = window.DATA.SHIPS.find(s => s.id === save.loadout.shipId) || window.DATA.SHIPS[0];
    player.w = 34; player.h = 30;
    player.speed = ship.speed;
    player.fireRate = Math.round(12 / ship.fireMult);
    player.color = ship.color;
  }
  applyLoadout();

  function cycleSlot(arr, owned, idx) {
    const cur = arr[idx];
    const opts = [-1, ...owned];
    const pos = opts.indexOf(cur);
    arr[idx] = opts[(pos + 1) % opts.length];
    saveSave(); renderHangar(); applyLoadout();
  }

  function renderHangar() {
    const shipList = document.getElementById("ship-list");
    const wSlots = document.getElementById("weapon-slots");
    const cSlots = document.getElementById("consumable-slots");
    const unlockList = document.getElementById("unlock-list");
    if (!shipList) return;
    const D = window.DATA;
    shipList.innerHTML = "<div style='font-size:11px;opacity:0.7;margin-bottom:4px'>SHIPS (tap to equip / buy with keys)</div>";
    D.SHIPS.forEach(s => {
      const owned = save.ownedShips.includes(s.id);
      const equipped = save.loadout.shipId === s.id;
      const d = document.createElement("div"); d.className = "card " + (owned ? "owned" : "locked");
      d.innerHTML = `<b style="color:${s.color}">${s.name}</b> — HP:${s.maxHp} SPD:${s.speed} ${equipped ? " [EQUIPPED]" : ""} ${owned ? "" : ` <span style="color:#ffd166">🔑${s.keyCost}</span>`}`;
      const btn = document.createElement("button");
      if (owned) { btn.textContent = equipped ? "EQUIPPED" : "EQUIP"; btn.disabled = equipped; btn.onclick = () => { save.loadout.shipId = s.id; saveSave(); applyLoadout(); renderHangar(); updateHud(); }; }
      else { btn.textContent = `UNLOCK 🔑${s.keyCost}`; btn.disabled = save.keys < s.keyCost; btn.onclick = () => { if (save.keys >= s.keyCost) { save.keys -= s.keyCost; state.keys = save.keys; save.ownedShips.push(s.id); saveSave(); updateHud(); renderHangar(); } }; }
      d.appendChild(btn); shipList.appendChild(d);
    });
    wSlots.innerHTML = "<div style='font-size:11px;opacity:0.7;margin:6px 0 4px'>WEAPON SLOTS — tap slot to cycle owned guns</div>";
    save.loadout.weapons.forEach((gid, i) => {
      const g = D.GUNS.find(x => x.id === gid);
      const row = document.createElement("div"); row.className = "slot-row";
      const card = document.createElement("div"); card.className = "card";
      card.innerHTML = `<b>SLOT ${i + 1}:</b> ${g ? `<span style="color:${g.color}">${g.name}</span> DMG:${g.dmg}` : "<i>Empty</i>"}`;
      card.style.cursor = "pointer"; card.onclick = () => cycleSlot(save.loadout.weapons, save.ownedGuns, i);
      row.appendChild(card); wSlots.appendChild(row);
    });
    cSlots.innerHTML = "<div style='font-size:11px;opacity:0.7;margin:6px 0 4px'>CONSUMABLE SLOTS — press 1/2 in game</div>";
    save.loadout.consumables.forEach((cid, i) => {
      const co = D.CONSUMABLES.find(x => x.id === cid);
      const row = document.createElement("div"); row.className = "slot-row";
      const card = document.createElement("div"); card.className = "card";
      card.innerHTML = `<b>SLOT ${i + 1}:</b> ${co ? `<span style="color:${co.color}">${co.name}</span>` : "<i>Empty</i>"}`;
      card.style.cursor = "pointer"; card.onclick = () => cycleSlot(save.loadout.consumables, save.ownedConsumables, i);
      row.appendChild(card); cSlots.appendChild(row);
    });
    unlockList.innerHTML = "<div style='font-size:11px;opacity:0.7;margin:6px 0 4px'>UNLOCK — guns & consumables (keys)</div>";
    [...D.GUNS, ...D.CONSUMABLES].forEach(item => {
      const isGun = D.GUNS.includes(item);
      const owned = isGun ? save.ownedGuns.includes(item.id) : save.ownedConsumables.includes(item.id);
      if (owned) return;
      const d = document.createElement("div"); d.className = "card locked";
      d.innerHTML = `${isGun ? "🔫" : "🧪"} ${item.name} — <span style="color:#ffd166">🔑${item.keyCost}</span> ${isGun ? `DMG:${item.dmg}` : item.desc.slice(0, 38)}`;
      const btn = document.createElement("button"); btn.textContent = `UNLOCK 🔑${item.keyCost}`; btn.disabled = save.keys < item.keyCost;
      btn.onclick = () => { if (save.keys >= item.keyCost) { save.keys -= item.keyCost; state.keys = save.keys; if (isGun) save.ownedGuns.push(item.id); else save.ownedConsumables.push(item.id); saveSave(); updateHud(); renderHangar(); renderShop(); renderInventory(); } };
      d.appendChild(btn); unlockList.appendChild(d);
    });
  }

  function renderShop() {
    const el = document.getElementById("shop-list"); if (!el) return;
    const D = window.DATA;
    el.innerHTML = `<div style="font-size:11px;opacity:0.7;margin-bottom:6px">Spend credits (light cyan) to stock consumables. You have <b style="color:#8fdcff">${state.credits} credits</b></div>`;
    D.CONSUMABLES.forEach(c => {
      const d = document.createElement("div"); d.className = "card";
      const owned = save.ownedConsumables.includes(c.id);
      d.innerHTML = `<b style="color:${c.color}">${c.name}</b> ${owned ? "" : "(locked 🔑"+c.keyCost+")"} — ${c.desc} <span style="color:#8fdcff"> ${c.creditCost ? c.creditCost+"c" : "FREE"}</span>`;
      if (owned && c.creditCost > 0) {
        const btn = document.createElement("button"); btn.textContent = `BUY ${c.creditCost}c`;
        btn.disabled = state.credits < c.creditCost; btn.onclick = () => { if (state.credits >= c.creditCost) { state.credits -= c.creditCost; save.credits = state.credits; saveSave(); updateHud(); renderShop(); } };
        d.appendChild(btn);
      }
      el.appendChild(d);
    });
  }

  function renderInventory() {
    const el = document.getElementById("inv-content"); if (!el) return;
    const D = window.DATA;
    let html = `<div style="font-size:11px;opacity:0.7">Credits <span style="color:#8fdcff">${state.credits}</span> — Keys 🔑${state.keys}</div><hr style="margin:6px 0;opacity:0.2">`;
    html += "<b>Ships</b><br>";
    D.SHIPS.forEach(s => { const o = save.ownedShips.includes(s.id); html += `<div class="card ${o?"owned":"locked"}" style="margin:3px 0">${o?"✓":"🔒"} <span style="color:${s.color}">${s.name}</span> HP:${s.maxHp} SPD:${s.speed} ${save.loadout.shipId===s.id?"[EQUIPPED]":""} ${o?"":`🔑${s.keyCost}`}</div>`; });
    html += "<b>Guns</b><br>";
    D.GUNS.forEach(g => { const o = save.ownedGuns.includes(g.id); html += `<div class="card ${o?"owned":"locked"}" style="margin:3px 0">${o?"✓":"🔒"} <span style="color:${g.color}">${g.name}</span> DMG:${g.dmg} ${o?"":`🔑${g.keyCost}`}</div>`; });
    html += "<b>Consumables</b><br>";
    D.CONSUMABLES.forEach(c => { const o = save.ownedConsumables.includes(c.id); html += `<div class="card ${o?"owned":"locked"}" style="margin:3px 0">${o?"✓":"🔒"} <span style="color:${c.color}">${c.name}</span> ${o?"":`🔑${c.keyCost}`}</div>`; });
    el.innerHTML = html;
  }

  function showMenu(name) {
    overlay.classList.add("hidden"); hangarEl.classList.add("hidden"); shopEl.classList.add("hidden"); invEl.classList.add("hidden"); pauseScreen.classList.add("hidden");
    if (name === "hangar") { renderHangar(); hangarEl.classList.remove("hidden"); }
    else if (name === "shop") { renderShop(); shopEl.classList.remove("hidden"); }
    else if (name === "inventory") { renderInventory(); invEl.classList.remove("hidden"); }
    else if (name === "menu") { overlay.classList.remove("hidden"); updateHud(); }
  }

  document.getElementById("hangar-btn").addEventListener("click", () => showMenu("hangar"));
  document.getElementById("shop-btn").addEventListener("click", () => showMenu("shop"));
  document.getElementById("inv-btn").addEventListener("click", () => showMenu("inventory"));
  document.getElementById("hangar-close").addEventListener("click", () => showMenu("menu"));
  document.getElementById("shop-close").addEventListener("click", () => showMenu("menu"));
  document.getElementById("inv-close").addEventListener("click", () => showMenu("menu"));

  startBtn.addEventListener("click", startGame);
  resumeBtn.addEventListener("click", () => togglePause());

  // idle background animation on menu
  function idleLoop() {
    if (state.running) return;
    ctx.clearRect(0, 0, W, H);
    updateStars();
    drawStars();
    requestAnimationFrame(idleLoop);
  }
  idleLoop();
})();
