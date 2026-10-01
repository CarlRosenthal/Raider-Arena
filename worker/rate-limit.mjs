import { json, digest } from "./security.mjs";
// Durable counters remain effective across isolates/restarts. No raw IP storage.
export class AuthGuard {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  async fetch(request) {
    const path = new URL(request.url).pathname,
      body = await request.json(),
      now = Date.now();
    return this.ctx.blockConcurrencyWhile(async () => {
      if (path === "/limit") {
        const key = "rate:" + body.key;
        let row = await this.ctx.storage.get(key);
        if (!row || row.exp <= now) row = { count: 0, exp: now + 60000 };
        row.count++;
        await this.ctx.storage.put(key, row);
        await this.schedule();
        return row.count > body.limit
          ? json({ error: "Too many attempts" }, 429, { "Retry-After": "60" })
          : json({ ok: true });
      }
      if (path === "/revoke") {
        await this.ctx.storage.put("revoked:" + body.sid, { exp: body.exp });
        await this.schedule();
        return json({ ok: true });
      }
      if (path === "/check")
        return json(
          { ok: true },
          body.exp > now &&
            body.version === (await digest(this.env.SESSION_SECRET)) &&
            !(await this.ctx.storage.get("revoked:" + body.sid))
            ? 200
            : 401,
        );
      return json({ error: "Not found" }, 404);
    });
  }
  async schedule() {
    if (!(await this.ctx.storage.getAlarm()))
      await this.ctx.storage.setAlarm(Date.now() + 60000);
  }
  async alarm() {
    const rows = await this.ctx.storage.list();
    for (const [key, row] of rows)
      if (row.exp <= Date.now()) await this.ctx.storage.delete(key);
    if ((await this.ctx.storage.list({ limit: 1 })).size)
      await this.ctx.storage.setAlarm(Date.now() + 60000);
  }
}
