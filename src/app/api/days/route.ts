import { NextRequest, NextResponse } from "next/server";
import { activeDays } from "@/lib/timeday";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const tz = Number(req.nextUrl.searchParams.get("tz") ?? "0");
  return NextResponse.json({ days: activeDays(tz) });
}
