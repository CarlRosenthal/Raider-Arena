// End-to-end operator tests against a local Worker, with isolated browser sessions.
const { Miniflare } = require("miniflare");
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
(async () => {
  execFileSync(process.execPath, ["scripts/build.cjs"]);
  const mf = new Miniflare({
    host: "127.0.0.1",
    port: 0,
    modules: true,
    scriptPath: "worker/index.mjs",
    compatibilityDate: "2026-07-30",
    bindings: {
      SITE_PASSWORD: "local-test-password",
      SESSION_SECRET: "local-test-signing-secret-1234567890",
    },
    durableObjects: {
      ROOMS: { className: "ArenaRoom", useSQLite: true },
      AUTH: { className: "AuthGuard", useSQLite: true },
    },
    assets: {
      directory: "dist",
      binding: "ASSETS",
      routerConfig: {
        has_user_worker: true,
        invoke_user_worker_ahead_of_assets: true,
      },
      assetConfig: { html_handling: "none" },
    },
  });
  let browser;
  try {
    const ready = await mf.ready;
    const base = ready.href
      .replace("127.0.0.1", "localhost")
      .replace(/\/$/, "");
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    });
    const displayContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const phoneContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    for (const context of [displayContext, phoneContext])
      context.on("page", (p) =>
        p.on("pageerror", (e) => errors.push(e.message)),
      );
    const display = await displayContext.newPage(),
      phone = await phoneContext.newPage();
    async function signIn(page, path) {
      await page.goto(base + path);
      await page.getByLabel("Site password").fill("local-test-password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(base + path);
    }
    await signIn(display, "/cup-shuffle.html?test");
    await display
      .getByRole("button", { name: "Connect phone", exact: true })
      .click();
    await display.getByRole("button", { name: "New pairing code" }).click();
    await display.waitForFunction(() =>
      /^[A-Z2-9]{8}$/.test(document.querySelector("#remote-code").textContent),
    );
    const code = await display.locator("#remote-code").textContent();
    await signIn(phone, "/operator.html");
    await phone.getByLabel("Pairing code").fill(code);
    await phone.getByRole("button", { name: "Connect", exact: true }).click();
    await phone.locator("#advance").waitFor({ state: "visible" });
    await phone.waitForFunction(
      () => !document.querySelector("#actions").disabled,
    );
    await display.locator("#remote-close").click();
    await phone.selectOption("#preset", "impossible");
    await display.waitForFunction(
      () => raiderTest.snapshot().prefs.cups.preset === "impossible",
    );
    await phone.locator("summary").click();
    await phone.selectOption("#tune-cups", "5");
    await display.waitForFunction(
      () => raiderTest.snapshot().prefs.cups.cups === 5,
    );
    await phone.selectOption("#tune-ball", "soccer");
    await display.waitForFunction(
      () => raiderTest.snapshot().prefs.cups.ball === "soccer",
    );
    await phone.locator("#advance").click();
    await display.waitForFunction(
      () => raiderTest.snapshot().phase !== "ready",
    );
    await phone.locator("#pause").click();
    await display.waitForFunction(() => raiderTest.snapshot().paused);
    await phone.locator("#pause").click();
    await display.waitForFunction(
      () => raiderTest.snapshot().phase === "guess",
    );
    await phone.locator("#choices button").nth(4).click();
    await display.waitForFunction(() => raiderTest.snapshot().picked === 4);
    // A phone dialog confirms ending an active round; no blocking desktop dialog.
    phone.on("dialog", (d) => d.accept());
    await phone.locator("#reset").click();
    await display.waitForFunction(
      () => raiderTest.snapshot().phase === "ready",
    );
    for (const [game, slug] of [
      ["race", "raider-rally-race"],
      ["helmet", "helmet-shuffle"],
      ["memory", "memory-match"],
    ]) {
      await phone.selectOption("#game", game);
      await display.waitForURL(base + "/" + slug + ".html");
      await phone.waitForFunction(
        (g) =>
          document.querySelector("#game").value === g &&
          !document.querySelector("#actions").disabled,
        game,
      );
      await phone.locator("#advance").click();
      await phone.waitForFunction(
        () => document.querySelector("#advance").textContent !== "Start round",
      );
      await phone.locator("#pause").click();
      await phone.waitForFunction(
        () => document.querySelector("#pause").textContent === "Resume",
      );
      await phone.locator("#reset").click();
      await phone.waitForFunction(
        () => document.querySelector("#advance").textContent === "Start round",
      );
    }
    await phone.selectOption("#tune-pairs", "8");
    await phone.waitForFunction(
      () => document.querySelector("#choices").children.length === 16,
    );
    await phone.locator("#advance").click();
    await phone.locator("#choices button").nth(15).click();
    await phone.waitForFunction(() =>
      document
        .querySelector("#choices")
        .lastElementChild.textContent.includes("•"),
    );
    // Reload retains a valid pair; connection loss pauses the board.
    await phone.reload();
    await phone.waitForFunction(
      () => !document.querySelector("#actions").disabled,
    );
    await phone.waitForFunction(
      () => document.querySelector("#pause").textContent === "Resume",
    );
    await phone.locator("#pause").click();
    await phone.locator("#disconnect").click();
    await display.waitForFunction(
      () =>
        document.querySelector("[data-role=pause]").textContent === "Resume",
    );
    // New code revokes prior credentials; the replacement operator still works.
    await display
      .getByRole("button", { name: "Connect phone", exact: true })
      .click();
    await display.getByRole("button", { name: "New pairing code" }).click();
    await display.waitForFunction(
      (old) =>
        /^[A-Z2-9]{8}$/.test(
          document.querySelector("#remote-code").textContent,
        ) && document.querySelector("#remote-code").textContent !== old,
      code,
    );
    const code2 = await display.locator("#remote-code").textContent();
    await phone.getByLabel("Pairing code").fill(code2);
    await phone.getByRole("button", { name: "Connect", exact: true }).click();
    await phone.waitForFunction(
      () => !document.querySelector("#actions").disabled,
    );
    await phone.locator("#logout").click();
    await phone.waitForURL(base + "/login");
    const response = await phoneContext.request.get(
      base + "/assets/js/engine.js",
      { maxRedirects: 0 },
    );
    assert.equal(response.status(), 302);
    assert.deepEqual(errors, []);
    console.log(
      "PASS isolated desktop/mobile: login, pairing, tuning, all four games, choices/card 16, pause, reset, switching, reconnect, revocation and logout",
    );
  } finally {
    await browser?.close();
    await mf.dispose();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
