// Explicit allowlist: never upload repository files, tests, or secrets as assets.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "dist");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const name of [
  "index.html",
  "cup-shuffle.html",
  "helmet-shuffle.html",
  "memory-match.html",
  "raider-rally-race.html",
  "operator.html",
  "assets",
]) {
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
