const DEFAULTS = {
  appUrl: "http://127.0.0.1:43123",
  token: "",
  filter: { bhk: [], minRent: null, maxRent: null },
};
const appUrl = document.getElementById("appUrl");
const token = document.getElementById("token");
const saved = document.getElementById("saved");

const bhkBoxes = [...document.querySelectorAll("#bhkRow input")];
const minRent = document.getElementById("minRent");
const maxRent = document.getElementById("maxRent");

chrome.storage.sync.get(DEFAULTS).then((values) => {
  appUrl.value = values.appUrl;
  token.value = values.token;
  const f = values.filter || DEFAULTS.filter;
  const wanted = (f.bhk || []).map(String);
  for (const box of bhkBoxes) box.checked = wanted.includes(box.value);
  minRent.value = f.minRent ?? "";
  maxRent.value = f.maxRent ?? "";
});

document.getElementById("save").addEventListener("click", async () => {
  const toNumber = (el) => {
    const n = Number(el.value.trim());
    return el.value.trim() && Number.isFinite(n) && n > 0 ? n : null;
  };

  await chrome.storage.sync.set({
    appUrl: appUrl.value.trim() || DEFAULTS.appUrl,
    token: token.value.trim(),
    filter: {
      bhk: bhkBoxes.filter((b) => b.checked).map((b) => Number(b.value)),
      minRent: toNumber(minRent),
      maxRent: toNumber(maxRent),
    },
  });
  saved.textContent = "Saved";
  setTimeout(() => (saved.textContent = ""), 2000);
});
