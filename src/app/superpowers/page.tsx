"use client";

import { useState } from "react";
import Header from "@/components/Header";
import SummarizeCard from "@/components/SummarizeCard";
import WorksheetCard from "@/components/WorksheetCard";
import SketchCard from "@/components/SketchCard";

type Sent = { title: string; site: string; words: number; folder: string };

export default function SuperpowersPage() {
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [briefSending, setBriefSending] = useState(false);
  const [briefResult, setBriefResult] = useState<string | null>(null);

  async function sendBriefNow() {
    setBriefSending(true);
    setBriefResult(null);
    try {
      const res = await fetch("/api/brief", { method: "POST" });
      const data = await res.json();
      setBriefResult(
        res.ok
          ? `“${data.name}” delivered to the ${data.folder} folder ✦`
          : (data.error ?? "something went wrong")
      );
    } finally {
      setBriefSending(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSent(null);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "something went wrong");
      else {
        setSent(data);
        setUrl("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="page-fade flex-1 flex flex-col items-center px-6 py-16">
      <Header />
      <section className="w-full max-w-3xl flex flex-col gap-6">
        <form
          onSubmit={send}
          className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4"
        >
          <div>
            <h2 className="text-sm text-graphite">send an article to your tablet</h2>
            <p className="text-xs text-faint mt-1 leading-relaxed">
              paste a link and inkwell strips it to clean reader text, typesets a
              calm PDF, and drops it in the <span className="text-graphite">inkwell inbox</span>{" "}
              folder on your reMarkable
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              spellCheck={false}
              className="flex-1 min-w-0 bg-paper border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors placeholder:text-faint"
            />
            <button
              type="submit"
              disabled={sending || url.trim().length < 4}
              className="bg-ink text-paper text-sm rounded-full px-5 disabled:opacity-40 shrink-0"
            >
              {sending ? "typesetting…" : "send"}
            </button>
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          {sent && (
            <p className="text-sm text-accent-deep bg-accent-mist rounded-xl px-4 py-3">
              “{sent.title}” ({sent.site}, ~{sent.words} words) is on its way,
              check the {sent.folder} folder after your tablet syncs ✦
            </p>
          )}
        </form>

        <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm text-graphite">daily brief</h2>
              <p className="text-xs text-faint mt-1 leading-relaxed">
                todos, top stories from your feeds, weather, a resurfaced
                passage, auto-delivered every morning to a{" "}
                <span className="text-graphite">Daily briefing</span> folder.
                tune it in settings.
              </p>
            </div>
            <button
              onClick={sendBriefNow}
              disabled={briefSending}
              className="bg-ink text-paper text-sm rounded-full px-5 py-2.5 disabled:opacity-40 shrink-0"
            >
              {briefSending ? "assembling…" : "send now"}
            </button>
          </div>
          {briefResult && (
            <p className="text-sm text-accent-deep bg-accent-mist rounded-xl px-4 py-3">
              {briefResult}
            </p>
          )}
        </div>

        <SummarizeCard />
        <WorksheetCard />
        <SketchCard />
      </section>
    </main>
  );
}
