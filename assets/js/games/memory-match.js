// Four to eight pairs, countdown, matching rules, and card artwork.
const ICON_NAMES = [
  "FOOTBALL",
  "BASKETBALL",
  "BASEBALL",
  "TROPHY",
  "WHISTLE",
  "LIGHTNING",
  "SOCCER",
  "VOLLEYBALL",
];
function icon(id, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (id === 0) football(0, 0, 1.1);
  if (id === 1) {
    ellipse(
      0,
      0,
      43,
      43,
      gradient(-30, -30, 30, 30, [
        [0, "#ffca69"],
        [0.55, "#ed8c24"],
        [1, "#a44b13"],
      ]),
    );
    ctx.strokeStyle = "#5e2c10";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 43, 0, Math.PI * 2);
    ctx.stroke();
    line(-43, 0, 43, 0, "#5e2c10", 3);
    line(0, -43, 0, 43, "#5e2c10", 3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 43, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (id === 2) {
    ellipse(
      0,
      0,
      44,
      44,
      gradient(-25, -25, 30, 30, [
        [0, "#fff"],
        [0.6, "#eceff4"],
        [1, "#9faabc"],
      ]),
    );
    for (const side of [-1, 1]) {
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(side * 53, 0, 40, side === 1 ? 2.15 : -1, side === 1 ? 4.13 : 1);
      ctx.stroke();
      for (let j = -2; j <= 2; j++) {
        const yy = j * 12,
          xx = side * (53 - Math.sqrt(1600 - yy * yy));
        line(xx - 5, yy - 3, xx + 5, yy + 3, C.red, 3);
      }
    }
  }
  if (id === 3) {
    ctx.strokeStyle = "#f5cc6c";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-25, -29);
    ctx.lineTo(-48, -29);
    ctx.quadraticCurveTo(-51, 9, -19, 12);
    ctx.moveTo(25, -29);
    ctx.lineTo(48, -29);
    ctx.quadraticCurveTo(51, 9, 19, 12);
    ctx.stroke();
    ctx.fillStyle = gradient(-30, 0, 30, 0, [
      [0, "#b87c28"],
      [0.4, "#fff1b4"],
      [1, "#dca338"],
    ]);
    ctx.beginPath();
    ctx.moveTo(-30, -42);
    ctx.lineTo(30, -42);
    ctx.lineTo(23, 1);
    ctx.quadraticCurveTo(0, 35, -23, 1);
    ctx.closePath();
    ctx.fill();
    rect(-6, 18, 12, 22, "#e4b44e");
    rect(-31, 37, 62, 10, "#f1ce7b", 3);
  }
  if (id === 4) {
    ellipse(
      -12,
      9,
      31,
      31,
      gradient(-30, -20, 20, 40, [
        [0, "#eef3fb"],
        [0.5, "#a4b1c4"],
        [1, "#556376"],
      ]),
    );
    rect(-8, -20, 61, 26, "#bfcddd", 3);
    rect(31, -17, 13, 10, C.black, 2);
    ellipse(-12, 9, 13, 13, C.black);
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-47, 9, 9, 0, Math.PI * 2);
    ctx.stroke();
    line(35, -36, 46, -46, C.white, 4);
    line(54, -27, 67, -29, C.white, 4);
  }
  if (id === 5) {
    poly(
      [
        [7, -51],
        [-39, 8],
        [-6, 8],
        [-16, 53],
        [40, -15],
        [8, -15],
        [22, -51],
      ],
      gradient(-30, -30, 30, 40, [
        [0, "#fff1b0"],
        [1, "#e5a526"],
      ]),
    );
  }
  if (id === 6) soccerBall(0, 0, 1.3);
  if (id === 7) volleyball(0, 0, 1.3);
  ctx.restore();
}
function memoryPairs() {
  return phase === "ready" ? prefs.memory.pairs : roundConfig.pairs;
}
function cardRect(i) {
  const rows = Math.ceil((memoryPairs() * 2) / 4),
    h = Math.min(185, 490 / rows - 18);
  return {
    x: 182 + (i % 4) * 315,
    y: 335 + Math.floor(i / 4) * (h + 18),
    w: 291,
    h,
  };
}
function drawMemory() {
  const ready = phase === "ready",
    result = phase === "result",
    remaining = ready ? prefs.memory.memory * 1000 : memory.remaining,
    total = ready ? prefs.memory.memory * 1000 : memory.total;
  const count = memory.matched.length / 2;
  text(
    result
      ? memory.won
        ? "PERFECT MATCH, RAIDERS!"
        : "TIME'S UP!"
      : ready
        ? `${memoryPairs()} PAIRS. ONE SHOT.`
        : "FIND YOUR NEXT MATCH.",
    55,
    264,
    29,
  );
  pill(`${count} / ${memoryPairs()} PAIRS`, 1075, 247, 205, "#303843");
  rect(1300, 240, 245, 55, remaining <= 10000 && !ready ? C.red : "#303843", 4);
  text(`${(remaining / 1000).toFixed(1)}s`, 1422, 269, 32, C.white, "center");
  rect(55, 312, 1490, 4, "#3d4653");
  rect(
    55,
    312,
    1490 * clamp(remaining / total),
    4,
    remaining <= 10000 && !ready ? C.red : C.white,
  );
  for (let i = 0; i < memoryPairs() * 2; i++) {
    const { x, y, w, h } = cardRect(i),
      matched = memory.matched.includes(i),
      face = !ready && (matched || memory.open.includes(i) || result);
    const flip =
      face && !result
        ? clamp(
            (visualTime - memory.flipAt[i]) /
              Math.min(140, roundConfig.hold * 0.7),
          )
        : 1;
    const scale =
        face && flip < 1
          ? Math.max(0.07, Math.abs(Math.cos(flip * Math.PI)))
          : 1,
      show = face && (flip >= 0.5 || result);
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(scale, 1);
    ctx.translate(-w / 2, -h / 2);
    rect(0, 5, w, h, "#030406", 6);
    rect(
      0,
      0,
      w,
      h,
      gradient(0, 0, w, h, [
        [0, show ? "#424d5c" : "#313844"],
        [0.5, show ? "#262d38" : "#191e26"],
        [1, "#10151c"],
      ]),
      6,
    );
    ctx.strokeStyle = matched ? "#f1f5fb" : show ? C.red : "#505d70";
    ctx.lineWidth = matched ? 3 : 1.5;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    if (show) {
      icon(memory.deck[i], w / 2, h / 2, Math.min(0.9, h / 150));
      if (matched) {
        pill("OK", w - 45, 10, 33, "#526174");
      }
    } else {
      poly(
        [
          [w - 78, 0],
          [w, 0],
          [w, 78],
        ],
        "#9e1023",
      );
      line(0, h - 5, w, h - 5, "#960f24", 2);
      logo("wr", w / 2 - 45, h / 2 - 32, 90, 64);
    }
    rect(10, 10, 52, 40, show ? "#0b0f15" : C.red, 3);
    text(String(i + 1), 36, 31, 28, C.white, "center");
    ctx.restore();
  }
  if (result && memory.won) confetti();
}

