import { NextRequest, NextResponse } from "next/server";
import { activity, timeline } from "@/lib/versions";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get("docId") ?? "";
  if (!docId) return NextResponse.json({ error: "docId required" }, { status: 400 });
  const doc = getDb()
    .prepare("SELECT name, path FROM documents WHERE id = ?")
    .get(docId) as { name: string; path: string } | undefined;
  if (!doc) return NextResponse.json({ error: "document not found" }, { status: 404 });
  try {
    const versions = await timeline(docId);
    const act = await activity(docId);
    return NextResponse.json({ doc, versions, activity: act.days, latestHash: act.latestHash });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "timeline failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
