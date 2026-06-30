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

  const BASE_SPD    = 280;
  const SPD_STEP    = 40;
  const LEVEL_EVERY = 12;
  const GRAV        = 1600;
  const JUMP_V      = -620;

  // Base shooting interval (seconds between shots), decreases with level
  const BASE_SHOOT  = 2.6;
  const SHOOT_MIN   = 1.0;

  let canvas, ctx;
  let W, H, groundY;
  let gameState = 'idle';
  let score = 0, hiScore = 0;
  let level = 1, spd = BASE_SPD, elapsed = 0;
  let coneTimer = 0, levelTimer = 0, shootTimer = 0;
  let cones = [], shots = [], particles = [];
  let rafId = null, lastTs = null;
  let groundOff = 0;
  let bgImg = null, bgReady = false;
  let skaterImg = null, skaterReady = false;
  let copImg = null, copReady = false;

  let copShooting = 0;

  const P = {
    x: 90, y: 0, w: 34, h: 54,
    vy: 0, grounded: true, frameTimer: 0,
  };

  /* ---- image loading ---- */
  function loadImages() {
    if (!bgImg) {
      bgImg = new Image();
      bgImg.onload = function () { bgReady = true; };
      bgImg.src = 'assets/images/graffiti-banner.jpg';
    }
    if (!skaterImg) {
      skaterImg = new Image();
      skaterImg.onload = function () { skaterReady = true; };
      skaterImg.src = 'assets/images/skater.svg';
    }
    if (!copImg) {
      copImg = new Image();
      copImg.onload = function () { copReady = true; };
      copImg.src = 'assets/images/cop-pig.svg';
    }
  }

  function drawBg() {
    if (bgReady) {
      ctx.drawImage(bgImg, 0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.52)';
      ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0e0e1a'); g.addColorStop(1, '#1e1a30');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
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
    ctx.strokeStyle = '#ff337799';
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
    ctx.ellipse(px, groundY + 4, 26, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (skaterReady) {
      // SVG viewBox 0 0 60 82; wheel bottom at y=82 aligns with P.y
      const sw = 64, sh = 88;
      // slight tilt when airborne
      if (!P.grounded) {
        ctx.translate(px, py);
        ctx.rotate(-0.15);
        ctx.drawImage(skaterImg, -sw / 2, -sh, sw, sh);
      } else {
        ctx.drawImage(skaterImg, px - sw / 2, py - sh, sw, sh);
      }
    }
    ctx.restore();
  }

  /* ---- cop pig ---- */
  function drawCopPig() {
    // SVG viewBox 0 0 80 120; boot bottom at y=117, align to groundY
    // body center in SVG at x=48, align to W-70 on screen
    const cx = W - 70, cy = groundY;
    const sw = 90, sh = 135;
    const drawX = cx - 48 * (sw / 80);
    const drawY = cy - 117 * (sh / 120);

    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx + 5, cy + 4, 28, 6, 0, 0, Math.PI * 2); ctx.fill();

    if (copReady) {
      // bounce body slightly when shooting
      const bounceY = copShooting > 0 ? -4 : 0;
      ctx.drawImage(copImg, drawX, drawY + bounceY, sw, sh);
    }
    ctx.restore();
  }

  /* ---- cones (ground obstacles from edge) ---- */
  function spawnCone() {
    cones.push({ x: W + 30, y: groundY, w: 22, h: 38, spd: spd, scored: false });
  }

  function drawCone(o) {
    const x = o.x, y = o.y;
    ctx.save();
    ctx.fillStyle = '#ff6600';
    ctx.beginPath(); ctx.moveTo(x, y - o.h); ctx.lineTo(x - o.w/2, y); ctx.lineTo(x + o.w/2, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x - o.w/2 + 2, y - 20, o.w - 4, 5);
    ctx.restore();
  }

  /* ---- cop shots (donuts thrown from cop position) ---- */
  function shoot() {
    const cx = W - 70, cy = groundY;
    // Alternate: rolling ground shot or low-arc thrown shot
    const rolling = Math.random() < 0.5;
    const startY  = rolling ? groundY : cy - 52;
    // vertical velocity for arced throws (rolling has vy=0, but gravity applies to both)
    const vy      = rolling ? 0 : -80 - Math.random() * 60;
    shots.push({
      x: cx - 20, y: startY,
      vx: -spd,
      vy: vy,
      r: 11,
      rot: 0, rotSpd: (Math.random() - 0.5) * 10,
      scored: false,
    });
    copShooting = 0.25; // animate arm for 0.25s
  }

  function drawShot(s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    // donut body
    ctx.fillStyle = '#c87941';
    ctx.beginPath(); ctx.arc(0, 0, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.beginPath(); ctx.arc(0, 0, s.r * 0.38, 0, Math.PI * 2); ctx.fill();
    // icing
    ctx.fillStyle = '#ff88aa';
    ctx.beginPath(); ctx.arc(0, 0, s.r * 0.78, Math.PI + 0.3, -0.3); ctx.arc(0, 0, s.r * 0.55, -0.3, Math.PI + 0.3, true); ctx.closePath(); ctx.fill();
    // sprinkles
    ctx.fillStyle = '#00ffcc'; ctx.fillRect(-5, -s.r * 0.6, 3, 2);
    ctx.fillStyle = '#ffee00'; ctx.fillRect(2,   s.r * 0.4, 3, 2);
    ctx.fillStyle = '#fff';    ctx.fillRect(-2, -s.r * 0.3, 3, 2);
    ctx.restore();
  }

  /* ---- collision ---- */
  function hitsPlayer(x, y, r) {
    const hw = P.w * 0.42, hh = P.h * 0.70;
    const cx = P.x, cy = P.y - hh / 2;
    // circle vs AABB
    const nearX = Math.max(cx - hw, Math.min(x, cx + hw));
    const nearY = Math.max(cy - hh/2, Math.min(y, cy + hh/2));
    return Math.hypot(x - nearX, y - nearY) < r;
  }

  function coneHitsPlayer(o) {
    const hw = P.w * 0.4, hh = P.h * 0.7;
    const px = P.x, py = P.y - hh / 2;
    return px + hw > o.x - o.w/2 && px - hw < o.x + o.w/2
        && py + hh/2 > o.y - o.h && py - hh/2 < o.y;
  }

  /* ---- particles ---- */
  function burst() {
    for (let i = 0; i < 20; i++) {
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
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, 52);

    ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
    ctx.font = 'bold 18px "Bebas Neue",sans-serif';
    ctx.fillText(String(score).padStart(5,'0'), W - 85, 8);
    ctx.font = '10px Arial'; ctx.fillStyle = '#bbb';
    ctx.fillText('SCORE', W - 85, 28);
    ctx.fillStyle = '#ffee00'; ctx.font = 'bold 13px "Bebas Neue",sans-serif';
    ctx.fillText('HI ' + String(hiScore).padStart(5,'0'), W - 85, 40);

    ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 14px "Bebas Neue",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LVL ' + level, 12, 8);

    ctx.restore();
  }

  /* ---- overlays ---- */
  function drawIdle() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "Bebas Neue",sans-serif';
    ctx.fillText('TAP OR PRESS SPACE TO START', W/2, H/2);
    ctx.restore();
  }

  function drawDead() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
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

  /* ---- reset ---- */
  function resetGame() {
    score = 0; level = 1; spd = BASE_SPD; elapsed = 0;
    coneTimer = 0; levelTimer = 0; shootTimer = 0;
    cones = []; shots = []; particles = [];
    copShooting = 0;
    P.y = groundY; P.vy = 0; P.grounded = true; P.frameTimer = 0;
    hiScore = parseInt(localStorage.getItem('skaterHiScore') || '0', 10);
    groundOff = 0;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = canvas.width  = rect.width  || canvas.offsetWidth  || 780;
    H = canvas.height = rect.height || canvas.offsetHeight || 240;
    groundY = H - 40;
    if (gameState !== 'playing') P.y = groundY;
  }

  /* ---- main loop ---- */
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    const dt = lastTs === null ? 0.016 : Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    drawBg();

    if (gameState === 'playing') groundOff -= spd * dt;
    drawGround();

    if (gameState === 'playing') {
      elapsed    += dt;
      coneTimer  += dt;
      levelTimer += dt;
      shootTimer += dt;

      if (copShooting > 0) copShooting -= dt;

      // player physics
      P.vy += GRAV * dt; P.y += P.vy * dt; P.frameTimer += dt;
      if (P.y >= groundY) { P.y = groundY; P.vy = 0; P.grounded = true; }

      // spawn cones from right edge
      const coneInterval = Math.max(1.2, 2.8 - (level - 1) * 0.12);
      if (coneTimer >= coneInterval) { spawnCone(); coneTimer = 0; }

      // cop shoots
      const shootInterval = Math.max(SHOOT_MIN, BASE_SHOOT - (level - 1) * 0.18);
      if (shootTimer >= shootInterval) { shoot(); shootTimer = 0; }

      // level up
      if (levelTimer >= LEVEL_EVERY) {
        levelTimer = 0; level++; spd = BASE_SPD + (level - 1) * SPD_STEP;
      }

      // move cones
      for (const o of cones) o.x -= o.spd * dt;
      cones = cones.filter(o => o.x > -60);
      for (const o of cones) {
        if (!o.scored && o.x + o.w/2 < P.x - P.w/2) { o.scored = true; score++; }
      }

      // move shots (with gravity)
      for (const s of shots) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += GRAV * 0.55 * dt;
        if (s.y > groundY) { s.y = groundY; s.vy = 0; }  // bounce-stop on ground
        s.rot += s.rotSpd * dt;
      }
      shots = shots.filter(s => s.x > -40);
      for (const s of shots) {
        if (!s.scored && s.x + s.r < P.x - P.w/2) { s.scored = true; score++; }
      }

      // collision
      let dead = false;
      for (const o of cones) { if (coneHitsPlayer(o)) { dead = true; break; } }
      if (!dead) {
        for (const s of shots) { if (hitsPlayer(s.x, s.y, s.r * 0.85)) { dead = true; break; } }
      }
      if (dead) {
        gameState = 'dead'; burst();
        if (score > hiScore) { hiScore = score; localStorage.setItem('skaterHiScore', hiScore); }
      }

      updateParticles(dt);
    }

    for (const o of cones) drawCone(o);
    for (const s of shots) drawShot(s);
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
    loadImages();
    hiScore = parseInt(localStorage.getItem('skaterHiScore') || '0', 10);
    if (gameState !== 'playing') P.y = groundY;
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
