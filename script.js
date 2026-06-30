/* ═══════════════════════════════════════
   PAGE SWITCHING
═══════════════════════════════════════ */
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

/* ═══════════════════════════════════════
   MENU FILTER
═══════════════════════════════════════ */
function filterMenu(btn) {
  const filter = btn.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.menu-section').forEach(section => {
    section.classList.toggle('hidden', filter !== 'all' && section.dataset.category !== filter);
  });
}

/* ═══════════════════════════════════════
   INTERSECTION OBSERVER — fade-in on scroll
═══════════════════════════════════════ */
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

/* ═══════════════════════════════════════
   COCKTAIL BLAST - GAME
═══════════════════════════════════════ */
(function () {
  'use strict';

  const SPEED_UP_EVERY = 15;   // seconds between each speed increase
  const BASE_SPEED     = 220;  // px/s starting speed
  const SPEED_STEP     = 70;   // px/s added per level

  let canvas, ctx;
  let gameState = 'idle'; // 'idle' | 'playing' | 'over'
  let score = 0, hiScore = 0;
  let gameTime = 0, bestTime = 0; // seconds survived
  let balls = [], particles = [];
  let rafId = null, lastTs = 0;
  let spawnAccum = 0, timerHandle = null;
  const SPAWN_GAP = 1400; // ms — constant throughout
  let ballSpd = BASE_SPEED;
  let speedLevel = 0;
  let pendingSpeedUp = false; // waiting for screen to clear before bumping speed
  let speedUpFlash = 0;       // seconds remaining on "SPEED UP!" banner
  let groundY = 200;

  const P = {
    x: 90, y: 0, w: 34, h: 50,
    vy: 0, grounded: true,
    JUMP: -580, GRAV: 1300,
    legFrame: 0, legTimer: 0,
    dead: false
  };

  function pTop() { return groundY - P.h; }

  window.initGame = function () {
    if (!canvas) {
      canvas = document.getElementById('gameCanvas');
      ctx    = canvas.getContext('2d');
      window.addEventListener('resize', resize);
      document.addEventListener('keydown', onKey);
      canvas.addEventListener('pointerdown', onPointer);
    }
    resize();
    if (!rafId) draw();
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  || canvas.offsetWidth  || 780;
    canvas.height = rect.height || canvas.offsetHeight || 240;
    groundY = canvas.height - 32;
    if (gameState !== 'playing') P.y = pTop();
  }

  function onKey(e) {
    const gp = document.getElementById('page-game');
    if (!gp || !gp.classList.contains('active')) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); act(); }
  }
  function onPointer(e) { e.preventDefault(); act(); }

  function act() {
    if (gameState === 'idle' || gameState === 'over') { startGame(); return; }
    if (!P.dead && P.grounded) { P.vy = P.JUMP; P.grounded = false; }
  }

  function startGame() {
    score = 0; gameTime = 0;
    balls = []; particles = [];
    spawnAccum = 0;
    ballSpd = BASE_SPEED; speedLevel = 0;
    pendingSpeedUp = false; speedUpFlash = 0;
    P.y = pTop(); P.vy = 0; P.grounded = true; P.dead = false;
    gameState = 'playing';

    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      if (gameState !== 'playing') return;
      gameTime++;
      // Schedule a speed up every N seconds (only one pending at a time)
      if (gameTime % SPEED_UP_EVERY === 0 && !pendingSpeedUp) {
        pendingSpeedUp = true;
        // Stop spawning immediately — update() will resume once screen clears
      }
    }, 1000);

    if (!rafId) { lastTs = performance.now(); rafId = requestAnimationFrame(loop); }
  }

  function endGame() {
    gameState = 'over';
    if (score    > hiScore)   hiScore   = score;
    if (gameTime > bestTime)  bestTime  = gameTime;
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  function loop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    if (gameState === 'playing') update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    // Speed up: apply once every ball from the previous wave has left
    if (pendingSpeedUp && balls.length === 0) {
      speedLevel++;
      ballSpd    = BASE_SPEED + speedLevel * SPEED_STEP;
      pendingSpeedUp = false;
      speedUpFlash   = 1.8;
      spawnAccum     = 0; // fresh gap before first ball of new wave
    }

    // Only spawn when not waiting for the screen to clear
    if (!pendingSpeedUp) {
      spawnAccum += dt * 1000;
      if (spawnAccum >= SPAWN_GAP) { spawnAccum -= SPAWN_GAP; spawnBall(); }
    }

    if (speedUpFlash > 0) speedUpFlash -= dt;

    // Player physics
    if (!P.grounded) { P.vy += P.GRAV * dt; P.y += P.vy * dt; }
    if (P.y >= pTop()) { P.y = pTop(); P.vy = 0; P.grounded = true; }
    if (P.grounded) {
      P.legTimer += dt;
      if (P.legTimer > 0.09) { P.legFrame ^= 1; P.legTimer = 0; }
    }

    // Particles
    particles = particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 420 * dt; p.life -= dt;
      return p.life > 0;
    });

    // Balls
    const px = P.x + P.w / 2, py = P.y + P.h / 2;
    let hit = false;
    balls = balls.filter(b => {
      b.x -= b.spd * dt;

      // Collision
      if (!hit && Math.hypot(px - b.x, py - b.y) < b.r + 10) {
        hit = true;
        deathBurst();
        P.dead = true;
        return false;
      }

      // Ball cleared the player — avoided
      if (b.x + b.r < P.x) { score++; return false; }

      return b.x + b.r > -10;
    });

    if (hit) endGame();
  }

  function spawnBall() {
    const JUMP_H = 145;
    const fracs  = [0, 0, 0, 0.45, 0.85];
    const frac   = fracs[Math.floor(Math.random() * fracs.length)];
    const r      = 13 + Math.random() * 10;
    const COLS   = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF922B', '#F59AE8', '#ffffff'];
    balls.push({
      x:    canvas.width + r + 10,
      y:    groundY - r - frac * JUMP_H,
      r,
      color: COLS[Math.floor(Math.random() * COLS.length)],
      spd:  ballSpd   // uniform speed — no random variance
    });
  }

  function deathBurst() {
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i / 14) + Math.random() * 0.3;
      const s = 90 + Math.random() * 130;
      particles.push({
        x: P.x + P.w / 2, y: P.y + P.h / 2,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80,
        color: i % 2 === 0 ? '#E8215A' : '#FFD93D',
        r: 4 + Math.random() * 5, life: 0.6 + Math.random() * 0.3
      });
    }
  }

  /* ── Drawing ── */
  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0e0016'); bg.addColorStop(1, '#26002e');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Ground
    ctx.fillStyle = '#E8215A';
    ctx.fillRect(0, groundY, W, 3);
    const gl = ctx.createLinearGradient(0, groundY, 0, H);
    gl.addColorStop(0, 'rgba(232,33,90,0.2)'); gl.addColorStop(1, 'transparent');
    ctx.fillStyle = gl; ctx.fillRect(0, groundY + 3, W, H - groundY - 3);

    // Particles
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life * 2.2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // Balls
    balls.forEach(b => {
      ctx.save();
      ctx.shadowColor = b.color; ctx.shadowBlur = 18;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    if (gameState !== 'over' || !P.dead || particles.length > 0) drawPlayer();

    if (gameState !== 'idle') drawHUD();
    if (gameState === 'idle') drawIdle();
    if (gameState === 'over') drawOver();

    // Speed-up flash banner (shown during play and briefly after)
    if (speedUpFlash > 0 && gameState === 'playing') drawSpeedUpBanner();
  }

  function drawPlayer() {
    const x = Math.round(P.x), y = Math.round(P.y), w = P.w, h = P.h;
    const la     = P.grounded ? (P.legFrame ? 9 : -9) : 5;
    const scared = !P.dead && balls.some(b => b.x - (x + w) < 110 && b.x > x);
    ctx.save();

    if (P.grounded) {
      ctx.fillStyle = 'rgba(232,33,90,0.22)';
      ctx.beginPath(); ctx.ellipse(x + w / 2, groundY + 3, w * 0.55, 4, 0, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#A01038';
    ctx.fillRect(x + 6,    y + h - 18, 10, 20 + la);
    ctx.fillRect(x + w-16, y + h - 18, 10, 20 - la + 4);

    ctx.fillStyle = '#111';
    ctx.fillRect(x + 3,    y + h + Math.max(la, 0) + 2, 16, 6);
    ctx.fillRect(x + w-19, y + h - Math.min(la, 0) + 6, 16, 6);

    ctx.fillStyle = '#E8215A';
    ctx.fillRect(x + 3, y + 20, w - 6, h - 34);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px "Bebas Neue",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('V', x + w / 2, y + 38);

    ctx.fillStyle = '#E8215A';
    if (scared) {
      ctx.fillRect(x - 8, y + 12, 8, 10);
      ctx.fillRect(x + w, y + 12, 8, 10);
    } else {
      ctx.fillRect(x - 5, y + 22, 8, P.grounded ? 13 - la / 2 : 10);
      ctx.fillRect(x + w - 3, y + 22, 8, P.grounded ? 13 + la / 2 : 10);
    }

    ctx.fillStyle = '#ffc89a';
    ctx.beginPath(); ctx.arc(x + w / 2, y + 11, 12, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(x + w / 2, y + 3, 9, Math.PI, 0); ctx.fill();

    ctx.fillStyle = '#111';
    if (P.dead) {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      [[x + w/2 - 6, y + 9], [x + w/2 + 5, y + 9]].forEach(([ex, ey]) => {
        ctx.beginPath(); ctx.moveTo(ex-3, ey-3); ctx.lineTo(ex+3, ey+3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex+3, ey-3); ctx.lineTo(ex-3, ey+3); ctx.stroke();
      });
    } else if (scared) {
      ctx.beginPath(); ctx.arc(x + w/2 - 4, y + 10, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w/2 + 5, y + 10, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + w/2 - 3, y + 9, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w/2 + 6, y + 9, 1.2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(x + w/2 + 5, y + 10, 2.2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.lineWidth = 1.8;
    if (P.dead || scared) {
      ctx.strokeStyle = '#c0392b';
      ctx.beginPath(); ctx.arc(x + w/2 + 3, y + 19, 3.5, Math.PI, 0, true); ctx.stroke();
    } else {
      ctx.strokeStyle = '#8B4513';
      ctx.beginPath(); ctx.arc(x + w/2 + 4, y + 16, 3, 0.1, Math.PI - 0.1); ctx.stroke();
    }

    ctx.restore();
  }

  function fmtTime(s) {
    if (s < 60) return s + 's';
    return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  }

  function drawHUD() {
    ctx.save();
    ctx.font = '22px "Bebas Neue",sans-serif';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText('AVOIDED: ' + score, 14, 10);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD93D';
    ctx.fillText(fmtTime(gameTime), canvas.width / 2, 10);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('BEST: ' + hiScore, canvas.width - 14, 10);
    ctx.restore();
  }

  function drawSpeedUpBanner() {
    const alpha = Math.min(1, speedUpFlash / 0.4); // fade in quickly, hold, fade out
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, canvas.height / 2 - 36, canvas.width, 52);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD93D';
    ctx.font = '38px "Bebas Neue",sans-serif';
    ctx.shadowColor = '#FFD93D'; ctx.shadowBlur = 20;
    ctx.fillText('SPEED UP!  LVL ' + speedLevel, canvas.width / 2, canvas.height / 2 - 10);
    ctx.restore();
  }

  function drawIdle() {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cy = canvas.height / 2;
    ctx.fillStyle = '#E8215A';
    ctx.font = '40px "Bebas Neue",sans-serif';
    ctx.fillText('COCKTAIL BLAST', canvas.width / 2, cy - 22);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '18px "Bebas Neue",sans-serif';
    ctx.fillText('JUMP OVER THE BALLS  -  ONE HIT AND YOU\'RE OUT', canvas.width / 2, cy + 10);
    ctx.fillStyle = '#FFD93D';
    ctx.font = '16px "Bebas Neue",sans-serif';
    ctx.fillText('PRESS SPACE OR TAP TO START', canvas.width / 2, cy + 34);
    ctx.restore();
  }

  function drawOver() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cy = canvas.height / 2;

    ctx.fillStyle = '#E8215A';
    ctx.font = '50px "Bebas Neue",sans-serif';
    ctx.fillText('GAME OVER', canvas.width / 2, cy - 46);

    ctx.fillStyle = '#FFD93D';
    ctx.font = '26px "Bebas Neue",sans-serif';
    ctx.fillText('BALLS AVOIDED: ' + score + '   |   SURVIVED: ' + fmtTime(gameTime), canvas.width / 2, cy + 2);

    const isHi = score > 0 && score === hiScore;
    ctx.fillStyle = isHi ? '#6BCB77' : 'rgba(255,255,255,0.5)';
    ctx.font = '19px "Bebas Neue",sans-serif';
    ctx.fillText(isHi ? 'NEW HIGH SCORE!' : 'BEST: ' + hiScore + ' avoided  /  ' + fmtTime(bestTime) + ' survived', canvas.width / 2, cy + 36);

    ctx.fillStyle = '#fff';
    ctx.font = '17px "Bebas Neue",sans-serif';
    ctx.fillText('TAP OR PRESS SPACE TO PLAY AGAIN', canvas.width / 2, cy + 64);
    ctx.restore();
  }
})();

/* ═══════════════════════════════════════
   TODO: Google Places API (μελλοντικά)
   ─────────────────────────────────────
   Όταν έχεις Place ID + API Key:
   1. Πρόσθεσε τα εδώ:
        const GOOGLE_PLACE_ID = 'ChIJ...';
        const GOOGLE_API_KEY  = 'AIzaSy...';
   2. Ενεργοποίησε "Places API (New)" στο Google Cloud Console
   3. Η αξιολόγηση θα τραβάει αυτόματα τα πραγματικά reviews
      και το κουμπί θα ανοίγει απευθείας το write-review dialog:
        https://search.google.com/local/writereview?placeid=PLACE_ID
═══════════════════════════════════════ */
