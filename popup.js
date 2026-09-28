const statusEl = document.getElementById("status");

document.getElementById("save").addEventListener("click", async () => {
  const pass = document.getElementById("pass").value.trim();
  if (pass.length < 8) {
    statusEl.textContent = "Mindestens 8 Zeichen erforderlich.";
    return;
  }
  await chrome.storage.local.set({ "promptaudit.passphrase": pass });
  statusEl.textContent = "Passphrase gesetzt. Erfassung aktiv.";
});

document.getElementById("verify").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "PROMPTAUDIT_VERIFY" }, (res) => {
    if (!res?.ok) return;
    const r = res.result;
    statusEl.textContent = r.intact
      ? `Kette intakt — ${r.entries} Einträge versiegelt.`
      : `Integritätsbruch bei Eintrag #${r.brokenAt}!`;
  });
});
