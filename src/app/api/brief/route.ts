import { NextResponse } from "next/server";
import { isPaired } from "@/lib/rmapi";
import { briefSentToday, buildBrief, sendBrief } from "@/lib/brief";

export const runtime = "nodejs";

export async function GET() {
  // preview of what today's brief would contain
  const brief = await buildBrief();
  return NextResponse.json({ brief, sentToday: briefSentToday() });
}

export async function POST() {
  if (!isPaired()) return NextResponse.json({ error: "not paired" }, { status: 401 });
  try {
    const delivered = await sendBrief();
    return NextResponse.json(delivered);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "brief failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