function gameReset() {
  memory = {
    deck: [],
    matched: [],
    open: [],
    remaining: prefs.memory.memory * 1000,
    total: prefs.memory.memory * 1000,
    closeAt: null,
    turns: 0,
    flipAt: Array(prefs.memory.pairs * 2).fill(-1000),
  };
}
function gameStart() {
  picked = null;
  const total = roundConfig.memory * 1000;
  memory = {
    deck: shuffled(
      Array.from({ length: roundConfig.pairs }, (_, i) => [i, i]).flat(),
    ),
    matched: [],
    open: [],
    remaining: total,
    total,
    closeAt: null,
    turns: 0,
    flipAt: Array(roundConfig.pairs * 2).fill(-1000),
    lastClickSecond: Math.ceil(total / 1000),
    won: false,
  };
  phaseTo("playing");
}
function gamePick(index) {
  if (
    phase !== "playing" ||
    index >= memory.deck.length ||
    memory.remaining <= 0 ||
    memory.open.length === 2 ||
    memory.matched.includes(index) ||
    memory.open.includes(index)
  )
    return;
  memory.open.push(index);
  memory.flipAt[index] = visualTime;
  ping(480, 0.05);
  if (memory.open.length === 2) {
    memory.turns++;
    const [a, b] = memory.open;
    if (memory.deck[a] === memory.deck[b]) {
      memory.matched.push(a, b);
      memory.open = [];
      memory.closeAt = null;
      ping(880, 0.1);
      if (memory.matched.length === memory.deck.length) {
        memory.won = true;
        phaseTo("result");
      }
    } else memory.closeAt = elapsed + roundConfig.hold;
  }
  sync();
}
function gameTick() {
  if (phase === "playing") {
    memory.remaining = Math.max(0, memory.total - elapsed);
    const second = Math.ceil(memory.remaining / 1000);
    if (second !== memory.lastClickSecond) {
      if (roundConfig.timerClick && second > 0)
        tone(second <= 10 ? 1400 : 1000, 0.035, 0, "triangle", 0.04);
      memory.lastClickSecond = second;
    }
    if (memory.closeAt !== null && elapsed >= memory.closeAt) {
      memory.open = [];
      memory.closeAt = null;
      sync();
    }
    if (memory.remaining === 0) {
      memory.open = [];
      memory.won = false;
      phaseTo("result");
    }
  }
}
function gameStatus() {
  return phase === "result"
    ? memory.won
      ? `All ${memoryPairs()} pairs matched!`
      : `Time up. ${memory.matched.length / 2} of ${memoryPairs()} pairs.`
    : `${memory.matched.length / 2}/${memoryPairs()} pairs | ${(memory.remaining / 1000).toFixed(1)}s${digits ? " | Card " + digits + " + Enter" : ""}`;
}
function gameDetail() {
  return `${prefs.memory.pairs} pairs / ${prefs.memory.memory}s / ${prefs.memory.hold}ms mismatch`;
}
function gameCanvasPick(x, y) {
  for (let i = 0; i < memoryPairs() * 2; i++) {
    const c = cardRect(i);
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) pick(i);
  }
}
function gameDraw() {
  drawMemory();
}
