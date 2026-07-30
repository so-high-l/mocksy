export const API_KEYS_COOKIE = "mocksy_api_keys";
const API_KEYS_DURATION_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

function getEncryptionSecret() {
  return process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "mocksy-local-session-secret-change-before-deploying");
}

function toBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(getEncryptionSecret()));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecurePayload(payload) {
  if (!getEncryptionSecret()) throw new Error("SESSION_SECRET is required before API keys can be saved.");
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    await encryptionKey(),
    encoder.encode(JSON.stringify(payload)),
  ));
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return toBase64Url(combined);
}

export async function decryptSecurePayload(value) {
  if (!value || !getEncryptionSecret()) return {};
  try {
    const combined = fromBase64Url(value);
    const nonce = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      await encryptionKey(),
      encrypted,
    );
    const parsed = JSON.parse(new TextDecoder().decode(decrypted));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export const encryptApiKeys = encryptSecurePayload;
export const decryptApiKeys = decryptSecurePayload;

export async function getStoredApiKeys(request) {
  return decryptApiKeys(request.cookies.get(API_KEYS_COOKIE)?.value);
}

export async function getGeminiApiKey(request) {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const keys = await getStoredApiKeys(request);
  return typeof keys.gemini === "string" ? keys.gemini : "";
}

export async function getBflApiKey(request) {
  if (process.env.BFL_API_KEY) return process.env.BFL_API_KEY;
  const keys = await getStoredApiKeys(request);
  return typeof keys.bfl === "string" ? keys.bfl : "";
}

export async function getOpenAIApiKey(request) {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const keys = await getStoredApiKeys(request);
  return typeof keys.openai === "string" ? keys.openai : "";
}

export async function getApiKeyForProvider(request, provider) {
  if (provider === "bfl") return getBflApiKey(request);
  return getGeminiApiKey(request);
}

export function apiKeysCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: API_KEYS_DURATION_SECONDS,
  };
}

export function maskKey(value) {
  if (!value) return "";
  if (value.length < 10) return "••••••••";
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}
