import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// inkwell keeps its OWN rmapi device token in ./data (gitignored),
// isolated from any rmapi login elsewhere on the machine via RMAPI_CONFIG.
const DATA_DIR = path.join(process.cwd(), "data");
const CONF_PATH = path.join(DATA_DIR, "rmapi.conf");
const RMAPI_BIN =
  process.env.RMAPI_BIN ??
  (fs.existsSync("/opt/homebrew/bin/rmapi") ? "/opt/homebrew/bin/rmapi" : "rmapi");

export type RmapiResult = { code: number | null; stdout: string; stderr: string };

export function isPaired(): boolean {
  return fs.existsSync(CONF_PATH);
}

export function unpair(): void {
  fs.rmSync(CONF_PATH, { force: true });
}

export function runRmapi(
  args: string[],
  stdin?: string,
  timeoutMs = 30_000
): Promise<RmapiResult> {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return new Promise((resolve, reject) => {
    const child = spawn(RMAPI_BIN, args, {
      env: { ...process.env, RMAPI_CONFIG: CONF_PATH },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    // rmapi reads the one-time code from stdin when unpaired; closing stdin
    // makes it fail fast (it retries the prompt 3x, then exits) instead of hanging.
    if (stdin !== undefined) child.stdin.write(stdin);
    child.stdin.end();
  });
}

export function parseAccount(out: string): { user: string; syncVersion: string } | null {
  const m = out.match(/User:\s*(.+?),\s*SyncVersion:\s*(\S+)/);
  return m ? { user: m[1], syncVersion: m[2] } : null;
}
