// Shared canvas primitives and arena branding.
function rect(x, y, w, h, fill, r = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function line(x, y, x2, y2, color, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function text(
  s,
  x,
  y,
  size = 24,
  color = C.white,
  align = "left",
  weight = 700,
) {
  ctx.font = `${weight} ${size}px Arial`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}
function ellipse(x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function poly(points, fill) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function gradient(x, y, x2, y2, stops) {
  const g = ctx.createLinearGradient(x, y, x2, y2);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  return g;
}
function logo(kind, x, y, w, h) {
  const im = art[kind];
  if (!im.complete || !im.naturalWidth) return;
  const crop = kind === "raider" ? [474, 217, 594, 389] : [495, 231, 545, 391],
    s = Math.min(w / crop[2], h / crop[3]);
  ctx.drawImage(
    im,
    ...crop,
    x + (w - crop[2] * s) / 2,
    y + (h - crop[3] * s) / 2,
    crop[2] * s,
    crop[3] * s,
  );
}
function pill(label, x, y, w, fill = C.red) {
  rect(x, y, w, 36, fill, 3);
  text(label, x + w / 2, y + 19, 16, C.white, "center");
}
function base() {
  rect(0, 0, 1600, 900, C.black);
  rect(
    0,
    115,
    1600,
    715,
    gradient(0, 115, 0, 830, [
      [0, "#171b20"],
      [0.55, "#0d1014"],
      [1, "#171a1f"],
    ]),
  );
  // Stationary arena architecture keeps moving game objects easy to track.
  for (let i = 0; i < 12; i++) {
    line(0, 345 + i * 40, 1600, 345 + i * 40, "#ffffff03", 1);
  }
  poly(
    [
      [0, 116],
      [31, 116],
      [160, 345],
      [129, 345],
    ],
    "#a90d20",
  );
  poly(
    [
      [1600, 116],
      [1569, 116],
      [1440, 345],
      [1471, 345],
    ],
    "#a90d20",
  );
  rect(0, 0, 1600, 7, C.red);
  rect(0, 7, 1600, 109, "#060708");
  logo("wr", 55, 24, 108, 77);
  text("LINCOLN HIGH SCHOOL", 185, 48, 25);
  text("WISCONSIN RAPIDS  /  RED RAIDERS", 185, 82, 16, C.silver);
  pill("RAIDER ARENA", 1300, 32, 245);
  line(55, 115, 1545, 115, "#454950", 1);
  text(titlesafe(), 55, 172, 46);
  rect(55, 211, 70, 4, C.red);
  const name = presetName();
  pill(name, 1295, 146, 250, name === "IMPOSSIBLE" ? "#9c0e1d" : "#30353c");
  text(
    `ROUND ${String(round).padStart(2, "0")}`,
    1545,
    205,
    17,
    C.silver,
    "right",
  );
  rect(0, 832, 1600, 68, "#060708");
  line(55, 832, 1545, 832, C.red, 2);
  text("RAIDER NATION", 55, 866, 19);
  text("RED. WHITE. RAIDER PRIDE.", 1545, 866, 17, C.silver, "right");
}
function titlesafe() {
  return GAMES[game];
}
function banner(main, sub = "") {
  text(main, 800, 261, 32, C.white, "center");
  if (sub) text(sub, 800, 300, 18, C.silver, "center", 400);
}
function confetti() {
  for (let i = 0; i < 55; i++) {
    const x = (i * 263 + Math.sin(i) * 90) % 1600,
      y = ((i * 127 + visualTime * 0.1) % 690) + 125;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(i + visualTime * 0.0015);
    rect(-3, -5, 6, 11, COLORS[i % 3]);
    ctx.restore();
  }
}
