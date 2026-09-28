# PromptAudit Capture Agent

Zero-Knowledge-Browser-Erweiterung (Manifest V3) zur manipulationssicheren
Protokollierung von KI-Prompts.

## Prinzip

- **Zero-Knowledge:** Prompts werden ausschliesslich lokal im Browser mit
  AES-256-GCM verschluesselt. Der Schluessel wird per PBKDF2-SHA256
  (210'000 Iterationen) aus der Mandanten-Passphrase abgeleitet und niemals
  uebertragen oder dauerhaft gespeichert.
- **WORM:** Jeder Eintrag wird mit einem SHA-256-Hash versiegelt, der den
  Hash des Vorgaengers enthaelt (append-only Hashkette). Es existiert kein
  Aenderungs- oder Loeschpfad.
- **Kein Netzwerkverkehr:** Die Erweiterung sendet keine Daten an externe
  Server. Gespeichert wird lokal via `chrome.storage.local`.

## Dateien

| Datei          | Zweck                                                          |
| -------------- | -------------------------------------------------------------- |
| `manifest.json`| Manifest V3: Berechtigungen, Content Scripts, Service Worker   |
| `background.js`| Kryptographie (AES-256-GCM, PBKDF2), Hashkette, Verifizierung  |
| `content.js`   | Erfassung der Prompts auf ChatGPT, Claude, Gemini, Copilot     |
| `popup.html`   | Oberflaeche: Passphrase setzen, Integritaet pruefen            |
| `popup.js`     | Logik der Oberflaeche                                          |

## Installation (Entwicklungsmodus)

1. Chrome oeffnen → `chrome://extensions`
2. «Entwicklermodus» aktivieren
3. «Entpackte Erweiterung laden» → diesen Ordner waehlen
4. Ueber das Erweiterungs-Symbol die Mandanten-Passphrase setzen

## Verifizierung

Die Integritaet der Hashkette laesst sich jederzeit ueber das Popup
(«Integritaet prüfen») oder programmgesteuert ueber die Nachricht
`PROMPTAUDIT_VERIFY` pruefen.
