# inkwell

**The quiet companion for your reMarkable.**

Built by Advait Namboodiri. A working product, not a concept: everything in this document runs today against a real reMarkable account.

---

## The gap

reMarkable sells focus. No apps, no notifications, no browser. That restraint is the product, and it works.

But the cost of that calm is that the tablet knows nothing about itself. After two years of daily use, a reMarkable holds hundreds of documents and kilometers of handwriting, and the owner can answer none of these questions: How much do I actually write? When? With what pen? What did this page look like a month ago? Which of my 800 documents are dead weight? And there is no easy way to get smart content onto the device each morning.

The official apps are file viewers. The third party scene is command line tools for hackers. Nobody has built the intelligence layer.

inkwell is that layer. The tablet stays exactly as calm as reMarkable designed it to be. The intelligence lives in the companion.

## What inkwell does today

**Insight.** A year-of-ink heatmap built from per-page save timestamps. A reading shelf with live progress for every book. A library census. Every text highlight extracted and resurfaced daily, Readwise style, with no third party service.

**Ink analytics.** inkwell parses reMarkable's binary stroke format directly. One real account, measured: 5.39 kilometers of ink, 653,542 pen strokes across 596 documents, average pen pressure 51 percent, fineliner used for 99 percent of strokes. No product anywhere shows a reMarkable owner this.

**Time machine. Git for handwriting.** Every time a document changes, inkwell snapshots it. Pick a notebook and scrub its history like a commit log: pages added, pages changed, and a rendered image of any page exactly as it looked in any snapshot. Erased ink stops being lost forever. Nothing like this exists for any e-ink device.

**Order.** A janitor that finds stale documents, duplicates and orphans, with one-click cleanup. Every removal is archived to a local vault first, so nothing is ever unrecoverable.

**Superpowers.** Send any web article to the tablet as a calmly typeset PDF. A daily brief PDF every morning at 7am: todos, top headlines from chosen feeds, weather, the owner's own ink stats, delivered to a Daily briefing folder with an email notification. AI document summaries, generated worksheets, and prompt-to-line-art sketches, all runnable on a fully local model at zero cost, or on the Claude API with a live spend meter.

## How it is built

- **Local first.** Everything runs on the owner's machine. The device token, the library mirror, the AI, the vault: nothing leaves the laptop. Pairing uses reMarkable's own one-time code flow.
- **A custom parser for the .rm v6 format, written in Rust, compiled to WebAssembly.** Validated stroke-for-stroke against the reference implementation. It reads text highlights (with exact text and positions) and full stroke data (coordinates, pressure, speed, tool) and processes an entire 774-document library in about twenty seconds.
- **TypeScript and Next.js** for the product surface, **SQLite** for the local mirror, **MLX** for on-device AI on Apple Silicon with a one-click switch to the Claude API.
- Design language mirrors the device: paper white, warm ink, one restrained accent. Calm above all.

## The honest part

inkwell talks to the reMarkable cloud through the same sync protocol the official apps use, via the community's unofficial client. It works, and the community has maintained that path for years, but it is not blessed, and a protocol change could break every companion tool overnight.

That is exactly why this is worth a conversation. The demand for these features is visible in every reMarkable community thread. The choice is between that demand being met by fragile unofficial tools, or by something reMarkable sanctions and shapes.

## What this could be for reMarkable

- **A retention engine.** Streaks, yearly recaps, a growing personal archive: the more someone writes, the more inkwell gives back, and the harder it is to leave the ecosystem.
- **A Connect differentiator.** Insight, time machine and daily brief are natural premium features that make the subscription concrete.
- **Zero risk to the core.** The tablet itself stays untouched and distraction free. All intelligence lives off-device, which is the same philosophy that built the product.

## The ask

Thirty minutes with the product team. A live demo takes five. If the direction resonates, inkwell is a working head start on an official companion: the data layer, the parser, the design language and a v2 architecture (hosted accounts, official API) are already mapped.

Advait Namboodiri · advaitsdesk@gmail.com
