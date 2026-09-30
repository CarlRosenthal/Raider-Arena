function ball(x, y) {
  ellipse(x, y + 33, 42, 10, "#0009");
  const g = ctx.createRadialGradient(x - 12, y - 15, 2, x, y, 31);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.55, "#e3e7ed");
  g.addColorStop(1, "#7c8695");
  ellipse(x, y, 31, 31, g);
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 23, -1.7, 0.4);
  ctx.stroke();
}
function football(x, y, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.rotate(-0.18);
  ctx.fillStyle = gradient(-30, -24, 30, 28, [
    [0, "#ec9c56"],
    [0.4, "#a94a25"],
    [1, "#502416"],
  ]);
  ctx.beginPath();
  ctx.moveTo(-48, 0);
  ctx.bezierCurveTo(-22, -40, 22, -40, 48, 0);
  ctx.bezierCurveTo(22, 40, -22, 40, -48, 0);
  ctx.fill();
  ctx.strokeStyle = "#ffdab7";
  ctx.lineWidth = 2;
  ctx.stroke();
  line(-30, -16, -30, 16, C.white, 5);
  line(30, -16, 30, 16, C.white, 5);
  line(-17, -5, 17, -5, C.white, 3);
  for (let i = -12; i <= 12; i += 8) line(i, -11, i, 1, C.white, 3);
  ctx.restore();
}

function soccerBall(x, y, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ellipse(
    0,
    0,
    34,
    34,
    gradient(-20, -25, 25, 30, [
      [0, "#fff"],
      [1, "#aeb8c7"],
    ]),
  );
  const pentagon = (cx, cy, r, angle) =>
    Array.from({ length: 5 }, (_, i) => [
      cx + r * Math.cos(angle + (i * Math.PI * 2) / 5),
      cy + r * Math.sin(angle + (i * Math.PI * 2) / 5),
    ]);
  const center = pentagon(0, 0, 13, -Math.PI / 2);
  poly(center, "#19212c");
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.clip();
  center.forEach(([px, py], i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const ex = Math.cos(a) * 35,
      ey = Math.sin(a) * 35;
    line(px, py, ex, ey, "#657183", 2);
    poly(pentagon(ex, ey, 12, a), "#19212c");
  });
  ctx.restore();
  ctx.restore();
}
function volleyball(x, y, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ellipse(
    0,
    0,
    34,
    34,
    gradient(-20, -25, 25, 30, [
      [0, "#fff"],
      [1, "#bcc5d2"],
    ]),
  );
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "#657183";
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    for (const offset of [0, 10, 20]) {
      ctx.beginPath();
      ctx.moveTo(-offset, 34);
      ctx.bezierCurveTo(17 - offset, 12, 12 - offset, -10, 0, -34);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.restore();
}
function selectedBall(kind, x, y, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  if (kind === "football") football(0, 0, 0.85);
  else if (kind === "soccer") soccerBall(0, 0);
  else if (kind === "volleyball") volleyball(0, 0);
  else ball(0, 0);
  ctx.restore();
}
