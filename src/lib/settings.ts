import { getSyncState, setSyncState } from "./db";

// removal_mode:
//   "trash"  — archive to vault, then move the doc to the tablet's trash (default)
//   "delete" — archive to vault, then permanently delete from the cloud
export type RemovalMode = "trash" | "delete";

export type BriefSections = {
  todos: boolean;
  news: boolean;
  weather: boolean;
  quote: boolean;
};

// preset feeds are toggle chips in the UI; BBC contributes its top 3
// stories, other enabled presets and custom feeds contribute their top 1
export type BriefPresets = { bbc: boolean; motorsport: boolean; nyt: boolean };

export const PRESET_FEEDS: Record<keyof BriefPresets, { label: string; url: string }> = {
  bbc: { label: "BBC news", url: "http://feeds.bbci.co.uk/news/rss.xml" },
  motorsport: { label: "Motorsport F1", url: "https://www.motorsport.com/rss/f1/news/" },
  nyt: {
    label: "NY Times",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  },
};

export type BriefConfig = {
  sections: BriefSections;
  presets: BriefPresets;
  customFeeds: string[];
  city: string;
  time: string; // "HH:MM" local time to auto-send
};

export type Settings = { removalMode: RemovalMode; brief: BriefConfig };

const DEFAULT_BRIEF: BriefConfig = {
  sections: { todos: true, news: true, weather: true, quote: true },
  presets: { bbc: true, motorsport: true, nyt: false },
  customFeeds: [],
  city: "Madison",
  time: "07:00",
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function getSettings(): Settings {
  const mode = getSyncState("removal_mode");
  let brief = DEFAULT_BRIEF;
  const raw = getSyncState("brief_config");
  if (raw) {
    try {
      const p = JSON.parse(raw);
      brief = {
        sections: { ...DEFAULT_BRIEF.sections, ...(p.sections ?? {}) },
        presets: { ...DEFAULT_BRIEF.presets, ...(p.presets ?? {}) },
        customFeeds: Array.isArray(p.customFeeds)
          ? p.customFeeds.filter((f: unknown) => typeof f === "string")
          : DEFAULT_BRIEF.customFeeds,
        city:
          typeof p.city === "string" && p.city.trim() ? p.city : DEFAULT_BRIEF.city,
        time:
          typeof p.time === "string" && TIME_RE.test(p.time)
            ? p.time
            : Number.isInteger(p.hour) // migrate old hour-based config
              ? `${String(p.hour).padStart(2, "0")}:00`
              : DEFAULT_BRIEF.time,
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
      presets: { ...current.presets, ...(patch.brief.presets ?? {}) },
      customFeeds: Array.isArray(patch.brief.customFeeds)
        ? patch.brief.customFeeds.map((f) => f.trim()).filter(Boolean).slice(0, 10)
        : current.customFeeds,
      city:
        typeof patch.brief.city === "string" && patch.brief.city.trim()
          ? patch.brief.city.trim()
          : current.city,
      time:
        typeof patch.brief.time === "string" && TIME_RE.test(patch.brief.time)
          ? patch.brief.time
          : current.time,
    };
    setSyncState("brief_config", JSON.stringify(next));
  }
  return getSettings();
}
