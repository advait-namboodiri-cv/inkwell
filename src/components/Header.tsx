"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

const TABS = [
  { href: "/", label: "dashboard" },
  { href: "/janitor", label: "janitor" },
];

export default function Header() {
  const pathname = usePathname();
  return (
    <div className="flex flex-col items-center">
      <header className="flex items-center gap-2.5 mb-2 text-ink">
        <Logo size={30} />
        <h1 className="text-3xl font-semibold tracking-tight">inkwell</h1>
      </header>
      <p className="text-graphite mb-6">the quiet companion for your reMarkable</p>
      <nav className="flex gap-1.5 mb-10 bg-accent-mist rounded-full p-1">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              pathname === t.href
                ? "bg-card text-ink shadow-soft"
                : "text-graphite hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
