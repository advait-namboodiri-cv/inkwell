import { NextResponse } from "next/server";
import { isPaired } from "@/lib/rmapi";
import { getSyncProgress, lastSyncedAt, runSync } from "@/lib/sync";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ...getSyncProgress(), lastSyncedAt: lastSyncedAt() });
}

export async function POST() {
  if (!isPaired()) {
    return NextResponse.json({ error: "not paired" }, { status: 401 });
  }
  const result = await runSync();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ...result, lastSyncedAt: lastSyncedAt() });
}
