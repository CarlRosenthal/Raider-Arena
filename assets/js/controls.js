// Operator controls, popup console, keyboard shortcuts, and navigation.
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.display = "none"), 4500);
}
function full() {
  try {
    const result = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    result?.catch(() =>
      toast("Use F11 in your main game window to enter browser fullscreen."),
    );
  } catch {
    toast("Use F11 in your main game window for fullscreen.");
  }
}
function clean() {
  document.body.classList.toggle("clean");
  resize();
}
function help() {
  if (active() && !paused) {
    paused = true;
    sync();
  }
  document.getElementById("help").showModal();
}
const ICONS = {
  full: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  hide: '<path d="M2 3l20 18M9 5a12 12 0 0 1 13 7 14 14 0 0 1-4 5M6 6a16 16 0 0 0-4 6c4 7 10 9 16 5"/>',
  tune: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9c0-4 7-4 6 0 0 2-3 2-3 5m0 3v1"/>',
};
function symbol(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${ICONS[name]}</svg>`;
}
function slider(key, label, min, max, step) {
  return `<div class="setting" data-setting="${key}"><label>${label} <output data-output="${key}"></output></label><input aria-label="${label}" data-setting-input="${key}" type="range" min="${min}" max="${max}" step="${step}"></div>`;
}
function choiceSetting(key, label, choices) {
  return `<div class="setting" data-setting="${key}"><label>${label}</label><select data-setting-input="${key}" aria-label="${label}">${choices.map(([value, title]) => `<option value="${value}">${title}</option>`).join("")}</select></div>`;
}
function makeControls(doc, mount, isOperator = false) {
  mount.innerHTML = `<div class="row games"><div class="row"><button data-role="home">← Game hub</button>${Object.entries(
    GAMES,
  )
    .map(
      ([key, title]) =>
        `<button data-game="${key}">${key === "race" ? "Rally Race" : key === "cups" ? "Cup Shuffle" : key === "helmet" ? "Helmet Shuffle" : "Memory Match"}</button>`,
    )
    .join(
      "",
    )}</div><div class="row"><select aria-label="Difficulty or race pace" data-role="preset">${Object.entries(
    PRESETS,
  )
    .map(([id, p]) => `<option value="${id}">${p.name}</option>`)
    .join(
      "",
    )}<option value="custom" disabled>Custom</option></select><button data-role="tune" title="Adjust speed and difficulty">${symbol("tune")} Tuning</button><span data-role="detail" class="muted"></span></div></div><div class="row actions"><div class="tools"><button class="primary" data-role="advance">Start round</button><button data-role="pause">Pause</button><button data-role="reset">Reset</button>${isOperator ? "" : `<button data-role="operator">Operator window</button><button data-role="full" title="Fullscreen (F)" aria-label="Fullscreen">${symbol("full")}</button><button data-role="hide" title="Hide controls (H)" aria-label="Hide controls">${symbol("hide")}</button><button data-role="help" title="Help (?)" aria-label="Help">${symbol("help")}</button>`}</div><div class="pickers" data-role="pickers"></div><div class="status" data-role="message" aria-live="polite"></div></div><div class="tuning" data-role="tuning" ${isOperator ? "" : "hidden"}>${choiceSetting(
    "cups",
    "Number of cups",
    [
      [3, "3 cups"],
      [4, "4 cups"],
      [5, "5 cups"],
    ],
  )}${choiceSetting("ball", "Ball style", [
    ["normal", "Normal ball"],
    ["football", "Football"],
    ["soccer", "Soccer ball"],
    ["volleyball", "Volleyball"],
  ])}${choiceSetting("pairs", "Memory pairs", [
    [4, "4 pairs / 8 cards"],
    [5, "5 pairs / 10 cards"],
    [6, "6 pairs / 12 cards"],
    [7, "7 pairs / 14 cards"],
    [8, "8 pairs / 16 cards"],
  ])}${choiceSetting("timerClick", "Timer clicking sound", [
    ["false", "Off"],
    ["true", "On"],
  ])}${slider("swap", "Base swap time (ms)", 60, 1200, 5)}${slider("moves", "Shuffle moves", 6, 60, 1)}${slider("show", "Ball preview (ms)", 400, 3000, 100)}<div class="setting" data-setting="chaos"><label>Movement</label><select data-setting-input="chaos" aria-label="Shuffle movement"><option value="false">Two-object swaps</option><option value="true">Include three-way moves</option></select></div>${slider("race", "Race duration (seconds)", 3, 45, 1)}${slider("memory", "Memory clock (seconds)", 6, 120, 1)}${slider("hold", "Mismatch display (ms)", 80, 1200, 10)}<div class="setting"><label class="audio"><input type="checkbox" data-role="sound"> Game sounds</label><span class="muted">Changes apply to the next round.</span></div></div>`;
  const ui = {
    doc,
    mount,
    isOperator,
    get: (name) => mount.querySelector(`[data-role="${name}"]`),
  };
  controls.push(ui);
  mount
    .querySelectorAll("[data-game]")
    .forEach((b) => (b.onclick = () => chooseGame(b.dataset.game)));
  ui.get("home").onclick = () => navigateTo("index.html");
  ui.get("advance").onclick = action(advance);
  ui.get("pause").onclick = action(pause);
  ui.get("reset").onclick = action(resetRequested);
  ui.get("preset").onchange = (e) => changePreset(e.target.value);
  ui.get("tune").onclick = () => {
    const el = ui.get("tuning");
    el.hidden = !el.hidden;
    resize();
  };
  mount
    .querySelectorAll("[data-setting-input]")
    .forEach(
      (el) =>
        (el.oninput = (e) =>
          tune(
            el.dataset.settingInput,
            el.dataset.settingInput === "chaos"
              ? e.target.value === "true"
              : e.target.value,
          )),
    );
  ui.get("sound").onchange = (e) => {
    sound = e.target.checked;
    if (!sound) stopSounds();
    ping(600, 0.08);
    sync();
  };
  if (!isOperator) {
    ui.get("operator").onclick = openOperator;
    ui.get("full").onclick = full;
    ui.get("hide").onclick = clean;
    ui.get("help").onclick = help;
  }
  sync();
  return ui;
}
function sync() {
  if (paused) stopSounds();
  updateEngineSound();
  controls = controls.filter(
    (ui) => !ui.isOperator || (operator && !operator.closed),
  );
  for (const ui of controls) {
    ui.mount.querySelectorAll("[data-game]").forEach((b) => {
      b.classList.toggle("active", b.dataset.game === game);
      b.setAttribute("aria-pressed", String(b.dataset.game === game));
    });
    ui.get("preset").value = prefs[game].preset;
    ui.get("preset").disabled = active();
    ui.get("detail").textContent = detail();
    ui.get("sound").checked = sound;
    ui.get("advance").textContent =
      phase === "ready"
        ? "Start round"
        : phase === "result"
          ? "Next round"
          : isShell() && phase === "guess"
            ? "Reveal"
            : "In progress";
    ui.get("advance").disabled =
      paused ||
      !(
        ["ready", "result"].includes(phase) ||
        (isShell() && phase === "guess")
      );
    ui.get("pause").textContent = paused ? "Resume" : "Pause";
    ui.get("pause").disabled = !active();
    ui.get("message").textContent = status();
    ui.mount.querySelectorAll("[data-setting]").forEach((el) => {
      const k = el.dataset.setting;
      el.style.display = (isShell()
        ? [
            "swap",
            "moves",
            "show",
            "chaos",
            ...(game === "cups" ? ["cups", "ball"] : []),
          ]
        : game === "race"
          ? ["race"]
          : ["memory", "hold", "pairs", "timerClick"]
      ).includes(k)
        ? ""
        : "none";
    });
    ui.mount.querySelectorAll("[data-setting-input]").forEach((el) => {
      const key = el.dataset.settingInput;
      el.value = String(prefs[game][key]);
      el.disabled = active();
    });
    ui.mount
      .querySelectorAll("[data-output]")
      .forEach(
        (el) => (el.textContent = String(prefs[game][el.dataset.output])),
      );
    const count =
        game === "memory" ? memoryPairs() * 2 : isShell() ? shellCount() : 3,
      box = ui.get("pickers");
    box.classList.toggle("memory-pickers", game === "memory");
    if (box.children.length !== count) {
      box.replaceChildren();
      for (let i = 0; i < count; i++) {
        const b = ui.doc.createElement("button");
        b.textContent = String(i + 1);
        b.onclick = action(() => pick(i));
        box.appendChild(b);
      }
    }
    [...box.children].forEach((b, i) => {
      if (game === "memory") {
        const matched = memory.matched.includes(i),
          opened = memory.open.includes(i);
        b.textContent = `${i + 1}${matched ? " ✓" : opened ? " •" : ""}`;
        b.classList.toggle("open-card", opened);
        b.setAttribute("aria-pressed", String(matched || opened));
      }
      b.setAttribute(
        "aria-label",
        (game === "memory" ? "Card " : "Choice ") +
          (i + 1) +
          (game === "memory" && memory.matched.includes(i) ? ", matched" : ""),
      );
      b.disabled =
        paused ||
        (game === "memory"
          ? phase !== "playing" ||
            memory.open.length === 2 ||
            memory.matched.includes(i) ||
            memory.open.includes(i)
          : game === "race"
            ? phase !== "ready"
            : phase !== "guess");
      b.classList.toggle(
        "active",
        game === "memory" ? memory.matched.includes(i) : picked === i,
      );
    });
  }
}
function openOperator() {
  if (operator && !operator.closed) {
    operator.focus();
    return;
  }
  operator = window.open(
    "",
    "RaiderArenaOperator-" + game,
    "width=1160,height=740",
  );
  if (!operator) {
    toast("Allow pop-ups for this site, then open the operator window again.");
    return;
  }
  operator.document.open();
  operator.document.write(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      GAMES[game] +
      ' | Operator</title><link rel="stylesheet" href="' +
      new URL("assets/css/arena.css", document.baseURI).href +
      '"></head><body class="op"><h1>' +
      GAMES[game] +
      '</h1><p class="muted">OPERATOR CONSOLE</p><section id="panel"></section><p class="muted">Space: start / reveal &nbsp; P: pause &nbsp; Memory: number + Enter</p></body></html>',
  );
  operator.document.close();
  makeControls(
    operator.document,
    operator.document.getElementById("panel"),
    true,
  );
  operator.document.addEventListener("keydown", keyDown);
  operator.focus();
}
function keyDown(e) {
  if (
    e.target.matches("input,select,textarea") ||
    ((e.key === " " || e.key === "Enter") && e.target.closest("button,a")) ||
    document.getElementById("help").open
  )
    return;
  settleClock();
  const k = e.key.toLowerCase();
  if (k === " ") {
    e.preventDefault();
    if (!e.repeat) advance();
  } else if (k === "enter") {
    e.preventDefault();
    if (e.repeat) return;
    if (game === "memory" && phase === "playing" && digits) {
      pick(Number(digits) - 1);
      digits = "";
      sync();
    } else advance();
  } else if (/^\d$/.test(k)) {
    e.preventDefault();
    if (e.repeat) return;
    if (game === "memory" && phase === "playing") {
      if (performance.now() - digitAt > 2000) digits = "";
      digits = (digits + k).slice(-2);
      if (Number(digits) > memoryPairs() * 2) digits = k;
      digitAt = performance.now();
      sync();
    } else if (+k >= 1 && +k <= (game === "cups" ? shellCount() : 3))
      pick(+k - 1);
  } else if (k === "backspace") {
    e.preventDefault();
    digits = "";
    sync();
  } else if (!e.repeat) {
    if (k === "p") pause();
    else if (k === "r") resetRequested();
    else if (k === "f") full();
    else if (k === "h") clean();
    else if (k === "o") openOperator();
    else if (k === "?") help();
  }
}
