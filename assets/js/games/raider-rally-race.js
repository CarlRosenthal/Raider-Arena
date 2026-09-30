// Three lanes, random winners, race timing, and car artwork.
function raceProgress(id) {
  if (["ready", "countdown"].includes(phase)) return 0;
  const t = Math.min(1, elapsed / race.finish[id]);
  return clamp(
    t + 0.047 * Math.sin(t * Math.PI) * Math.sin(t * 12 + race.waves[id]),
  );
}
function car(x, y, id, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const color = COLORS[id];
  ellipse(0, 7, 106, 13, "#000a");
  if (phase === "racing") {
    const pulse = 8 + 6 * Math.sin(visualTime * 0.04);
    poly(
      [
        [-91, -25],
        [-115 - pulse, -17],
        [-91, -11],
      ],
      id === 0 ? "#ff6975" : "#cbd7e8",
    );
    line(-139, -22, -120, -22, "#b6bfcd66", 3);
  }
  rect(-98, -29, 20, 10, "#707887", 2);
  rect(-91, -52, 9, 26, color, 2);
  rect(-109, -55, 48, 7, color, 2);
  poly(
    [
      [-91, -31],
      [-63, -48],
      [-34, -55],
      [-14, -76],
      [32, -76],
      [62, -49],
      [85, -40],
      [99, -17],
      [88, -6],
      [-87, -6],
    ],
    gradient(0, -77, 0, 0, [
      [0, id === 0 ? "#ff7180" : "#ffffff"],
      [0.4, color],
      [1, id === 0 ? "#950b20" : "#6e7889"],
    ]),
  );
  poly(
    [
      [-8, -70],
      [28, -70],
      [51, -48],
      [-26, -48],
    ],
    "#131d28",
  );
  poly(
    [
      [2, -67],
      [26, -67],
      [37, -57],
      [-7, -57],
    ],
    "#788a9b",
  );
  line(11, -71, 11, -48, "#adbacb", 3);
  rect(-39, -40, 71, 27, "#050607", 4);
  logo("wr", -19, -40, 39, 27);
  text(String(id + 1), -65, -27, 18, id === 0 ? C.white : C.black, "center");
  line(41, -38, 80, -30, "#ffffff99", 3);
  rect(79, -32, 15, 7, "#fff2ca", 2);
  rect(-85, -25, 9, 7, C.red, 2);
  rect(-87, -8, 175, 6, "#48515e", 2);
  for (const wx of [-59, 62]) {
    ellipse(wx, -4, 23, 23, "#07090c");
    ellipse(wx, -4, 17, 17, "#8895a7");
    ellipse(wx, -4, 12, 12, "#151b23");
    const a = phase === "racing" ? visualTime * 0.018 : 0;
    for (let j = 0; j < 5; j++) {
      const t = a + (j * Math.PI * 2) / 5;
      line(
        wx + Math.cos(t) * 4,
        -4 + Math.sin(t) * 4,
        wx + Math.cos(t) * 14,
        -4 + Math.sin(t) * 14,
        "#e3e9f2",
        3,
      );
    }
    ellipse(wx, -4, 4, 4, C.red);
  }
  ctx.restore();
}
function drawRace() {
  const result = phase === "result",
    ready = phase === "ready";
  banner(
    result
      ? `${TEAMS[race.winner]} TAKES THE CHECKERED FLAG!`
      : ready
        ? "CHOOSE YOUR LANE. BACK YOUR TEAM."
        : phase === "countdown"
          ? "ON THE GRID. READY TO RALLY."
          : "BRING IT HOME, RAIDERS!",
    result
      ? "MAKE SOME NOISE FOR THE WINNER!"
      : ready
        ? "1 / RED     2 / WHITE     3 / SILVER"
        : "",
  );
  for (let i = 0; i < 3; i++) {
    const y = 358 + i * 141;
    rect(
      55,
      y,
      1490,
      128,
      gradient(0, y, 0, y + 128, [
        [0, "#30363d"],
        [0.4, "#1d2229"],
        [1, "#161b20"],
      ]),
      4,
    );
    rect(55, y, 194, 128, "#0e1115", 4);
    rect(55, y, 6, 128, COLORS[i]);
    text(String(i + 1), 90, y + 46, 33, COLORS[i], "center");
    text(TEAMS[i], 126, y + 46, 25, COLORS[i]);
    if (picked === i) text("YOUR PICK", 126, y + 84, 13, C.red);
    for (let x = 276; x < 1400; x += 94) {
      line(x, y + 117, x + 48, y + 117, "#8a929d55", 2);
      line(x, y + 12, x + 48, y + 12, "#8a929d22", 1);
    }
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 2; col++)
        rect(
          1450 + col * 12,
          y + row * 16,
          12,
          16,
          (row + col) % 2 ? "#090b0e" : "#dbe0e7",
        );
    line(255, y, 255, y + 127, "#666f7d", 2);
    const p = raceProgress(i);
    car(354 + (1370 - 354) * p, y + 92, i, 0.82);
    if (result) {
      const place = race.order.indexOf(i) + 1;
      pill(
        place === 1 ? "WINNER" : place === 2 ? "2ND" : "3RD",
        1000,
        y + 44,
        180,
        place === 1 ? C.red : "#444d5a",
      );
    }
  }
  if (phase === "racing") {
    const leader = [0, 1, 2].sort(
      (a, b) => raceProgress(b) - raceProgress(a),
    )[0];
    pill(`${TEAMS[leader]} LEADS`, 680, 793, 240, "#303741");
  }
  if (phase === "countdown") {
    rect(602, 483, 396, 102, "#050607", 8);
    const lights = 3 - Math.floor(elapsed / 1000);
    for (let i = 0; i < 3; i++) {
      ellipse(698 + i * 102, 534, 33, 33, i < lights ? C.red : "#272d35");
      ellipse(689 + i * 102, 525, 9, 9, i < lights ? "#ff6072" : "#343c47");
    }
  }
  if (result) confetti();
}

function gameReset() {
  race = {};
}
function gameStart() {
  const order = shuffled([0, 1, 2]),
    duration = roundConfig.race * 1000;
  race = {
    order,
    duration,
    finish: [0, 0, 0],
    waves: [random(628) / 100, random(628) / 100, random(628) / 100],
    winner: order[0],
  };
  order.forEach(
    (id, rank) =>
      (race.finish[id] = duration + rank * Math.min(380, duration * 0.025)),
  );
  phaseTo("countdown");
}
function gamePick(index) {
  if (phase === "ready" && index < 3) {
    picked = index;
    sync();
  }
}
function gameTick() {
  if (phase === "countdown" && elapsed >= 3000) {
    elapsed -= 3000;
    phaseTo("racing");
    ping(1000, 0.2);
  }
  if (phase === "racing" && elapsed >= Math.max(...race.finish)) {
    elapsed = Math.max(...race.finish);
    phaseTo("result");
  }
}
function gameStatus() {
  return phase === "result"
    ? `${TEAMS[race.winner]} wins!`
    : phase === "countdown"
      ? "Starting countdown"
      : "Race in progress";
}
function gameDetail() {
  return `${prefs[game].race}s sprint / random winner`;
}
function gameCanvasPick(x, y) {
  if (y >= 358 && y < 768) pick(Math.floor((y - 358) / 141));
}
function gameDraw() {
  drawRace();
}
