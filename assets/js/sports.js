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
