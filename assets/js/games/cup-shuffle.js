// Cup artwork. Shared shuffle rules live in shell.js.
function cupShape(x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-84, -219);
    ctx.bezierCurveTo(-95, -178, -116, -44, -123, -15);
    ctx.bezierCurveTo(-132, 17, 132, 17, 123, -15);
    ctx.bezierCurveTo(116, -44, 95, -178, 84, -219);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = gradient(-130, 0, 130, 0, [
    [0, "#7c0012"],
    [0.2, "#ed182e"],
    [0.42, "#ff485a"],
    [0.6, "#db1328"],
    [1, "#7e0617"],
  ]);
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(0, -40 - i * 18, 123 - i * 3, 13, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#60061455";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  rect(-67, -240, 22, 280, "#ffffff13");
  ctx.restore();
  ellipse(0, -219, 84, 17, "#ff6572");
  ellipse(0, -222, 76, 11, "#c6162b");
  ellipse(0, -224, 63, 6, "#ff4b5c");
  ctx.beginPath();
  // Only the front rim is visible on an upside-down cup resting flat.
  ctx.ellipse(0, -8, 123, 21, 0, 0, Math.PI);
  ctx.strokeStyle = "#dce2ea";
  ctx.lineWidth = 7;
  ctx.stroke();
  rect(-83, -180, 166, 111, "#050607", 8);
  ctx.strokeStyle = "#8995a5";
  ctx.lineWidth = 2;
  ctx.strokeRect(-81, -178, 162, 107);
  logo("raider", -73, -173, 146, 100);
  text("LINCOLN", 0, -40, 16, C.white, "center");
  ctx.restore();
}
const drawShellObject = (x, y, lift, scale) =>
  cupShape(x, 676 + y - lift, scale);
