import { NextResponse } from "next/server";
import { isPaired } from "@/lib/rmapi";
import { getBackfillProgress, startBackfill } from "@/lib/backfill";
import { lastSyncedAt } from "@/lib/sync";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getBackfillProgress());
}

export async function POST() {
  if (!isPaired()) return NextResponse.json({ error: "not paired" }, { status: 401 });
  if (!lastSyncedAt()) return NextResponse.json({ error: "sync first" }, { status: 409 });
  return NextResponse.json(startBackfill());
}
