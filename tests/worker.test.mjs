import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import {
  signSession,
  verifySession,
  SESSION_MS,
  pairingCode,
  CODE_RE,
  validCommand,
} from "../worker/security.mjs";
const secret = "test-signing-secret-not-for-production-123456";
const mf = new Miniflare({
  workers: [
    {
      name: "arena",
      modules: true,
      scriptPath: "worker/index.mjs",
      compatibilityDate: "2026-07-30",
      bindings: {
        SITE_PASSWORD: "local-test-password",
        SESSION_SECRET: secret,
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
    },
  ],
});
after(() => mf.dispose());
const base = "https://arena.test";
let ip = 0;
async function request(
  path,
  { cookie, body, origin = base, method, headers = {} } = {},
) {
  return mf.dispatchFetch(base + path, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}
async function login() {
  const r = await request("/api/login", {
    body: { password: "local-test-password" },
    headers: { "CF-Connecting-IP": "192.0.2." + ++ip },
  });
  assert.equal(r.status, 200);
  const c = r.headers.get("set-cookie");
  assert.match(c, /HttpOnly; Secure; SameSite=Strict/);
  return c.split(";")[0];
}
async function socket(code, token, cookie) {
  const r = await request(`/api/rooms/${code}/socket`, {
    cookie,
    headers: {
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": "raider-v1, " + token,
    },
  });
  assert.equal(r.status, 101);
  const ws = r.webSocket,
    messages = [];
  ws.addEventListener("message", (e) => messages.push(JSON.parse(e.data)));
  ws.accept();
  return {
    ws,
    messages,
    async wait(predicate) {
      for (let i = 0; i < 100; i++) {
        const index = messages.findIndex(predicate);
        if (index >= 0) return messages.splice(index, 1)[0];
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error("Message not received: " + JSON.stringify(messages));
    },
  };
}
test("signed sessions reject tampering, expiry and invalid data; codes and command bounds", async () => {
  const data = { sid: "a".repeat(64), exp: Date.now() + 10000 };
  const token = await signSession(data, secret);
  assert.deepEqual(await verifySession(token, secret), data);
  assert.equal(await verifySession(token + "x", secret), null);
  assert.equal(await verifySession(token, secret, data.exp), null);
  for (let i = 0; i < 100; i++) assert.match(pairingCode(), CODE_RE);
  const command = {
    id: crypto.randomUUID(),
    page: crypto.randomUUID(),
    sentAt: Date.now(),
    action: "pick",
    value: 15,
  };
  assert.equal(validCommand(command), true);
  assert.equal(validCommand({ ...command, value: 16 }), false);
  assert.equal(validCommand({ ...command, action: "eval" }), false);
  assert.equal(validCommand({ ...command, sentAt: Date.now() - 30000 }), false);
});
test("every static route is gated; origin protection, login throttling and logout revocation", async () => {
  for (const path of [
    "/",
    "/cup-shuffle.html",
    "/assets/js/engine.js",
    "/assets/images/raider.jpg",
    "/operator.html",
  ])
    assert.equal((await request(path)).status, 302);
  assert.equal((await request("/api/config")).status, 401);
  assert.equal(
    (
      await request("/api/login", {
        body: { password: "local-test-password" },
        origin: "https://evil.test",
      })
    ).status,
    403,
  );
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await request("/api/login", {
          body: { password: "wrong" },
          headers: { "CF-Connecting-IP": "198.51.100.10" },
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await request("/api/login", {
        body: { password: "wrong" },
        headers: { "CF-Connecting-IP": "198.51.100.10" },
      })
    ).status,
    429,
  );
  const cookie = await login();
  const page = await request("/cup-shuffle.html", { cookie });
  assert.equal(page.status, 200);
  assert.match(page.headers.get("cache-control"), /no-store/);
  for (const path of ["/worker/index.mjs", "/.dev.vars", "/package.json"])
    assert.equal((await request(path, { cookie })).status, 404);
  assert.equal(
    (
      await request("/api/rooms", {
        cookie,
        body: {},
        origin: "https://evil.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/login", { body: { password: "x".repeat(5000) } }))
      .status,
    400,
  );
  assert.equal(
    (await request("/api/logout", { cookie, body: {} })).status,
    200,
  );
  assert.equal((await request("/api/config", { cookie })).status, 401);
});
test("role-bound single-use pairing, command relay, stale rejection, disconnect and room revocation", async () => {
  const hostCookie = await login(),
    phoneCookie = await login(),
    otherCookie = await login();
  const created = await request("/api/rooms", { cookie: hostCookie, body: {} });
  assert.equal(created.status, 201);
  const room = await created.json();
  assert.equal(
    (
      await request(`/api/rooms/${room.code}/socket`, {
        cookie: otherCookie,
        headers: {
          Upgrade: "websocket",
          "Sec-WebSocket-Protocol": "raider-v1, " + room.token,
        },
      })
    ).status,
    403,
  );
  const display = await socket(room.code, room.token, hostCookie);
  const joined = await request(`/api/rooms/${room.code}/join`, {
    cookie: phoneCookie,
    body: {},
  });
  assert.equal(joined.status, 200);
  const phone = await joined.json();
  assert.equal(
    (
      await request(`/api/rooms/${room.code}/join`, {
        cookie: otherCookie,
        body: {},
      })
    ).status,
    409,
  );
  const controller = await socket(room.code, phone.token, phoneCookie);
  await display.wait((m) => m.type === "presence" && m.operator);
  const page = crypto.randomUUID();
  display.ws.send(
    JSON.stringify({ type: "state", state: { page, title: "CUP SHUFFLE" } }),
  );
  assert.equal(
    (await controller.wait((m) => m.type === "state")).state.page,
    page,
  );
  const cmd = {
    type: "command",
    action: "advance",
    id: crypto.randomUUID(),
    page,
    sentAt: Date.now(),
  };
  controller.ws.send(JSON.stringify(cmd));
  assert.equal((await display.wait((m) => m.type === "command")).id, cmd.id);
  display.ws.send(JSON.stringify({ type: "ack", id: cmd.id, ok: true }));
  assert.equal((await controller.wait((m) => m.type === "ack")).ok, true);
  controller.ws.send(
    JSON.stringify({
      ...cmd,
      id: crypto.randomUUID(),
      page: crypto.randomUUID(),
    }),
  );
  assert.equal((await controller.wait((m) => m.type === "ack")).ok, false);
  // A controller cannot publish a forged display state or end the room.
  controller.ws.send(
    JSON.stringify({ type: "state", state: { page: "forged" } }),
  );
  await controller.wait((m) => m.type === "error");
  assert.equal(
    (
      await request(`/api/rooms/${room.code}/end`, {
        cookie: phoneCookie,
        body: { token: room.token },
      })
    ).status,
    403,
  );
  controller.ws.close(1000);
  await display.wait((m) => m.type === "presence" && !m.operator);
  const reconnected = await socket(room.code, phone.token, phoneCookie);
  await reconnected.wait((m) => m.type === "ready");
  await request("/api/logout", { cookie: phoneCookie, body: {} });
  const closed = new Promise((resolve) =>
    reconnected.ws.addEventListener("close", resolve),
  );
  reconnected.ws.send(JSON.stringify({ type: "ping" }));
  assert.equal((await closed).code, 4003);
  assert.equal(
    (
      await request(`/api/rooms/${room.code}/end`, {
        cookie: hostCookie,
        body: { token: room.token },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/rooms/${room.code}/join`, {
        cookie: otherCookie,
        body: {},
      })
    ).status,
    410,
  );
});
test("missing secrets fail closed instead of exposing assets", async () => {
  const blank = new Miniflare({
    workers: [
      {
        name: "arena",
        modules: true,
        scriptPath: "worker/index.mjs",
        compatibilityDate: "2026-07-30",
        bindings: {},
        durableObjects: {
          ROOMS: { className: "ArenaRoom", useSQLite: true },
          AUTH: { className: "AuthGuard", useSQLite: true },
        },
      },
    ],
  });
  try {
    assert.equal((await blank.dispatchFetch(base + "/")).status, 503);
  } finally {
    await blank.dispose();
  }
});
