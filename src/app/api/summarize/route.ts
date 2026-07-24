import { NextResponse } from "next/server";
import { summarize } from "@/lib/summary";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.docId !== "string" || !body.docId) {
    return NextResponse.json({ error: "docId required" }, { status: 400 });
  }
  try {
    const { row, ai, cached } = await summarize(body.docId);
    return NextResponse.json({
      summary: row.summary,
      provider: row.provider,
      model: row.model,
      cached,
      costCents: ai?.costCents ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "summary failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
