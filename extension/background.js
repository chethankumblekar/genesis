const DEFAULTS = { appUrl: "http://127.0.0.1:43123", token: "" };

async function settings() {
  return { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
}

/**
 * The POST happens here rather than in the content script so the request
 * carries the extension's own origin instead of nobroker.in / facebook.com.
 */
async function ingest({ source, items }) {
  const { appUrl, token } = await settings();

  if (!token) {
    return { ok: false, error: "Set your token in the extension options" };
  }

  let response;
  try {
    response = await fetch(`${appUrl.replace(/\/+$/, "")}/api/scrape/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ source, items }),
    });
  } catch {
    return { ok: false, error: `Can't reach ${appUrl}` };
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    // fall through to the status-based message below
  }

  if (!response.ok) {
    if (response.status === 401) {
      return { ok: false, error: "Token rejected — check extension options" };
    }
    return { ok: false, error: body.error || `App returned ${response.status}` };
  }

  return { ok: true, counts: body.counts };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "hh-ingest") return false;
  ingest(message).then(sendResponse);
  return true; // keep the channel open for the async reply
});
