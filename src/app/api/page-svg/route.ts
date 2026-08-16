import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { versionBundlePath } from "@/lib/versions";
import { renderPageSvg } from "@/lib/render";
import { isSafeId } from "@/lib/safe";

export const runtime = "nodejs";

// renders one page of one snapshot to svg via rmc (the python renderer)
export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get("docId") ?? "";
  const hash = req.nextUrl.searchParams.get("hash") ?? "";
  const pageId = req.nextUrl.searchParams.get("pageId") ?? "";
  if (!isSafeId(docId) || !isSafeId(hash) || !isSafeId(pageId)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }
  const bundle = versionBundlePath(docId, hash);
  if (!fs.existsSync(bundle)) {
    return NextResponse.json({ error: "snapshot not found" }, { status: 404 });
  }
  let svg: string | null;
  try {
    svg = await renderPageSvg(bundle, pageId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "render failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
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
