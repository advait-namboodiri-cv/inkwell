import { getDb, getSyncState, setSyncState } from "./db";
import { getSettings } from "./settings";
import { topNews, type NewsItem } from "./rss";
import { briefPdf } from "./briefPdf";
import { deliverPdf } from "./deliver";

// Assembles the daily brief from free sources only — no AI anywhere:
// open todos, top RSS stories, open-meteo weather, a resurfaced highlight,
// and a rotating quote from a local list.
export type Brief = {
  dateLabel: string;
  todos: string[];
  news: NewsItem[];
  weather: { label: string } | null;
  passage: { text: string; doc: string } | null;
  quote: { text: string; by: string };
};

const QUOTES: { text: string; by: string }[] = [
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", by: "Seneca" },
  { text: "Simplicity is the ultimate sophistication.", by: "Leonardo da Vinci" },
  { text: "The best way out is always through.", by: "Robert Frost" },
  { text: "What we fear doing most is usually what we most need to do.", by: "Tim Ferriss" },
  { text: "Well begun is half done.", by: "Aristotle" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", by: "James Clear" },
  { text: "Whether you think you can, or you think you can't — you're right.", by: "Henry Ford" },
  { text: "Make it work, make it right, make it fast.", by: "Kent Beck" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", by: "Marcus Aurelius" },
  { text: "Little by little, one travels far.", by: "attributed to Tolkien" },
  { text: "Perfection is achieved when there is nothing left to take away.", by: "Antoine de Saint-Exupéry" },
  { text: "How we spend our days is, of course, how we spend our lives.", by: "Annie Dillard" },
  { text: "Slow is smooth, smooth is fast.", by: "unknown" },
  { text: "A year from now you may wish you had started today.", by: "Karen Lamb" },
];

async function todaysWeather(city: string): Promise<{ label: string } | null> {
  try {
    const geo = await (
      await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
        { signal: AbortSignal.timeout(10_000) }
      )
    ).json();
    const hit = geo?.results?.[0];
    if (!hit) return null;
    const wx = await (
      await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
          `&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`,
        { signal: AbortSignal.timeout(10_000) }
      )
    ).json();
    const d = wx?.daily;
    if (!d?.temperature_2m_max) return null;
    const hi = Math.round(d.temperature_2m_max[0]);
    const lo = Math.round(d.temperature_2m_min[0]);
    const rain = d.precipitation_probability_max?.[0];
    return {
      label: `${city} · high ${hi}° low ${lo}°${rain != null ? ` · ${rain}% chance of rain` : ""}`,
    };
  } catch {
    return null;
  }
}

export async function buildBrief(): Promise<Brief> {
  const { brief } = getSettings();
  const db = getDb();
  const now = new Date();

  const todos = brief.sections.todos
    ? (db.prepare("SELECT text FROM todos WHERE done = 0 ORDER BY id ASC LIMIT 12").all() as {
        text: string;
      }[]).map((t) => t.text)
    : [];

  const news = brief.sections.news ? await topNews(brief.feeds, 3) : [];
  const weather = brief.sections.weather ? await todaysWeather(brief.city) : null;

  let passage: Brief["passage"] = null;
  if (brief.sections.passage) {
    const all = db
      .prepare(
        `SELECT h.text, d.name AS doc FROM highlights h
         JOIN documents d ON d.id = h.doc_id WHERE d.deleted = 0
         ORDER BY h.doc_id, h.page_id, h.ord`
      )
      .all() as { text: string; doc: string }[];
    if (all.length > 0) passage = all[Math.floor(Date.now() / 86_400_000) % all.length];
  }

  const dayNumber = Math.floor(Date.now() / 86_400_000);
  const quote = QUOTES[dayNumber % QUOTES.length];

  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return { dateLabel, todos, news, weather, passage, quote };
}

export async function sendBrief(): Promise<{ name: string; folder: string }> {
  const brief = await buildBrief();
  const pdf = await briefPdf(brief);
  const dateName = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const delivered = await deliverPdf(pdf, `brief · ${dateName}`, "Daily briefing");
  setSyncState("last_brief_date", new Date().toDateString());
  return delivered;
}

export function briefSentToday(): boolean {
  return getSyncState("last_brief_date") === new Date().toDateString();
}
