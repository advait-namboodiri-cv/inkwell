import { NextResponse } from "next/server";
import { isPaired } from "@/lib/rmapi";
import { makeWorksheet } from "@/lib/worksheet";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isPaired()) return NextResponse.json({ error: "not paired" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 4) {
    return NextResponse.json({ error: "describe the worksheet you want" }, { status: 400 });
  }
  try {
    const { name, folder, ai, problems } = await makeWorksheet(
      prompt,
      body.includeAnswers !== false
    );
    return NextResponse.json({
      name,
      folder,
      problems,
      provider: ai.provider,
      model: ai.model,
      costCents: ai.costCents,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "worksheet failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
