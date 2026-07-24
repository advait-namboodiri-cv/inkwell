import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const pExecFile = promisify(execFile);

// renders one .rm page out of a bundle to svg via rmc (python)
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
    await pExecFile("rmc", ["-t", "svg", "-o", svgPath, rmPath], { timeout: 30_000 });
    return fs.readFileSync(svgPath, "utf8");
  } catch {
    return null;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
