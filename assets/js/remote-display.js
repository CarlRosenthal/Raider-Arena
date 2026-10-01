// The display owns all simulation state; only safe operator-facing state is sent.
(() => {
  if (
    document.documentElement.dataset.arenaRemote !== "true" ||
    typeof fetch !== "function"
  )
    return;
  const storageKey = "raider-remote-display";
  const page = crypto.randomUUID();
  let link,
    credentials,
    paired = false,
    enabled = false,
    reconnecting = false;
  const processed = new Set();
  const panel = document.createElement("dialog");
  panel.id = "remote-pairing";
  panel.innerHTML =
    '<button type="button" id="remote-close">Close</button><h2>Connect a phone</h2><p>On your phone, sign in at <a id="remote-url" target="_blank" rel="noopener"></a> and enter this code.</p><p id="remote-code" class="pair-code"></p><p id="remote-status" role="status"></p><p>Codes last 10 minutes and pair one phone. A lost connection pauses an active game; resume when reconnected.</p><button id="remote-new">New pairing code</button> <button id="remote-end">End remote session</button><p>Click this desktop once to enable game audio. Fullscreen must also be entered on the desktop.</p>';
  document.body.appendChild(panel);
  const url = new URL("operator.html", document.baseURI);
  panel.querySelector("#remote-url").textContent = url.href;
  panel.querySelector("#remote-url").href = url.href;
  panel.querySelector("#remote-close").onclick = () => panel.close();
  const message = (text) => {
    panel.querySelector("#remote-status").textContent = text;
  };
  function hold() {
    if (active() && !paused) {
      paused = true;
      sync();
    }
  }
  function view() {
    const ui = controls.find((ui) => !ui.isOperator);
    if (!ui) return null;
    return {
      page,
      game,
      title: GAMES[game],
      phase,
      active: active(),
      paused,
      status: status(),
      sound,
      preset: prefs[game].preset,
      clean: document.body.classList.contains("clean"),
      advance: {
        label: ui.get("advance").textContent,
        disabled: ui.get("advance").disabled,
      },
      pause: {
        label: ui.get("pause").textContent,
        disabled: ui.get("pause").disabled,
      },
      choices: [...ui.get("pickers").children].map((b) => ({
        label: b.textContent,
        disabled: b.disabled,
        active: b.classList.contains("active"),
      })),
      settings: [...ui.mount.querySelectorAll("[data-setting]")]
        .filter((el) => el.style.display !== "none")
        .map((el) => {
          const input = el.querySelector("[data-setting-input]");
          return {
            key: input.dataset.settingInput,
            label: input.getAttribute("aria-label"),
            value: input.value,
            disabled: input.disabled,
            type: input.tagName === "SELECT" ? "select" : "range",
            min: input.min,
            max: input.max,
            step: input.step,
            options:
              input.tagName === "SELECT"
                ? [...input.options].map((o) => ({
                    value: o.value,
                    label: o.textContent,
                  }))
                : [],
          };
        }),
    };
  }
  function publish() {
    const state = view();
    if (state) link?.send({ type: "state", state });
  }
  function execute(data) {
    if (data.page !== page || processed.has(data.id)) {
      link.send({ type: "ack", id: data.id, ok: false });
      return;
    }
    processed.add(data.id);
    if (processed.size > 100) processed.delete(processed.values().next().value);
    settleClock();
    let ok = true;
    switch (data.action) {
      case "advance":
        advance();
        break;
      case "pause":
        pause();
        break;
      case "reset":
        reset();
        break;
      case "pick":
        pick(data.value);
        break;
      case "preset":
        changePreset(data.value);
        break;
      case "tune":
        tune(data.key, data.value);
        break;
      case "sound":
        sound = data.value;
        if (!sound) stopSounds();
        sync();
        break;
      case "hide":
        clean();
        break;
      case "game":
        if (!Object.hasOwn(GAME_PAGES, data.value)) {
          ok = false;
          break;
        }
        link.send({ type: "ack", id: data.id, ok: true });
        location.href = GAME_PAGES[data.value];
        return;
      default:
        ok = false;
    }
    link.send({ type: "ack", id: data.id, ok });
    publish();
  }
  function connect() {
    link?.stop();
    link = new ArenaRemote.Link(
      credentials,
      (data) => {
        if (data.type === "command") execute(data);
        if (data.type === "request-state") publish();
        if (data.type === "presence") {
          if (paired && !data.operator) hold();
          paired = paired || data.operator;
          panel.querySelector("#remote-code").textContent = paired
            ? "Paired"
            : credentials.code;
          message(
            data.operator
              ? "Phone connected. Ready to operate."
              : paired
                ? "Phone disconnected. Waiting for reconnection."
                : "Waiting for your phone…",
          );
        }
      },
      (state) => {
        if (state === "disconnected") {
          hold();
          reconnecting = true;
          message("Connection lost. Reconnecting…");
        }
        if (state === "connected") {
          if (reconnecting) hold();
          reconnecting = false;
          publish();
        }
        if (state === "ended") {
          hold();
          sessionStorage.removeItem(storageKey);
          credentials = null;
          message(
            "Session ended or expired. Generate a new code to reconnect.",
          );
          panel.querySelector("#remote-code").textContent = "—";
        }
      },
    );
  }
  async function end() {
    if (credentials)
      await ArenaRemote.api(`/api/rooms/${credentials.code}/end`, {
        token: credentials.token,
      });
    link?.stop();
    credentials = null;
    paired = false;
    sessionStorage.removeItem(storageKey);
    hold();
    panel.querySelector("#remote-code").textContent = "—";
    message("Remote session ended.");
  }
  panel.querySelector("#remote-new").onclick = async () => {
    const button = panel.querySelector("#remote-new");
    button.disabled = true;
    try {
      await end();
      credentials = await ArenaRemote.api("/api/rooms", {});
      sessionStorage.setItem(storageKey, JSON.stringify(credentials));
      panel.querySelector("#remote-code").textContent = credentials.code;
      paired = false;
      connect();
    } catch (error) {
      message(error.message);
    } finally {
      button.disabled = false;
    }
  };
  panel.querySelector("#remote-end").onclick = () =>
    end().catch((e) => message(e.message));
  ArenaRemote.api("/api/config")
    .then((config) => {
      if (!config.remote) return;
      enabled = true;
      const button = document.createElement("button");
      button.textContent = "Connect phone";
      button.dataset.role = "remote";
      button.onclick = () => {
        unlockAudio();
        panel.showModal();
      };
      document.querySelector("#desk .tools").appendChild(button);
      const logout = document.createElement("button");
      logout.textContent = "Sign out";
      logout.onclick = async () => {
        if (active() && !confirm("End this round and sign out?")) return;
        try {
          await end();
          await ArenaRemote.api("/api/logout", {});
          location.href = "/login";
        } catch (error) {
          toast(error.message);
        }
      };
      document.querySelector("#desk .tools").appendChild(logout);
      try {
        credentials = JSON.parse(sessionStorage.getItem(storageKey));
      } catch {}
      if (credentials && credentials.expiresAt > Date.now()) {
        panel.querySelector("#remote-code").textContent = credentials.code;
        connect();
      } else sessionStorage.removeItem(storageKey);
    })
    .catch(() => {}); // Static/offline pages retain their original local controls.
  setInterval(() => {
    if (enabled && link) publish();
  }, 500);
  window.addEventListener("pagehide", () => link?.stop());
})();
