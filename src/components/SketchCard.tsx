"use client";

import { useState } from "react";

type Generated = { svg: string; provider: string; model: string; costCents: number };

export default function SketchCard() {
  const [prompt, setPrompt] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [gen, setGen] = useState<Generated | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setGen(null);
    setSent(null);
    setError(null);
    try {
      const res = await fetch("/api/sketch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "something went wrong");
      else {
        setGen(data);
        setLastPrompt(prompt);
      }
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!gen) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/sketch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send: true, svg: gen.svg, title: lastPrompt || "sketch" }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "send failed");
      else setSent(`“${data.name}” delivered to ${data.folder}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
      <div>
        <h2 className="text-sm text-graphite">ai sketch</h2>
        <p className="text-xs text-faint mt-1 leading-relaxed">
          prompt to vector line art. preview it here first, send to the tablet
          only if you like it. honest note: sketches are the one feature where
          the Claude API clearly beats the local model.
        </p>
      </div>
      <form onSubmit={generate} className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. a lighthouse on a cliff, minimal line art"
          className="flex-1 min-w-0 bg-paper border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy || prompt.trim().length < 4}
          className="bg-ink text-paper text-sm rounded-full px-5 disabled:opacity-40 shrink-0"
        >
          {busy ? "drawing…" : "generate"}
        </button>
      </form>
      {error && <p className="text-danger text-sm">{error}</p>}
      {gen && (
        <div className="flex flex-col gap-3">
          <div
            className="border border-line rounded-xl bg-white overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: gen.svg }}
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-faint">
              {gen.provider === "local"
                ? "local model, free"
                : `${gen.model}, ${gen.costCents < 1 ? "<1¢" : `${gen.costCents.toFixed(1)}¢`}`}
            </span>
            <button
              onClick={send}
              disabled={sending}
              className="bg-ink text-paper text-sm rounded-full px-5 py-2 disabled:opacity-40"
            >
              {sending ? "sending…" : "send to tablet"}
            </button>
          </div>
          {sent && (
            <p className="text-sm text-accent-deep bg-accent-mist rounded-xl px-4 py-3">{sent}</p>
          )}
        </div>
      )}
    </div>
  );
}
