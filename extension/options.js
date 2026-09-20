const DEFAULTS = { appUrl: "http://127.0.0.1:43123", token: "" };
const appUrl = document.getElementById("appUrl");
const token = document.getElementById("token");
const saved = document.getElementById("saved");

chrome.storage.sync.get(DEFAULTS).then((values) => {
  appUrl.value = values.appUrl;
  token.value = values.token;
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.sync.set({
    appUrl: appUrl.value.trim() || DEFAULTS.appUrl,
    token: token.value.trim(),
  });
  saved.textContent = "Saved";
  setTimeout(() => (saved.textContent = ""), 2000);
});
