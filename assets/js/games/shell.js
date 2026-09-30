// Rules and board shared by Cup Shuffle and Helmet Shuffle.
function makeMoves(p) {
  const moves = [];
  let previous = "";
  for (let i = 0; i < p.moves; i++) {
    let map, key;
    do {
      map = [0, 1, 2];
      if (p.chaos && random(4) === 0) {
        map = random(2) ? [1, 2, 0] : [2, 0, 1];
      } else {
        const a = random(3),
          b = (a + 1 + random(2)) % 3;
        [map[a], map[b]] = [map[b], map[a]];
      }
      key = map.join("");
    } while (key === previous);
    previous = key;
    moves.push({
      map,
      duration: Math.max(
        45,
        Math.round(
          p.swap * (0.94 + random(13) / 100) * (1 - (0.18 * i) / p.moves),
        ),
      ),
    });
  }
  return moves;
}
function drawShell() {
  const win = shell.slots.indexOf(shell.ball),
    result = phase === "result",
    reveal = phase === "reveal" || result;
  let main =
    phase === "ready"
      ? game === "cups"
        ? "THREE CUPS. ONE BALL."
        : "FOLLOW THE FOOTBALL."
      : phase === "show"
        ? "LOCK ON. DON'T LOSE IT."
        : phase === "guess"
          ? picked === null
            ? "WHERE IS IT? 1, 2 OR 3?"
            : `CHOICE ${picked + 1}. LOCKED IN.`
          : reveal
            ? picked === win
              ? "THAT'S RAIDER FOCUS!"
              : `IT\'S UNDER ${win + 1}!`
            : "EYES UP, RAIDER NATION.";
  banner(
    main,
    result
      ? picked === null
        ? "WHO CALLED IT?"
        : picked === win
          ? "MAKE SOME NOISE!"
          : "ONE MORE ROUND?"
      : phase === "ready"
        ? `${presetName()} CHALLENGE`
        : phase === "guess"
          ? "LET THE CROWD DECIDE."
          : "",
  );
  const xs = [390, 800, 1210];
  // Draw fixed position markers before sorting moving objects back-to-front.
  for (let i = 0; i < 3; i++) {
    const selected =
        picked === i && ["guess", "reveal", "result"].includes(phase),
      correct = result && i === win;
    ellipse(xs[i], 708, 170, 29, "#020304");
    ellipse(
      xs[i],
      700,
      168,
      28,
      gradient(xs[i] - 168, 680, xs[i] + 168, 715, [
        [0, "#292f37"],
        [0.5, "#59616d"],
        [1, "#242930"],
      ]),
    );
    ellipse(
      xs[i],
      695,
      159,
      23,
      correct ? "#740e20" : selected ? "#333e4e" : "#161b22",
    );
    ctx.beginPath();
    ctx.ellipse(xs[i], 695, 162, 25, 0, 0, Math.PI * 2);
    ctx.strokeStyle = selected || correct ? C.red : "#566171";
    ctx.lineWidth = selected || correct ? 4 : 2;
    ctx.stroke();
    rect(xs[i] - 43, 748, 86, 54, correct || selected ? C.red : "#303741", 4);
    text(String(i + 1), xs[i], 776, 29, C.white, "center");
  }
  const objects = shell.slots.map((id, slot) => ({
    id,
    x: xs[slot],
    y: 0,
    scale: 1,
  }));
  if (phase === "shuffle") {
    const move = shell.moves[shell.index],
      t = clamp(elapsed / move.duration),
      e = ease(t);
    objects.forEach((obj, src) => {
      const dest = move.map[src];
      obj.x = xs[src] + (xs[dest] - xs[src]) * e;
      if (dest !== src) {
        obj.y = (dest > src ? -1 : 1) * Math.sin(t * Math.PI) * 60;
        obj.scale = 1 + obj.y * 0.00065;
      }
    });
    rect(630, 315, 340, 3, "#424954");
    rect(630, 315, (340 * (shell.index + t)) / shell.moves.length, 3, C.red);
  }
  const lift =
    phase === "show"
      ? 100
      : phase === "cover"
        ? 100 * (1 - ease(clamp(elapsed / 500)))
        : reveal
          ? result
            ? 100
            : 100 * ease(clamp(elapsed / 750))
          : 0;
  if (["show", "cover", "reveal", "result"].includes(phase)) {
    const obj = objects.find((o) => o.id === shell.ball);
    if (game === "cups") ball(obj.x, 652);
    else football(obj.x - 20, 652, 1.05);
  }
  objects
    .sort((a, b) => a.y - b.y)
    .forEach((o) => {
      ellipse(o.x, 688 + o.y * 0.2, 110 * o.scale, 15, "#0008");
      drawShellObject(o.x, o.y, lift, o.scale);
    });
  if (result && picked === win) confetti();
}

function gameReset() {
  shell = { slots: [0, 1, 2], ball: random(3), moves: [], index: 0 };
}
function gameStart() {
  picked = null;
  shell = {
    slots: [0, 1, 2],
    ball: random(3),
    moves: makeMoves(roundConfig),
    index: 0,
  };
  phaseTo("show");
}
function gamePick(index) {
  if (phase === "guess" && index < 3) {
    picked = index;
    sync();
    ping(450, 0.06);
  }
}
function gameTick() {
  if (phase === "show" && elapsed >= roundConfig.show) {
    elapsed -= roundConfig.show;
    phaseTo("cover");
  }
  if (phase === "cover" && elapsed >= 500) {
    elapsed -= 500;
    phaseTo("shuffle");
  }
  while (phase === "shuffle" && elapsed >= shell.moves[shell.index].duration) {
    const move = shell.moves[shell.index++];
    elapsed -= move.duration;
    const next = [];
    move.map.forEach((dest, src) => (next[dest] = shell.slots[src]));
    shell.slots = next;
    if (shell.index === shell.moves.length) {
      elapsed = 0;
      phaseTo("guess");
    }
  }
  if (phase === "reveal" && elapsed >= 750) {
    elapsed = 0;
    phaseTo("result");
  }
}
function gameStatus() {
  return {
    show: "Remember the starting position",
    cover: "Covering the ball",
    shuffle: "Shuffle in progress",
    guess:
      picked === null
        ? "Waiting for an audience pick"
        : `Choice ${picked + 1} selected. Reveal when ready.`,
    reveal: "Revealing...",
    result: `Ball under ${game === "cups" ? "cup" : "helmet"} ${shell.slots.indexOf(shell.ball) + 1}`,
  }[phase];
}
function gameDetail() {
  const p = prefs[game];
  return `${p.swap}ms base / ${p.moves} moves${p.chaos ? " / 3-way moves" : ""}`;
}
function gameCanvasPick(x, y) {
  if (y > 330 && y < 817) {
    const i = Math.round((x - 390) / 410);
    if (i >= 0 && i < 3 && Math.abs(x - (390 + i * 410)) < 180) pick(i);
  }
}
function gameDraw() {
  drawShell();
}
