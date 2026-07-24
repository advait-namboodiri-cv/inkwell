import { NextResponse } from "next/server";
import { verifySmtp } from "@/lib/mailer";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(await verifySmtp());
}
