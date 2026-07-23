"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";

type Todo = { id: number; text: string; done: number; created_at: number };

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/todos");
      if (res.ok) setTodos((await res.json()).todos);
    })();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      setTodos((await res.json()).todos);
      setText("");
    }
  }

  async function toggle(t: Todo) {
    const res = await fetch("/api/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, done: !t.done }),
    });
    if (res.ok) setTodos((await res.json()).todos);
  }

  async function remove(t: Todo) {
    const res = await fetch(`/api/todos?id=${t.id}`, { method: "DELETE" });
    if (res.ok) setTodos((await res.json()).todos);
  }

  return (
    <main className="page-fade flex-1 flex flex-col items-center px-6 py-16">
      <Header />
      <section className="w-full max-w-lg flex flex-col gap-6">
        <form
          onSubmit={add}
          className="bg-card border border-line rounded-2xl px-6 py-5 shadow-soft flex flex-col gap-3"
        >
          <h2 className="text-sm text-graphite">
            todos · open ones print on your daily brief
          </h2>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="add a todo…"
              className="flex-1 min-w-0 bg-paper border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors placeholder:text-faint"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="bg-ink text-paper text-sm rounded-full px-5 disabled:opacity-40 shrink-0"
            >
              add
            </button>
          </div>
          {todos === null ? (
            <p className="text-faint text-sm">loading…</p>
          ) : todos.length === 0 ? (
            <p className="text-faint text-sm">nothing yet, a clean slate</p>
          ) : (
            <ul className="flex flex-col">
              {todos.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 py-2.5 border-b border-line last:border-0 group"
                >
                  <input
                    type="checkbox"
                    checked={!!t.done}
                    onChange={() => toggle(t)}
                    className="accent-[var(--accent)] w-4 h-4 shrink-0"
                  />
                  <span
                    className={`flex-1 text-[15px] ${
                      t.done ? "line-through text-faint" : ""
                    }`}
                  >
                    {t.text}
                  </span>
                  <button
                    onClick={() => remove(t)}
                    className="text-faint hover:text-danger text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`delete ${t.text}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      </section>
    </main>
  );
}
