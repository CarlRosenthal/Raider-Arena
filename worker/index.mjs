import {
  CODE_RE,
  SESSION_MS,
  randomToken,
  pairingCode,
  digest,
  equalSecret,
  signSession,
  verifySession,
  json,
  smallJson,
} from "./security.mjs";
import { loginHTML } from "./login.mjs";
export { ArenaRoom } from "./room.mjs";
export { AuthGuard } from "./rate-limit.mjs";
const cookieName = "__Host-raider_session";
export async function guard(env, path, body) {
  return env.AUTH.get(env.AUTH.idFromName("auth")).fetch(
    new Request("https://internal/" + path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}
function protectedResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  return new Response(response.body, { status: response.status, headers });
}
const cookie = (value, age) =>
  `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
async function handle(request, env) {
  const url = new URL(request.url),
    path = url.pathname;
  // Fail closed, including all HTML, images, scripts and API routes.
  if (
    !env.SITE_PASSWORD ||
    env.SITE_PASSWORD.length < 12 ||
    !env.SESSION_SECRET ||
    env.SESSION_SECRET.length < 32
  )
    return new Response(
      "Hosting setup incomplete. Configure SITE_PASSWORD (12+ characters) and SESSION_SECRET (32+ characters).",
      { status: 503 },
    );
  if (
    request.method === "POST" ||
    request.headers.get("Upgrade") === "websocket"
  ) {
    if (request.headers.get("Origin") !== url.origin)
      return json({ error: "Origin rejected" }, 403);
  }
  if (path === "/login" && request.method === "GET")
    return new Response(loginHTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  if (path === "/api/login" && request.method === "POST") {
    const ip = await digest(
      env.SESSION_SECRET +
        ":" +
        (request.headers.get("CF-Connecting-IP") || "local"),
    );
    const limit = await guard(env, "limit", { key: "login:" + ip, limit: 10 });
    if (!limit.ok) return limit;
    const body = await smallJson(request);
    if (
      typeof body.password !== "string" ||
      body.password.length > 256 ||
      !(await equalSecret(body.password, env.SITE_PASSWORD))
    )
      return json({ error: "Invalid password" }, 401);
    const token = await signSession(
      {
        sid: randomToken(),
        exp: Date.now() + SESSION_MS,
        version: await digest(env.SESSION_SECRET),
      },
      env.SESSION_SECRET,
    );
    return json({ ok: true }, 200, {
      "Set-Cookie": cookie(token, SESSION_MS / 1000),
    });
  }
  const token = request.headers
    .get("Cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  const session = await verifySession(token, env.SESSION_SECRET);
  if (!session || !(await guard(env, "check", session)).ok) {
    return path.startsWith("/api/")
      ? json({ error: "Sign in required" }, 401)
      : new Response(null, {
          status: 302,
          headers: {
            Location: "/login?next=" + encodeURIComponent(path + url.search),
          },
        });
  }
  if (path === "/api/logout" && request.method === "POST") {
    await guard(env, "revoke", session);
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
  }
  if (path === "/api/config" && request.method === "GET")
    return json({ remote: true, expiresAt: session.exp });
  if (path === "/api/rooms" && request.method === "POST") {
    const limit = await guard(env, "limit", {
      key: "create:" + session.sid,
      limit: 10,
    });
    if (!limit.ok) return limit;
    for (let i = 0; i < 3; i++) {
      const code = pairingCode();
      const room = env.ROOMS.get(env.ROOMS.idFromName(code));
      const result = await room.fetch(
        new Request("https://internal/create", {
          method: "POST",
          body: JSON.stringify({ session }),
        }),
      );
      if (result.status === 409) continue;
      return json({ code, ...(await result.json()) }, result.status);
    }
    return json({ error: "Try again" }, 503);
  }
  const match = path.match(/^\/api\/rooms\/([A-Z2-9]{8})\/(join|socket|end)$/);
  if (match && CODE_RE.test(match[1])) {
    const [, code, action] = match;
    if (action === "join" && request.method === "POST") {
      const limit = await guard(env, "limit", {
        key: "join:" + session.sid,
        limit: 10,
      });
      if (!limit.ok) return limit;
    } else if (
      action === "socket" &&
      request.method === "GET" &&
      request.headers.get("Upgrade") === "websocket"
    ) {
      // Browser credentials live in the subprotocol, never the URL/query string.
    } else if (action !== "end" || request.method !== "POST")
      return json({ error: "Method not allowed" }, 405);
    const headers = new Headers(request.headers);
    headers.set("X-Arena-Session", JSON.stringify(session));
    return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(
      new Request("https://internal/" + action, {
        method: request.method,
        headers,
        body: request.method === "POST" ? request.body : undefined,
      }),
    );
  }
  if (path.startsWith("/api/")) return json({ error: "Not found" }, 404);
  if (!["GET", "HEAD"].includes(request.method))
    return new Response("Method not allowed", { status: 405 });
  if (path === "/") url.pathname = "/index.html";
  const asset = await env.ASSETS.fetch(new Request(url, request));
  return asset.headers.get("Content-Type")?.includes("text/html")
    ? new HTMLRewriter()
        .on("html", {
          element(el) {
            el.setAttribute("data-arena-remote", "true");
          },
        })
        .transform(asset)
    : asset;
}
export default {
  async fetch(request, env) {
    try {
      const response = await handle(request, env);
      return response.status === 101 ? response : protectedResponse(response);
    } catch {
      return protectedResponse(
        json({ error: "Request could not be completed" }, 400),
      );
    }
  },
};
