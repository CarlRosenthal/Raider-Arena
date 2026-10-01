const encoder = new TextEncoder();
export const SESSION_MS = 8 * 60 * 60 * 1000;
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export function pairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  // The alphabet has 32 symbols, so each random byte maps without bias.
  let code = "";
  while (code.length < 8) {
    const b = crypto.getRandomValues(new Uint8Array(1))[0];
    code += alphabet[b % alphabet.length];
  }
  return code;
}
export async function digest(value) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function equalSecret(a, b) {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
const base64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
function unbase64(value) {
  return Uint8Array.from(
    atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
}
async function key(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function signSession(session, secret) {
  const body = base64url(encoder.encode(JSON.stringify(session)));
  return (
    body +
    "." +
    base64url(
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          await key(secret),
          encoder.encode(body),
        ),
      ),
    )
  );
}
export async function verifySession(token, secret, now = Date.now()) {
  try {
    if (!token || token.length > 1024) return null;
    const [body, signature, extra] = token.split(".");
    if (
      extra ||
      !signature ||
      !(await crypto.subtle.verify(
        "HMAC",
        await key(secret),
        unbase64(signature),
        encoder.encode(body),
      ))
    )
      return null;
    const data = JSON.parse(new TextDecoder().decode(unbase64(body)));
    if (
      !/^[a-f0-9]{64}$/.test(data.sid) ||
      !Number.isSafeInteger(data.exp) ||
      data.exp <= now ||
      data.exp > now + SESSION_MS
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
export function validCommand(c) {
  if (
    !c ||
    typeof c !== "object" ||
    !/^[a-f0-9-]{16,64}$/.test(c.id) ||
    !/^[a-f0-9-]{16,64}$/.test(c.page) ||
    !Number.isFinite(c.sentAt) ||
    Math.abs(Date.now() - c.sentAt) > 10000
  )
    return false;
  if (["advance", "pause", "reset", "hide"].includes(c.action)) return true;
  if (c.action === "sound") return typeof c.value === "boolean";
  if (c.action === "pick")
    return Number.isInteger(c.value) && c.value >= 0 && c.value < 16;
  if (c.action === "game")
    return ["cups", "race", "helmet", "memory"].includes(c.value);
  if (c.action === "preset")
    return [
      "warmup",
      "varsity",
      "allstar",
      "elite",
      "insane",
      "impossible",
    ].includes(c.value);
  if (c.action !== "tune") return false;
  if (["chaos", "timerClick"].includes(c.key))
    return ["true", "false", true, false].includes(c.value);
  if (c.key === "ball")
    return ["normal", "football", "soccer", "volleyball"].includes(c.value);
  const ranges = {
    swap: [60, 1200],
    moves: [6, 60],
    show: [400, 3000],
    race: [3, 45],
    memory: [6, 120],
    cups: [3, 5],
    pairs: [4, 8],
    hold: [80, 1200],
  };
  return (
    Object.hasOwn(ranges, c.key) &&
    Number.isFinite(Number(c.value)) &&
    Number(c.value) >= ranges[c.key][0] &&
    Number(c.value) <= ranges[c.key][1]
  );
}
export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
export async function smallJson(request, max = 4096) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > max) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
