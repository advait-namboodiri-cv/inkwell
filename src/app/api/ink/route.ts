import { NextResponse } from "next/server";
import { inkReport, startInkScan } from "@/lib/inkscan";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(inkReport());
}

export async function POST() {
  return NextResponse.json(startInkScan());
}
