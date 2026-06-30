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
   SKATER GAME
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

  // Fixed internal canvas resolution — matches background image ratio (2752:1120)
  const GAME_W = 820;
  const GAME_H = 334;

  // ---- Sprite paths — swap these for real assets when designer delivers them ----
  const SKATER_RUN_SRCS  = [
    'assets/images/skater_run_1.png',
    'assets/images/skater_run_2.png',
    'assets/images/skater_run_3.png',
    'assets/images/skater_run_4.png',
  ];
  const SKATER_JUMP_SRCS = ['assets/images/skater_jump.png'];
  const COP_SRCS         = [
    'assets/images/cop_idle_1.png',
    'assets/images/cop_idle_2.png',
    'assets/images/cop_idle_3.png',
  ];
  const SKATER_RUN_FPS  = 10;   // frames/sec while running
  const SKATER_JUMP_FPS =  4;   // frames/sec while airborne
  const COP_FPS         =  5;   // frames/sec for cop idle loop

  let canvas, ctx;
  let W, H, groundY;
  let gameState = 'idle';
  let score = 0, hiScore = 0;
  let level = 1, spd = BASE_SPD, elapsed = 0;
  let levelTimer = 0, shootTimer = 0;
  let shots = [], particles = [];
  let rafId = null, lastTs = null;
  let groundOff = 0;
  let bgImg = null, bgReady = false;
  let skaterImg = null, skaterReady = false;
  let copImg = null, copReady = false;
  let donutDangerImg = null, donutDangerReady = false;
  let donutSafeImg = null, donutSafeReady = false;

  // PNG sprite frame arrays (primary) — SVGs above remain as fallback
  let skaterRunFrames  = [], skaterRunReady  = false;
  let skaterJumpFrames = [], skaterJumpReady = false;
  let copPigFrames     = [], copPigReady     = false;

  // Animation timers and current frame indices
  let skaterAnimTimer = 0, skaterAnimFrame = 0;
  let copAnimTimer    = 0, copAnimFrame    = 0;

  let copShooting = 0;

  const P = {
    x: 90, y: 0, w: 34, h: 54,
    vy: 0, grounded: true, frameTimer: 0,
  };

  /* ---- image loading ---- */

  // Loads an array of image paths; calls onAllDone(frames) when every
  // request settles (load or error).  Frames that 404 will have
  // naturalWidth === 0 and are skipped at draw time.
  function loadFrameArray(srcs, onAllDone) {
    if (!srcs.length) { onAllDone([]); return []; }
    var frames = srcs.map(function (src) {
      var img = new Image(); img.src = src; return img;
    });
    var pending = frames.length;
    frames.forEach(function (img) {
      img.onload = img.onerror = function () {
        if (--pending === 0) onAllDone(frames);
      };
    });
    return frames;
  }

  function loadImages() {
    if (!bgImg) {
      bgImg = new Image();
      bgImg.onload = function () { bgReady = true; };
      bgImg.src = 'assets/images/graffiti-banner.jpg';
    }
    // SVG fallbacks — used automatically when PNG sprites haven't loaded
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
    // PNG sprite frames — take priority over SVGs once at least one frame loads
    if (!skaterRunFrames.length) {
      skaterRunFrames = loadFrameArray(SKATER_RUN_SRCS, function (frames) {
        skaterRunReady = frames.some(function (f) { return f.naturalWidth > 0; });
      });
    }
    if (!skaterJumpFrames.length) {
      skaterJumpFrames = loadFrameArray(SKATER_JUMP_SRCS, function (frames) {
        skaterJumpReady = frames.some(function (f) { return f.naturalWidth > 0; });
      });
    }
    if (!copPigFrames.length) {
      copPigFrames = loadFrameArray(COP_SRCS, function (frames) {
        copPigReady = frames.some(function (f) { return f.naturalWidth > 0; });
      });
    }
    if (!donutDangerImg) {
      donutDangerImg = new Image();
      donutDangerImg.onload = function () { donutDangerReady = true; };
      donutDangerImg.src = 'assets/images/donut-danger.svg';
    }
    if (!donutSafeImg) {
      donutSafeImg = new Image();
      donutSafeImg.onload = function () { donutSafeReady = true; };
      donutSafeImg.src = 'assets/images/donut-safe.svg';
    }
  }

  function drawBg() {
    if (bgReady) {
      ctx.drawImage(bgImg, 0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
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
  function pickFrame(pngFrames, pngReady, fallbackImg, fallbackReady, frameIdx) {
    if (pngReady && pngFrames.length) {
      var f = pngFrames[frameIdx % pngFrames.length];
      if (f && f.naturalWidth > 0) return f;
    }
    return fallbackReady ? fallbackImg : null;
  }

  function drawPlayer() {
    const px = P.x, py = P.y;
    const sh = Math.round(H * 0.22), sw = Math.round(sh * 64 / 88);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(px, groundY + 4, sw * 0.42, 4, 0, 0, Math.PI * 2); ctx.fill();

    const img = P.grounded
      ? pickFrame(skaterRunFrames,  skaterRunReady,  skaterImg, skaterReady, skaterAnimFrame)
      : pickFrame(skaterJumpFrames, skaterJumpReady, skaterImg, skaterReady, skaterAnimFrame);

    if (img) {
      if (!P.grounded) {
        ctx.translate(px, py); ctx.rotate(-0.15);
        ctx.drawImage(img, -sw / 2, -sh, sw, sh);
      } else {
        ctx.drawImage(img, px - sw / 2, py - sh, sw, sh);
      }
    }
    ctx.restore();
  }

  /* ---- villain ---- */
  function drawCopPig() {
    const cx = W - Math.max(50, Math.round(W * 0.09)), cy = groundY;
    const sh = Math.round(H * 0.22), sw = Math.round(sh * 90 / 135);
    const drawX = cx - 48 * (sw / 80);
    const drawY = cy - 117 * (sh / 120);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx + 5, cy + 4, sw * 0.42, 5, 0, 0, Math.PI * 2); ctx.fill();

    const img = pickFrame(copPigFrames, copPigReady, copImg, copReady, copAnimFrame);
    if (img) {
      const bounceY = copShooting > 0 ? -4 : 0;
      ctx.drawImage(img, drawX, drawY + bounceY, sw, sh);
    }
    ctx.restore();
  }

  /* ---- donuts at varied heights ---- */
  // safe=true → donut flies above standing skater (gold icing — don't jump!)
  const SHOT_HEIGHTS = [0, 28, 50, 75];  // 75 clears the standing player's head

  function shoot() {
    const h = SHOT_HEIGHTS[Math.floor(Math.random() * SHOT_HEIGHTS.length)];
    const safe = h >= 70;
    shots.push({
      x: W - Math.max(60, Math.round(W * 0.115)),
      y: groundY - Math.round(h * (H / 260)),
      vx: -spd,
      r: Math.round(12 * (H / 260)),
      rot: 0,
      rotSpd: (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 5),
      scored: false,
      safe,
    });
    copShooting = 0.25;
  }

  function drawShot(s) {
    const img = s.safe ? donutSafeImg : donutDangerImg;
    const ready = s.safe ? donutSafeReady : donutDangerReady;
    const d = s.r * 2.1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    if (ready) {
      ctx.drawImage(img, -d / 2, -d / 2, d, d);
    } else {
      ctx.fillStyle = '#c87941';
      ctx.beginPath(); ctx.arc(0, 0, s.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(10,10,20,0.85)';
      ctx.beginPath(); ctx.arc(0, 0, s.r * 0.38, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* ---- collision ---- */
  function hitsPlayer(x, y, r) {
    const hh = Math.round(50 * (H / 260));
    const hw = Math.round(14 * (H / 260));
    const cy = P.y - hh / 2;
    // circle vs AABB
    const nearX = Math.max(P.x - hw, Math.min(x, P.x + hw));
    const nearY = Math.max(cy - hh / 2, Math.min(y, cy + hh / 2));
    return Math.hypot(x - nearX, y - nearY) < r;
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
    ctx.fillText(String(score).padStart(5,'0'), W - 10, 8);
    ctx.font = '10px Arial'; ctx.fillStyle = '#bbb';
    ctx.fillText('SCORE', W - 10, 28);
    ctx.fillStyle = '#ffee00'; ctx.font = 'bold 13px "Bebas Neue",sans-serif';
    ctx.fillText('HI ' + String(hiScore).padStart(5,'0'), W - 10, 40);

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
    ctx.fillText('GAME OVER', W/2, H/2 - 48);
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
    levelTimer = 0; shootTimer = 0;
    shots = []; particles = [];
    copShooting = 0;
    skaterAnimTimer = 0; skaterAnimFrame = 0;
    P.y = groundY; P.vy = 0; P.grounded = true; P.frameTimer = 0;
    hiScore = parseInt(localStorage.getItem('skaterHiScore') || '0', 10);
    groundOff = 0;
  }

  function resize() {
    // Lock internal resolution — CSS scales the display with letterboxing
    canvas.width  = GAME_W;
    canvas.height = GAME_H;
    W = GAME_W;
    H = GAME_H;
    groundY = H - Math.round(H * 0.15);
    P.x = Math.round(W * 0.115);
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
      levelTimer += dt;
      shootTimer += dt;

      if (copShooting > 0) copShooting -= dt;

      // player physics
      P.vy += GRAV * dt; P.y += P.vy * dt; P.frameTimer += dt;
      if (P.y >= groundY) { P.y = groundY; P.vy = 0; P.grounded = true; }

      // shoot donuts
      const shootInterval = Math.max(SHOOT_MIN, BASE_SHOOT - (level - 1) * 0.18);
      if (shootTimer >= shootInterval) { shoot(); shootTimer = 0; }

      // level up
      if (levelTimer >= LEVEL_EVERY) {
        levelTimer = 0; level++; spd = BASE_SPD + (level - 1) * SPD_STEP;
      }

      // move shots (straight, no gravity)
      for (const s of shots) {
        s.x += s.vx * dt;
        s.rot += s.rotSpd * dt;
      }
      shots = shots.filter(s => s.x > -40);
      for (const s of shots) {
        if (!s.scored && s.x + s.r < P.x - P.w / 2) { s.scored = true; score++; }
      }

      // collision
      let dead = false;
      for (const s of shots) { if (hitsPlayer(s.x, s.y, s.r * 0.82)) { dead = true; break; } }
      if (dead) {
        gameState = 'dead'; burst();
        if (score > hiScore) { hiScore = score; localStorage.setItem('skaterHiScore', hiScore); }
      }

      updateParticles(dt);

      // advance skater animation
      const skateFps = P.grounded ? SKATER_RUN_FPS : SKATER_JUMP_FPS;
      skaterAnimTimer += dt;
      if (skaterAnimTimer >= 1 / skateFps) {
        skaterAnimTimer -= 1 / skateFps;
        skaterAnimFrame++;
      }
    }

    // cop pig animates continuously (always visible)
    copAnimTimer += dt;
    if (copAnimTimer >= 1 / COP_FPS) {
      copAnimTimer -= 1 / COP_FPS;
      copAnimFrame++;
    }

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
