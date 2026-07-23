import { NextResponse } from "next/server";
import { isPaired, parseAccount, runRmapi } from "@/lib/rmapi";

export const runtime = "nodejs";

export async function GET() {
  if (!isPaired()) return NextResponse.json({ paired: false });
  const res = await runRmapi(["account"]);
  const account = parseAccount(res.stdout);
  if (res.code !== 0 || !account) {
    return NextResponse.json({ paired: false, degraded: true });
  }
  return NextResponse.json({ paired: true, account });
}
