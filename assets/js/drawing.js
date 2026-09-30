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
    785,
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
  text("LINCOLN HIGH SCHOOL", 185, 62, 27);
  text(titlesafe(), 1545, 62, 38, C.white, "right");
  line(55, 115, 1545, 115, "#454950", 1);
}
function titlesafe() {
  return GAMES[game];
}
function banner(main) {
  text(main, 800, 245, 36, C.white, "center");
}
let confettiParticles = [],
  confettiStart = 0;
function resetConfetti() {
  confettiStart = visualTime;
  confettiParticles = Array.from({ length: 145 }, () => ({
    x: Math.random() * 1600,
    y: 100 + Math.random() * 250,
    vx: (Math.random() - 0.5) * 360,
    vy: -80 - Math.random() * 260,
    gravity: 110 + Math.random() * 130,
    delay: Math.random() * 0.8,
    spin: (Math.random() - 0.5) * 12,
    sway: 10 + Math.random() * 50,
    seed: Math.random() * Math.PI * 2,
    size: 5 + Math.random() * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
}
function confetti() {
  const seconds = (visualTime - confettiStart) / 1000;
  for (const p of confettiParticles) {
    const t = seconds - p.delay;
    if (t < 0) continue;
    const x = p.x + p.vx * t + p.sway * Math.sin(t * 3 + p.seed),
      y = p.y + p.vy * t + 0.5 * p.gravity * t * t;
    if (y > 930 || x < -40 || x > 1640) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.seed + p.spin * t);
    ctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(p.seed + t * 5)));
    rect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65, p.color, 1);
    ctx.restore();
  }
}
