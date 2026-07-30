export const SESSION_COOKIE = "mocksy_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

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

export function getAppPassword() {
  if (process.env.APP_PASSWORD) return process.env.APP_PASSWORD;
  return process.env.NODE_ENV === "production" ? "" : "mocksy";
}

export function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  return process.env.NODE_ENV === "production" ? "" : "mocksy-local-session-secret-change-before-deploying";
}

export function isAuthConfigured() {
  return Boolean(getAppPassword() && getSessionSecret());
}

async function hmac(value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function createSessionToken() {
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
    version: 1,
  })));
  const signature = toBase64Url(await hmac(payload));
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token) {
  if (!token || !isAuthConfigured()) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  try {
    const expected = await hmac(payload);
    const received = fromBase64Url(signature);
    if (expected.length !== received.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ received[index];
    if (difference !== 0) return false;

    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return data.version === 1 && Number(data.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}
