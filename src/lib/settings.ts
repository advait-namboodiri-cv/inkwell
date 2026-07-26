import { getSyncState, setSyncState } from "./db";

// removal_mode:
//   "trash"  — archive to vault, then move the doc to the tablet's trash (default)
//   "delete" — archive to vault, then permanently delete from the cloud
export type RemovalMode = "trash" | "delete";

export type BriefSections = {
  todos: boolean;
  news: boolean;
  weather: boolean;
  inkStats: boolean;
  history: boolean;
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

// email notification config: the password is entered in the settings UI,
// stored only in the local database (data/ is gitignored), and never sent
// back to the browser. hasPassword tells the UI whether one is saved.
export type EmailConfig = {
  enabled: boolean;
  to: string; // defaults to the reMarkable account address at send time
  smtpUser: string;
  hasPassword: boolean;
};

// AI config: each superpower picks its own provider, local MLX (free,
// private) by default, or the Anthropic API. The Anthropic key is entered in
// settings, stored only in the local db, and never returned to the browser.
export type AiProvider = "local" | "anthropic";
export type AiFeature = "summary" | "worksheet" | "sketch";
export type AiConfig = {
  features: Record<AiFeature, AiProvider>;
  localUrl: string; // OpenAI-compatible base url of the mlx server
  localModel: string;
  anthropicModel: string;
  hasKey: boolean;
};

export type Settings = {
  removalMode: RemovalMode;
  brief: BriefConfig;
  email: EmailConfig;
  ai: AiConfig;
};

const DEFAULT_AI: AiConfig = {
  features: { summary: "local", worksheet: "local", sketch: "local" },
  localUrl: "http://localhost:8080/v1",
  localModel: "mlx-community/Qwen2.5-14B-Instruct-4bit",
  anthropicModel: "claude-opus-4-8",
  hasKey: false,
};

function readAiFeatures(): Record<AiFeature, AiProvider> {
  const out = { ...DEFAULT_AI.features };
  const raw = getSyncState("ai_features");
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<Record<AiFeature, AiProvider>>;
      for (const k of ["summary", "worksheet", "sketch"] as const) {
        if (p[k] === "local" || p[k] === "anthropic") out[k] = p[k];
      }
      return out;
    } catch {
      /* fall through to legacy */
    }
  }
  // legacy single-provider setting seeds all three
  if (getSyncState("ai_provider") === "anthropic") {
    out.summary = out.worksheet = out.sketch = "anthropic";
  }
  return out;
}

const DEFAULT_BRIEF: BriefConfig = {
  sections: {
    todos: true,
    news: true,
    weather: true,
    inkStats: true,
    history: true,
    quote: true,
  },
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
  const email: EmailConfig = {
    enabled: getSyncState("email_enabled") === "1",
    to: getSyncState("email_to") ?? "",
    smtpUser: getSyncState("smtp_user") ?? "",
    hasPassword: Boolean(getSyncState("smtp_pass")),
  };
  const ai: AiConfig = {
    features: readAiFeatures(),
    localUrl: getSyncState("ai_local_url") || DEFAULT_AI.localUrl,
    localModel: getSyncState("ai_local_model") || DEFAULT_AI.localModel,
    anthropicModel: getSyncState("ai_anthropic_model") || DEFAULT_AI.anthropicModel,
    hasKey: Boolean(getSyncState("anthropic_key")),
  };
  return { removalMode: mode === "delete" ? "delete" : "trash", brief, email, ai };
}

// server-only: the actual credentials for sending (db first, env fallback)
export function getSmtpCredentials(): { user: string; pass: string } | null {
  const user = getSyncState("smtp_user") || process.env.SMTP_USER || "";
  const pass = getSyncState("smtp_pass") || process.env.SMTP_PASS || "";
  return user && pass ? { user, pass } : null;
}

// server-only: the Anthropic API key (db first, env fallback)
export function getAnthropicKey(): string | null {
  return getSyncState("anthropic_key") || process.env.ANTHROPIC_API_KEY || null;
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
  if (patch.email) {
    const e = patch.email as Partial<EmailConfig> & { smtpPass?: string };
    if (typeof e.enabled === "boolean") setSyncState("email_enabled", e.enabled ? "1" : "0");
    if (typeof e.to === "string") setSyncState("email_to", e.to.trim());
    if (typeof e.smtpUser === "string") setSyncState("smtp_user", e.smtpUser.trim());
    // only overwrite the stored password when a non-empty one is submitted;
    // google displays app passwords with spaces, so strip all whitespace
    if (typeof e.smtpPass === "string" && e.smtpPass.trim()) {
      setSyncState("smtp_pass", e.smtpPass.replace(/\s+/g, ""));
    }
  }
  if (patch.ai) {
    const a = patch.ai as Partial<AiConfig> & { anthropicKey?: string };
    if (a.features && typeof a.features === "object") {
      const merged = readAiFeatures();
      for (const k of ["summary", "worksheet", "sketch"] as const) {
        if (a.features[k] === "local" || a.features[k] === "anthropic") {
          merged[k] = a.features[k];
        }
      }
      setSyncState("ai_features", JSON.stringify(merged));
    }
    if (typeof a.localUrl === "string" && a.localUrl.trim()) {
      setSyncState("ai_local_url", a.localUrl.trim().replace(/\/$/, ""));
    }
    if (typeof a.localModel === "string" && a.localModel.trim()) {
      setSyncState("ai_local_model", a.localModel.trim());
    }
    if (typeof a.anthropicModel === "string" && a.anthropicModel.trim()) {
      setSyncState("ai_anthropic_model", a.anthropicModel.trim());
    }
    // only overwrite the stored key when a non-empty one is submitted
    if (typeof a.anthropicKey === "string" && a.anthropicKey.trim()) {
      setSyncState("anthropic_key", a.anthropicKey.trim());
    }
  }
  return getSettings();
}
