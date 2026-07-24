import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { versionBundlePath } from "@/lib/versions";

export const runtime = "nodejs";
const pExecFile = promisify(execFile);

const ID_RE = /^[0-9a-f-]{8,64}$/i;

// renders one page of one snapshot to svg via rmc (the python renderer)
export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get("docId") ?? "";
  const hash = req.nextUrl.searchParams.get("hash") ?? "";
  const pageId = req.nextUrl.searchParams.get("pageId") ?? "";
  if (!ID_RE.test(docId) || !ID_RE.test(hash) || !ID_RE.test(pageId)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }
  const bundle = versionBundlePath(docId, hash);
  if (!fs.existsSync(bundle)) {
    return NextResponse.json({ error: "snapshot not found" }, { status: 404 });
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "inkwell-svg-"));
  try {
    const rmPath = path.join(tmp, "page.rm");
    const svgPath = path.join(tmp, "page.svg");
    const { stdout } = await pExecFile("unzip", ["-p", bundle, `*/${pageId}.rm`], {
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
    });
    if ((stdout as Buffer).length === 0) {
      return NextResponse.json({ error: "no ink on this page yet" }, { status: 404 });
    }
    fs.writeFileSync(rmPath, stdout as Buffer);
    await pExecFile("rmc", ["-t", "svg", "-o", svgPath, rmPath], { timeout: 30_000 });
    const svg = fs.readFileSync(svgPath, "utf8");
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "private, max-age=86400", // snapshots are immutable
      },
    });
  } catch {
    return NextResponse.json({ error: "couldn't render this page" }, { status: 502 });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
