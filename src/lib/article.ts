import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

// Fetches a web page and strips it to clean reader-mode content
// using Firefox's Readability engine.
export type ArticleBlock = { kind: "h" | "p" | "quote" | "li"; text: string };

export type Article = {
  title: string;
  byline: string;
  site: string;
  url: string;
  blocks: ArticleBlock[];
};

const BLOCK_TAGS: Record<string, ArticleBlock["kind"]> = {
  H1: "h",
  H2: "h",
  H3: "h",
  H4: "h",
  P: "p",
  BLOCKQUOTE: "quote",
  LI: "li",
  PRE: "p",
};

export async function fetchArticle(url: string): Promise<Article> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (inkwell reader)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`page returned ${res.status}`);
  const html = await res.text();

  const dom = new JSDOM(html, { url });
  const parsed = new Readability(dom.window.document).parse();
  if (!parsed || !parsed.content) throw new Error("couldn't find readable article text");

  // walk the cleaned article html and flatten to typesettable blocks
  const contentDom = new JSDOM(parsed.content);
  const blocks: ArticleBlock[] = [];
  const walk = (el: Element) => {
    const kind = BLOCK_TAGS[el.tagName];
    if (kind) {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) blocks.push({ kind, text });
      return; // don't descend into a block we already captured
    }
    for (const child of el.children) walk(child);
  };
  walk(contentDom.window.document.body);
  if (blocks.length === 0) {
    const text = (parsed.textContent ?? "").trim();
    if (!text) throw new Error("article was empty after cleaning");
    for (const para of text.split(/\n\s*\n/)) {
      const t = para.replace(/\s+/g, " ").trim();
      if (t) blocks.push({ kind: "p", text: t });
    }
  }

  return {
    title: parsed.title?.trim() || new URL(url).hostname,
    byline: parsed.byline?.trim() ?? "",
    site: parsed.siteName?.trim() || new URL(url).hostname,
    url,
    blocks,
  };
}
