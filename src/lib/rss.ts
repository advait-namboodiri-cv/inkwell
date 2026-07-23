import { JSDOM } from "jsdom";

// Minimal RSS/Atom fetcher — jsdom parses the XML, no extra dependency.
export type NewsItem = {
  title: string;
  source: string;
  summary: string;
  publishedAt: number;
};

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFeed(url: string): Promise<NewsItem[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (inkwell brief)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`feed returned ${res.status}`);
  const xml = await res.text();
  const doc = new JSDOM(xml, { contentType: "text/xml" }).window.document;

  const sourceName =
    text(doc.querySelector("channel > title")) ||
    text(doc.querySelector("feed > title")) ||
    new URL(url).hostname;

  // RSS <item> or Atom <entry>
  const nodes = [
    ...doc.querySelectorAll("channel > item"),
    ...doc.querySelectorAll("feed > entry"),
  ].slice(0, 10);

  return nodes.map((n) => {
    const title = text(n.querySelector("title"));
    const desc = stripHtml(
      text(n.querySelector("description")) || text(n.querySelector("summary"))
    );
    const dateStr =
      text(n.querySelector("pubDate")) ||
      text(n.querySelector("published")) ||
      text(n.querySelector("updated"));
    const ts = Date.parse(dateStr);
    return {
      title,
      source: sourceName,
      summary: desc.length > 220 ? `${desc.slice(0, 217)}…` : desc,
      publishedAt: Number.isNaN(ts) ? 0 : ts,
    };
  });
}

// Top N across all feeds: freshest first, at most one story per feed
// until every feed has contributed (keeps one loud feed from dominating).
export async function topNews(feeds: string[], count = 3): Promise<NewsItem[]> {
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const perFeed = results
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled")
    .map((r) => r.value.filter((i) => i.title))
    .filter((list) => list.length > 0)
    .map((list) => [...list].sort((a, b) => b.publishedAt - a.publishedAt));

  const picked: NewsItem[] = [];
  let round = 0;
  while (picked.length < count && perFeed.some((f) => f.length > round)) {
    const candidates = perFeed
      .filter((f) => f.length > round)
      .map((f) => f[round])
      .sort((a, b) => b.publishedAt - a.publishedAt);
    for (const c of candidates) {
      if (picked.length < count) picked.push(c);
    }
    round += 1;
  }
  return picked.slice(0, count);
}
