// Canvas sizing, event listeners, and animation loop. Load this script last.
function draw() {
  ctx.setTransform(canvas.width / 1600, 0, 0, canvas.height / 900, 0, 0);
  base();
  gameDraw();
  if (paused) {
    rect(0, 116, 1600, 716, "#000b");
    rect(570, 381, 460, 158, "#07090c", 6);
    pill("OPERATOR HOLD", 690, 399, 220);
    text("PLAY PAUSED", 800, 488, 40, C.white, "center");
  }
}
function resize() {
  const host = document.getElementById("screen"),
    w = Math.max(1, Math.min(host.clientWidth, (host.clientHeight * 16) / 9)),
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = w + "px";
  canvas.style.height = (w * 9) / 16 + "px";
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(((w * 9) / 16) * dpr);
}
canvas.addEventListener("click", (e) => {
  settleClock();
  const r = canvas.getBoundingClientRect(),
    x = ((e.clientX - r.left) * 1600) / r.width,
    y = ((e.clientY - r.top) * 900) / r.height;
  gameCanvasPick(x, y);
});
document.addEventListener("keydown", keyDown);
document.getElementById("closeHelp").onclick = () =>
  document.getElementById("help").close();
document.addEventListener("visibilitychange", () => {
  if (document.hidden && active() && !paused) {
    paused = true;
    sync();
  }
  last = performance.now();
});
window.addEventListener("resize", resize);
window.addEventListener("beforeunload", () => {
  if (operator && !operator.closed) operator.close();
});
reset();
makeControls(document, document.getElementById("desk"));
resize();
if (window.ResizeObserver)
  new ResizeObserver(resize).observe(document.getElementById("screen"));
function frame(now) {
  const dt = last ? Math.max(0, now - last) : 0;
  last = now;
  tick(dt);
  if (now - lastStatus > 100) {
    lastStatus = now;
    controls
      .filter((ui) => !ui.isOperator || (operator && !operator.closed))
      .forEach((ui) => (ui.get("message").textContent = status()));
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).has("test"))
  window.raiderTest = {
    chooseGame,
    changePreset,
    tune,
    start,
    advance,
    pick,
    reset,
    pause,
    tick,
    draw,
    snapshot: () =>
      JSON.parse(
        JSON.stringify({
          game,
          phase,
          round,
          paused,
          elapsed,
          visualTime,
          picked,
          roundConfig,
          prefs,
          shell,
          race,
          memory,
        }),
      ),
  };
