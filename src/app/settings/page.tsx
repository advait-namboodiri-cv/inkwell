"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";

type RemovalMode = "trash" | "delete";

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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/settings");
      if (res.ok) setMode((await res.json()).removalMode);
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
      </section>
    </main>
  );
}
