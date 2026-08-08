const INKWELL = "http://localhost:3111";

const titleEl = document.getElementById("title");
const sendEl = document.getElementById("send");
const statusEl = document.getElementById("status");

let pageUrl = null;

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs && tabs[0];
  if (!tab || !tab.url || !/^https?:/.test(tab.url)) {
    titleEl.textContent = "this page can't be sent";
    sendEl.disabled = true;
    return;
  }
  pageUrl = tab.url;
  titleEl.textContent = tab.title || tab.url;
});

sendEl.addEventListener("click", async () => {
  if (!pageUrl) return;
  sendEl.disabled = true;
  statusEl.className = "";
  statusEl.textContent = "typesetting…";
  try {
    const res = await fetch(`${INKWELL}/api/inbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-inkwell-extension": "1" },
      body: JSON.stringify({ url: pageUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "something went wrong");
    statusEl.className = "ok";
    statusEl.textContent = `sent · ~${data.words} words, on your tablet after next sync`;
  } catch (err) {
    statusEl.className = "err";
    statusEl.textContent = /Failed to fetch|Load failed/i.test(String(err && err.message))
      ? "inkwell isn't running on your mac. start it, then try again"
      : String((err && err.message) || "something went wrong");
    sendEl.disabled = false;
  }
});
