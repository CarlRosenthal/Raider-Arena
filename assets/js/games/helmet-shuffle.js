// Helmet artwork. Shared shuffle rules live in shell.js.
function helmetShape(x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-106, 73);
  ctx.lineTo(-115, 3);
  ctx.bezierCurveTo(-123, -129, 63, -157, 105, -54);
  ctx.lineTo(111, -3);
  ctx.lineTo(55, 8);
  ctx.lineTo(40, 73);
  ctx.closePath();
  ctx.fillStyle = gradient(-100, -120, 92, 85, [
    [0, "#ff7280"],
    [0.22, "#f52039"],
    [0.62, "#c20b25"],
    [1, "#5d0011"],
  ]);
  ctx.fill();
  ctx.strokeStyle = "#d8dce4";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-94, -51);
  ctx.bezierCurveTo(-65, -124, 37, -134, 81, -65);
  ctx.strokeStyle = "#ffffff45";
  ctx.lineWidth = 8;
  ctx.stroke();
  rect(-77, -81, 111, 77, "#050607", 6);
  logo("raider", -73, -78, 103, 71);
  ctx.strokeStyle = "#6f7b8d";
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(45, 20);
  ctx.lineTo(143, 29);
  ctx.lineTo(121, 87);
  ctx.lineTo(44, 76);
  ctx.moveTo(54, 49);
  ctx.lineTo(136, 56);
  ctx.stroke();
  ctx.strokeStyle = "#dce4f0";
  ctx.lineWidth = 6;
  ctx.stroke();
  ellipse(29, 30, 15, 15, "#8d98aa");
  ellipse(29, 30, 9, 9, C.white);
  ellipse(29, 30, 4, 4, "#161b22");
  rect(-103, 34, 8, 18, "#710817", 3);
  rect(-89, 38, 8, 18, "#710817", 3);
  ctx.restore();
}
const drawShellObject = (x, y, lift, scale) =>
  helmetShape(x, 599 + y - lift, 1.04 * scale);
