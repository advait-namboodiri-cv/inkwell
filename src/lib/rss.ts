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

export async function fetchFeed(url: string): Promise<NewsItem[]> {
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

// The brief's news: BBC contributes its top 3 stories (feed order = the
// editors' ranking), every other feed contributes its single top story.
// Capped at 6 items total.
export async function assembleNews(
  bbcUrl: string | null,
  otherUrls: string[]
): Promise<NewsItem[]> {
  const [bbcResult, ...otherResults] = await Promise.allSettled([
    bbcUrl ? fetchFeed(bbcUrl) : Promise.resolve([]),
    ...otherUrls.map(fetchFeed),
  ]);
  const picked: NewsItem[] = [];
  if (bbcResult.status === "fulfilled") {
    picked.push(...bbcResult.value.filter((i) => i.title).slice(0, 3));
  }
  for (const r of otherResults) {
    if (r.status === "fulfilled") {
      const top = r.value.find((i) => i.title);
      if (top) picked.push(top);
    }
  }
  return picked.slice(0, 6);
}
