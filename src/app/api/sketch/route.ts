import { NextResponse } from "next/server";
import { isPaired } from "@/lib/rmapi";
import { makeSketch, sendSketch } from "@/lib/sketch";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST {prompt} → generate + preview; POST {svg, title, send: true} → deliver
export async function POST(req: Request) {
  if (!isPaired()) return NextResponse.json({ error: "not paired" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.send === true) {
    if (typeof body.svg !== "string" || typeof body.title !== "string") {
      return NextResponse.json({ error: "svg and title required" }, { status: 400 });
    }
    try {
      const delivered = await sendSketch(body.svg, body.title.slice(0, 60) || "sketch");
      return NextResponse.json(delivered);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "send failed";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 4) {
    return NextResponse.json({ error: "describe the sketch you want" }, { status: 400 });
  }
  try {
    const { svg, ai } = await makeSketch(prompt);
    return NextResponse.json({
      svg,
      provider: ai.provider,
      model: ai.model,
      costCents: ai.costCents,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "sketch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
