import { NextResponse } from "next/server";
import { spendTotals } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(spendTotals());
}
