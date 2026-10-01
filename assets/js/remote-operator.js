(() => {
  const $ = (id) => document.getElementById(id),
    storageKey = "raider-remote-operator";
  let credentials,
    link,
    state,
    connected = false,
    host = false,
    pending = null,
    lastState = 0,
    settingsKey = "";
  const notice = (text) => ($("notice").textContent = text);
  function availability() {
    $("actions").disabled =
      !connected ||
      !host ||
      !state ||
      Date.now() - lastState > 5000 ||
      !!pending;
  }
  function send(action, value, key) {
    if ($("actions").disabled) return;
    if (
      (action === "reset" || action === "game") &&
      state.active &&
      !confirm("End the current round?")
    ) {
      render(state);
      return;
    }
    const id = crypto.randomUUID();
    pending = id;
    availability();
    notice("");
    if (
      !link.send({
        type: "command",
        id,
        page: state.page,
        action,
        value,
        key,
        sentAt: Date.now(),
      })
    ) {
      pending = null;
      availability();
      notice("Disconnected. Command was not sent.");
      return;
    }
    setTimeout(() => {
      if (pending === id) {
        pending = null;
        availability();
        notice(
          "No confirmation from the display. Check the board before trying again.",
        );
      }
    }, 4000);
  }
  function render(next) {
    state = next;
    lastState = Date.now();
    $("game-title").textContent = state.title;
    $("game-status").textContent = state.status;
    $("advance").textContent = state.advance.label;
    $("advance").disabled = state.advance.disabled;
    $("pause").textContent = state.pause.label;
    $("pause").disabled = state.pause.disabled;
    $("sound").checked = state.sound;
    $("hide").textContent = state.clean
      ? "Show board controls"
      : "Hide board controls";
    if (document.activeElement !== $("game")) $("game").value = state.game;
    $("preset").disabled = state.active;
    if (document.activeElement !== $("preset"))
      $("preset").value = state.preset;
    $("choices-label").textContent =
      state.game === "memory"
        ? "Cards (same positions as the board)"
        : "Choose a " +
          (state.game === "race"
            ? "lane"
            : state.game === "helmet"
              ? "helmet"
              : "cup");
    $("choices").classList.toggle("memory", state.game === "memory");
    if ($("choices").children.length !== state.choices.length) {
      $("choices").replaceChildren();
      state.choices.forEach((_, i) => {
        const b = document.createElement("button");
        b.onclick = () => send("pick", i);
        $("choices").appendChild(b);
      });
    }
    state.choices.forEach((choice, i) => {
      const b = $("choices").children[i];
      b.textContent = choice.label;
      b.disabled = choice.disabled;
      b.classList.toggle("active", choice.active);
    });
    const key = state.game + state.settings.map((s) => s.key).join(",");
    if (settingsKey !== key) {
      settingsKey = key;
      $("settings").replaceChildren();
      state.settings.forEach((s) => {
        const label = document.createElement("label");
        label.htmlFor = "tune-" + s.key;
        label.textContent = s.label;
        const output = document.createElement("output");
        output.id = "value-" + s.key;
        label.append(" ", output);
        const input = document.createElement(
          s.type === "select" ? "select" : "input",
        );
        input.id = "tune-" + s.key;
        if (s.type === "select")
          for (const o of s.options) {
            const option = document.createElement("option");
            option.value = o.value;
            option.textContent = o.label;
            input.appendChild(option);
          }
        else {
          input.type = "range";
          input.min = s.min;
          input.max = s.max;
          input.step = s.step;
        }
        input.oninput = () => {
          output.textContent = input.value;
        };
        input.onchange = () => send("tune", input.value, s.key);
        $("settings").append(label, input);
      });
    }
    state.settings.forEach((s) => {
      const input = $("tune-" + s.key);
      input.disabled = s.disabled;
      if (document.activeElement !== input) {
        input.value = s.value;
        $("value-" + s.key).textContent = s.type === "range" ? s.value : "";
      }
    });
    availability();
  }
  function connect() {
    link?.stop();
    state = null;
    host = false;
    connected = false;
    pending = null;
    availability();
    $("console").hidden = false;
    $("pair-panel").hidden = true;
    link = new ArenaRemote.Link(
      credentials,
      (data) => {
        if (data.type === "state") render(data.state);
        if (data.type === "presence") {
          host = data.host;
          if (!host) {
            state = null;
            $("connection").textContent = "Display disconnected. Waiting…";
          } else $("connection").textContent = "Connected to the display";
          availability();
        }
        if (data.type === "ack" && data.id === pending) {
          pending = null;
          if (!data.ok)
            notice(
              "Command rejected. Wait for the current display state and try again.",
            );
          availability();
        }
      },
      (status) => {
        connected = status === "connected";
        if (!connected) {
          host = false;
          state = null;
          pending = null;
        }
        $("connection").textContent = {
          connected: "Connected. Waiting for the display…",
          connecting: "Connecting…",
          disconnected: "Connection lost. Reconnecting…",
          ended: "Session ended. Generate a new pairing code on the display.",
        }[status];
        if (status === "ended") {
          sessionStorage.removeItem(storageKey);
          credentials = null;
          $("pair-panel").hidden = false;
        }
        availability();
      },
    );
  }
  $("pair-form").onsubmit = async (event) => {
    event.preventDefault();
    notice("");
    const code = $("code").value.toUpperCase().replace(/[\s-]/g, "");
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) {
      notice("Enter the 8-character code shown on the desktop.");
      return;
    }
    const button = $("pair-form").querySelector("button");
    button.disabled = true;
    try {
      credentials = {
        code,
        ...(await ArenaRemote.api(`/api/rooms/${code}/join`, {})),
      };
      sessionStorage.setItem(storageKey, JSON.stringify(credentials));
      connect();
    } catch (error) {
      notice(error.message);
    } finally {
      button.disabled = false;
    }
  };
  for (const action of ["advance", "pause", "reset", "hide"])
    $(action).onclick = () => send(action);
  $("sound").onchange = () => send("sound", $("sound").checked);
  $("game").onchange = () => send("game", $("game").value);
  $("preset").onchange = () => send("preset", $("preset").value);
  $("disconnect").onclick = () => {
    link?.stop();
    credentials = null;
    state = null;
    connected = false;
    sessionStorage.removeItem(storageKey);
    $("console").hidden = true;
    $("pair-panel").hidden = false;
    $("connection").textContent =
      "Disconnected. Generate a new code on the desktop to pair again.";
    availability();
  };
  $("logout").onclick = async () => {
    try {
      await ArenaRemote.api("/api/logout", {});
      link?.stop();
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem("raider-remote-display");
      location.href = "/login";
    } catch (error) {
      notice(error.message);
    }
  };
  setInterval(availability, 1000);
  if (document.documentElement.dataset.arenaRemote !== "true") {
    notice(
      "Remote operation is available on the Cloudflare-hosted site. Open its operator page to pair.",
    );
    $("pair-form").querySelector("button").disabled = true;
    $("logout").hidden = true;
    return;
  }
  ArenaRemote.api("/api/config")
    .then(() => {
      try {
        credentials = JSON.parse(sessionStorage.getItem(storageKey));
      } catch {}
      if (credentials && credentials.expiresAt > Date.now()) connect();
      else sessionStorage.removeItem(storageKey);
    })
    .catch((error) => {
      notice(
        "Remote operation is available on the Cloudflare-hosted site. " +
          error.message,
      );
      $("pair-form").querySelector("button").disabled = true;
    });
})();
