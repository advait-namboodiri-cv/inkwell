import { NextResponse } from "next/server";
import { isPaired } from "@/lib/rmapi";
import { fetchArticle } from "@/lib/article";
import { articlePdf } from "@/lib/typeset";
import { deliverPdf } from "@/lib/deliver";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isPaired()) return NextResponse.json({ error: "not paired" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const raw = typeof body.url === "string" ? body.url.trim() : "";
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    return NextResponse.json({ error: "that doesn't look like a link" }, { status: 400 });
  }
  try {
    const article = await fetchArticle(url.href);
    const pdf = await articlePdf(article);
    const delivered = await deliverPdf(pdf, article.title);
    return NextResponse.json({
      title: article.title,
      site: article.site,
      words: article.blocks.reduce((n, b) => n + b.text.split(" ").length, 0),
      folder: delivered.folder,
      name: delivered.name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "couldn't fetch that page";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
