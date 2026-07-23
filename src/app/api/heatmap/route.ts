import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

// pages-annotated-per-day, bucketed in the CLIENT's timezone (offset in
// minutes, same convention as Date.getTimezoneOffset: positive = behind UTC)
export async function GET(req: NextRequest) {
  const tzOffsetMin = Number(req.nextUrl.searchParams.get("tz") ?? "0");
  const shiftMs = -tzOffsetMin * 60_000;
  const db = getDb();
  const days = db
    .prepare(
      `SELECT date((modifed + ?) / 1000, 'unixepoch') AS day, COUNT(*) AS pages
       FROM page_events GROUP BY day ORDER BY day`
    )
    .all(shiftMs) as { day: string; pages: number }[];
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS events, COUNT(DISTINCT doc_id) AS docs FROM page_events`
    )
    .get() as { events: number; docs: number };
  return NextResponse.json({ days, totals });
}
