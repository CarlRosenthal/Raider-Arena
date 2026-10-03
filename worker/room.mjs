import { randomToken, json, smallJson, validCommand } from "./security.mjs";
const PAIR_MS = 10 * 60 * 1000;
export class ArenaRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.view = null;
    this.viewAt = 0;
  }
  sockets(role) {
    return this.ctx
      .getWebSockets(role)
      .filter((ws) => ws.readyState === 1 && ws.deserializeAttachment()?.live);
  }
  send(ws, data) {
    try {
      ws.send(JSON.stringify(data));
    } catch {}
  }
  broadcast(role, data) {
    for (const ws of this.sockets(role)) this.send(ws, data);
  }
  presence() {
    const data = {
      type: "presence",
      host: this.sockets("host").length > 0,
      operator: this.sockets("operator").length > 0,
    };
    for (const ws of this.ctx.getWebSockets()) this.send(ws, data);
  }
  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const path = new URL(request.url).pathname,
        now = Date.now();
      let room = await this.ctx.storage.get("room");
      if (path === "/create") {
        if (room && room.exp > now) return json({ error: "Code in use" }, 409);
        const { session } = await request.json();
        room = {
          host: { sid: session.sid, token: randomToken() },
          exp: session.exp,
          pairExp: Math.min(now + PAIR_MS, session.exp),
        };
        await this.ctx.storage.put("room", room);
        await this.ctx.storage.setAlarm(room.pairExp);
        return json(
          {
            token: room.host.token,
            pairExpiresAt: room.pairExp,
            expiresAt: room.exp,
          },
          201,
        );
      }
      if (!room || room.exp <= now || (!room.operator && room.pairExp <= now))
        return json(
          { error: "Pairing expired. Generate a new code on the display." },
          410,
        );
      const session = JSON.parse(request.headers.get("X-Arena-Session"));
      if (path === "/join") {
        if (room.operator || !this.sockets("host").length)
          return json(
            {
              error:
                "Code unavailable. Check the display or generate a new code.",
            },
            409,
          );
        room.operator = { sid: session.sid, token: randomToken() };
        room.exp = Math.min(room.exp, session.exp);
        await this.ctx.storage.put("room", room);
        await this.ctx.storage.setAlarm(Math.min(room.exp, now + 10000));
        return json({ token: room.operator.token, expiresAt: room.exp });
      }
      if (path === "/end") {
        const { token } = await smallJson(request);
        if (room.host.sid !== session.sid || token !== room.host.token)
          return json({ error: "Forbidden" }, 403);
        await this.end();
        return json({ ok: true });
      }
      if (path !== "/socket") return json({ error: "Not found" }, 404);
      const protocols = (request.headers.get("Sec-WebSocket-Protocol") || "")
        .split(",")
        .map((s) => s.trim());
      const role = ["host", "operator"].find(
        (role) =>
          room[role]?.sid === session.sid &&
          protocols.includes(room[role].token),
      );
      if (!role || !protocols.includes("raider-v1"))
        return json({ error: "Forbidden" }, 403);
      for (const previous of this.sockets(role)) {
        previous.serializeAttachment({
          ...previous.deserializeAttachment(),
          live: false,
        });
        previous.close(4001, "Replaced by another connection");
      }
      const pair = new WebSocketPair(),
        [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, [role]);
      server.serializeAttachment({
        role,
        session,
        live: true,
        window: now,
        count: 0,
        lastSeen: now,
      });
      await this.ctx.storage.setAlarm(
        Math.min(
          room.exp,
          room.operator ? room.exp : room.pairExp,
          now + 10000,
        ),
      );
      if (role === "host") {
        this.view = null;
        this.viewAt = 0;
      }
      this.send(server, { type: "ready", role, expiresAt: room.exp });
      this.presence();
      if (role === "operator") {
        if (this.view && now - this.viewAt < 5000)
          this.send(server, { type: "state", state: this.view });
        this.broadcast("host", { type: "request-state" });
      }
      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: { "Sec-WebSocket-Protocol": "raider-v1" },
      });
    });
  }
  async webSocketMessage(ws, message) {
    const info = ws.deserializeAttachment(),
      now = Date.now();
    if (!info?.live) return;
    if (typeof message !== "string" || message.length > 32768) {
      ws.close(1009, "Message too large");
      return;
    }
    if (now - info.window > 1000) {
      info.window = now;
      info.count = 0;
    }
    if (++info.count > 30) {
      ws.close(1008, "Too many messages");
      return;
    }
    info.lastSeen = now;
    ws.serializeAttachment(info);
    const room = await this.ctx.storage.get("room");
    if (!room || now >= room.exp || (!room.operator && now >= room.pairExp)) {
      await this.end();
      return;
    }
    const auth = await this.env.AUTH.get(
      this.env.AUTH.idFromName("auth"),
    ).fetch(
      new Request("https://internal/check", {
        method: "POST",
        body: JSON.stringify(info.session),
      }),
    );
    if (!auth.ok) {
      ws.close(4003, "Sign in again");
      return;
    }
    if (!ws.deserializeAttachment()?.live) return;
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      ws.close(1008, "Invalid message");
      return;
    }
    if (!data || typeof data !== "object") {
      ws.close(1008, "Invalid message");
      return;
    }
    if (data.type === "ping") {
      this.send(ws, { type: "pong" });
      return;
    }
    if (
      info.role === "host" &&
      data.type === "state" &&
      data.state &&
      typeof data.state.page === "string"
    ) {
      this.view = data.state;
      this.viewAt = now;
      this.broadcast("operator", { type: "state", state: data.state });
    } else if (
      info.role === "host" &&
      data.type === "ack" &&
      typeof data.id === "string"
    ) {
      this.broadcast("operator", {
        type: "ack",
        id: data.id,
        ok: data.ok === true,
      });
    } else if (info.role === "operator" && data.type === "command") {
      if (
        !validCommand(data) ||
        !this.view ||
        this.view.page !== data.page ||
        now - this.viewAt > 5000 ||
        !this.sockets("host").length
      ) {
        this.send(ws, { type: "ack", id: data.id, ok: false });
        return;
      }
      this.broadcast("host", data);
    } else {
      this.send(ws, { type: "error", message: "Unsupported message" });
    }
  }
  webSocketClose(ws, code, reason) {
    const info = ws.deserializeAttachment();
    if (info?.live) {
      ws.serializeAttachment({ ...info, live: false });
      if (info.role === "host") {
        this.view = null;
        this.viewAt = 0;
      }
      this.presence();
    }
    try {
      ws.close(code === 1005 ? 1000 : code, reason);
    } catch {}
  }
  webSocketError(ws) {
    this.webSocketClose(ws, 1011, "Connection error");
  }
  async end() {
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, { type: "ended" });
      ws.close(4000, "Session ended");
    }
    this.view = null;
    this.viewAt = 0;
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }
  async alarm() {
    const room = await this.ctx.storage.get("room"),
      now = Date.now();
    if (!room || now >= room.exp || (!room.operator && now >= room.pairExp)) {
      await this.end();
      return;
    }
    for (const ws of this.ctx.getWebSockets()) {
      const info = ws.deserializeAttachment();
      if (info?.live && now - info.lastSeen > 20000) {
        ws.serializeAttachment({ ...info, live: false });
        if (info.role === "host") {
          this.view = null;
          this.viewAt = 0;
        }
        ws.close(4002, "Heartbeat timed out");
      }
    }
    this.presence();
    const deadline = Math.min(
      room.exp,
      room.operator ? room.exp : room.pairExp,
    );
    await this.ctx.storage.setAlarm(
      this.ctx.getWebSockets().length
        ? Math.min(deadline, now + 10000)
        : deadline,
    );
  }
}
