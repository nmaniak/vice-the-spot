/* =======================================
   PAGE SWITCHING
======================================= */
function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });

  const page = document.getElementById('page-' + pageId);
  const tab  = document.querySelector(`.nav-tab[data-page="${pageId}"]`);
  if (page) page.classList.add('active');
  if (tab)  { tab.classList.add('active'); tab.setAttribute('aria-selected', 'true'); }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (pageId === 'game' && typeof initGame === 'function') initGame();
}

/* =======================================
   MENU FILTER
======================================= */
function filterMenu(btn) {
  const filter = btn.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.menu-section').forEach(section => {
    section.classList.toggle('hidden', filter !== 'all' && section.dataset.category !== filter);
  });
}

/* =======================================
   INTERSECTION OBSERVER - fade-in on scroll
======================================= */
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    .reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.4s ease, transform 0.4s ease; }
    .reveal.visible { opacity: 1; transform: none; }
  `;
  document.head.appendChild(style);

  const observer = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    }),
    { threshold: 0.08 }
  );

  document.querySelectorAll('.menu-section, .gallery-item, .rating-summary, .review-card, .write-review').forEach(el => {
    el.classList.add('reveal');
    observer.observe(el);
  });
});

/* =======================================
   SKATER VS COP PIG - GAME
======================================= */
(function () {
  'use strict';

  const BASE_SPD    = 260;
  const SPD_STEP    = 40;
  const LEVEL_EVERY = 12;
  const GRAV        = 1600;
  const JUMP_V      = -620;

  let canvas, ctx;
  let W, H, groundY;
  let gameState = 'idle';
  let score = 0, hiScore = 0;
  let level = 1, spd = BASE_SPD, elapsed = 0;
  let spawnTimer = 0, levelTimer = 0;
  let obstacles = [], particles = [];
  let rafId = null, lastTs = null;

  // parallax offsets
  let skyOff = 0, midOff = 0, groundOff = 0;
  let skyBuildings = [], midBuildings = [];

  const P = {
    x: 90, y: 0, w: 34, h: 54,
    vy: 0, grounded: true, frameTimer: 0,
  };

  /* ---- background init ---- */
  function initBg() {
    skyBuildings = []; midBuildings = [];
    let x = 0;
    while (x < W + 300) {
      const bw = 40 + Math.random() * 80;
      skyBuildings.push({ ox: x, w: bw, h: 60 + Math.random() * 100,
        col: `hsl(${220 + Math.random()*40},${20+Math.random()*20}%,${14+Math.random()*10}%)`,
        win: Math.random() > 0.3 });
      x += bw + 2 + Math.random() * 20;
    }
    x = 0;
    while (x < W + 300) {
      const bw = 30 + Math.random() * 60;
      midBuildings.push({ ox: x, w: bw, h: 30 + Math.random() * 60,
        col: `hsl(${210+Math.random()*30},${15+Math.random()*15}%,${20+Math.random()*10}%)` });
      x += bw + 1 + Math.random() * 10;
    }
    skyOff = midOff = groundOff = 0;
  }

  function drawBuildings(list, offset, yBase, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    const span = W + 400;
    for (const b of list) {
      const x = ((b.ox + offset) % span + span) % span - 200;
      ctx.fillStyle = b.col;
      ctx.fillRect(x, yBase - b.h, b.w, b.h);
      if (b.win) {
        ctx.fillStyle = 'rgba(255,220,80,0.22)';
        for (let wy = yBase - b.h + 6; wy < yBase - 8; wy += 14)
          for (let wx = x + 5; wx < x + b.w - 8; wx += 12)
            if (Math.random() > 0.4) ctx.fillRect(wx, wy, 6, 8);
      }
    }
    ctx.restore();
  }

  function drawGround() {
    ctx.fillStyle = '#2d2d3a';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.strokeStyle = '#ffee00aa';
    ctx.lineWidth = 2;
    ctx.setLineDash([24, 18]);
    ctx.lineDashOffset = groundOff % 42;
    ctx.beginPath();
    ctx.moveTo(0, groundY + (H - groundY) / 2);
    ctx.lineTo(W, groundY + (H - groundY) / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#ff337788';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();
  }

  /* ---- player ---- */
  function drawPlayer() {
    const px = P.x, py = P.y;
    ctx.save();

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(px, groundY + 4, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // board
    ctx.fillStyle = '#cc2255';
    const boardY = py + 2;
    ctx.beginPath();
    ctx.roundRect(px - 22, boardY, 44, 7, 3);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(px - 14, boardY + 7, 5, 0, Math.PI * 2);
    ctx.arc(px + 14, boardY + 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3377';
    ctx.beginPath();
    ctx.arc(px - 14, boardY + 7, 3, 0, Math.PI * 2);
    ctx.arc(px + 14, boardY + 7, 3, 0, Math.PI * 2);
    ctx.fill();

    const top = py - P.h;
    // body
    ctx.fillStyle = '#e8215a';
    ctx.beginPath(); ctx.roundRect(px - 11, top + 18, 22, 26, 4); ctx.fill();
    // hood
    ctx.fillStyle = '#c41a4a';
    ctx.beginPath(); ctx.arc(px, top + 18, 12, Math.PI, 0); ctx.fill();
    // head
    ctx.fillStyle = '#f4c48e';
    ctx.beginPath(); ctx.arc(px, top + 13, 11, 0, Math.PI * 2); ctx.fill();
    // eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(px - 4, top + 12, 2, 0, Math.PI * 2);
    ctx.arc(px + 4, top + 12, 2, 0, Math.PI * 2);
    ctx.fill();
    // legs
    const kick = P.grounded ? Math.sin(P.frameTimer * 8) * 6 : 0;
    ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px - 4, top + 44); ctx.lineTo(px - 8 + kick, boardY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 4, top + 44); ctx.lineTo(px + 8 - kick, boardY); ctx.stroke();

    ctx.restore();
  }

  /* ---- cop pig ---- */
  function drawCopPig() {
    const cx = W - 70, cy = groundY;
    ctx.save();

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 4, 24, 6, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#4a90d9';
    ctx.beginPath(); ctx.roundRect(cx - 18, cy - 60, 36, 40, 6); ctx.fill();

    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(cx - 4, cy - 45, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b8860b'; ctx.font = 'bold 5px Arial'; ctx.textAlign = 'center';
    ctx.fillText('PIG', cx - 4, cy - 43);

    ctx.fillStyle = '#2a60a0';
    ctx.fillRect(cx - 14, cy - 24, 10, 24);
    ctx.fillRect(cx + 4, cy - 24, 10, 24);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 15, cy - 3, 12, 7);
    ctx.fillRect(cx + 3, cy - 3, 12, 7);

    ctx.fillStyle = '#ffaacc';
    ctx.beginPath(); ctx.arc(cx, cy - 72, 18, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#2a60a0';
    ctx.fillRect(cx - 20, cy - 92, 40, 6);
    ctx.fillRect(cx - 14, cy - 108, 28, 20);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(cx, cy - 100, 4, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ff99bb';
    ctx.beginPath(); ctx.ellipse(cx, cy - 69, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cc5577';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 69, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy - 69, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 7, cy - 76, 5, 0, Math.PI * 2);
    ctx.arc(cx + 7, cy - 76, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx - 7, cy - 75, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 7, cy - 75, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 83); ctx.lineTo(cx - 3, cy - 80);
    ctx.moveTo(cx + 12, cy - 83); ctx.lineTo(cx + 3, cy - 80);
    ctx.stroke();

    ctx.strokeStyle = '#4a90d9'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 18, cy - 52); ctx.lineTo(cx - 40, cy - 64); ctx.stroke();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(cx - 40, cy - 66); ctx.lineTo(cx - 55, cy - 80); ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(cx - 40, cy - 66, 4, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  /* ---- obstacles ---- */
  function spawnObstacle() {
    const types = ['cone', 'cone', 'trash', 'donut', 'pothole', 'board'];
    const type  = types[Math.floor(Math.random() * types.length)];
    let oh = 36, ow = 24;
    if (type === 'pothole') { oh = 10; ow = 50; }
    if (type === 'cone')    { oh = 38; ow = 22; }
    if (type === 'trash')   { oh = 44; ow = 26; }
    if (type === 'donut')   { oh = 24; ow = 24; }
    if (type === 'board')   { oh = 14; ow = 44; }
    obstacles.push({ type, x: W + 40, y: groundY, w: ow, h: oh,
      spd: spd + (Math.random() - 0.5) * 20, scored: false });
  }

  function drawObstacle(o) {
    const x = o.x, y = o.y;
    ctx.save();
    if (o.type === 'pothole') {
      ctx.fillStyle = '#111118';
      ctx.beginPath(); ctx.ellipse(x, y - 5, o.w / 2, o.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.stroke();
    }
    if (o.type === 'cone') {
      ctx.fillStyle = '#ff6600';
      ctx.beginPath(); ctx.moveTo(x, y - o.h); ctx.lineTo(x - o.w/2, y); ctx.lineTo(x + o.w/2, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'white'; ctx.fillRect(x - o.w/2 + 2, y - 20, o.w - 4, 5);
    }
    if (o.type === 'trash') {
      ctx.fillStyle = '#556b2f'; ctx.fillRect(x - o.w/2, y - o.h, o.w, o.h);
      ctx.fillStyle = '#3a5020'; ctx.fillRect(x - o.w/2, y - o.h, o.w, 8);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(x - o.w/2, y - o.h + 8 + i*10); ctx.lineTo(x + o.w/2, y - o.h + 8 + i*10); ctx.stroke();
      }
    }
    if (o.type === 'donut') {
      ctx.fillStyle = '#c87941';
      ctx.beginPath(); ctx.arc(x, y - o.h/2, o.w/2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath(); ctx.arc(x, y - o.h/2, o.w/5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff88aa'; ctx.fillRect(x - 7, y - o.h/2 - 2, 14, 3);
      ctx.fillStyle = '#00ffcc'; ctx.fillRect(x - 5, y - o.h/2 - 6, 4, 2);
      ctx.fillStyle = '#ffee00'; ctx.fillRect(x + 2, y - o.h/2 + 4, 4, 2);
    }
    if (o.type === 'board') {
      ctx.fillStyle = '#8B4513';
      ctx.beginPath(); ctx.roundRect(x - o.w/2, y - o.h, o.w, o.h - 4, 3); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(x - 14, y - 4, 4, 0, Math.PI * 2);
      ctx.arc(x + 14, y - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---- collision ---- */
  function collides(o) {
    const px = P.x, py = P.y, ph = P.h;
    const pw = P.w * 0.55, phh = ph * 0.75;
    if (o.type === 'pothole') {
      return py >= groundY - 2 && px + pw/2 > o.x - o.w/2 && px - pw/2 < o.x + o.w/2;
    }
    const or = Math.min(o.w, o.h) / 2;
    return Math.hypot(o.x - px, (o.y - o.h/2) - (py - phh/2)) < or + Math.min(pw, phh) / 2;
  }

  /* ---- particles ---- */
  function burst() {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 220;
      particles.push({
        x: P.x, y: P.y - P.h / 2,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, r: 3 + Math.random() * 6,
        col: ['#ff3377','#ffee00','#00ffcc','#ff6600'][Math.floor(Math.random() * 4)],
      });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 400 * dt; p.life -= dt * 1.8;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* ---- HUD ---- */
  function drawHUD() {
    ctx.save();
    ctx.font = 'bold 18px "Bebas Neue",sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
    ctx.fillText(String(score).padStart(5,'0'), W - 80, 10);
    ctx.font = '11px Arial'; ctx.fillStyle = '#aaa';
    ctx.fillText('SCORE', W - 80, 30);
    ctx.fillStyle = '#ffee00'; ctx.font = 'bold 14px "Bebas Neue",sans-serif';
    ctx.fillText('HI ' + String(hiScore).padStart(5,'0'), W - 80, 46);
    ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 13px "Bebas Neue",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LVL ' + level, 12, 10);
    ctx.restore();
  }

  /* ---- overlays ---- */
  function drawIdle() {
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,20,0.72)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3377'; ctx.font = 'bold 36px "Bebas Neue",sans-serif';
    ctx.fillText('SKATER VS COP PIG', W/2, H/2 - 40);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Bebas Neue",sans-serif';
    ctx.fillText('TAP OR PRESS SPACE TO START', W/2, H/2 + 4);
    ctx.fillStyle = '#888'; ctx.font = '13px Arial';
    ctx.fillText('Avoid everything the Cop Pig throws at you', W/2, H/2 + 28);
    ctx.restore();
  }

  function drawDead() {
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,20,0.78)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3377'; ctx.font = 'bold 46px "Bebas Neue",sans-serif';
    ctx.fillText('BUSTED!', W/2, H/2 - 48);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "Bebas Neue",sans-serif';
    ctx.fillText('SCORE: ' + score, W/2, H/2);
    if (score > 0 && score >= hiScore) {
      ctx.fillStyle = '#ffee00'; ctx.font = 'bold 16px "Bebas Neue",sans-serif';
      ctx.fillText('NEW HIGH SCORE!', W/2, H/2 + 28);
    }
    ctx.fillStyle = '#aaa'; ctx.font = '15px Arial';
    ctx.fillText('Tap / Space to Try Again', W/2, H/2 + 58);
    ctx.restore();
  }

  /* ---- init / reset ---- */
  function resetGame() {
    score = 0; level = 1; spd = BASE_SPD; elapsed = 0;
    spawnTimer = 0; levelTimer = 0;
    obstacles = []; particles = [];
    P.y = groundY; P.vy = 0; P.grounded = true; P.frameTimer = 0;
    hiScore = parseInt(localStorage.getItem('skaterHiScore') || '0', 10);
    initBg();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = canvas.width  = rect.width  || canvas.offsetWidth  || 780;
    H = canvas.height = rect.height || canvas.offsetHeight || 240;
    groundY = H - 40;
    if (gameState !== 'playing') { P.y = groundY; }
  }

  /* ---- main loop ---- */
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    const dt = lastTs === null ? 0.016 : Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    ctx.fillStyle = '#0e0e1a'; ctx.fillRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0, '#0e0e1a'); grad.addColorStop(1, '#1e1a30');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, groundY);

    if (gameState === 'playing') {
      skyOff    -= spd * 0.08 * dt;
      midOff    -= spd * 0.30 * dt;
      groundOff -= spd * dt;
    }

    drawBuildings(skyBuildings, skyOff, groundY - 20, 0.6);
    drawBuildings(midBuildings, midOff, groundY - 10, 0.85);
    drawGround();

    if (gameState === 'playing') {
      elapsed    += dt;
      spawnTimer += dt;
      levelTimer += dt;

      P.vy += GRAV * dt; P.y += P.vy * dt; P.frameTimer += dt;
      if (P.y >= groundY) { P.y = groundY; P.vy = 0; P.grounded = true; }

      const interval = Math.max(0.9, 2.2 - (level - 1) * 0.1);
      if (spawnTimer >= interval) { spawnObstacle(); spawnTimer = 0; }

      if (levelTimer >= LEVEL_EVERY) {
        levelTimer = 0; level++; spd = BASE_SPD + (level - 1) * SPD_STEP;
      }

      for (const o of obstacles) o.x -= o.spd * dt;
      obstacles = obstacles.filter(o => o.x > -100);

      for (const o of obstacles) {
        if (!o.scored && o.x + o.w/2 < P.x - P.w/2) { o.scored = true; score++; }
      }

      for (const o of obstacles) {
        if (collides(o)) {
          gameState = 'dead';
          burst();
          if (score > hiScore) { hiScore = score; localStorage.setItem('skaterHiScore', hiScore); }
          break;
        }
      }

      updateParticles(dt);
    }

    for (const o of obstacles) drawObstacle(o);
    drawParticles();
    if (gameState !== 'dead' || particles.length > 0) drawPlayer();
    drawCopPig();
    drawHUD();
    if (gameState === 'idle') drawIdle();
    if (gameState === 'dead') drawDead();
  }

  /* ---- input ---- */
  function handleInput() {
    if (gameState === 'idle') { gameState = 'playing'; return; }
    if (gameState === 'dead') { resetGame(); gameState = 'playing'; return; }
    if (!P.grounded) return;
    P.vy = JUMP_V; P.grounded = false;
  }

  /* ---- public init called by switchPage ---- */
  window.initGame = function () {
    if (!canvas) {
      canvas = document.getElementById('gameCanvas');
      ctx    = canvas.getContext('2d');
      window.addEventListener('resize', resize);
      document.addEventListener('keydown', e => {
        if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
        const gp = document.getElementById('page-game');
        if (!gp || !gp.classList.contains('active')) return;
        e.preventDefault(); handleInput();
      });
      canvas.addEventListener('pointerdown', e => { e.preventDefault(); handleInput(); });
    }
    resize();
    hiScore = parseInt(localStorage.getItem('skaterHiScore') || '0', 10);
    initBg();
    if (gameState !== 'playing') { P.y = groundY; }
    if (!rafId) { lastTs = null; rafId = requestAnimationFrame(loop); }
  };
})();

/* =======================================
   TODO: Google Places API (future)
   -------------------------------------
   When you have Place ID + API Key:
   1. Add here:
        const GOOGLE_PLACE_ID = 'ChIJ...';
        const GOOGLE_API_KEY  = 'AIzaSy...';
   2. Enable "Places API (New)" in Google Cloud Console
   3. Reviews will load automatically and the button
      will open the write-review dialog directly:
        https://search.google.com/local/writereview?placeid=PLACE_ID
======================================= */
