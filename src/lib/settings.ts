import { getSyncState, setSyncState } from "./db";

// removal_mode:
//   "trash"  — archive to vault, then move the doc to the tablet's trash (default)
//   "delete" — archive to vault, then permanently delete from the cloud
export type RemovalMode = "trash" | "delete";

export type BriefSections = {
  todos: boolean;
  news: boolean;
  weather: boolean;
  passage: boolean;
  quote: boolean;
};

export type BriefConfig = {
  sections: BriefSections;
  feeds: string[];
  city: string;
  hour: number; // local hour to auto-send (default 7)
};

export type Settings = { removalMode: RemovalMode; brief: BriefConfig };

const DEFAULT_BRIEF: BriefConfig = {
  sections: { todos: true, news: true, weather: true, passage: true, quote: true },
  feeds: [
    "http://feeds.bbci.co.uk/news/rss.xml",
    "https://hnrss.org/frontpage",
    "https://www.theverge.com/rss/index.xml",
    "https://www.motorsport.com/rss/f1/news/",
  ],
  city: "Madison",
  hour: 7,
};

export function getSettings(): Settings {
  const mode = getSyncState("removal_mode");
  let brief = DEFAULT_BRIEF;
  const raw = getSyncState("brief_config");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      brief = {
        sections: { ...DEFAULT_BRIEF.sections, ...(parsed.sections ?? {}) },
        feeds: Array.isArray(parsed.feeds) ? parsed.feeds.filter((f: unknown) => typeof f === "string") : DEFAULT_BRIEF.feeds,
        city: typeof parsed.city === "string" && parsed.city.trim() ? parsed.city : DEFAULT_BRIEF.city,
        hour: Number.isInteger(parsed.hour) && parsed.hour >= 0 && parsed.hour <= 23 ? parsed.hour : DEFAULT_BRIEF.hour,
      };
    } catch {
      /* fall back to defaults */
    }
  }
  return { removalMode: mode === "delete" ? "delete" : "trash", brief };
}

export function updateSettings(patch: Partial<Settings>): Settings {
  if (patch.removalMode === "trash" || patch.removalMode === "delete") {
    setSyncState("removal_mode", patch.removalMode);
  }
  if (patch.brief) {
    const current = getSettings().brief;
    const next: BriefConfig = {
      sections: { ...current.sections, ...(patch.brief.sections ?? {}) },
      feeds: Array.isArray(patch.brief.feeds)
        ? patch.brief.feeds.map((f) => f.trim()).filter(Boolean).slice(0, 10)
        : current.feeds,
      city: typeof patch.brief.city === "string" && patch.brief.city.trim() ? patch.brief.city.trim() : current.city,
      hour: Number.isInteger(patch.brief.hour) && patch.brief.hour! >= 0 && patch.brief.hour! <= 23 ? patch.brief.hour! : current.hour,
    };
    setSyncState("brief_config", JSON.stringify(next));
  }
  return getSettings();
}
