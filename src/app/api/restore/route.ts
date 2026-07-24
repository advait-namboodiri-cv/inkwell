import { NextResponse } from "next/server";
import { isPaired } from "@/lib/rmapi";
import { restoreAsPdf } from "@/lib/timeday";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isPaired()) return NextResponse.json({ error: "not paired" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { docId, hash, dayLabel } = body ?? {};
  if (typeof docId !== "string" || typeof hash !== "string" || typeof dayLabel !== "string") {
    return NextResponse.json({ error: "docId, hash and dayLabel required" }, { status: 400 });
  }
  try {
    const result = await restoreAsPdf(docId, hash, dayLabel.slice(0, 24));
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "restore failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
