import { NextRequest, NextResponse } from "next/server";
import { dayDetail } from "@/lib/timeday";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? "";
  const tz = Number(req.nextUrl.searchParams.get("tz") ?? "0");
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  try {
    const docs = await dayDetail(date, tz);
    return NextResponse.json({ docs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "day lookup failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
