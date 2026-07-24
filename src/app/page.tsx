"use client";

import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";
import Header from "@/components/Header";

type Account = { user: string; syncVersion: string };

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [code, setCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => {
        if (s.paired) setAccount(s.account);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function pair(e: React.FormEvent) {
    e.preventDefault();
    setPairing(true);
    setError(null);
    const res = await fetch("/api/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setPairing(false);
    if (res.ok) {
      setAccount(data.account);
      setCode("");
    } else {
      setError(data.error ?? "something went wrong");
    }
  }

  return (
    <main className="page-fade flex-1 flex flex-col items-center px-6 py-16">
      <Header />

      {!loaded ? (
        <p className="text-faint">opening the well…</p>
      ) : account ? (
        <Dashboard user={account.user} />
      ) : (
        <form
          onSubmit={pair}
          className="w-full max-w-md bg-card border border-line rounded-2xl px-8 py-8 shadow-soft flex flex-col gap-5"
        >
          <h2 className="font-medium text-lg">connect your reMarkable</h2>
          <ol className="flex flex-col gap-3 text-[15px] text-graphite list-decimal list-inside">
            <li>
              get a one-time code at{" "}
              <a
                href="https://my.remarkable.com/device/desktop/connect"
                target="_blank"
                rel="noreferrer"
                className="text-accent-deep underline underline-offset-2 decoration-accent/40"
              >
                my.remarkable.com
              </a>
            </li>
            <li>enter it below, codes expire after a few minutes</li>
          </ol>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={8}
            placeholder="abcd1234"
            autoFocus
            spellCheck={false}
            className="font-mono tracking-[0.35em] text-center text-lg bg-paper border border-line rounded-xl px-4 py-3 outline-none focus:border-accent transition-colors placeholder:text-faint"
          />
          {error && <p className="text-danger text-sm">{error}</p>}
          <button
            type="submit"
            disabled={pairing || code.trim().length !== 8}
            className="bg-ink text-paper rounded-full py-3 font-medium transition-opacity disabled:opacity-40"
          >
            {pairing ? "pairing…" : "pair"}
          </button>
          <p className="text-faint text-xs leading-relaxed">
            your code becomes a device token that never leaves this mac
          </p>
        </form>
      )}
    </main>
  );
}
