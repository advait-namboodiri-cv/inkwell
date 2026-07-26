const INKWELL = "http://localhost:3111";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "inkwell-send-link",
    title: "send link to reMarkable",
    contexts: ["link"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "inkwell-send-link" || !info.linkUrl) return;
  try {
    const res = await fetch(`${INKWELL}/api/inbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: info.linkUrl }),
    });
    badge(res.ok ? "✓" : "!");
  } catch {
    badge("!");
  }
});

function badge(text) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: text === "✓" ? "#3a5a6a" : "#a8552e" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
}
