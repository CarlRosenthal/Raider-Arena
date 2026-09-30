// Run against any static server, including a project subpath.
// npm install --no-save playwright && npx playwright install chromium
// BASE_URL=http://localhost:8000 node tests/smoke.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = (process.env.BASE_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  context.on("page", (page) => {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
  });
  const page = await context.newPage();
  const games = {
    cups: "cup-shuffle",
    race: "raider-rally-race",
    helmet: "helmet-shuffle",
    memory: "memory-match",
  };
  for (const [game, slug] of Object.entries(games)) {
    await page.goto(`${base}/${slug}.html?test`);
    await page.waitForFunction(() => window.raiderTest);
    assert.equal(await page.evaluate(() => raiderTest.snapshot().game), game);
    assert.equal(await page.locator("canvas").count(), 1);
    assert.equal(await page.locator("[data-game].active").count(), 1);
    await page.evaluate(() =>
      Promise.all([...document.images].map((i) => i.decode().catch(() => {}))),
    );
    await page.waitForFunction(
      () => art.raider.naturalWidth > 0 && art.wr.naturalWidth > 0,
    );
    if (process.env.CAPTURE_PREVIEWS) {
      await page.evaluate(() => {
        raiderTest.draw();
      });
      const b64 = await page.locator("canvas").evaluate((c) => {
        const out = document.createElement("canvas");
        out.width = 800;
        out.height = 450;
        out.getContext("2d").drawImage(c, 0, 0, 800, 450);
        return out.toDataURL("image/jpeg", 0.88).split(",")[1];
      });
      require("node:fs").writeFileSync(
        `${__dirname}/../assets/images/${slug}-preview.jpg`,
        Buffer.from(b64, "base64"),
      );
    }
    await page.locator('[data-role="advance"]').click();
    assert.notEqual(
      await page.evaluate(() => raiderTest.snapshot().phase),
      "ready",
    );
    await page.locator('[data-role="pause"]').click();
    assert.equal(await page.evaluate(() => raiderTest.snapshot().paused), true);
    await page.evaluate(() => {
      const before = raiderTest.snapshot().elapsed;
      raiderTest.tick(10000);
      if (raiderTest.snapshot().elapsed !== before)
        throw Error("Pause clock advanced");
    });
    await page.locator('[data-role="pause"]').click();
    for (const preset of [
      "warmup",
      "varsity",
      "allstar",
      "elite",
      "insane",
      "impossible",
    ]) {
      const result = await page.evaluate(
        ({ game, preset }) => {
          const t = raiderTest;
          t.reset();
          t.changePreset(preset);
          t.start();
          if (game === "cups" || game === "helmet") {
            const before = t.snapshot();
            const duration =
              before.roundConfig.show +
              500 +
              before.shell.moves.reduce((n, m) => n + m.duration, 0) +
              1;
            t.tick(duration);
            const after = t.snapshot();
            if (
              after.phase !== "guess" ||
              [...after.shell.slots].sort().join("") !== "012"
            )
              throw Error("Shuffle did not finish");
            let expected = [0, 1, 2];
            for (const move of before.shell.moves) {
              const next = [];
              move.map.forEach((dest, src) => (next[dest] = expected[src]));
              expected = next;
            }
            if (expected.join("") !== after.shell.slots.join(""))
              throw Error("Ball tracking changed");
            t.pick(after.shell.slots.indexOf(after.shell.ball));
            t.advance();
            t.tick(751);
            t.draw();
            return t.snapshot().phase === "result";
          }
          if (game === "race") {
            t.tick(60000);
            t.draw();
            const s = t.snapshot();
            return (
              s.phase === "result" &&
              s.race.order.length === 3 &&
              s.race.winner === s.race.order[0]
            );
          }
          const start = t.snapshot();
          if (start.memory.deck.length !== 12) throw Error("Wrong deck length");
          t.tick(start.memory.total + 1);
          t.pick(0);
          t.draw();
          const s = t.snapshot();
          return (
            s.phase === "result" &&
            s.memory.remaining === 0 &&
            s.memory.open.length === 0
          );
        },
        { game, preset },
      );
      assert.equal(result, true, `${slug} ${preset}`);
    }
    if (game === "memory") {
      await page.evaluate(() => {
        const t = raiderTest;
        t.reset();
        t.changePreset("varsity");
        t.start();
        const s = t.snapshot();
        if (s.memory.total !== 30000)
          throw Error("Varsity must default to 30 seconds");
        const a = 0,
          b = s.memory.deck.findIndex((x) => x !== s.memory.deck[a]);
        t.pick(a);
        t.pick(b);
        t.pick(11);
        if (t.snapshot().memory.open.length !== 2)
          throw Error("Third card accepted");
        t.tick(651);
        if (t.snapshot().memory.open.length)
          throw Error("Mismatch never closed");
        for (let icon = 0; icon < 6; icon++) {
          const pair = s.memory.deck
            .map((v, i) => (v === icon ? i : -1))
            .filter((i) => i >= 0);
          t.pick(pair[0]);
          t.pick(pair[1]);
        }
        t.draw();
        if (
          !t.snapshot().memory.won ||
          t.snapshot().memory.matched.length !== 12
        )
          throw Error("Unable to complete memory");
      });
    }
    await page.evaluate(() => {
      raiderTest.reset();
      raiderTest.changePreset("elite");
    });
    await page.reload();
    await page.waitForFunction(() => window.raiderTest);
    assert.equal(
      await page.locator('[data-role="preset"]').inputValue(),
      "elite",
    );
    await page.evaluate(() => {
      raiderTest.changePreset("varsity");
    });
    const popupPromise = page.waitForEvent("popup");
    await page.locator('[data-role="operator"]').click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    await popup.locator('[data-role="advance"]').click();
    assert.notEqual(
      await page.evaluate(() => raiderTest.snapshot().phase),
      "ready",
    );
    assert.equal(
      await popup.locator("body").evaluate((e) => getComputedStyle(e).display),
      "block",
    );
    await popup.close();
    await page.evaluate(() => raiderTest.reset());
    // Navigation goes to an independent page, preserving the project subpath.
    await page
      .locator('[data-game="' + (game === "cups" ? "memory" : "cups") + '"]')
      .click();
    await page.waitForURL(
      game === "cups" ? "**/memory-match.html" : "**/cup-shuffle.html",
    );
    console.log(
      `PASS ${slug}: presets, round lifecycle, persistence, operator, navigation`,
    );
  }
  await page.goto(base + "/index.html");
  assert.equal(await page.locator("nav.games > a").count(), 4);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.goto(base + "/memory-match.html");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  if (process.env.SCREENSHOT_DIR) {
    await page.screenshot({
      path: process.env.SCREENSHOT_DIR + "/memory-mobile.png",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/index.html");
    await page.screenshot({
      path: process.env.SCREENSHOT_DIR + "/hub.png",
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("PASS hub, mobile layout, no missing assets or browser errors");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
