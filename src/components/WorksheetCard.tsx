"use client";

import { useState } from "react";

type Done = {
  name: string;
  folder: string;
  problems: number;
  provider: string;
  model: string;
  costCents: number;
};

export default function WorksheetCard() {
  const [prompt, setPrompt] = useState("");
  const [answers, setAnswers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDone(null);
    setError(null);
    try {
      const res = await fetch("/api/worksheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, includeAnswers: answers }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "something went wrong");
      else {
        setDone(data);
        setPrompt("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={run}
      className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4"
    >
      <div>
        <h2 className="text-sm text-graphite">generate a worksheet</h2>
        <p className="text-xs text-faint mt-1 leading-relaxed">
          describe the practice you want and a typeset problem set lands in your
          inkwell inbox, with room to work by hand. free on the local model.
        </p>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        placeholder="e.g. 8 integration by parts problems, easy to hard"
        className="bg-paper border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors placeholder:text-faint resize-y"
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input
            type="checkbox"
            checked={answers}
            onChange={(e) => setAnswers(e.target.checked)}
            className="accent-[var(--accent)] w-4 h-4"
          />
          include an answer page
        </label>
        <button
          type="submit"
          disabled={busy || prompt.trim().length < 4}
          className="bg-ink text-paper text-sm rounded-full px-5 py-2 disabled:opacity-40"
        >
          {busy ? "writing problems…" : "generate & send"}
        </button>
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
      {done && (
        <p className="text-sm text-accent-deep bg-accent-mist rounded-xl px-4 py-3">
          “{done.name}” ({done.problems} problems) delivered to {done.folder} ·{" "}
          {done.provider === "local"
            ? "local model, free"
            : `${done.model}, ${done.costCents < 1 ? "<1¢" : `${done.costCents.toFixed(1)}¢`}`}
        </p>
      )}
    </form>
  );
}
