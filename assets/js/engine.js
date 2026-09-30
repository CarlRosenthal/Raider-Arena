// Shared round lifecycle; game rules are implemented by each game script.
function random(n) {
  const u = new Uint32Array(1),
    limit = Math.floor(4294967296 / n) * n;
  do {
    crypto.getRandomValues(u);
  } while (u[0] >= limit);
  return u[0] % n;
}
function shuffled(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function active() {
  return !["ready", "result"].includes(phase);
}
function save() {
  try {
    localStorage.setItem("raider-arena-v2", JSON.stringify(prefs));
  } catch {}
}
function presetName() {
  const p = active() || phase === "result" ? roundConfig : prefs[game];
  return p?.preset === "custom"
    ? "CUSTOM"
    : (PRESETS[p?.preset]?.name || "Varsity").toUpperCase();
}
function ping(freq = 600, duration = 0.08) {
  if (!sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const o = audio.createOscillator(),
      gain = audio.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    gain.gain.setValueAtTime(0.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.connect(gain);
    gain.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + duration);
  } catch {}
}
function phaseTo(next) {
  phase = next;
  sync();
  if (next === "result") ping(900, 0.3);
  else if (next === "guess") ping(700, 0.18);
}

function reset() {
  phase = "ready";
  paused = false;
  elapsed = 0;
  visualTime = 0;
  picked = null;
  roundConfig = null;
  digits = "";
  gameReset();
  last = performance.now();
  sync();
}
function navigateTo(url) {
  if (active() && !confirm("End this round and leave this game?")) return;
  window.location.href = url;
}
function chooseGame(g) {
  if (g in GAME_PAGES && g !== game) navigateTo(GAME_PAGES[g]);
}
function resetRequested() {
  if (active() && !confirm("End this round and reset?")) return;
  reset();
}
function changePreset(id) {
  if (active() || !(id in PRESETS)) return;
  prefs[game] = { ...PRESETS[id], preset: id };
  save();
  sync();
}
function tune(key, value) {
  if (active()) return;
  const p = prefs[game];
  if (key === "chaos") p.chaos = !!value;
  else if (key in SLIDERS) {
    const [min, max] = SLIDERS[key];
    p[key] = Math.round(clamp(Number(value) || min, min, max));
  } else return;
  p.preset = "custom";
  save();
  sync();
}

function start() {
  if (!["ready", "result"].includes(phase)) return;
  if (phase === "result") round++;
  elapsed = 0;
  visualTime = 0;
  paused = false;
  digits = "";
  roundConfig = { ...prefs[game] };
  last = performance.now();
  gameStart();
  ping(500, 0.14);
}
function advance() {
  if (paused) return;
  if (["ready", "result"].includes(phase)) start();
  else if (isShell() && phase === "guess") {
    elapsed = 0;
    phaseTo("reveal");
  }
}
function pick(index) {
  if (paused || !Number.isInteger(index) || index < 0) return;
  gamePick(index);
}
function pause() {
  if (active()) {
    paused = !paused;
    last = performance.now();
    sync();
  }
}
// Settle elapsed time before an operator action, including a last-second card pick.
function settleClock() {
  const now = performance.now();
  if (last) tick(Math.max(0, now - last));
  last = now;
}
function action(fn) {
  return () => {
    settleClock();
    fn();
  };
}

function tick(dt) {
  if (paused) return;
  visualTime += dt;
  if (!active()) return;
  elapsed += dt;
  gameTick();
}
function status() {
  if (paused) return "PAUSED";
  if (phase === "ready") return "Ready for the next challenge";
  return gameStatus();
}
function detail() {
  return gameDetail();
}
