import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { versionBundlePath } from "@/lib/versions";
import { renderPageSvg } from "@/lib/render";

export const runtime = "nodejs";

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
  const svg = await renderPageSvg(bundle, pageId);
  if (!svg) {
    return NextResponse.json({ error: "no ink on this page" }, { status: 404 });
  }
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=86400", // snapshots are immutable
    },
  });
}
