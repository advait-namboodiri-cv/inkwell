"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";

type RemovalMode = "trash" | "delete";
type Sections = {
  todos: boolean;
  news: boolean;
  weather: boolean;
  passage: boolean;
  quote: boolean;
};
type BriefConfig = { sections: Sections; feeds: string[]; city: string; hour: number };

const SECTION_LABELS: { key: keyof Sections; label: string }[] = [
  { key: "todos", label: "open todos" },
  { key: "news", label: "top 3 news stories" },
  { key: "weather", label: "weather" },
  { key: "passage", label: "a resurfaced passage" },
  { key: "quote", label: "a quote" },
];

const OPTIONS: { value: RemovalMode; label: string; detail: string }[] = [
  {
    value: "trash",
    label: "send to the tablet's trash",
    detail:
      "archived to the local vault, then moved to your reMarkable's trash — you can still restore it on the device",
  },
  {
    value: "delete",
    label: "delete from the cloud",
    detail:
      "archived to the local vault, then permanently removed from your reMarkable account",
  },
];

export default function SettingsPage() {
  const [mode, setMode] = useState<RemovalMode | null>(null);
  const [brief, setBrief] = useState<BriefConfig | null>(null);
  const [feedsText, setFeedsText] = useState("");
  const [saved, setSaved] = useState(false);
  const [briefSaved, setBriefSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const s = await res.json();
        setMode(s.removalMode);
        setBrief(s.brief);
        setFeedsText(s.brief.feeds.join("\n"));
      }
    })();
  }, []);

  async function choose(next: RemovalMode) {
    setMode(next);
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removalMode: next }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function saveBrief(patch: Partial<BriefConfig>) {
    if (!brief) return;
    const next = { ...brief, ...patch };
    setBrief(next);
    setBriefSaved(false);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: next }),
    });
    if (res.ok) {
      const s = await res.json();
      setBrief(s.brief);
      setBriefSaved(true);
      setTimeout(() => setBriefSaved(false), 2000);
    }
  }

  return (
    <main className="page-fade flex-1 flex flex-col items-center px-6 py-16">
      <Header />
      <section className="w-full max-w-lg flex flex-col gap-6">
        <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm text-graphite">when the janitor removes a doc</h2>
            {saved && <span className="text-xs text-accent-deep">saved ✓</span>}
          </div>
          {mode === null ? (
            <p className="text-faint text-sm">loading…</p>
          ) : (
            <div className="flex flex-col gap-3">
              {OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`flex gap-3 items-start border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                    mode === o.value
                      ? "border-accent bg-accent-mist"
                      : "border-line hover:border-faint"
                  }`}
                >
                  <input
                    type="radio"
                    name="removalMode"
                    checked={mode === o.value}
                    onChange={() => choose(o.value)}
                    className="accent-[var(--accent)] mt-1"
                  />
                  <span>
                    <span className="text-[15px]">{o.label}</span>
                    <span className="block text-xs text-graphite mt-0.5 leading-relaxed">
                      {o.detail}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-faint leading-relaxed">
            either way, a full copy always lands in the local vault first —
            nothing is ever unrecoverable.
          </p>
        </div>

        <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm text-graphite">daily brief</h2>
            {briefSaved && <span className="text-xs text-accent-deep">saved ✓</span>}
          </div>
          {brief === null ? (
            <p className="text-faint text-sm">loading…</p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-faint">sections</span>
                {SECTION_LABELS.map((s) => (
                  <label key={s.key} className="flex items-center gap-2.5 text-[15px]">
                    <input
                      type="checkbox"
                      checked={brief.sections[s.key]}
                      onChange={(e) =>
                        saveBrief({
                          sections: { ...brief.sections, [s.key]: e.target.checked },
                        })
                      }
                      className="accent-[var(--accent)] w-4 h-4"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-faint">rss feeds — one per line</span>
                <textarea
                  value={feedsText}
                  onChange={(e) => setFeedsText(e.target.value)}
                  onBlur={() => saveBrief({ feeds: feedsText.split("\n") })}
                  rows={4}
                  spellCheck={false}
                  className="bg-paper border border-line rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-accent transition-colors resize-y"
                />
              </label>
              <div className="flex gap-4">
                <label className="flex flex-col gap-1.5 flex-1">
                  <span className="text-xs text-faint">weather city</span>
                  <input
                    value={brief.city}
                    onChange={(e) => setBrief({ ...brief, city: e.target.value })}
                    onBlur={() => saveBrief({ city: brief.city })}
                    className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5 w-32">
                  <span className="text-xs text-faint">send at (hour)</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={brief.hour}
                    onChange={(e) =>
                      setBrief({ ...brief, hour: Number(e.target.value) })
                    }
                    onBlur={() => saveBrief({ hour: brief.hour })}
                    className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                  />
                </label>
              </div>
              <p className="text-xs text-faint leading-relaxed">
                the brief sends automatically at that hour while inkwell is
                running, into a &ldquo;Daily briefing&rdquo; folder on your tablet.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
