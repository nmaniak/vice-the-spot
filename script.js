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
   COCKTAIL BLAST – GAME
═══════════════════════════════════════ */
(function () {
  'use strict';

  const DURATION = 60;

  let canvas, ctx;
  let gameState = 'idle'; // 'idle' | 'playing' | 'over'
  let score = 0, hiScore = 0;
  let timeLeft = DURATION;
  let balls = [], particles = [];
  let rafId = null, lastTs = 0;
  let spawnAccum = 0, timerHandle = null;
  let spawnGap = 1400, ballSpd = 220;
  let groundY = 200;

  const P = {
    x: 90, y: 0, w: 34, h: 50,
    vy: 0, grounded: true,
    JUMP: -580, GRAV: 1300,
    legFrame: 0, legTimer: 0
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
    P.y = pTop();
  }

  function onKey(e) {
    const gp = document.getElementById('page-game');
    if (!gp || !gp.classList.contains('active')) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); act(); }
  }
  function onPointer(e) { e.preventDefault(); act(); }

  function act() {
    if (gameState === 'idle' || gameState === 'over') { startGame(); return; }
    if (P.grounded) { P.vy = P.JUMP; P.grounded = false; }
  }

  function startGame() {
    score = 0; timeLeft = DURATION;
    balls = []; particles = [];
    spawnAccum = 0; spawnGap = 1400; ballSpd = 220;
    P.y = pTop(); P.vy = 0; P.grounded = true;
    gameState = 'playing';

    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      timeLeft = Math.max(0, timeLeft - 1);
      const elapsed = DURATION - timeLeft;
      spawnGap = Math.max(350, 1400 - elapsed * 17);
      ballSpd  = 220 + elapsed * 5;
      if (timeLeft === 0) { clearInterval(timerHandle); endGame(); }
    }, 1000);

    if (!rafId) { lastTs = performance.now(); rafId = requestAnimationFrame(loop); }
  }

  function endGame() {
    gameState = 'over';
    if (score > hiScore) hiScore = score;
  }

  function loop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    if (gameState === 'playing') update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    spawnAccum += dt * 1000;
    if (spawnAccum >= spawnGap) { spawnAccum -= spawnGap; spawnBall(); }

    if (!P.grounded) { P.vy += P.GRAV * dt; P.y += P.vy * dt; }
    if (P.y >= pTop()) { P.y = pTop(); P.vy = 0; P.grounded = true; }

    if (P.grounded) {
      P.legTimer += dt;
      if (P.legTimer > 0.09) { P.legFrame ^= 1; P.legTimer = 0; }
    }

    const px = P.x + P.w / 2, py = P.y + P.h / 2;
    balls = balls.filter(b => {
      b.x -= b.spd * dt;
      if (Math.hypot(px - b.x, py - b.y) < b.r + 14) { score++; burst(b); return false; }
      return b.x + b.r > -10;
    });

    particles = particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 420 * dt; p.life -= dt;
      return p.life > 0;
    });
  }

  function spawnBall() {
    const JUMP_H = 145;
    const fracs  = [0, 0, 0.45, 0.85];
    const frac   = fracs[Math.floor(Math.random() * fracs.length)];
    const r      = 13 + Math.random() * 10;
    const COLS   = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF922B','#F59AE8','#ffffff'];
    balls.push({
      x:   canvas.width + r + 10,
      y:   groundY - r - frac * JUMP_H,
      r,
      color: COLS[Math.floor(Math.random() * COLS.length)],
      spd: ballSpd * (0.8 + Math.random() * 0.4)
    });
  }

  function burst(b) {
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i / 10) + Math.random() * 0.4;
      const s = 70 + Math.random() * 110;
      particles.push({ x: b.x, y: b.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 50,
                       color: b.color, r: 3 + Math.random()*4, life: 0.5 + Math.random()*0.25 });
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
    ctx.fillStyle = gl; ctx.fillRect(0, groundY+3, W, H - groundY - 3);

    // Particles
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life * 2.2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });

    // Balls
    balls.forEach(b => {
      ctx.save();
      ctx.shadowColor = b.color; ctx.shadowBlur = 18;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.beginPath(); ctx.arc(b.x - b.r*0.3, b.y - b.r*0.3, b.r*0.38, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });

    drawPlayer();

    if (gameState !== 'idle') drawHUD();
    if (gameState === 'idle')  drawIdle();
    if (gameState === 'over')  drawOver();
  }

  function drawPlayer() {
    const x = Math.round(P.x), y = Math.round(P.y), w = P.w, h = P.h;
    const la = P.grounded ? (P.legFrame ? 9 : -9) : 5;
    ctx.save();

    // Ground shadow
    if (P.grounded) {
      ctx.fillStyle = 'rgba(232,33,90,0.22)';
      ctx.beginPath(); ctx.ellipse(x+w/2, groundY+3, w*0.55, 4, 0, 0, Math.PI*2); ctx.fill();
    }

    // Legs
    ctx.fillStyle = '#A01038';
    ctx.fillRect(x+6,  y+h-18, 10, 20 + la);
    ctx.fillRect(x+w-16, y+h-18, 10, 20 - la + 4);

    // Shoes
    ctx.fillStyle = '#111';
    ctx.fillRect(x+3,   y+h+Math.max(la,0)+2, 16, 6);
    ctx.fillRect(x+w-19, y+h-Math.min(la,0)+6, 16, 6);

    // Body
    ctx.fillStyle = '#E8215A';
    ctx.fillRect(x+3, y+20, w-6, h-34);

    // V logo
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px "Bebas Neue",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('V', x+w/2, y+38);

    // Arms
    ctx.fillStyle = '#E8215A';
    ctx.fillRect(x-5, y+22, 8, P.grounded ? 13-la/2 : 10);
    ctx.fillRect(x+w-3, y+22, 8, P.grounded ? 13+la/2 : 10);

    // Head
    ctx.fillStyle = '#ffc89a';
    ctx.beginPath(); ctx.arc(x+w/2, y+11, 12, 0, Math.PI*2); ctx.fill();

    // Hair
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(x+w/2, y+3, 9, Math.PI, 0); ctx.fill();

    // Eye
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(x+w/2+5, y+10, 2.2, 0, Math.PI*2); ctx.fill();

    // Mouth — open when ball is near
    const near = balls.some(b => b.x - (x+w) < 90 && b.x - (x+w) > -20);
    if (near) {
      ctx.fillStyle = '#8B0000';
      ctx.beginPath(); ctx.arc(x+w/2+4, y+16, 4, 0, Math.PI); ctx.fill();
    } else {
      ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(x+w/2+4, y+16, 3, 0.1, Math.PI-0.1); ctx.stroke();
    }

    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    ctx.font = '22px "Bebas Neue",sans-serif';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + score, 14, 10);

    ctx.textAlign = 'center';
    ctx.fillStyle = timeLeft <= 10 ? '#FF6B6B' : '#FFD93D';
    ctx.fillText(timeLeft + 's', canvas.width / 2, 10);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('BEST: ' + hiScore, canvas.width - 14, 10);
    ctx.restore();
  }

  function drawIdle() {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cy = canvas.height / 2;
    ctx.fillStyle = '#E8215A';
    ctx.font = '40px "Bebas Neue",sans-serif';
    ctx.fillText('COCKTAIL BLAST', canvas.width/2, cy - 22);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '18px "Bebas Neue",sans-serif';
    ctx.fillText('JUMP AND EAT AS MANY BALLS AS POSSIBLE IN 60 SECONDS', canvas.width/2, cy + 10);
    ctx.fillStyle = '#FFD93D';
    ctx.font = '16px "Bebas Neue",sans-serif';
    ctx.fillText('PRESS SPACE OR TAP TO START', canvas.width/2, cy + 34);
    ctx.restore();
  }

  function drawOver() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cy = canvas.height / 2;

    ctx.fillStyle = '#E8215A';
    ctx.font = '48px "Bebas Neue",sans-serif';
    ctx.fillText("TIME'S UP!", canvas.width/2, cy - 44);

    ctx.fillStyle = '#FFD93D';
    ctx.font = '30px "Bebas Neue",sans-serif';
    ctx.fillText('BALLS EATEN: ' + score, canvas.width/2, cy + 2);

    const isHi = score > 0 && score === hiScore;
    ctx.fillStyle = isHi ? '#6BCB77' : 'rgba(255,255,255,0.5)';
    ctx.font = '20px "Bebas Neue",sans-serif';
    ctx.fillText(isHi ? 'NEW HIGH SCORE!' : 'BEST: ' + hiScore, canvas.width/2, cy + 36);

    ctx.fillStyle = '#fff';
    ctx.font = '17px "Bebas Neue",sans-serif';
    ctx.fillText('TAP OR PRESS SPACE TO PLAY AGAIN', canvas.width/2, cy + 64);
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
