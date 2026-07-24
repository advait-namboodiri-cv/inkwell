import { NextResponse } from "next/server";
import { verifyAi } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(await verifyAi());
}
