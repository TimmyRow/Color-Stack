(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const heightEl = document.getElementById("height");
  const comboEl = document.getElementById("combo");
  const goalEl = document.getElementById("goal");
  const walletEl = document.getElementById("wallet");
  const curtain = document.getElementById("curtain");
  const playBtn = document.getElementById("play");
  const dropBtn = document.getElementById("drop");
  const shopBtn = document.getElementById("shop");
  const pauseBtn = document.getElementById("pause");
  const muteBtn = document.getElementById("mute");
  const restartBtn = document.getElementById("restart");
  const shopPanel = document.getElementById("shopPanel");
  const shopCloseBtn = document.getElementById("shopClose");
  const shopCoinsEl = document.getElementById("shopCoins");
  const backgroundShopEl = document.getElementById("backgroundShop");
  const blockShopEl = document.getElementById("blockShop");

  const W = 900;
  const H = 1200;
  const slabH = 58;
  const bestKey = "color-stack-best";
  const bestHeightKey = "color-stack-best-height";
  const coinsKey = "color-stack-coins";
  const missionKey = "color-stack-mission";
  const runsKey = "color-stack-runs";
  const muteKey = "color-stack-muted";
  const backgroundKey = "color-stack-background";
  const blockThemeKey = "color-stack-block-theme";
  const ownedBackgroundsKey = "color-stack-owned-backgrounds";
  const ownedBlocksKey = "color-stack-owned-blocks";
  const defaultColors = ["#f7c85b", "#8b5cf6", "#22c55e", "#ef4444"];
  const rainbowColors = ["#f7c85b", "#8b5cf6", "#ef4444", "#22c55e"];
  const backgrounds = [
    { id: "grid", name: "Arcade Grid", cost: 0, colors: ["#202431", "#141720", "#090b10"], rails: ["#f7c85b", "#8b5cf6"], preview: "linear-gradient(135deg, #202431, #090b10)" },
    { id: "sunset", name: "Sunset Pop", cost: 35, colors: ["#382244", "#21162c", "#140c18"], rails: ["#ef4444", "#f7c85b"], preview: "linear-gradient(135deg, #ef4444, #8b5cf6 58%, #140c18)" },
    { id: "mint", name: "Mint Circuit", cost: 45, colors: ["#12322d", "#0d221f", "#071210"], rails: ["#22c55e", "#f7c85b"], preview: "linear-gradient(135deg, #22c55e, #12322d 52%, #071210)" },
    { id: "royal", name: "Royal Night", cost: 60, colors: ["#201747", "#15102d", "#090815"], rails: ["#8b5cf6", "#ef4444"], preview: "linear-gradient(135deg, #8b5cf6, #201747 54%, #090815)" }
  ];
  const blockThemes = [
    { id: "classic", name: "Classic Stack", cost: 0, colors: defaultColors },
    { id: "candy", name: "Candy Blocks", cost: 40, colors: ["#f9a8d4", "#93c5fd", "#fdba74", "#86efac"] },
    { id: "neon", name: "Neon Blocks", cost: 55, colors: ["#a3e635", "#06b6d4", "#f43f5e", "#c084fc"] },
    { id: "ember", name: "Ember Blocks", cost: 65, colors: ["#facc15", "#fb7185", "#f97316", "#84cc16"] }
  ];
  const missions = [
    { text: "Reach 8 blocks", reward: 12, test: () => state.stack.length >= 8 },
    { text: "Land 3 perfects", reward: 16, test: () => state.perfectRun >= 3 },
    { text: "Score 150", reward: 18, test: () => state.score >= 150 },
    { text: "Land a rainbow", reward: 20, test: () => state.rainbowLanded },
    { text: "Reach 15 blocks", reward: 26, test: () => state.stack.length >= 15 }
  ];

  let state;
  let rafId = 0;
  let last = 0;
  let audioCtx = null;
  const memorySave = {};
  let muted = getSave(muteKey, "0") === "1";
  let adLocked = false;
  let pokiReady = false;
  let gameplayActive = false;
  let audioSuspendedForAd = false;
  let lastTapDrop = 0;
  let activeBackground = getItem(backgrounds, getSave(backgroundKey, "grid"));
  let activeBlockTheme = getItem(blockThemes, getSave(blockThemeKey, "classic"));
  let colors = activeBlockTheme.colors;

  function initPoki() {
    const sdk = getPoki();
    if (!sdk) {
      pokiReady = true;
      return;
    }
    Promise.resolve(sdk.init())
      .catch(() => undefined)
      .then(() => {
        pokiReady = true;
        callPoki("gameLoadingFinished");
        callPoki("movePill", 0, 18);
      });
  }

  function getPoki() {
    return window.PokiSDK || null;
  }

  function getSave(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return Object.prototype.hasOwnProperty.call(memorySave, key) ? memorySave[key] : fallback;
    }
  }

  function setSave(key, value) {
    const stringValue = String(value);
    memorySave[key] = stringValue;
    try {
      window.localStorage.setItem(key, stringValue);
    } catch (error) {
      // Device storage can be unavailable in private/restricted modes.
    }
  }

  function callPoki(method, ...args) {
    const sdk = getPoki();
    if (!sdk || typeof sdk[method] !== "function") return undefined;
    try {
      return sdk[method](...args);
    } catch (error) {
      return undefined;
    }
  }

  function reset() {
    const base = {
      x: W / 2 - 245,
      y: H - 118,
      w: 490,
      dir: 0,
      color: colors[0],
      rainbow: false,
      settled: true
    };

    curtain.querySelector(".label").textContent = "Color Stack";
    curtain.querySelector("h2").textContent = "Color Stack";
    curtain.querySelector("p:not(.label)").textContent = "Stack the colors higher. Land rainbow blocks to widen the tower.";
    playBtn.textContent = "Play";

    state = {
      running: false,
      paused: false,
      over: false,
      score: 0,
      combo: 1,
      perfectRun: 0,
      rainbowLanded: false,
      missionDone: false,
      runCoins: 0,
      coins: Number(getSave(coinsKey, 0)),
      missionIndex: Number(getSave(missionKey, 0)) % missions.length,
      runs: Number(getSave(runsKey, 0)),
      best: Number(getSave(bestKey, getSave("stack-snap-best", 0))),
      bestHeight: Number(getSave(bestHeightKey, 1)),
      speed: 255,
      cameraY: 0,
      shake: 0,
      bump: 0,
      wallFlash: 0,
      rainbowCooldown: 3,
      message: "Tap to drop",
      messageT: 1.8,
      stack: [base],
      chips: [],
      stars: [],
      rings: [],
      floaters: [],
      active: null
    };

    spawnSlab();
    syncHud();
    pauseBtn.textContent = "Pause";
    syncMute();
    renderShop();
  }

  function spawnSlab() {
    const top = state.stack[state.stack.length - 1];
    const fromLeft = state.stack.length % 2 === 0;
    const rainbow = shouldSpawnRainbow();
    state.active = {
      x: state.stack.length === 1 ? top.x : fromLeft ? -top.w - 30 : W + 30,
      y: top.y - slabH,
      w: top.w,
      dir: fromLeft ? 1 : -1,
      color: rainbow ? "#ffffff" : colors[state.stack.length % colors.length],
      rainbow,
      settled: false,
      squash: 0
    };
  }

  function shouldSpawnRainbow() {
    if (state.stack.length < 4 || state.rainbowCooldown > 0) return false;
    const chance = Math.min(0.16, 0.055 + state.stack.length * 0.003);
    return Math.random() < chance;
  }

  function requestStart(resetFirst) {
    if (adLocked) return;
    if (resetFirst) reset();
    if (!pokiReady || !getPoki() || typeof getPoki().commercialBreak !== "function") {
      start();
      return;
    }

    adLocked = true;
    if (state.running && !state.paused) stopGameplay();
    pauseForAd();
    Promise.resolve(callPoki("commercialBreak", pauseForAd))
      .catch(() => undefined)
      .then(() => {
      adLocked = false;
      resumeFromAd();
      start();
    });
  }

  function start() {
    startGameplay();
    state.running = true;
    state.paused = false;
    state.over = false;
    curtain.classList.add("hidden");
    last = performance.now();
    playSound("start");
  }

  function stopGameplay() {
    if (!gameplayActive) return;
    gameplayActive = false;
    callPoki("gameplayStop");
  }

  function startGameplay() {
    if (gameplayActive) return;
    gameplayActive = true;
    callPoki("gameplayStart");
  }

  function pauseForAd() {
    adLocked = true;
    if (audioCtx && audioCtx.state === "running") {
      audioSuspendedForAd = true;
      audioCtx.suspend();
    }
  }

  function resumeFromAd() {
    if (audioSuspendedForAd && audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    audioSuspendedForAd = false;
  }

  function gameOver() {
    state.running = false;
    state.over = true;
    awardRunCoins();
    state.runs += 1;
    setSave(runsKey, state.runs);
    state.shake = 18;
    state.message = "Off the edge";
    state.messageT = 2;
    curtain.classList.remove("hidden");
    curtain.querySelector(".label").textContent = "Final score " + state.score;
    curtain.querySelector("h2").textContent = "Try Again";
    curtain.querySelector("p:not(.label)").textContent = "Final tower: " + state.stack.length + " blocks. Earned " + state.runCoins + " coins. Run " + state.runs + ".";
    playBtn.textContent = "Restart";
    playSound("fail");
    stopGameplay();
    syncHud();
  }

  function drop() {
    unlockAudio();
    if (!state.running) {
      requestStart(state.over);
      return;
    }
    if (state.paused || state.over || adLocked) return;

    const active = state.active;
    const top = state.stack[state.stack.length - 1];
    const left = Math.max(active.x, top.x);
    const right = Math.min(active.x + active.w, top.x + top.w);
    const overlap = right - left;

    if (overlap <= 0) {
      state.chips.push(makeChip(active.x, active.y, active.w, active.color, active.dir, active.rainbow));
      gameOver();
      return;
    }

    const missLeft = active.x < top.x ? active.x : right;
    const missW = active.w - overlap;
    if (missW > 2) {
      state.chips.push(makeChip(missLeft, active.y, missW, active.color, active.dir, active.rainbow));
    }

    const perfect = Math.abs(active.x - top.x) <= 10;
    const bonus = perfect ? Math.min(18, 3 + state.combo * 2) : 0;
    const placed = {
      x: clamp(left - bonus / 2, 24, W - overlap - bonus - 24),
      y: active.y,
      w: Math.min(top.w + 22, overlap + bonus),
      dir: 0,
      color: active.color,
      rainbow: active.rainbow,
      settled: true,
      perfect,
      squash: placedSquash(placedScorePreview(perfect, overlap, active.rainbow))
    };

    state.stack.push(placed);
    if (placed.rainbow) {
      widenTower(56);
      state.rainbowCooldown = 7;
    } else {
      state.rainbowCooldown = Math.max(0, state.rainbowCooldown - 1);
    }
    const gained = placedScorePreview(perfect, overlap, placed.rainbow);
    state.score += gained;
    state.combo = perfect ? Math.min(9, state.combo + 1) : 1;
    state.perfectRun = perfect ? state.perfectRun + 1 : 0;
    if (placed.rainbow) state.rainbowLanded = true;
    state.speed = Math.min(640, state.speed + 11 + state.combo * 1.5);
    state.message = placed.rainbow ? "Rainbow boost" : perfect ? "Perfect +" + state.combo : "Nice";
    state.messageT = placed.rainbow ? 1.05 : 0.75;
    state.bump = placed.rainbow ? 34 : perfect ? 22 : 10;
    state.shake = Math.max(state.shake, placed.rainbow ? 9 : perfect ? 5 : 2);
    burst(placed.x + placed.w / 2, placed.y + slabH / 2, placed.rainbow ? 22 : perfect ? state.combo + 7 : 5, placed.rainbow ? null : placed.color);
    floatScore(placed.x + placed.w / 2, placed.y - 12, "+" + gained, placed.rainbow ? "#fff8e8" : placed.color);
    if (placed.rainbow) {
      state.rings.push({ x: placed.x + placed.w / 2, y: placed.y + slabH / 2, r: 30, life: 0.55 });
    }
    spawnSlab();
    checkMission();
    saveBest();
    syncHud();
    playSound(placed.rainbow ? "rainbow" : perfect ? "perfect" : "drop");
  }

  function placedScorePreview(perfect, overlap, rainbow) {
    return (perfect ? 10 * state.combo : 4 + Math.ceil(overlap / 34)) + (rainbow ? 25 : 0);
  }

  function placedSquash(points) {
    return Math.min(0.22, 0.08 + points / 220);
  }

  function widenTower(amount) {
    state.stack.forEach((slab) => {
      const center = slab.x + slab.w / 2;
      slab.w = Math.min(720, slab.w + amount);
      slab.x = clamp(center - slab.w / 2, 24, W - slab.w - 24);
    });
  }

  function makeChip(x, y, w, color, dir, rainbow) {
    return {
      x,
      y,
      w,
      h: slabH,
      color,
      rainbow,
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
        color: color || rainbowColors[i % rainbowColors.length]
      });
    }
  }

  function wallSparks(x, dir) {
    for (let i = 0; i < 8; i += 1) {
      state.stars.push({
        x,
        y: state.active.y + 18 + Math.random() * 24,
        vx: -dir * (90 + Math.random() * 180),
        vy: -80 + Math.random() * 160,
        life: 0.25 + Math.random() * 0.22,
        color: rainbowColors[i % rainbowColors.length]
      });
    }
  }

  function floatScore(x, y, text, color) {
    state.floaters.push({
      x,
      y,
      text,
      color,
      life: 0.85
    });
  }

  function togglePause() {
    if (!state.running || state.over) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    state.message = state.paused ? "Paused" : "Stack";
    state.messageT = 1;
    if (state.paused) {
      stopGameplay();
    } else {
      startGameplay();
    }
  }

  function saveBest() {
    if (state.score > state.best) {
      state.best = state.score;
      setSave(bestKey, state.best);
    }
    if (state.stack.length > state.bestHeight) {
      state.bestHeight = state.stack.length;
      setSave(bestHeightKey, state.bestHeight);
    }
  }

  function awardRunCoins() {
    const base = Math.floor(state.score / 75) + Math.floor(state.stack.length / 5);
    if (base <= 0) return;
    addCoins(base);
  }

  function addCoins(amount) {
    state.runCoins += amount;
    state.coins += amount;
    setSave(coinsKey, state.coins);
    floatScore(W - 168, state.active ? state.active.y - 18 : H - 220, "+" + amount + " coins", "#f7c85b");
  }

  function checkMission() {
    if (state.missionDone) return;
    const mission = missions[state.missionIndex];
    if (!mission.test()) return;
    state.missionDone = true;
    addCoins(mission.reward);
    state.message = "Mission complete";
    state.messageT = 1.15;
    playSound("mission");
    state.missionIndex = (state.missionIndex + 1) % missions.length;
    setSave(missionKey, state.missionIndex);
  }

  function syncHud() {
    scoreEl.textContent = state.score;
    bestEl.textContent = state.best;
    heightEl.textContent = state.stack.length + "/" + Math.max(state.bestHeight, state.stack.length);
    comboEl.textContent = "x" + state.combo;
    goalEl.textContent = getGoalText();
    walletEl.textContent = state.coins + " coins";
    shopCoinsEl.textContent = state.coins + " coins";
  }

  function getItem(items, id) {
    return items.find((item) => item.id === id) || items[0];
  }

  function getOwned(key, fallback) {
    try {
      const parsed = JSON.parse(getSave(key, "[]"));
      return new Set([fallback, ...parsed]);
    } catch (error) {
      return new Set([fallback]);
    }
  }

  function saveOwned(key, owned) {
    setSave(key, JSON.stringify([...owned]));
  }

  function renderShop() {
    if (!state) return;
    renderShopGroup(backgroundShopEl, backgrounds, ownedBackgroundsKey, activeBackground.id, "background");
    renderShopGroup(blockShopEl, blockThemes, ownedBlocksKey, activeBlockTheme.id, "blocks");
    shopCoinsEl.textContent = state.coins + " coins";
  }

  function renderShopGroup(root, items, ownedKey, activeId, type) {
    const owned = getOwned(ownedKey, items[0].id);
    root.innerHTML = "";
    items.forEach((item) => {
      const itemEl = document.createElement("article");
      itemEl.className = "shop-item" + (item.id === activeId ? " selected" : "");
      const preview = document.createElement("div");
      preview.className = type === "blocks" ? "shop-preview block-preview" : "shop-preview";
      if (type === "blocks") {
        item.colors.forEach((color) => {
          const swatch = document.createElement("i");
          swatch.style.background = color;
          preview.appendChild(swatch);
        });
      } else {
        preview.style.background = item.preview;
      }
      const name = document.createElement("b");
      name.textContent = item.name;
      const cost = document.createElement("small");
      cost.textContent = owned.has(item.id) ? "Owned" : item.cost + " coins";
      const action = document.createElement("button");
      action.type = "button";
      action.textContent = item.id === activeId ? "Selected" : owned.has(item.id) ? "Select" : "Buy";
      action.disabled = item.id === activeId || (!owned.has(item.id) && state.coins < item.cost);
      action.addEventListener("click", () => buyOrSelectItem(item, type, owned, ownedKey));
      itemEl.append(preview, name, cost, action);
      root.appendChild(itemEl);
    });
  }

  function buyOrSelectItem(item, type, owned, ownedKey) {
    if (!owned.has(item.id)) {
      if (state.coins < item.cost) return;
      state.coins -= item.cost;
      setSave(coinsKey, state.coins);
      owned.add(item.id);
      saveOwned(ownedKey, owned);
      floatScore(W / 2, state.active ? state.active.y - 28 : H - 260, "-" + item.cost + " coins", "#f7c85b");
    }

    if (type === "blocks") {
      activeBlockTheme = item;
      colors = item.colors;
      setSave(blockThemeKey, item.id);
    } else {
      activeBackground = item;
      setSave(backgroundKey, item.id);
    }
    syncHud();
    renderShop();
    playSound("mission");
  }

  function openShop() {
    shopPanel.classList.remove("hidden");
    if (state.running && !state.paused && !state.over) {
      togglePause();
    }
    renderShop();
  }

  function closeShop() {
    shopPanel.classList.add("hidden");
  }

  function getGoalText() {
    if (state.active && state.active.rainbow) return "Rainbow block";
    if (state.missionDone) return "Mission complete";
    const mission = missions[state.missionIndex];
    return "Mission: " + mission.text + " +" + mission.reward;
  }

  function syncMute() {
    muteBtn.textContent = muted ? "Muted" : "Sound";
    muteBtn.setAttribute("aria-pressed", String(muted));
  }

  function update(dt) {
    if (!state.paused && state.running && !state.over) {
      const active = state.active;
      active.x += active.dir * state.speed * dt;
      if (active.x <= 0) {
        active.x = 0;
        active.dir = 1;
        state.wallFlash = 0.18;
        wallSparks(0, -1);
        playSound("wall");
      }
      if (active.x + active.w >= W) {
        active.x = W - active.w;
        active.dir = -1;
        state.wallFlash = 0.18;
        wallSparks(W, 1);
        playSound("wall");
      }
    }

    const targetCamera = Math.max(0, H - 380 - state.active.y);
    state.cameraY += (targetCamera + state.bump - state.cameraY) * Math.min(1, dt * 5.5);
    state.bump = Math.max(0, state.bump - dt * 80);
    state.wallFlash = Math.max(0, state.wallFlash - dt);
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

    state.rings.forEach((ring) => {
      ring.life -= dt;
      ring.r += 560 * dt;
    });
    state.rings = state.rings.filter((ring) => ring.life > 0);

    state.floaters.forEach((floater) => {
      floater.life -= dt;
      floater.y -= 72 * dt;
    });
    state.floaters = state.floaters.filter((floater) => floater.life > 0);

    state.stack.forEach((slab) => {
      if (slab.squash) slab.squash = Math.max(0, slab.squash - dt * 1.9);
    });
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
    state.rings.forEach(drawRing);
    state.floaters.forEach(drawFloater);

    ctx.restore();
    drawGuide();
    drawMessage();
  }

  function drawBackdrop() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, activeBackground.colors[0]);
    grad.addColorStop(0.56, activeBackground.colors[1]);
    grad.addColorStop(1, activeBackground.colors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255, 248, 232, 0.035)";
    for (let x = 90; x < W; x += 90) {
      ctx.fillRect(x, 0, 2, H);
    }

    ctx.fillStyle = hexToRgba(activeBackground.rails[0], 0.11);
    ctx.fillRect(118, 0, state.wallFlash ? 11 : 5, H);
    ctx.fillStyle = hexToRgba(activeBackground.rails[1], 0.11);
    ctx.fillRect(W - 123, 0, state.wallFlash ? 11 : 5, H);

    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "#fff8e8";
    ctx.lineWidth = 1.5;
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
    ctx.shadowColor = "rgba(0,0,0,0.34)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 10;
    if (slab.squash) {
      const squash = Math.sin(slab.squash * Math.PI * 4.5) * slab.squash;
      ctx.translate(slab.x + slab.w / 2, y + slabH);
      ctx.scale(1 + squash * 0.7, 1 - squash * 0.42);
      ctx.translate(-(slab.x + slab.w / 2), -(y + slabH));
    }
    roundRect(slab.x, y, slab.w, slabH, 8);
    ctx.fillStyle = slab.rainbow ? makeRainbowGradient(slab.x, slab.w) : makeSlabGradient(slab);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(slab.x + 14, y + 12, Math.max(0, slab.w - 28), 6);
    ctx.fillStyle = "rgba(0,0,0,0.17)";
    ctx.fillRect(slab.x + 10, y + slabH - 12, Math.max(0, slab.w - 20), 5);
    if (slab.perfect) {
      ctx.strokeStyle = "#f7c85b";
      ctx.lineWidth = 4;
      ctx.strokeRect(slab.x + 4, y + 4, slab.w - 8, slabH - 8);
    }
    ctx.restore();
  }

  function makeSlabGradient(slab) {
    const grad = ctx.createLinearGradient(slab.x, slab.y, slab.x, slab.y + slabH);
    grad.addColorStop(0, lighten(slab.color, 0.18));
    grad.addColorStop(0.42, slab.color);
    grad.addColorStop(1, slab.color);
    return grad;
  }

  function makeRainbowGradient(x, w) {
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    rainbowColors.forEach((color, index) => {
      grad.addColorStop(index / (rainbowColors.length - 1), color);
    });
    return grad;
  }

  function playSound(type) {
    if (muted) return;
    if (adLocked) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const tone = {
      start: [220, 330, 0.07],
      drop: [260, 190, 0.055],
      perfect: [520, 780, 0.09],
      wall: [140, 110, 0.035],
      fail: [150, 70, 0.18],
      rainbow: [330, 990, 0.16],
      mission: [440, 880, 0.13]
    }[type] || [240, 180, 0.05];

    osc.type = type === "perfect" || type === "rainbow" || type === "mission" ? "triangle" : "square";
    osc.frequency.setValueAtTime(tone[0], now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, tone[1]), now + tone[2]);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(type === "wall" ? 0.025 : 0.07, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone[2]);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + tone[2] + 0.01);
  }

  function unlockAudio() {
    if (muted || audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function drawChip(chip) {
    ctx.save();
    ctx.translate(chip.x + chip.w / 2, chip.y + chip.h / 2);
    ctx.rotate(chip.rot);
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 8;
    roundRect(-chip.w / 2, -chip.h / 2, chip.w, chip.h, 8);
    ctx.fillStyle = chip.rainbow ? makeRainbowGradient(-chip.w / 2, chip.w) : chip.color;
    ctx.fill();
    ctx.restore();
  }

  function drawFloater(floater) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, floater.life * 2);
    ctx.fillStyle = floater.color;
    ctx.font = "900 34px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.46)";
    ctx.shadowBlur = 12;
    ctx.fillText(floater.text, floater.x, floater.y);
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

  function drawRing(ring) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ring.life * 1.8);
    ctx.strokeStyle = "#fff8e8";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawGuide() {
    if (!state.running || state.over || state.paused) return;
    const top = state.stack[state.stack.length - 1];
    const screenY = top.y + state.cameraY;
    ctx.strokeStyle = "rgba(247, 200, 91, 0.82)";
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 12]);
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

  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
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
  window.addEventListener("orientationchange", () => {
    setTimeout(resize, 250);
  });
  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.code === "Space" || event.code === "ArrowDown" || event.code === "ArrowUp" || event.code === "Enter") {
      event.preventDefault();
      drop();
    }
    if (event.code === "KeyP") togglePause();
    if (event.code === "KeyR") {
      requestStart(true);
    }
  });
  window.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
  window.addEventListener("touchmove", (event) => {
    if (event.target.closest(".shop-card")) return;
    event.preventDefault();
  }, { passive: false });

  function handleTapDrop(event) {
    event.preventDefault();
    const now = performance.now();
    if (now - lastTapDrop < 140) return;
    lastTapDrop = now;
    drop();
  }

  canvas.addEventListener("pointerdown", handleTapDrop);
  if (!window.PointerEvent) {
    canvas.addEventListener("touchstart", handleTapDrop, { passive: false });
  }
  playBtn.addEventListener("click", () => {
    requestStart(true);
  });
  dropBtn.addEventListener("pointerdown", handleTapDrop);
  if (!window.PointerEvent) {
    dropBtn.addEventListener("touchstart", handleTapDrop, { passive: false });
  }
  shopBtn.addEventListener("click", openShop);
  shopCloseBtn.addEventListener("click", closeShop);
  shopPanel.addEventListener("click", (event) => {
    if (event.target === shopPanel) closeShop();
  });
  pauseBtn.addEventListener("click", togglePause);
  muteBtn.addEventListener("click", () => {
    muted = !muted;
    setSave(muteKey, muted ? "1" : "0");
    syncMute();
    playSound("drop");
  });
  restartBtn.addEventListener("click", () => {
    requestStart(true);
  });

  reset();
  resize();
  initPoki();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}());
