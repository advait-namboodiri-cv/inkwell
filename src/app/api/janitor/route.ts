import { NextRequest, NextResponse } from "next/server";
import { isPaired } from "@/lib/rmapi";
import { janitorReport, removeDocs } from "@/lib/janitor";
import { lastSyncedAt } from "@/lib/sync";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!lastSyncedAt()) {
    return NextResponse.json({ error: "not synced yet" }, { status: 409 });
  }
  const sort = req.nextUrl.searchParams.get("sort") === "largest" ? "largest" : "oldest";
  return NextResponse.json(janitorReport(sort));
}

export async function POST(req: Request) {
  if (!isPaired()) return NextResponse.json({ error: "not paired" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids: unknown = body.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((i) => typeof i === "string")) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }
  if (ids.length > 50) {
    return NextResponse.json({ error: "max 50 at a time" }, { status: 400 });
  }
  const results = await removeDocs(ids as string[]);
  return NextResponse.json({ results });
}
