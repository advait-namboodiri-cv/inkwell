"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";

type RemovalMode = "trash" | "delete";
type Sections = {
  todos: boolean;
  news: boolean;
  weather: boolean;
  inkStats: boolean;
  history: boolean;
  quote: boolean;
};
type EmailConfig = { enabled: boolean; to: string; smtpUser: string; hasPassword: boolean };
type AiConfig = {
  provider: "local" | "anthropic";
  localUrl: string;
  localModel: string;
  anthropicModel: string;
  hasKey: boolean;
};
type Spend = { totalCents: number; byFeature: { feature: string; n: number; cents: number }[] };
type Presets = { bbc: boolean; motorsport: boolean; nyt: boolean };
type BriefConfig = {
  sections: Sections;
  presets: Presets;
  customFeeds: string[];
  city: string;
  time: string;
};

const SECTION_LABELS: { key: keyof Sections; label: string }[] = [
  { key: "todos", label: "open todos" },
  { key: "news", label: "news" },
  { key: "weather", label: "weather" },
  { key: "inkStats", label: "your ink stats" },
  { key: "history", label: "on this day in history" },
  { key: "quote", label: "a quote" },
];

const PRESET_LABELS: { key: keyof Presets; label: string; hint: string }[] = [
  { key: "bbc", label: "BBC news", hint: "top 3 stories" },
  { key: "motorsport", label: "Motorsport F1", hint: "top story" },
  { key: "nyt", label: "NY Times", hint: "top story" },
];

