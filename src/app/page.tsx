"use client";

import { useCallback, useEffect, useState } from "react";

type Account = { user: string; syncVersion: string };
type TreeEntry = { type: "d" | "f"; path: string };
type Tree = { docs: number; folders: number; topLevel: TreeEntry[] };

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [code, setCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<Tree | null>(null);

  const loadTree = useCallback(async () => {
    const res = await fetch("/api/tree");
    if (res.ok) setTree(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => {
        if (s.paired) {
          setAccount(s.account);
          loadTree();
        }
      })
      .finally(() => setLoaded(true));
  }, [loadTree]);

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
      loadTree();
    } else {
      setError(data.error ?? "something went wrong");
    }
  }

  return (
    <main className="page-fade flex-1 flex flex-col items-center px-6 py-16">
      <header className="flex items-baseline gap-2 mb-2">
        <span aria-hidden className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
        <h1 className="text-3xl font-semibold tracking-tight">inkwell</h1>
      </header>
      <p className="text-graphite mb-12">the quiet companion for your reMarkable</p>

      {!loaded ? (
        <p className="text-faint">opening the well…</p>
      ) : account ? (
        <section className="w-full max-w-lg flex flex-col gap-6">
          <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft">
            <div className="flex items-center gap-2 text-sm text-accent-deep">
              <span aria-hidden className="w-2 h-2 rounded-full bg-accent inline-block" />
              connected
            </div>
            <p className="mt-1 text-graphite text-sm">{account.user}</p>
          </div>

          {tree ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft text-center">
                  <div className="text-3xl font-semibold">{tree.docs}</div>
                  <div className="text-sm text-graphite mt-1">documents</div>
                </div>
                <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft text-center">
                  <div className="text-3xl font-semibold">{tree.folders}</div>
                  <div className="text-sm text-graphite mt-1">folders</div>
                </div>
              </div>
              <div className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft">
                <h2 className="text-sm text-graphite mb-3">your library</h2>
                <ul className="flex flex-col gap-1.5">
                  {tree.topLevel.map((e) => (
                    <li key={e.path} className="flex items-center gap-2.5 text-[15px]">
                      <span aria-hidden className="text-faint w-4 text-center">
                        {e.type === "d" ? "▸" : "·"}
                      </span>
                      <span className="truncate">{e.path.slice(1)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-faint text-center">reading your library…</p>
          )}
        </section>
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
            <li>enter it below — codes expire after a few minutes</li>
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
            your code is exchanged for a device token that never leaves this
            mac. inkwell only ever reads your library unless you ask it to
            change something.
          </p>
        </form>
      )}
    </main>
  );
}
