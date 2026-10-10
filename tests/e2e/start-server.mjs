// Starts the standalone production server the way the Docker image lays it
// out (static assets and public/ next to server.js), honouring NEXT_DIST_DIR.
//   npm run build && node tests/e2e/start-server.mjs     (PORT, DATABASE_URL from the env)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = process.env.NEXT_DIST_DIR || ".next";
const standalone = path.join(root, distDir, "standalone");
const server = path.join(standalone, "server.js");

if (!fs.existsSync(server)) {
  console.error(`No standalone build at ${server}. Run "npm run build" first.`);
  process.exit(1);
}

function replaceDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

replaceDir(path.join(root, distDir, "static"), path.join(standalone, distDir, "static"));
for (const dir of ["public", "branding-defaults", "drizzle", "assets"]) {
  replaceDir(path.join(root, dir), path.join(standalone, dir));
}

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  // Not process.env.HOSTNAME: shells and CI runners often export the machine name there.
  env: { ...process.env, PORT: process.env.PORT || "3100", HOSTNAME: "127.0.0.1" },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
