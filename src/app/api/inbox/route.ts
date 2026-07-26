import { NextResponse } from "next/server";
import { isPaired } from "@/lib/rmapi";
import { fetchArticle } from "@/lib/article";
import { articlePdf } from "@/lib/typeset";
import { deliverPdf } from "@/lib/deliver";

export const runtime = "nodejs";
export const maxDuration = 300;

// the browser extension (chrome + safari) calls this route cross-origin;
// the server only listens on localhost, so a permissive CORS policy is fine
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  if (!isPaired()) {
    return NextResponse.json({ error: "not paired" }, { status: 401, headers: CORS });
  }
  const body = await req.json().catch(() => ({}));
  const raw = typeof body.url === "string" ? body.url.trim() : "";
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    return NextResponse.json(
      { error: "that doesn't look like a link" },
      { status: 400, headers: CORS }
    );
  }
  try {
    const article = await fetchArticle(url.href);
    const pdf = await articlePdf(article);
    const delivered = await deliverPdf(pdf, article.title);
    return NextResponse.json(
      {
        title: article.title,
        site: article.site,
        words: article.blocks.reduce((n, b) => n + b.text.split(" ").length, 0),
        folder: delivered.folder,
        name: delivered.name,
      },
      { headers: CORS }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "couldn't fetch that page";
    return NextResponse.json({ error: msg }, { status: 502, headers: CORS });
  }
}
