# inkwell — narration scripts

Two videos, same app, same voice. **Script A** is the full tour (5 to 6 minutes). **Script B** is the short cut (2 to 3 minutes) for anyone who wants the gist.

**How to use these**: the bold lines in brackets are stage directions, do not read them. Everything else is what you say. Read at a relaxed pace, roughly 130 words a minute. Where a line says *(pause)*, actually stop talking for two or three seconds and let the screen breathe. You are not in a hurry. The app is calm; sound calm.

**Before recording**: make sure `npm run dev` is running, the tablet has synced recently, the ink scan has completed, and you have a page from today in the time machine. Have Paul Graham's essay link ready to paste. Close every other tab. Full screen the browser, hide bookmarks.

---

# SCRIPT A — the full tour (5 to 6 minutes)

## 1. Who and why *(about 40 seconds)*

**[Screen: your reMarkable's own file list, either the device on camera or the tablet's screen. Slow scroll through folders.]**

Hi, I'm Advait. I'm a computer science student, I'm a little obsessed with productivity, and this is my reMarkable. I have had it for two years. Two years of lecture notes, book highlights, half finished ideas, and a lot of math.

**[Keep scrolling slowly. Let it look like a lot.]**

I love this thing. It is the only device I own that does exactly one thing and refuses to distract me. That restraint is the whole product.

But here is what has always bugged me. My tablet holds two years of my handwriting, and it knows absolutely nothing about itself. It cannot tell me how much I write, or when. It cannot show me what a page looked like last month. It cannot find anything. And there is no easy way to get good stuff onto it.

*(pause)*

So I built the missing half. It is called inkwell.

## 2. Pairing and the dashboard *(about 60 seconds)*

**[Screen: cut to inkwell, the pairing screen if you have a spare code, otherwise the dashboard.]**

inkwell connects to your reMarkable the same way an official app does. You get a one time code from the reMarkable site, you type it in, and that is it.

And a detail I care about a lot: that code becomes a device token that never leaves my laptop. Everything you are about to see runs locally. No servers of mine, nobody else's cloud, no account to sign up for.

**[Screen: the dashboard, fully loaded. Sit here. Let the backdrop glyphs drift.]**

This is the dashboard. *(pause)*

Top of the page is a year of my handwriting. Every square is a day, and it gets darker the more pages I inked that day. You can see finals season. You can see the weeks I disappeared.

**Technically**, this comes from something reMarkable already stores and nobody surfaces: every page inside a notebook carries the timestamp of its last save. inkwell reads those out of the synced files and buckets them by day. A thousand and eighty six page saves across a hundred and ninety seven documents, and it took seconds to compute.

**[Scroll gently to the three cards.]**

Underneath: my whole library measured. Seven hundred forty three documents, ninety five folders, and how much of it is dead weight. My books in flight with live progress, because the tablet syncs which page I am on. And every highlight I have ever made, pulled out with the actual text, one resurfaced each day.

## 3. Ink stats *(about 50 seconds)*

**[Screen: click the ink stats button. Let it expand. Do not talk over the animation.]**

*(pause)*

And then there is this. **[The numbers.]**

I have laid down five point three nine kilometers of ink on this tablet. Six hundred fifty three thousand pen strokes. My average pen pressure is fifty one percent. And apparently I am a fineliner person, by a landslide.

*(pause, let them read the pens list)*

**Technically**, this is the part I am proudest of. When you write, the tablet's digitizer samples your pen many times a second and records position, pressure, speed, and tilt into a binary format. To read it, I wrote my own parser in Rust, compiled it to WebAssembly, and validated it stroke for stroke against the reference implementation.

The distance is real geometry: the gap between every pair of sample points, summed, converted at the screen's two hundred twenty six dpi. And it chews through my entire seven hundred document library in about twenty seconds.

**[Click "how this is measured" and let it open.]**

I put the explanation right in the app, because a number this weird deserves to show its work.

## 4. Time machine *(about 70 seconds)*

**[Screen: click the time machine tab.]**

This next one is my favorite. I call it git for handwriting.

**[Click a day chip with several pages, like a busy day.]**

I pick a day. Any day I wrote something. And inkwell shows me every notebook I touched that day, and exactly which pages.

**[Click a page chip. Wait for the ink to render. Sit with it.]**

*(pause)*

And there is the ink. That is my actual handwriting, rendered from the raw stroke data.

**Technically**, two things are happening. Every time a document changes, inkwell keeps a full snapshot of it forever, so you get a commit log: pages added, pages changed. And the pages you see are rendered from reMarkable's binary page files into vector images.

**[Hover or click the restore button, or click it if you want to show the result.]**

And this button rebuilds a past version and sends it back to my tablet as a PDF.

I will be honest about the limit, because it matters: reMarkable's sync only accepts PDFs and ebooks, so I cannot restore editable ink. Nobody outside reMarkable can. With official access, that becomes real.

## 5. Janitor *(about 40 seconds)*

**[Screen: janitor tab. Let the lists load.]**

