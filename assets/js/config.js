// Shared branding, presets, saved settings, and page state.
"use strict";
const canvas = document.getElementById("board"),
  ctx = canvas.getContext("2d");
const C = {
  red: "#ed182e",
  white: "#f7f8fa",
  silver: "#b7bec9",
  black: "#08090b",
  line: "#393e46",
};
const art = { raider: new Image(), wr: new Image() };
art.raider.src = "assets/images/raider.jpg";
art.wr.src = "assets/images/wr.jpg";
const GAMES = {
  cups: "CUP SHUFFLE",
  race: "RAIDER RALLY RACE",
  helmet: "HELMET SHUFFLE",
  memory: "MEMORY MATCH",
};
const TEAMS = ["RED", "WHITE", "SILVER"],
  COLORS = [C.red, C.white, C.silver];
const PRESETS = {
  warmup: {
    name: "Warm-up",
    swap: 780,
    moves: 8,
    show: 2200,
    chaos: false,
    race: 30,
    memory: 45,
    hold: 900,
  },
  varsity: {
    name: "Varsity",
    swap: 440,
    moves: 14,
    show: 1500,
    chaos: false,
    race: 22,
    memory: 30,
    hold: 650,
  },
  allstar: {
    name: "All-Star",
    swap: 300,
    moves: 18,
    show: 1200,
    chaos: true,
    race: 16,
    memory: 25,
    hold: 450,
  },
  elite: {
    name: "Elite",
    swap: 210,
    moves: 24,
    show: 1000,
    chaos: true,
    race: 12,
    memory: 20,
    hold: 300,
  },
  insane: {
    name: "Insane",
    swap: 135,
    moves: 30,
    show: 800,
    chaos: true,
    race: 8,
    memory: 15,
    hold: 180,
  },
  impossible: {
    name: "Impossible",
    swap: 60,
    moves: 48,
    show: 600,
    chaos: true,
    race: 3,
    memory: 6,
    hold: 80,
  },
};
const SLIDERS = {
  swap: [60, 1200],
  moves: [6, 60],
  show: [400, 3000],
  race: [3, 45],
  memory: [6, 60],
  hold: [80, 1200],
};
let prefs = {};
for (const g of Object.keys(GAMES))
  prefs[g] = { ...PRESETS.varsity, preset: "varsity" };
try {
  const saved = JSON.parse(localStorage.getItem("raider-arena-v2"));
  for (const g of Object.keys(GAMES)) {
    const v = saved?.[g];
    if (!v) continue;
    for (const [k, [min, max]] of Object.entries(SLIDERS)) {
      if (Number.isFinite(v[k]))
        prefs[g][k] = Math.round(Math.max(min, Math.min(max, v[k])));
    }
    if (typeof v.chaos === "boolean") prefs[g].chaos = v.chaos;
    if (v.preset in PRESETS) prefs[g].preset = v.preset;
    else prefs[g].preset = "custom";
  }
} catch {}
const game = document.body.dataset.game;
let phase = "ready",
  round = 1,
  paused = false,
  elapsed = 0,
  visualTime = 0,
  picked = null,
  roundConfig = null;
let shell = {},
  race = {},
  memory = {},
  controls = [],
  operator = null,
  last = 0,
  lastStatus = 0,
  digits = "",
  digitAt = 0,
  toastTimer,
  sound = false,
  audio = null;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)),
  ease = (t) => t * t * (3 - 2 * t);
const isShell = () => game === "cups" || game === "helmet";

// All links are relative so project URLs and local/offline copies both work.
const GAME_PAGES = {
  cups: "cup-shuffle.html",
  race: "raider-rally-race.html",
  helmet: "helmet-shuffle.html",
  memory: "memory-match.html",
};
