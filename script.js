(() => {
  const ROUND_SECONDS = 30;
  const STORAGE_BEST = "bug-blaster-best";
  const STORAGE_MUTE = "bug-blaster-muted";

  const stage = document.getElementById("stage");
  const scoreEl = document.getElementById("score");
  const timerEl = document.getElementById("timer");
  const comboEl = document.getElementById("combo");
  const bestEl = document.getElementById("best");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");
  const muteBtn = document.getElementById("mute-btn");
  const overlayStartBtn = document.getElementById("overlay-start-btn");
  const overlayRestartBtn = document.getElementById("overlay-restart-btn");
  const startOverlay = document.getElementById("start-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const finalScoreEl = document.getElementById("final-score");
  const finalMetaEl = document.getElementById("final-meta");
  const gameoverTitle = document.getElementById("gameover-title");
  const timerStat = document.querySelector(".timer-stat");

  const BUG_TYPES = [
    {
      id: "common",
      points: 10,
      weight: 70,
      className: "common",
      color: "#39ff14",
      pixels: commonPixels("#39ff14"),
    },
    {
      id: "fast",
      points: 20,
      weight: 24,
      className: "fast",
      color: "#ff2bd6",
      pixels: commonPixels("#ff2bd6"),
    },
    {
      id: "gold",
      points: 50,
      weight: 6,
      className: "gold",
      color: "#ffe14a",
      pixels: goldPixels(),
    },
  ];

  const state = {
    playing: false,
    score: 0,
    combo: 1,
    hits: 0,
    timeLeft: ROUND_SECONDS,
    best: Number(localStorage.getItem(STORAGE_BEST) || 0),
    muted: localStorage.getItem(STORAGE_MUTE) === "1",
    spawnTimer: 0,
    roundTimer: 0,
    moveTimer: 0,
    bugs: new Map(),
    audio: null,
  };

  bestEl.textContent = pad(state.best);
  syncMuteButton();

  startBtn.addEventListener("click", startGame);
  overlayStartBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", () => startGame(true));
  overlayRestartBtn.addEventListener("click", () => startGame(true));
  muteBtn.addEventListener("click", toggleMute);

  stage.addEventListener("pointerdown", (event) => {
    if (!state.playing) return;
    if (event.target.closest(".bug")) return;
    resetCombo();
    playTone(140, 0.08, "square", 0.04);
  });

  function startGame() {
    unlockAudio();
    clearTimers();
    clearStageBugs();
    state.playing = true;
    state.score = 0;
    state.combo = 1;
    state.hits = 0;
    state.timeLeft = ROUND_SECONDS;
    renderHud();
    startOverlay.classList.add("hidden");
    gameoverOverlay.classList.add("hidden");
    restartBtn.disabled = false;
    startBtn.disabled = true;
    stage.classList.add("playing");
    timerStat.classList.remove("urgent");
    seedBugs(4);
    state.roundTimer = window.setInterval(tick, 1000);
    state.spawnTimer = window.setInterval(spawnTick, 700);
    state.moveTimer = window.setInterval(nudgeBugs, 420);
    playTone(520, 0.1, "square", 0.06);
    playTone(740, 0.12, "square", 0.05, 0.08);
  }

  function tick() {
    state.timeLeft -= 1;
    timerEl.textContent = String(state.timeLeft);
    if (state.timeLeft <= 8) timerStat.classList.add("urgent");
    if (state.timeLeft <= 5 && state.timeLeft > 0) {
      playTone(880, 0.05, "square", 0.05);
    }
    if (state.timeLeft <= 0) endGame();
  }

  function spawnTick() {
    const crowding = stage.querySelectorAll(".bug").length;
    const maxBugs = state.timeLeft > 15 ? 7 : 10;
    if (crowding < maxBugs) spawnBug();
    if (state.timeLeft < 12 && crowding < maxBugs) spawnBug();
  }

  function endGame() {
    state.playing = false;
    clearTimers();
    stage.classList.remove("playing");
    startBtn.disabled = false;
    timerStat.classList.remove("urgent");
    const isRecord = state.score > state.best;
    if (isRecord) {
      state.best = state.score;
      localStorage.setItem(STORAGE_BEST, String(state.best));
      bestEl.textContent = pad(state.best);
    }
    finalScoreEl.textContent = pad(state.score);
    gameoverTitle.textContent = isRecord ? "NEW HIGH SCORE" : "SWARM SURVIVED";
    finalMetaEl.textContent = `${state.hits} bugs blasted · best combo x${maxComboSeen}`;
    gameoverOverlay.classList.remove("hidden");
    playGameOver();
  }

  let maxComboSeen = 1;

  function spawnBug(type) {
    const picked = type || pickType();
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    const button = document.createElement("button");
    button.type = "button";
    button.className = `bug ${picked.className} spawn`;
    button.style.color = picked.color;
    button.dataset.id = id;
    button.setAttribute("aria-label", `${picked.id} bug, ${picked.points} points`);
    button.innerHTML = pixelSvg(picked.pixels, picked.color);
    placeBug(button);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      blastBug(button, picked);
    });
    stage.appendChild(button);
    state.bugs.set(id, { el: button, type: picked, vx: rand(-18, 18), vy: rand(-14, 14) });
    window.setTimeout(() => button.classList.remove("spawn"), 200);
  }

  function placeBug(el) {
    const rect = stage.getBoundingClientRect();
    const pad = 56;
    const x = rand(pad, Math.max(pad + 1, rect.width - pad));
    const y = rand(pad, Math.max(pad + 1, rect.height - pad));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  function nudgeBugs() {
    if (!state.playing) return;
    const rect = stage.getBoundingClientRect();
    const pad = 32;
    state.bugs.forEach((bug) => {
      const el = bug.el;
      let x = parseFloat(el.style.left) + bug.vx;
      let y = parseFloat(el.style.top) + bug.vy;
      if (x < pad || x > rect.width - pad) bug.vx *= -1;
      if (y < pad || y > rect.height - pad) bug.vy *= -1;
      x = clamp(x, pad, rect.width - pad);
      y = clamp(y, pad, rect.height - pad);
      if (Math.random() < 0.2) {
        bug.vx += rand(-6, 6);
        bug.vy += rand(-6, 6);
        bug.vx = clamp(bug.vx, -24, 24);
        bug.vy = clamp(bug.vy, -20, 20);
      }
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    });
  }

  function blastBug(el, type) {
    if (!state.playing) return;
    const id = el.dataset.id;
    const x = el.style.left;
    const y = el.style.top;
    el.remove();
    state.bugs.delete(id);

    state.hits += 1;
    const gained = type.points * state.combo;
    state.score += gained;
    maxComboSeen = Math.max(maxComboSeen, state.combo);
    state.combo = Math.min(8, state.combo + 1);
    renderHud();
    comboEl.parentElement.classList.add("combo-flash");
    window.setTimeout(() => comboEl.parentElement.classList.remove("combo-flash"), 250);

    burst(x, y, type.color, gained);
    playSplat(type.id);
    window.setTimeout(() => {
      if (state.playing) spawnBug();
    }, 90);
  }

  function burst(x, y, color, points) {
    for (let i = 0; i < 7; i += 1) {
      const p = document.createElement("span");
      p.className = "splat";
      p.style.left = x;
      p.style.top = y;
      p.style.background = color;
      p.style.marginLeft = `${rand(-18, 18)}px`;
      p.style.marginTop = `${rand(-18, 18)}px`;
      stage.appendChild(p);
      window.setTimeout(() => p.remove(), 360);
    }
    const float = document.createElement("div");
    float.className = "float-score";
    float.textContent = `+${points}`;
    float.style.left = x;
    float.style.top = y;
    stage.appendChild(float);
    window.setTimeout(() => float.remove(), 720);
  }

  function resetCombo() {
    state.combo = 1;
    comboEl.textContent = "x1";
  }

  function renderHud() {
    scoreEl.textContent = pad(state.score);
    timerEl.textContent = String(state.timeLeft);
    comboEl.textContent = `x${state.combo}`;
  }

  function seedBugs(count) {
    for (let i = 0; i < count; i += 1) spawnBug();
  }

  function clearStageBugs() {
    stage.querySelectorAll(".bug, .splat, .float-score").forEach((node) => node.remove());
    state.bugs.clear();
    maxComboSeen = 1;
  }

  function clearTimers() {
    window.clearInterval(state.roundTimer);
    window.clearInterval(state.spawnTimer);
    window.clearInterval(state.moveTimer);
  }

  function pickType() {
    const total = BUG_TYPES.reduce((sum, t) => sum + t.weight, 0);
    let roll = Math.random() * total;
    for (const type of BUG_TYPES) {
      roll -= type.weight;
      if (roll <= 0) return type;
    }
    return BUG_TYPES[0];
  }

  function toggleMute() {
    state.muted = !state.muted;
    localStorage.setItem(STORAGE_MUTE, state.muted ? "1" : "0");
    syncMuteButton();
  }

  function syncMuteButton() {
    muteBtn.textContent = state.muted ? "SOUND OFF" : "SOUND ON";
    muteBtn.setAttribute("aria-pressed", state.muted ? "true" : "false");
  }

  function unlockAudio() {
    if (!state.audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      state.audio = new Ctx();
    }
    if (state.audio.state === "suspended") state.audio.resume();
  }

  function playTone(freq, duration, type, gain, delay = 0) {
    if (state.muted || !state.audio) return;
    const t = state.audio.currentTime + delay;
    const osc = state.audio.createOscillator();
    const amp = state.audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(amp);
    amp.connect(state.audio.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function playSplat(kind) {
    if (kind === "gold") {
      playTone(660, 0.08, "square", 0.07);
      playTone(880, 0.12, "triangle", 0.06, 0.06);
      playTone(1175, 0.14, "square", 0.04, 0.12);
      return;
    }
    if (kind === "fast") {
      playTone(420, 0.06, "sawtooth", 0.05);
      playTone(640, 0.08, "square", 0.04, 0.04);
      return;
    }
    playTone(240, 0.07, "square", 0.06);
    playTone(180, 0.1, "triangle", 0.04, 0.03);
  }

  function playGameOver() {
    playTone(392, 0.16, "square", 0.06);
    playTone(311, 0.18, "square", 0.05, 0.14);
    playTone(196, 0.28, "triangle", 0.06, 0.3);
  }

  function pad(n) {
    return String(Math.max(0, n)).padStart(4, "0");
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function commonPixels(color) {
    const eye = "#07111c";
    const cells = [];
    const fill = (xs, ys, c) => {
      xs.forEach((x) => ys.forEach((y) => cells.push([x, y, c])));
    };
    fill([1, 2], [2, 3], color);
    fill([13, 14], [2, 3], color);
    fill([3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [4, 5, 6, 7, 8, 9], color);
    fill([5, 6], [6, 7], eye);
    fill([9, 10], [6, 7], eye);
    fill([2, 3], [10, 11], color);
    fill([12, 13], [10, 11], color);
    fill([6, 7, 8, 9], [12, 13], color);
    fill([0], [7], color);
    fill([15], [7], color);
    return cells;
  }

  function goldPixels() {
    const c = "#ffe14a";
    const e = "#fff6b0";
    const eye = "#07111c";
    const cells = [];
    const fill = (xs, ys, col) => {
      xs.forEach((x) => ys.forEach((y) => cells.push([x, y, col])));
    };
    fill([6, 7, 8, 9], [1, 2], e);
    fill([3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [3, 4, 5, 6, 7, 8, 9, 10], c);
    fill([5, 6], [5, 6], eye);
    fill([9, 10], [5, 6], eye);
    fill([7, 8], [7, 8], e);
    fill([1, 2], [4, 5], c);
    fill([13, 14], [4, 5], c);
    fill([2, 3], [11, 12], c);
    fill([12, 13], [11, 12], c);
    fill([6, 7, 8, 9], [13, 14], e);
    return cells;
  }

  function pixelSvg(pixels, glow) {
    const cells = pixels
      .map(
        ([x, y, fill]) =>
          `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}" />`
      )
      .join("");
    return `<svg class="bug-art" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="16" height="16" fill="transparent"/>${cells}<rect x="0" y="0" width="16" height="16" fill="${glow}" opacity="0.08"/></svg>`;
  }
})();