Two years of use leaves a mess. The janitor finds three kinds: documents I have not touched in six months, duplicates, and orphans, which are files whose folder got deleted out from under them.

**[Sort by largest. Let the textbooks appear.]**

Sort by size and there they are, the forty megabyte textbooks I read once.

And the important part: before anything is removed, inkwell copies the whole document into a vault on my laptop. So the tablet gets clean, and nothing is ever actually lost. There are two modes, send it to the tablet's trash where you can still restore it, or delete it properly. Both archive first.

## 6. Superpowers *(about 80 seconds)*

**[Screen: superpowers tab.]**

Everything so far has been about reading my tablet. This tab is about putting things onto it.

**[Paste the Paul Graham link, hit send, wait for the confirmation.]**

Any article on the web. inkwell strips the ads and the navigation, typesets it properly for e ink, and it is on my tablet before I get up for coffee. There is also a browser extension, so it is one button from any page.

**[Scroll to the daily brief.]**

Every morning at seven, this lands in a folder on my tablet: my todos, top headlines from the feeds I picked, the weather, and my own ink stats from the day before. It emails me when it is ready. No AI in this one at all, just free sources and a PDF.

**[Scroll to summarize, show a summary that is already cached.]**

This summarizes any document with real text in it. This is my copy of Outliers.

**[Scroll to worksheet and sketch.]**

And this generates practice worksheets. I asked for eight integration by parts problems, and got a typeset problem set with room to work by hand. That took about twenty five seconds. And this turns a prompt into line art, which you preview first and only send if you like it.

**Technically**, here is the part I like: every one of these can run on a language model running locally on this laptop. Free, private, nothing leaves the machine. Or you flip a switch and it uses the Claude API for higher quality, with a spend meter tracking every cent. Each feature chooses independently.

## 7. Close *(about 30 seconds)*

**[Screen: back to the dashboard. Let it sit.]**

So that is inkwell. *(pause)*

It reads what your tablet already knows and hands it back to you. It keeps your library clean. And it gets good things onto the page without breaking the calm that made you buy a reMarkable in the first place.

One honest note. This talks to the reMarkable cloud through the community's unofficial client. It works, but you could change something tomorrow and it would break. That is exactly why I am sending this to you instead of just keeping it.

The demand for this is in your community threads every week. I would rather build it with you than around you.

**[Beat.]**

I'm Advait. Thanks for watching.

---

# SCRIPT B — the short cut (2 to 3 minutes)

Use this as a separate upload, or as the first thing people see with a line like "if you want the two minute version, here it is."

## 1. Hook *(about 25 seconds)*

**[Screen: reMarkable file list, brief scroll. Then cut to inkwell dashboard.]**

Hi, I'm Advait. I have had a reMarkable for two years and I love it. Two years of notes, highlights, and math.

But my tablet knows nothing about itself. So I built the missing half. It is called inkwell, it runs entirely on my own laptop, and here is the two minute version.

## 2. It measures your handwriting *(about 40 seconds)*

**[Screen: dashboard, heatmap visible. Pause on it.]**

Every square is a day of handwriting. *(pause)* Books I am reading, with live progress. Every highlight I have ever made.

**[Click ink stats, let it expand.]**

And this. Five point three nine kilometers of ink. Six hundred fifty three thousand pen strokes. My average pen pressure.

To get that, I wrote my own parser in Rust for reMarkable's binary stroke format. It reads the pen data the tablet records while you write, and it processes my whole library in about twenty seconds.

## 3. It remembers *(about 35 seconds)*

**[Screen: time machine, click a day, click a page, let it render.]**

This is git for handwriting. Pick any day, see every notebook you touched, and see the ink as it was.

*(pause)*

inkwell snapshots every document whenever it changes, so your writing gets a history. And you can send an old version back to the tablet.

## 4. It cleans and it delivers *(about 40 seconds)*

**[Screen: janitor briefly, then superpowers.]**

The janitor finds stale documents, duplicates and orphans, and archives every one to a local vault before removing it, so nothing is ever lost.

**[Superpowers: gesture at article, brief, worksheet.]**

And this side puts things on the tablet. Any web article, typeset for e ink. A daily brief every morning with my todos, news and weather. AI summaries and generated worksheets, running on a local model for free, or the Claude API if I want more quality.

## 5. Close *(about 20 seconds)*

**[Screen: dashboard.]**

That is inkwell. It reads what your tablet already knows, keeps it clean, and puts good things on the page.

It runs on the community's unofficial sync client today, which is exactly why I would love to build it with you instead of around you.

**[Beat.]**

I'm Advait. Thanks for watching.

---

## Recording tips

- Record the screen first with no talking, moving slowly and deliberately, then record narration over it. Trying to do both at once is where people rush.
- Leave two full seconds on every screen before you start the sentence about it.
- If you fumble a line, stop, breathe, and say the whole sentence again. Cut the bad take later.
- Screen recording on a Mac: Shift Command 5, record the browser window, not the whole screen.
- Keep the browser at a normal window size, not tiny. The cards look best around 1400 pixels wide.
- Do not narrate the animations. Let the ink stats expand in silence, it lands better.
