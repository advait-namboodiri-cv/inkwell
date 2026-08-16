import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const pExecFile = promisify(execFile);

// rmc lives wherever pip put it; the dev server's PATH depends on which
// terminal launched it, so resolve a known install location first (same
// pattern as RMAPI_BIN in rmapi.ts) instead of trusting PATH.
const RMC_KNOWN = [
  "/opt/homebrew/Caskroom/miniconda/base/bin/rmc",
  path.join(os.homedir(), ".local", "bin", "rmc"),
  "/opt/homebrew/bin/rmc",
];
const RMC_BIN = process.env.RMC_BIN ?? RMC_KNOWN.find((p) => fs.existsSync(p)) ?? "rmc";

// renders one .rm page out of a bundle to svg via rmc (the python renderer).
// returns null only when the page genuinely has no ink; a broken renderer
// throws so the route can say so instead of pretending the page is blank.
export async function renderPageSvg(
  bundlePath: string,
  pageId: string
): Promise<string | null> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "inkwell-render-"));
  try {
    const rmPath = path.join(tmp, "page.rm");
    const svgPath = path.join(tmp, "page.svg");
    const { stdout } = await pExecFile("unzip", ["-p", bundlePath, `*/${pageId}.rm`], {
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
    }).catch(() => ({ stdout: Buffer.alloc(0) }));
    if ((stdout as Buffer).length === 0) return null; // page has no ink
    fs.writeFileSync(rmPath, stdout as Buffer);
    try {
      await pExecFile(RMC_BIN, ["-t", "svg", "-o", svgPath, rmPath], { timeout: 30_000 });
    } catch (err) {
      console.error(`[inkwell] rmc failed (${RMC_BIN}):`, err);
      throw new Error("the page renderer (rmc) isn't reachable from this server");
    }
    return fs.readFileSync(svgPath, "utf8");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
