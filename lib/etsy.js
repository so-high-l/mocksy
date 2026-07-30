import { decryptSecurePayload, encryptSecurePayload } from "./api-keys";

export const ETSY_SESSION_COOKIE = "mocksy_etsy_session";
export const ETSY_OAUTH_COOKIE = "mocksy_etsy_oauth";
export const ETSY_OAUTH_SCOPES = "listings_r listings_w shops_r";

const ETSY_API_ROOT = "https://openapi.etsy.com/v3";
const REFRESH_EARLY_MS = 2 * 60 * 1000;
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 90;

export class EtsyApiError extends Error {
  constructor(message, status = 502, payload = null) {
    super(message);
    this.name = "EtsyApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function getEtsyCredentials() {
  const keystring = String(process.env.ETSY_API_KEY || "").trim();
  const sharedSecret = String(process.env.ETSY_SHARED_SECRET || "").trim();
  return {
    configured: Boolean(keystring && sharedSecret),
    keystring,
    sharedSecret,
    header: keystring && sharedSecret ? `${keystring}:${sharedSecret}` : "",
  };
}

export function etsyCookieOptions(maxAge = SESSION_DURATION_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function getEtsyRedirectUri(request) {
  return getEtsyRedirectConfiguration(request).redirectUri;
}

export function getEtsyRedirectConfiguration(request) {
  const configuredValue = String(process.env.ETSY_REDIRECT_URI || "").trim();
  const suggestedValue = new URL("/api/etsy/callback", request.nextUrl.origin).toString();
  const redirectUri = configuredValue || suggestedValue;
  let error = "";
  let isHttps = false;

  try {
    const parsed = new URL(redirectUri);
    isHttps = parsed.protocol === "https:";
    if (!["http:", "https:"].includes(parsed.protocol)) {
      error = "ETSY_REDIRECT_URI must be an HTTP or HTTPS URL.";
    } else if (!isHttps) {
      error = "ETSY_REDIRECT_URI must use HTTPS. Open Mocksy through a public HTTPS URL or development tunnel.";
    } else if (parsed.username || parsed.password || parsed.hash) {
      error = "ETSY_REDIRECT_URI cannot contain credentials or a URL fragment.";
    }
  } catch {
    error = "ETSY_REDIRECT_URI is not a valid URL.";
  }

  return {
    redirectUri,
    configured: Boolean(configuredValue),
    valid: !error,
    isHttps,
    error,
  };
}

async function responsePayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function errorMessage(payload, fallback) {
  return payload?.error_description
    || payload?.error
    || payload?.message
    || fallback;
}

export async function requestEtsy(path, { accessToken = "", method = "GET", body = null, headers = {} } = {}) {
  const credentials = getEtsyCredentials();
  if (!credentials.configured) {
    throw new EtsyApiError("Add ETSY_API_KEY and ETSY_SHARED_SECRET before connecting Etsy.", 503);
  }

  const response = await fetch(`${ETSY_API_ROOT}${path}`, {
    method,
    headers: {
      "x-api-key": credentials.header,
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body,
    cache: "no-store",
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    throw new EtsyApiError(
      errorMessage(payload, `Etsy returned ${response.status}.`),
      response.status,
      payload,
    );
  }
  return payload;
}

export async function exchangeEtsyToken(parameters) {
  const credentials = getEtsyCredentials();
  if (!credentials.configured) {
    throw new EtsyApiError("Add ETSY_API_KEY and ETSY_SHARED_SECRET before connecting Etsy.", 503);
  }
  const response = await fetch(`${ETSY_API_ROOT}/public/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ client_id: credentials.keystring, ...parameters }),
    cache: "no-store",
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    throw new EtsyApiError(
      errorMessage(payload, "Etsy could not complete authorization."),
      response.status,
      payload,
    );
  }
  return payload;
}

export async function readEtsySession(request, { refresh = true } = {}) {
  const encrypted = request.cookies.get(ETSY_SESSION_COOKIE)?.value;
  const stored = await decryptSecurePayload(encrypted);
  if (!stored?.accessToken || !stored?.shopId) return { session: null, cookieValue: "" };
  if (!refresh || Number(stored.expiresAt) > Date.now() + REFRESH_EARLY_MS) {
    return { session: stored, cookieValue: "" };
  }
  if (!stored.refreshToken) throw new EtsyApiError("Reconnect Etsy to refresh shop access.", 401);

  const refreshed = await exchangeEtsyToken({
    grant_type: "refresh_token",
    refresh_token: stored.refreshToken,
  });
  const session = {
    ...stored,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || stored.refreshToken,
    expiresAt: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
    scope: refreshed.scope || stored.scope || ETSY_OAUTH_SCOPES,
  };
  return { session, cookieValue: await encryptSecurePayload(session) };
}

export function applyRefreshedEtsyCookie(response, cookieValue) {
  if (cookieValue) response.cookies.set(ETSY_SESSION_COOKIE, cookieValue, etsyCookieOptions());
  return response;
}

export function etsyDraftManageUrl() {
  return "https://www.etsy.com/your/shops/me/tools/listings?status=draft";
}

function flattenTaxonomy(nodes, parents = [], output = []) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const path = [...parents, node.name].filter(Boolean);
    output.push({ id: Number(node.id), name: String(node.name || ""), path: path.join(" › ") });
    flattenTaxonomy(node.children, path, output);
  }
  return output;
}

function taxonomyScore(node) {
  const name = node.name.toLowerCase();
  const path = node.path.toLowerCase();
  let score = 0;
  if (name === "digital prints") score += 300;
  if (name.includes("digital") && name.includes("print")) score += 180;
  if (name === "prints") score += 120;
  if (name.includes("print")) score += 70;
  if (path.includes("art & collectibles")) score += 80;
  if (path.includes("wall decor")) score += 45;
  if (path.includes("digital")) score += 35;
  if (path.includes("art")) score += 20;
  return score;
}

let taxonomyCache = null;

export async function getRelevantEtsyTaxonomy() {
  if (taxonomyCache?.expiresAt > Date.now()) return taxonomyCache.items;
  const payload = await requestEtsy("/application/seller-taxonomy/nodes");
  const items = flattenTaxonomy(payload.results)
    .map((node) => ({ ...node, score: taxonomyScore(node) }))
    .filter((node) => node.id > 0 && node.score >= 90)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, 80)
    .map(({ score, ...node }) => node);
  taxonomyCache = { items, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return items;
}
