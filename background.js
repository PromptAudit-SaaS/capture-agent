/**
 * PromptAudit Capture Agent — Hintergrund-Dienst (Service Worker, Manifest V3)
 *
 * Zero-Knowledge-Prinzip:
 * - Prompts werden ausschliesslich lokal im Browser verschluesselt (AES-256-GCM).
 * - Der Schluessel wird per PBKDF2-SHA256 aus der Mandanten-Passphrase abgeleitet
 *   und niemals uebertragen oder dauerhaft gespeichert.
 * - Gespeichert werden nur Chiffrat, IV, Salt und SHA-256-Fingerabdruck.
 * - Jeder Eintrag wird in eine append-only Hashkette versiegelt (WORM-Prinzip):
 *   es gibt keinen Aenderungs- oder Loeschpfad.
 */

const PBKDF2_ITERATIONS = 210_000;
const CHAIN_KEY = "promptaudit.worm.chain.v1";
const GENESIS_HASH = "0".repeat(64);

const enc = new TextEncoder();

function toBase64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return toHex(new Uint8Array(digest));
}

async function deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, hash: "SHA-256", iterations: PBKDF2_ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Verschluesselt Klartext lokal; Rueckgabe enthaelt niemals Klartext. */
async function encryptPayload(plaintext, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return {
    ct: toBase64(new Uint8Array(buf)),
    iv: toBase64(iv),
    salt: toBase64(salt),
    digest: await sha256Hex(plaintext),
    bytes: enc.encode(plaintext).length,
  };
}

async function readChain() {
  const data = await chrome.storage.local.get(CHAIN_KEY);
  const chain = data[CHAIN_KEY];
  return Array.isArray(chain) ? chain : [];
}

async function sealHash(entry) {
  return sha256Hex(
    [
      entry.seq,
      entry.timestamp,
      entry.tool,
      entry.model,
      entry.prompt.digest,
      entry.prevHash,
    ].join("|"),
  );
}

/**
 * Versiegelt einen erfassten Prompt: verschluesseln, hashen, an die Kette
 * anhaengen. Die Kette ist append-only — es existiert bewusst kein
 * update/delete-Pfad.
 */
async function appendEntry(input, passphrase) {
  const chain = await readChain();
  const prev = chain[chain.length - 1];
  const prompt = await encryptPayload(input.prompt, passphrase);

  const draft = {
    id: crypto.randomUUID(),
    seq: (prev?.seq ?? 0) + 1,
    timestamp: new Date().toISOString(),
    tool: input.tool,
    model: input.model ?? "unbekannt",
    prompt,
    prevHash: prev?.entryHash ?? GENESIS_HASH,
  };
  const entry = { ...draft, entryHash: await sealHash(draft) };

  await chrome.storage.local.set({ [CHAIN_KEY]: [...chain, entry] });
  return entry;
}

/** Prueft die Integritaet der gesamten Kette (Tamper-Evidence). */
async function verifyChain() {
  const chain = await readChain();
  let prevHash = GENESIS_HASH;
  for (const entry of chain) {
    const expected = await sealHash({ ...entry, prevHash });
    if (entry.prevHash !== prevHash || expected !== entry.entryHash) {
      return { intact: false, brokenAt: entry.seq, entries: chain.length };
    }
    prevHash = entry.entryHash;
  }
  return { intact: true, brokenAt: null, entries: chain.length };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "PROMPTAUDIT_CAPTURE") {
      const { passphrase } = await chrome.storage.local.get("promptaudit.passphrase");
      if (!passphrase) {
        sendResponse({ ok: false, error: "no-passphrase" });
        return;
      }
      const entry = await appendEntry(message.payload, passphrase);
      sendResponse({ ok: true, seq: entry.seq, entryHash: entry.entryHash });
    } else if (message?.type === "PROMPTAUDIT_VERIFY") {
      sendResponse({ ok: true, result: await verifyChain() });
    } else if (message?.type === "PROMPTAUDIT_STATUS") {
      const chain = await readChain();
      sendResponse({ ok: true, entries: chain.length });
    }
  })();
  return true; // asynchrone Antwort
});
