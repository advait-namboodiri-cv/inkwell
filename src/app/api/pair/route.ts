import { NextResponse } from "next/server";
import { parseAccount, runRmapi, unpair } from "@/lib/rmapi";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
  if (!/^[a-z0-9]{8}$/.test(code)) {
    return NextResponse.json(
      { error: "the code should be 8 letters and numbers" },
      { status: 400 }
    );
  }
  // any rmapi command while unpaired consumes the code from stdin and
  // exchanges it for a device token stored at our RMAPI_CONFIG path
  const res = await runRmapi(["account"], code + "\n");
  const account = parseAccount(res.stdout);
  if (res.code === 0 && account) {
    return NextResponse.json({ paired: true, account });
  }
  unpair(); // never keep a half-written token file
  return NextResponse.json(
    {
      error:
        "that code didn't work. codes are single use and expire in minutes, grab a fresh one and try again",
    },
    { status: 400 }
  );
}

export async function DELETE() {
  unpair();
  return NextResponse.json({ paired: false });
}
