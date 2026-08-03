(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const comboEl = document.getElementById("combo");
  const curtain = document.getElementById("curtain");
  const playBtn = document.getElementById("play");
  const dropBtn = document.getElementById("drop");
  const pauseBtn = document.getElementById("pause");
  const restartBtn = document.getElementById("restart");

  const W = 900;
  const H = 1200;
  const slabH = 58;
  const bestKey = "stack-snap-best";
  const colors = ["#f7c85b", "#8b5cf6", "#22c55e", "#ef4444"];
  const poki = window.PokiSDK || null;

  let state;
  let rafId = 0;
  let last = 0;

  function reset() {
    const base = {
      x: W / 2 - 245,
      y: H - 118,
      w: 490,
      dir: 0,
      color: colors[0],
      settled: true
    };

    curtain.querySelector(".label").textContent = "Quick arcade prototype";
    curtain.querySelector("h2").textContent = "Color Stack";
    curtain.querySelector("p:not(.label)").textContent = "Tap when the moving slab lines up. Edge catches still count, but a block that falls completely off the stack ends the run.";
    playBtn.textContent = "Play";

    state = {
      running: false,
      paused: false,
      over: false,
      score: 0,
      combo: 1,
      best: Number(localStorage.getItem(bestKey) || 0),
      speed: 255,
      cameraY: 0,
      shake: 0,
      message: "Tap to drop",
      messageT: 1.8,
      stack: [base],
      chips: [],
      stars: [],
      active: null
    };

    spawnSlab();
    syncHud();
    pauseBtn.textContent = "Pause";
  }

  function spawnSlab() {
    const top = state.stack[state.stack.length - 1];
    const fromLeft = state.stack.length % 2 === 0;
    state.active = {
      x: state.stack.length === 1 ? top.x : fromLeft ? -top.w - 30 : W + 30,
      y: top.y - slabH,
      w: top.w,
      dir: fromLeft ? 1 : -1,
      color: colors[state.stack.length % colors.length],
      settled: false
    };
  }

  function start() {
    if (poki && poki.gameplayStart) poki.gameplayStart();
    state.running = true;
    state.paused = false;
    state.over = false;
    curtain.classList.add("hidden");
    last = performance.now();
  }

  function gameOver() {
    state.running = false;
    state.over = true;
    state.shake = 18;
    state.message = "Off the edge";
    state.messageT = 2;
    curtain.classList.remove("hidden");
    curtain.querySelector(".label").textContent = "Final score " + state.score;
    curtain.querySelector("h2").textContent = "Try Again";
    curtain.querySelector("p:not(.label)").textContent = "You only lose when a block misses the stack completely. Catch even a tiny edge to keep climbing.";
    playBtn.textContent = "Restart";
    if (poki && poki.gameplayStop) poki.gameplayStop();
  }

  function drop() {
    if (!state.running) {
      start();
      return;
    }
    if (state.paused || state.over) return;

    const active = state.active;
    const top = state.stack[state.stack.length - 1];
    const left = Math.max(active.x, top.x);
    const right = Math.min(active.x + active.w, top.x + top.w);
    const overlap = right - left;

    if (overlap <= 0) {
      state.chips.push(makeChip(active.x, active.y, active.w, active.color, active.dir));
      gameOver();
      return;
    }

    const missLeft = active.x < top.x ? active.x : right;
    const missW = active.w - overlap;
    if (missW > 2) {
      state.chips.push(makeChip(missLeft, active.y, missW, active.color, active.dir));
    }

    const perfect = Math.abs(active.x - top.x) <= 10;
    const bonus = perfect ? Math.min(18, 3 + state.combo * 2) : 0;
    const placed = {
      x: clamp(left - bonus / 2, 24, W - overlap - bonus - 24),
      y: active.y,
      w: Math.min(top.w + 22, overlap + bonus),
      dir: 0,
      color: active.color,
      settled: true,
      perfect
    };

    state.stack.push(placed);
    state.score += perfect ? 10 * state.combo : 4 + Math.ceil(overlap / 34);
    state.combo = perfect ? Math.min(9, state.combo + 1) : 1;
    state.speed = Math.min(640, state.speed + 11 + state.combo * 1.5);
    state.message = perfect ? "Perfect +" + state.combo : "Nice";
    state.messageT = 0.75;
    burst(placed.x + placed.w / 2, placed.y + slabH / 2, perfect ? state.combo + 7 : 5, placed.color);
    spawnSlab();
    saveBest();
    syncHud();
  }

  function makeChip(x, y, w, color, dir) {
    return {
      x,
      y,
      w,
      h: slabH,
      color,
      vx: dir * (80 + Math.random() * 120),
      vy: -110,
      rot: 0,
      vr: dir * (1.8 + Math.random() * 1.7)
    };
  }

  function burst(x, y, count, color) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 210;
      state.stars.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.35,
        color
      });
    }
  }

  function togglePause() {
    if (!state.running || state.over) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    state.message = state.paused ? "Paused" : "Stack";
    state.messageT = 1;
  }

  function saveBest() {
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem(bestKey, String(state.best));
    }
  }

  function syncHud() {
    scoreEl.textContent = state.score;
    bestEl.textContent = state.best;
    comboEl.textContent = "x" + state.combo;
  }

  function update(dt) {
    if (!state.paused && state.running && !state.over) {
      const active = state.active;
      active.x += active.dir * state.speed * dt;
      if (active.x <= 0) {
        active.x = 0;
        active.dir = 1;
      }
      if (active.x + active.w >= W) {
        active.x = W - active.w;
        active.dir = -1;
      }
    }

    const targetCamera = Math.max(0, H - 380 - state.active.y);
    state.cameraY += (targetCamera - state.cameraY) * Math.min(1, dt * 5.5);
    state.messageT = Math.max(0, state.messageT - dt);
    state.shake = Math.max(0, state.shake - dt * 38);

    state.chips.forEach((chip) => {
      chip.vy += 860 * dt;
      chip.x += chip.vx * dt;
      chip.y += chip.vy * dt;
      chip.rot += chip.vr * dt;
    });
    state.chips = state.chips.filter((chip) => chip.y - state.cameraY < H + 180);

    state.stars.forEach((star) => {
      star.life -= dt;
      star.vy += 160 * dt;
      star.x += star.vx * dt;
      star.y += star.vy * dt;
    });
    state.stars = state.stars.filter((star) => star.life > 0);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackdrop();

    const sx = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    const sy = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    ctx.save();
    ctx.translate(sx, sy + state.cameraY);

    state.stack.forEach(drawSlab);
    if (state.active) drawSlab(state.active);
    state.chips.forEach(drawChip);
    state.stars.forEach(drawStar);

    ctx.restore();
    drawGuide();
    drawMessage();
  }

  function drawBackdrop() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#222a40");
    grad.addColorStop(0.58, "#141824");
    grad.addColorStop(1, "#0b0d13");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    for (let y = 120 - (state.cameraY % 120); y < H; y += 120) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSlab(slab) {
    const y = slab.y;
    ctx.save();
    roundRect(slab.x, y, slab.w, slabH, 8);
    const grad = ctx.createLinearGradient(slab.x, y, slab.x, y + slabH);
    grad.addColorStop(0, lighten(slab.color, 0.16));
    grad.addColorStop(1, slab.color);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(slab.x + 16, y + 13, Math.max(0, slab.w - 32), 7);
    if (slab.perfect) {
      ctx.strokeStyle = "#f7c85b";
      ctx.lineWidth = 4;
      ctx.strokeRect(slab.x + 4, y + 4, slab.w - 8, slabH - 8);
    }
    ctx.restore();
  }

  function drawChip(chip) {
    ctx.save();
    ctx.translate(chip.x + chip.w / 2, chip.y + chip.h / 2);
    ctx.rotate(chip.rot);
    roundRect(-chip.w / 2, -chip.h / 2, chip.w, chip.h, 8);
    ctx.fillStyle = chip.color;
    ctx.fill();
    ctx.restore();
  }

  function drawStar(star) {
    ctx.globalAlpha = Math.max(0, star.life * 1.8);
    ctx.fillStyle = star.color;
    ctx.beginPath();
    ctx.arc(star.x, star.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawGuide() {
    if (!state.running || state.over || state.paused) return;
    const top = state.stack[state.stack.length - 1];
    const screenY = top.y + state.cameraY;
    ctx.strokeStyle = "rgba(247, 200, 91, 0.7)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 12]);
    ctx.strokeRect(top.x, screenY - slabH, top.w, slabH);
    ctx.setLineDash([]);
  }

  function drawMessage() {
    if (state.messageT <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.messageT * 2);
    ctx.fillStyle = "#f7f4ea";
    ctx.font = "900 54px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 18;
    ctx.fillText(state.message, W / 2, 165);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function lighten(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + 255 * amount);
    const g = Math.min(255, ((n >> 8) & 255) + 255 * amount);
    const b = Math.min(255, (n & 255) + 255 * amount);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.code === "Space" || event.code === "ArrowDown" || event.code === "Enter") {
      event.preventDefault();
      drop();
    }
    if (event.code === "KeyP") togglePause();
    if (event.code === "KeyR") {
      reset();
      start();
    }
  });

  canvas.addEventListener("pointerdown", drop);
  playBtn.addEventListener("click", () => {
    reset();
    start();
  });
  dropBtn.addEventListener("click", drop);
  pauseBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", () => {
    reset();
    start();
  });

  reset();
  resize();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}());
