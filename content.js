/**
 * PromptAudit Capture Agent — Content Script
 *
 * Beobachtet die Eingabefelder unterstuetzter KI-Werkzeuge und meldet
 * abgesendete Prompts an den Hintergrund-Dienst. Die Verschluesselung
 * erfolgt dort lokal; dieses Script sendet den Prompt ausschliesslich
 * an die eigene Erweiterung (chrome.runtime), niemals an ein Netzwerk.
 */

(function () {
  "use strict";

  const TOOL_BY_HOST = {
    "chatgpt.com": "ChatGPT",
    "chat.openai.com": "ChatGPT",
    "claude.ai": "Claude",
    "gemini.google.com": "Gemini",
    "copilot.microsoft.com": "Copilot",
  };

  const tool = TOOL_BY_HOST[location.hostname] ?? "Unbekannt";

  /** Bekannte Eingabefelder der unterstuetzten Werkzeuge. */
  const INPUT_SELECTORS = [
    "#prompt-textarea", // ChatGPT
    "div[contenteditable='true'][data-testid*='composer']",
    "textarea[placeholder]", // generisch
    "div[contenteditable='true']", // Claude / Gemini / Copilot
  ];

  function findInput() {
    for (const sel of INPUT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function readPrompt(el) {
    if (!el) return "";
    const text = "value" in el ? el.value : el.innerText;
    return (text ?? "").trim();
  }

  function capture(promptText) {
    if (!promptText || promptText.length < 2) return;
    chrome.runtime.sendMessage(
      {
        type: "PROMPTAUDIT_CAPTURE",
        payload: { tool, model: "auto", prompt: promptText },
      },
      (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.ok) {
          console.debug(
            `[PromptAudit] Eintrag #${response.seq} versiegelt (${response.entryHash.slice(0, 12)}…)`,
          );
        }
      },
    );
  }

  // Absenden per Enter (ohne Shift) im Eingabefeld abfangen.
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      const el = findInput();
      if (el && el.contains(event.target)) capture(readPrompt(el));
    },
    true,
  );

  // Absenden per Klick auf den Senden-Button abfangen.
  document.addEventListener(
    "click",
    (event) => {
      const btn = event.target.closest(
        "button[data-testid*='send'], button[aria-label*='Send'], button[aria-label*='senden' i]",
      );
      if (btn) capture(readPrompt(findInput()));
    },
    true,
  );

  console.debug(`[PromptAudit] Capture Agent aktiv auf ${tool}.`);
})();