const OPTIONS: { value: RemovalMode; label: string; detail: string }[] = [
  {
    value: "trash",
    label: "send to the tablet's trash",
    detail:
      "archived to the local vault, then moved to your reMarkable's trash. you can still restore it on the device",
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

  const [email, setEmail] = useState<EmailConfig | null>(null);
  const [smtpPass, setSmtpPass] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);

  const [ai, setAi] = useState<AiConfig | null>(null);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [aiSaved, setAiSaved] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTest, setAiTest] = useState<{ ok: boolean; detail?: string; error?: string } | null>(null);
  const [spend, setSpend] = useState<Spend | null>(null);

  async function saveAi(patch: Partial<AiConfig> & { anthropicKey?: string }) {
    if (!ai) return;
    const next = { ...ai, ...patch };
    setAi(next);
    setAiSaved(false);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai: { ...next, anthropicKey: patch.anthropicKey ?? "" } }),
    });
    if (res.ok) {
      const s = await res.json();
      setAi(s.ai);
      if (patch.anthropicKey) {
        setAnthropicKey("");
        void testAi();
      }
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2000);
    }
  }

  async function testAi() {
    setAiTesting(true);
    setAiTest(null);
    try {
      const res = await fetch("/api/ai-test", { method: "POST" });
      setAiTest(await res.json());
    } finally {
      setAiTesting(false);
    }
  }
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/email-test", { method: "POST" });
      setTestResult(await res.json());
    } finally {
      setTesting(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/pair", { method: "DELETE" });
    window.location.href = "/";
  }

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const s = await res.json();
        setMode(s.removalMode);
        setBrief(s.brief);
        setFeedsText(s.brief.customFeeds.join("\n"));
        setEmail(s.email);
        setAi(s.ai);
      }
      const sp = await fetch("/api/ai-spend");
      if (sp.ok) setSpend(await sp.json());
    })();
  }, []);

  async function saveEmail(patch: Partial<EmailConfig> & { smtpPass?: string }) {
    if (!email) return;
    const next = { ...email, ...patch };
    setEmail(next);
    setEmailSaved(false);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: { ...next, smtpPass: patch.smtpPass ?? "" } }),
    });
    if (res.ok) {
      const s = await res.json();
      setEmail(s.email);
      if (patch.smtpPass) {
        setSmtpPass("");
        void testConnection(); // verify right after a new password is saved
      }
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
    }
  }

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

  const [briefSending, setBriefSending] = useState(false);
  const [briefResult, setBriefResult] = useState<string | null>(null);

  async function sendNow() {
    setBriefSending(true);
    setBriefResult(null);
    try {
      const res = await fetch("/api/brief", { method: "POST" });
      const data = await res.json();
      setBriefResult(
        res.ok
          ? `“${data.name}” delivered to the ${data.folder} folder${data.emailed ? " · email sent" : ""}`
          : (data.error ?? "something went wrong")
      );
    } finally {
      setBriefSending(false);
    }
  }

  return (
    <main className="page-fade flex-1 flex flex-col items-center px-6 py-16">
      <Header />
      <section className="w-full max-w-3xl flex flex-col gap-6">
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
            either way, a full copy always lands in the local vault first,
            nothing is ever unrecoverable.
          </p>
        </div>

        <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm text-graphite">daily brief</h2>
            <div className="flex items-center gap-3">
              {briefSaved && <span className="text-xs text-accent-deep">saved ✓</span>}
              <button
                onClick={sendNow}
                disabled={briefSending}
                className="bg-ink text-paper text-sm rounded-full px-4 py-1.5 disabled:opacity-40"
              >
                {briefSending ? "assembling…" : "send now"}
              </button>
            </div>
          </div>
          {briefResult && (
            <p className="text-sm text-accent-deep bg-accent-mist rounded-xl px-4 py-3">
              {briefResult}
            </p>
          )}
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
              <div className="flex flex-col gap-2">
                <span className="text-xs text-faint">news sources</span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_LABELS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() =>
                        saveBrief({
                          presets: { ...brief.presets, [p.key]: !brief.presets[p.key] },
                        })
                      }
                      className={`text-sm rounded-full px-4 py-1.5 border transition-colors ${
                        brief.presets[p.key]
                          ? "bg-accent-mist border-accent text-accent-deep"
                          : "border-line text-graphite hover:border-faint"
                      }`}
                    >
                      {p.label}
                      <span className="text-[10px] ml-1.5 opacity-70">{p.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-faint">
                  custom rss feeds, one per line, each contributes its top story
                </span>
                <textarea
                  value={feedsText}
                  onChange={(e) => setFeedsText(e.target.value)}
                  onBlur={() => saveBrief({ customFeeds: feedsText.split("\n") })}
                  rows={3}
                  spellCheck={false}
                  placeholder="https://example.com/feed.xml"
                  className="bg-paper border border-line rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-accent transition-colors resize-y placeholder:text-faint"
                />
              </label>
              <div className="flex gap-4">
                <label className="flex flex-col gap-1.5 flex-1">
                  <span className="text-xs text-faint">weather city, any city worldwide</span>
                  <input
                    value={brief.city}
                    onChange={(e) => setBrief({ ...brief, city: e.target.value })}
                    onBlur={() => saveBrief({ city: brief.city })}
                    className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5 w-36">
                  <span className="text-xs text-faint">send at</span>
                  <input
                    type="time"
                    value={brief.time}
                    onChange={(e) => setBrief({ ...brief, time: e.target.value })}
                    onBlur={() => saveBrief({ time: brief.time })}
                    className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                  />
                </label>
              </div>
              <p className="text-xs text-faint leading-relaxed">
                auto-sends at this time while inkwell is running, into a &ldquo;Daily briefing&rdquo; folder.
              </p>
            </>
          )}
        </div>

        <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm text-graphite">email me when the brief lands</h2>
            {emailSaved && <span className="text-xs text-accent-deep">saved ✓</span>}
          </div>
          {email === null ? (
            <p className="text-faint text-sm">loading…</p>
          ) : (
            <>
              <label className="flex items-center gap-2.5 text-[15px]">
                <input
                  type="checkbox"
                  checked={email.enabled}
                  onChange={(e) => saveEmail({ enabled: e.target.checked })}
                  className="accent-[var(--accent)] w-4 h-4"
                />
                send a &ldquo;your daily briefing is ready&rdquo; email each morning
              </label>
              {email.enabled && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-faint">
                      send it to (blank = your reMarkable account address)
                    </span>
                    <input
                      value={email.to}
                      onChange={(e) => setEmail({ ...email, to: e.target.value })}
                      onBlur={() => saveEmail({ to: email.to })}
                      placeholder="you@example.com"
                      className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-faint"
                    />
                  </label>
                  <div className="flex gap-4 flex-wrap">
                    <label className="flex flex-col gap-1.5 flex-1 min-w-48">
                      <span className="text-xs text-faint">gmail address that sends it</span>
                      <input
                        value={email.smtpUser}
                        onChange={(e) => setEmail({ ...email, smtpUser: e.target.value })}
                        onBlur={() => saveEmail({ smtpUser: email.smtpUser })}
                        placeholder="you@gmail.com"
                        className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-faint"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 flex-1 min-w-48">
                      <span className="text-xs text-faint">
                        gmail app password{email.hasPassword ? " (saved ✓, enter to replace)" : ""}
                      </span>
                      <input
                        type="password"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        onBlur={() => smtpPass.trim() && saveEmail({ smtpPass })}
                        placeholder={email.hasPassword ? "••••••••" : "16 characters"}
                        className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-faint"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={testConnection}
                      disabled={testing || !email.hasPassword}
                      className="text-sm border border-line rounded-full px-4 py-1.5 text-graphite hover:border-accent hover:text-accent-deep transition-colors disabled:opacity-40"
                    >
                      {testing ? "checking…" : "test connection"}
                    </button>
                    {testResult &&
                      (testResult.ok ? (
                        <span className="text-sm text-accent-deep">
                          connected to gmail ✓
                        </span>
                      ) : (
                        <span className="text-sm text-danger">{testResult.error}</span>
                      ))}
                  </div>
                  <p className="text-xs text-faint leading-relaxed">
                    app password from myaccount.google.com/apppasswords · stored locally, never shown
                  </p>
                </>
              )}
            </>
          )}
        </div>

        <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm text-graphite">ai</h2>
            {aiSaved && <span className="text-xs text-accent-deep">saved ✓</span>}
          </div>
          {ai === null ? (
            <p className="text-faint text-sm">loading…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "local", label: "local model", hint: "free · private" },
                    { key: "anthropic", label: "Claude API", hint: "costs cents" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => saveAi({ provider: p.key })}
                    className={`text-sm rounded-full px-4 py-1.5 border transition-colors ${
                      ai.provider === p.key
                        ? "bg-accent-mist border-accent text-accent-deep"
                        : "border-line text-graphite hover:border-faint"
                    }`}
                  >
                    {p.label}
                    <span className="text-[10px] ml-1.5 opacity-70">{p.hint}</span>
                  </button>
                ))}
              </div>
              {ai.provider === "local" ? (
                <div className="flex gap-4 flex-wrap">
                  <label className="flex flex-col gap-1.5 flex-1 min-w-48">
                    <span className="text-xs text-faint">mlx server url</span>
                    <input
                      value={ai.localUrl}
                      onChange={(e) => setAi({ ...ai, localUrl: e.target.value })}
                      onBlur={() => saveAi({ localUrl: ai.localUrl })}
                      className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 flex-1 min-w-48">
                    <span className="text-xs text-faint">model</span>
                    <input
                      value={ai.localModel}
                      onChange={(e) => setAi({ ...ai, localModel: e.target.value })}
                      onBlur={() => saveAi({ localModel: ai.localModel })}
                      className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                    />
                  </label>
                </div>
              ) : (
                <div className="flex gap-4 flex-wrap">
                  <label className="flex flex-col gap-1.5 flex-1 min-w-48">
                    <span className="text-xs text-faint">model</span>
                    <input
                      value={ai.anthropicModel}
                      onChange={(e) => setAi({ ...ai, anthropicModel: e.target.value })}
                      onBlur={() => saveAi({ anthropicModel: ai.anthropicModel })}
                      className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 flex-1 min-w-48">
                    <span className="text-xs text-faint">
                      api key{ai.hasKey ? " (saved ✓, enter to replace)" : ""}
                    </span>
                    <input
                      type="password"
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      onBlur={() => anthropicKey.trim() && saveAi({ anthropicKey })}
                      placeholder={ai.hasKey ? "••••••••" : "sk-ant-..."}
                      className="bg-paper border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-faint"
                    />
                  </label>
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={testAi}
                  disabled={aiTesting}
                  className="text-sm border border-line rounded-full px-4 py-1.5 text-graphite hover:border-accent hover:text-accent-deep transition-colors disabled:opacity-40"
                >
                  {aiTesting ? "checking…" : "test connection"}
                </button>
                {aiTest &&
                  (aiTest.ok ? (
                    <span className="text-sm text-accent-deep">{aiTest.detail} ✓</span>
                  ) : (
                    <span className="text-sm text-danger">{aiTest.error}</span>
                  ))}
              </div>
              {spend && (
                <p className="text-xs text-faint leading-relaxed">
                  spent: ${(spend.totalCents / 100).toFixed(2)}
                  {spend.byFeature.length > 0 &&
                    " · " +
                      spend.byFeature
                        .map((f) => `${f.n} ${f.feature}${f.n === 1 ? "" : "s"} ($${(f.cents / 100).toFixed(2)})`)
                        .join(" · ")}
                  {" · local runs are always free"}
                </p>
              )}
            </>
          )}
        </div>

        <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-3">
          <h2 className="text-sm text-graphite">device</h2>
          <p className="text-xs text-faint leading-relaxed">
            removes the token from this mac. stats, vault and settings stay.
          </p>
          {disconnecting ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-danger">
                are you sure? you&apos;ll need a new code to reconnect
              </span>
              <button
                onClick={disconnect}
                className="bg-danger text-paper text-sm rounded-full px-4 py-2"
              >
                yes, disconnect
              </button>
              <button
                onClick={() => setDisconnecting(false)}
                className="text-sm text-graphite px-2"
              >
                cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDisconnecting(true)}
              className="self-start bg-danger text-paper text-sm rounded-full px-4 py-2"
            >
              disconnect this reMarkable
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
