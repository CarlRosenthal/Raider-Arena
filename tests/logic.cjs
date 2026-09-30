// DOM + canvas regression checks. No browser process or server required.
// npm install --no-save jsdom @napi-rs/canvas
// node tests/logic.cjs
const { JSDOM } = require("jsdom");
const { createCanvas, Image, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
// On Linux, use an Arial-compatible font for preview generation.
for (const style of ["Regular", "Bold"]) {
  const font =
    "/usr/share/fonts/opentype/urw-base35/NimbusSans-" + style + ".otf";
  if (fs.existsSync(font)) GlobalFonts.registerFromPath(font, "Arial");
}
const root = path.resolve(__dirname, "..");
(async () => {
  for (const [game, slug] of Object.entries({
    cups: "cup-shuffle",
    race: "raider-rally-race",
    helmet: "helmet-shuffle",
    memory: "memory-match",
  })) {
    const html = fs.readFileSync(path.join(root, slug + ".html"), "utf8");
    const dom = new JSDOM(html, {
      url: `https://example.test/raider-arena/${slug}.html?test`,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    const w = dom.window,
      backing = createCanvas(1600, 900),
      pending = [];
    w.HTMLCanvasElement.prototype.getContext = () => backing.getContext("2d");
    w.Image = class extends Image {
      set src(value) {
        super.src = fs.readFileSync(path.join(root, value));
        pending.push(this.decode());
      }
      get src() {
        return super.src;
      }
    };
    const screen = w.document.getElementById("screen");
    Object.defineProperties(screen, {
      clientWidth: { value: 1600 },
      clientHeight: { value: 900 },
    });
    w.requestAnimationFrame = () => 1;
    w.confirm = () => true;
    w.focus = () => {};
    let popup;
    w.open = () => {
      popup = new JSDOM("", { url: w.location.href, pretendToBeVisual: true })
        .window;
      popup.focus = () => {};
      return popup;
    };
    const scripts = [...html.matchAll(/<script defer src="([^"]+)"/g)].map(
      (m) => m[1],
    );
    for (const script of scripts)
      vm.runInContext(
        fs.readFileSync(path.join(root, script), "utf8"),
        dom.getInternalVMContext(),
        { filename: script },
      );
    await Promise.all(pending);
    const t = w.raiderTest;
    const capture = (name) => {
      if (!process.env.SCREENSHOT_DIR) return;
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
      t.draw();
      fs.writeFileSync(
        path.join(process.env.SCREENSHOT_DIR, name + ".png"),
        backing.toBuffer("image/png"),
      );
    };
    assert.equal(t.snapshot().game, game);
    assert.equal(t.snapshot().phase, "ready");
    t.draw();
    if (process.env.CAPTURE_PREVIEWS) {
      const out = createCanvas(800, 450);
      out.getContext("2d").drawImage(backing, 0, 0, 800, 450);
      fs.writeFileSync(
        path.join(root, `assets/images/${slug}-preview.jpg`),
        out.toBuffer("image/jpeg", 88),
      );
    }
    for (const preset of [
      "warmup",
      "varsity",
      "allstar",
      "elite",
      "insane",
      "impossible",
    ]) {
      t.reset();
      t.changePreset(preset);
      t.start();
      t.pause();
      const paused = t.snapshot().elapsed;
      t.tick(1000);
      assert.equal(t.snapshot().elapsed, paused);
      t.pause();
      if (game === "cups" || game === "helmet") {
        const s = t.snapshot();
        let expected = [0, 1, 2];
        for (const move of s.shell.moves) {
          const n = [];
          move.map.forEach((dest, src) => (n[dest] = expected[src]));
          expected = n;
        }
        t.tick(
          s.roundConfig.show +
            500 +
            s.shell.moves.reduce((a, m) => a + m.duration, 0) +
            1,
        );
        assert.equal(t.snapshot().phase, "guess");
        assert.equal(t.snapshot().shell.slots.join(","), expected.join(","));
        t.pick(expected.indexOf(s.shell.ball));
        t.advance();
        t.tick(751);
        assert.equal(t.snapshot().phase, "result");
      } else if (game === "race") {
        t.tick(60000);
        const s = t.snapshot();
        assert.equal(s.phase, "result");
        assert.equal(s.race.winner, s.race.order[0]);
        assert.equal(new Set(s.race.order).size, 3);
      } else {
        t.tick(t.snapshot().memory.total + 1);
        t.pick(0);
        assert.equal(t.snapshot().phase, "result");
        assert.equal(t.snapshot().memory.remaining, 0);
        assert.equal(t.snapshot().memory.open.length, 0);
      }
      t.draw();
    }
    if (game === "memory") {
      t.reset();
      t.changePreset("varsity");
      t.start();
      const s = t.snapshot();
      assert.equal(s.memory.total, 30000);
      t.pick(0);
      t.pick(s.memory.deck.findIndex((v) => v !== s.memory.deck[0]));
      t.pick(11);
      assert.equal(t.snapshot().memory.open.length, 2);
      t.tick(651);
      assert.equal(t.snapshot().memory.open.length, 0);
      for (let icon = 0; icon < 6; icon++) {
        const pair = s.memory.deck
          .map((v, i) => (v === icon ? i : -1))
          .filter((i) => i >= 0);
        assert.equal(pair.length, 2);
        t.pick(pair[0]);
        t.pick(pair[1]);
      }
      assert.equal(t.snapshot().memory.won, true);
      assert.equal(t.snapshot().memory.matched.length, 12);
      t.draw();
    }
    if (game === "cups") {
      for (const count of [3, 4, 5])
        for (const ball of ["normal", "football", "soccer", "volleyball"]) {
          t.reset();
          t.tune("cups", count);
          t.tune("ball", ball);
          t.changePreset("impossible");
          assert.equal(
            t.snapshot().prefs.cups.cups,
            count,
            "Preset must preserve cup count",
          );
          assert.equal(
            w.document.querySelector('[data-role="pickers"]').children.length,
            count,
          );
          t.start();
          const before = t.snapshot();
          capture(`cups-${count}-${ball}`);
          t.tune("cups", 3);
          assert.equal(
            t.snapshot().roundConfig.cups,
            count,
            "Active round configuration is locked",
          );
          let expected = Array.from({ length: count }, (_, i) => i);
          for (const move of before.shell.moves) {
            assert.equal(new Set(move.map).size, count);
            const next = [];
            move.map.forEach((dest, src) => (next[dest] = expected[src]));
            expected = next;
          }
          t.tick(60000);
          assert.equal(t.snapshot().shell.slots.join(), expected.join());
          w.document.body.dispatchEvent(
            new w.KeyboardEvent("keydown", {
              key: String(count),
              bubbles: true,
            }),
          );
          assert.equal(
            t.snapshot().picked,
            count - 1,
            "All cup numbers work from keyboard",
          );
          t.pick(expected.indexOf(before.shell.ball));
          t.advance();
          t.tick(751);
          assert.equal(t.snapshot().phase, "result");
        }
      t.reset();
      t.tune("cups", 3);
      t.tune("ball", "normal");
      console.log(
        "PASS cups: 3–5 cups, four ball styles, complete tracking, keyboard choices, preset preservation",
      );
    }
    if (game === "memory") {
      for (const pairs of [4, 5, 6, 7, 8]) {
        t.reset();
        t.tune("pairs", pairs);
        t.changePreset("varsity");
        t.tune("memory", 120);
        t.tune("timerClick", true);
        assert.equal(
          w.document.querySelector('[data-role="pickers"]').children.length,
          pairs * 2,
        );
        t.start();
        const s = t.snapshot();
        assert.equal(s.memory.total, 120000);
        assert.equal(s.memory.deck.length, pairs * 2);
        assert.equal(new Set(s.memory.deck).size, pairs);
        capture(`memory-${pairs}-ready`);
        if (pairs === 8) {
          w.document.body.dispatchEvent(
            new w.KeyboardEvent("keydown", { key: "1", bubbles: true }),
          );
          w.document.body.dispatchEvent(
            new w.KeyboardEvent("keydown", { key: "6", bubbles: true }),
          );
          w.document.body.dispatchEvent(
            new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
          );
          assert.equal(
            t.snapshot().memory.open[0],
            15,
            "Two-digit card 16 is selectable",
          );
          t.pick(
            s.memory.deck.findIndex(
              (v, i) => v === s.memory.deck[15] && i !== 15,
            ),
          );
        }
        for (let id = 0; id < pairs; id++) {
          const indices = s.memory.deck
            .map((v, i) => (v === id ? i : -1))
            .filter((i) => i >= 0);
          assert.equal(indices.length, 2);
          indices.forEach((i) =>
            w.document
              .querySelector('[data-role="pickers"]')
              .children[i].click(),
          );
        }
        assert.equal(t.snapshot().memory.won, true);
        assert.equal(t.snapshot().memory.matched.length, pairs * 2);
        t.tick(700);
        capture(`memory-${pairs}-won`);
        t.start();
        t.tick(120001);
        t.pick(0);
        assert.equal(t.snapshot().phase, "result");
        assert.equal(t.snapshot().memory.open.length, 0);
      }
      const saved = JSON.parse(
        w.localStorage.getItem("raider-arena-v2"),
      ).memory;
      assert.equal(saved.pairs, 8);
      assert.equal(saved.memory, 120);
      assert.equal(saved.timerClick, true);
      t.reset();
      t.tune("pairs", 6);
      t.tune("timerClick", false);
      console.log(
        "PASS memory: 4–8 balanced pairs, operator grid, card 16, complete wins, 120-second timeout, saved options",
      );
    }
    if (game === "race") {
      t.reset();
      t.changePreset("impossible");
      t.start();
      t.tick(3000);
      let previous = [0, 0, 0];
      for (let frame = 0; frame < 300; frame++) {
        t.tick(10);
        const positions = w.eval("[0, 1, 2].map(raceProgress)");
        positions.forEach((p, i) =>
          assert.ok(p >= previous[i] - 1e-9, "Cars must not reverse"),
        );
        previous = positions;
      }
      const result = t.snapshot();
      const positions = w.eval("race.order.map(raceProgress)");
      assert.equal(result.phase, "result");
      assert.equal(positions[0], 1);
      assert.ok(positions[0] - positions[1] >= 0.13);
      assert.ok(positions[1] > positions[2]);
      t.tick(500);
      capture("race-winner");
      console.log(
        "PASS race: forward motion, finish-line freeze, visible lead and ordered places",
      );
    }
    if (game === "helmet") {
      t.reset();
      capture("white-wr-helmets");
    }
    t.reset();
    t.changePreset("elite");
    assert.equal(
      JSON.parse(w.localStorage.getItem("raider-arena-v2"))[game].preset,
      "elite",
    );
    t.changePreset("varsity");
    w.document.querySelector('[data-role="operator"]').click();
    assert.ok(popup.document.querySelector('[data-role="advance"]'));
    assert.equal(
      popup.document.querySelector("link").href,
      "https://example.test/raider-arena/assets/css/arena.css",
    );
    popup.document.querySelector('[data-role="advance"]').click();
    assert.notEqual(t.snapshot().phase, "ready");
    popup.document.querySelector('[data-role="pause"]').click();
    assert.equal(t.snapshot().paused, true);
    popup.close();
    dom.window.close();
    console.log(
      `PASS ${slug}: startup, six presets, tracking/completion, pause, settings, popup control wiring, canvas rendering`,
    );
  }
  for (const html of fs.readdirSync(root).filter((f) => f.endsWith(".html"))) {
    const doc = new JSDOM(fs.readFileSync(path.join(root, html), "utf8")).window
      .document;
    for (const el of doc.querySelectorAll("[src],[href]")) {
      const ref = el.getAttribute("src") || el.getAttribute("href");
      if (!/^(https?:|#)/.test(ref))
        assert.ok(
          fs.existsSync(path.join(root, ref)),
          `${html}: missing ${ref}`,
        );
    }
  }
  console.log("PASS all relative page and asset links");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
