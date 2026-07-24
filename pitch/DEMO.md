# inkwell — five minute demo script

Run before the demo: `npm run dev` in the project folder (the local model starts itself), tablet synced recently, one fresh article link ready in a note.

## 0:00 · Open on the dashboard

"This is inkwell, a companion app for the reMarkable I built. It's paired to my real account, everything you'll see is my real data."

Point at the year-of-ink heatmap: "Every square is a day, shaded by how many pages I actually inked. The tablet doesn't know this about itself. inkwell reads the per-page save timestamps out of the sync data."

Point at reading shelf and passages: "Live reading progress per book, and every highlight I've ever made, extracted from the binary format and resurfaced daily."

## 0:45 · Ink tab

"I wrote a parser for reMarkable's stroke format in Rust. Here's what it finds: I have laid down five point four kilometers of ink. Six hundred fifty thousand strokes. It knows my average pen pressure and that I'm a fineliner person. It processed my entire 774-document library in about twenty seconds."

## 1:30 · Time machine

"This is the feature I'm most excited about: git for handwriting."

Pick a notebook. "Every time a document changes, inkwell snapshots it. Here's the history, like a commit log: pages added, pages changed. Click any page and you see the ink exactly as it was in that snapshot. Erased work is never lost again. This doesn't exist for any e-ink device anywhere."

## 2:30 · Janitor

"Two years of use left me with hundreds of stale documents. The janitor found them, plus duplicates and orphaned files. One click removes them, and everything is archived to a local vault first, so nothing is ever unrecoverable." Sort by largest, show the textbooks.

## 3:00 · Superpowers

Paste the article link: "Any web article, stripped to clean text, typeset for e-ink, on the tablet in seconds."

Show the daily brief: "Every morning at seven, a one page brief lands on the tablet: my todos, top headlines from feeds I chose, weather, my own ink stats. It emails me when it's ready."

Show summarize and worksheet: "AI summaries of any document and generated practice worksheets. Here's the part I like: this runs on a fully local model on my laptop, zero cost, nothing leaves the machine. One toggle switches it to the Claude API with a live spend meter."

## 4:15 · The close

"Everything runs local-first: the device token, the data, the AI. The tablet stays exactly as calm as you designed it.

The honest caveat: this rides the community's unofficial sync client. It works, but you could break it tomorrow. That's why I'm here. The demand for this is in every community thread you have. I'd rather build it with you than around you."

## Backup plan

If wifi or sync misbehaves, everything except send-to-tablet works from local data. Record a screen capture of the full flow beforehand as the fallback.
