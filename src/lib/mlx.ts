import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getSettings } from "./settings";

// Keeps the local model alive: if the provider is "local" and nothing is
// serving at the configured url, spawn mlx_lm.server detached (it survives
// dev-server restarts). Logs to data/mlx.log. Safe to call repeatedly —
// it only spawns when the port is actually dark.
const KNOWN_BIN = "/opt/homebrew/Caskroom/miniconda/base/bin/mlx_lm.server";
let lastSpawnAt = 0;

export async function ensureMlx(): Promise<void> {
  const { ai } = getSettings();
  // only start the local server if some superpower actually uses it
  if (!Object.values(ai.features).includes("local")) return;
  try {
    const res = await fetch(`${ai.localUrl}/models`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (res.ok) return; // already serving
  } catch {
    /* dark — fall through and start it */
  }
  // model load takes a while; don't spawn again while one is still starting
  if (Date.now() - lastSpawnAt < 120_000) return;
  lastSpawnAt = Date.now();

  const port = (() => {
    try {
      return new URL(ai.localUrl).port || "8080";
    } catch {
      return "8080";
    }
  })();
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const log = fs.openSync(path.join(dataDir, "mlx.log"), "a");
  const bin = fs.existsSync(KNOWN_BIN) ? KNOWN_BIN : "mlx_lm.server";
  try {
    const child = spawn(bin, ["--model", ai.localModel, "--port", port], {
      detached: true,
      stdio: ["ignore", log, log],
    });
    child.unref();
    console.log(`[inkwell] starting mlx server (pid ${child.pid}, port ${port})`);
  } catch (err) {
    console.error("[inkwell] couldn't start mlx server:", err);
  } finally {
    fs.closeSync(log);
  }
}
