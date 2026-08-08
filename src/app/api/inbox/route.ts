import { NextResponse } from "next/server";
import { isPaired } from "@/lib/rmapi";
import { fetchArticle } from "@/lib/article";
import { articlePdf } from "@/lib/typeset";
import { deliverPdf } from "@/lib/deliver";
import { assertPublicUrl } from "@/lib/safe";

export const runtime = "nodejs";
export const maxDuration = 300;

// the browser extension (chrome + safari) reaches this route via its
// host_permissions, which bypass CORS entirely — so we intentionally do NOT
// send permissive CORS headers. instead we require a custom request header
// that a random web page cannot attach cross-origin without a preflight this
// route never approves. that stops any site you happen to be visiting from
// silently pushing documents to your tablet.
const EXTENSION_HEADER = "x-inkwell-extension";

export async function OPTIONS() {
  // no Access-Control-Allow-Origin: a browser-page preflight fails here,
  // which is exactly what we want. the extension never preflights.
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: Request) {
  if (req.headers.get(EXTENSION_HEADER) !== "1") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isPaired()) {
    return NextResponse.json({ error: "not paired" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const raw = typeof body.url === "string" ? body.url.trim() : "";
  let url: URL;
  try {
    url = assertPublicUrl(raw);
  } catch (err) {
    const msg = err instanceof Error && /local network/.test(err.message)
      ? err.message
      : "that doesn't look like a link";
    return NextResponse.json({ error: msg }, { status: 400 });
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
