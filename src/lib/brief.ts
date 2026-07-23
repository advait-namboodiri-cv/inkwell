import { getDb, getSyncState, setSyncState } from "./db";
import { getSettings, PRESET_FEEDS } from "./settings";
import { assembleNews, type NewsItem } from "./rss";
import { briefPdf } from "./briefPdf";
import { deliverPdf } from "./deliver";
import { notifyBriefReady } from "./mailer";
import { parseAccount, runRmapi } from "./rmapi";

// Assembles the daily brief from free sources only — no AI anywhere:
// open todos, top RSS stories, open-meteo weather, a rotating quote.
export type BriefWeather = {
  label: string; // "Madison · partly cloudy · high 78° low 51°"
  detail: string; // "10% chance of rain · sun 5:42a – 8:31p"
};

export type Brief = {
  dateLabel: string;
  todos: string[];
  news: NewsItem[];
  weather: BriefWeather | null;
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

const WEATHER_CODES: [number[], string][] = [
  [[0], "clear skies"],
  [[1], "mostly clear"],
  [[2], "partly cloudy"],
  [[3], "overcast"],
  [[45, 48], "foggy"],
  [[51, 53, 55, 56, 57], "drizzle"],
  [[61, 63, 65, 66, 67], "rain"],
  [[71, 73, 75, 77], "snow"],
  [[80, 81, 82], "showers"],
  [[85, 86], "snow showers"],
  [[95, 96, 99], "thunderstorms"],
];

function describeCode(code: number): string {
  for (const [codes, label] of WEATHER_CODES) {
    if (codes.includes(code)) return label;
  }
  return "";
}

function clockLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}${d.getHours() < 12 ? "a" : "p"}`;
}

async function todaysWeather(city: string): Promise<BriefWeather | null> {
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
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset` +
          `&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`,
        { signal: AbortSignal.timeout(10_000) }
      )
    ).json();
    const d = wx?.daily;
    if (!d?.temperature_2m_max) return null;
    const hi = Math.round(d.temperature_2m_max[0]);
    const lo = Math.round(d.temperature_2m_min[0]);
    const rain = d.precipitation_probability_max?.[0];
    const cond = describeCode(d.weather_code?.[0] ?? -1);
    const sun =
      d.sunrise?.[0] && d.sunset?.[0]
        ? `sun ${clockLabel(d.sunrise[0])} – ${clockLabel(d.sunset[0])}`
        : "";
    return {
      label: [hit.name, cond, `high ${hi}° low ${lo}°`].filter(Boolean).join(" · "),
      detail: [rain != null ? `${rain}% chance of rain` : "", sun]
        .filter(Boolean)
        .join(" · "),
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

  let news: NewsItem[] = [];
  if (brief.sections.news) {
    const others = [
      ...(brief.presets.motorsport ? [PRESET_FEEDS.motorsport.url] : []),
      ...(brief.presets.nyt ? [PRESET_FEEDS.nyt.url] : []),
      ...brief.customFeeds,
    ];
    news = await assembleNews(brief.presets.bbc ? PRESET_FEEDS.bbc.url : null, others);
  }

  const weather = brief.sections.weather ? await todaysWeather(brief.city) : null;

  const dayNumber = Math.floor(Date.now() / 86_400_000);
  const quote = QUOTES[dayNumber % QUOTES.length];

  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return { dateLabel, todos, news, weather, quote };
}

export async function sendBrief(): Promise<{ name: string; folder: string; emailed: boolean }> {
  const brief = await buildBrief();
  const pdf = await briefPdf(brief);
  const dateName = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const delivered = await deliverPdf(pdf, `brief · ${dateName}`, "Daily briefing");
  setSyncState("last_brief_date", new Date().toDateString());

  // email "it's ready" to the reMarkable account address (best effort)
  let emailed = false;
  try {
    const acct = parseAccount((await runRmapi(["account"])).stdout);
    if (acct) emailed = await notifyBriefReady(acct.user, delivered.name);
  } catch {
    /* email is never fatal */
  }
  return { ...delivered, emailed };
}

export function briefSentToday(): boolean {
  return getSyncState("last_brief_date") === new Date().toDateString();
}
