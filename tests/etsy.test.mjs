import assert from "node:assert/strict";
import test from "node:test";
import { encryptSecurePayload } from "../lib/api-keys.js";
import {
  ETSY_SESSION_COOKIE,
  exchangeEtsyToken,
  getEtsyPublicOrigin,
  getEtsyRedirectConfiguration,
  missingEtsyScopes,
  readEtsySession,
  requestEtsy,
} from "../lib/etsy.js";
import { etsyDraftParameters, normalizeEtsyListing } from "../lib/etsy-listing.js";
import { getPublicOrigin } from "../lib/public-url.js";
import nextConfig from "../next.config.mjs";

const ORIGINAL_ENV = {
  ETSY_API_KEY: process.env.ETSY_API_KEY,
  ETSY_SHARED_SECRET: process.env.ETSY_SHARED_SECRET,
  ETSY_REDIRECT_URI: process.env.ETSY_REDIRECT_URI,
  SESSION_SECRET: process.env.SESSION_SECRET,
};
const ORIGINAL_FETCH = globalThis.fetch;

function restoreEnvironment() {
  for (const [name, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  globalThis.fetch = ORIGINAL_FETCH;
}

function request(origin = "http://0.0.0.0:3000", headers = {}) {
  return {
    nextUrl: { origin },
    url: `${origin}/api/etsy/status`,
    headers: { get: (name) => headers[name.toLowerCase()] || "" },
  };
}

test.afterEach(restoreEnvironment);
test.after(restoreEnvironment);

test("Etsy callback configuration requires the exact HTTPS callback path", { concurrency: false }, () => {
  process.env.ETSY_REDIRECT_URI = "https://mocksy.example.com/api/etsy/callback";
  assert.deepEqual(getEtsyRedirectConfiguration(request()), {
    redirectUri: "https://mocksy.example.com/api/etsy/callback",
    configured: true,
    valid: true,
    isHttps: true,
    error: "",
  });

  process.env.ETSY_REDIRECT_URI = "https://mocksy.example.com/api/etsy/callback/";
  assert.match(getEtsyRedirectConfiguration(request()).error, /end exactly/);

  process.env.ETSY_REDIRECT_URI = "https://mocksy.example.com/api/etsy/callback?bad=1";
  assert.match(getEtsyRedirectConfiguration(request()).error, /query string/);
});

test("public redirects use the configured app origin and ignore request host headers", { concurrency: false }, () => {
  process.env.ETSY_REDIRECT_URI = "https://mocksy.example.com/api/etsy/callback";
  assert.equal(getEtsyPublicOrigin(request()), "https://mocksy.example.com");
  delete process.env.ETSY_REDIRECT_URI;
  assert.equal(
    getPublicOrigin(request("http://0.0.0.0:3000", {
      "x-forwarded-host": "proxy.example.com",
      "x-forwarded-proto": "https",
    })),
    "http://localhost:3000",
  );
});

test("OAuth token exchange rejects incomplete responses", { concurrency: false }, async () => {
  process.env.ETSY_API_KEY = "key";
  process.env.ETSY_SHARED_SECRET = "secret";
  globalThis.fetch = async () => new Response(JSON.stringify({ token_type: "Bearer" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  await assert.rejects(
    exchangeEtsyToken({ grant_type: "authorization_code", code: "code" }),
    /incomplete OAuth token response/,
  );
});

test("authenticated Etsy requests include both required authentication headers", { concurrency: false }, async () => {
  process.env.ETSY_API_KEY = "key";
  process.env.ETSY_SHARED_SECRET = "secret";
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ shop_id: 42 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await requestEtsy("/application/users/123/shops", { accessToken: "123.access-token" });
  assert.equal(captured.options.headers["x-api-key"], "key:secret");
  assert.equal(captured.options.headers.Authorization, "Bearer 123.access-token");
});

test("expired Etsy sessions refresh and preserve required shop data", { concurrency: false }, async () => {
  process.env.ETSY_API_KEY = "key";
  process.env.ETSY_SHARED_SECRET = "secret";
  process.env.SESSION_SECRET = "a-test-session-secret-that-is-long-enough";
  const encrypted = await encryptSecurePayload({
    accessToken: "123.expired",
    refreshToken: "old-refresh",
    expiresAt: Date.now() - 1,
    scope: "listings_r listings_w shops_r",
    userId: 123,
    shopId: 456,
    shopName: "Test shop",
  });
  globalThis.fetch = async () => new Response(JSON.stringify({
    access_token: "123.fresh",
    refresh_token: "new-refresh",
    expires_in: 3600,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  const result = await readEtsySession({
    cookies: { get: (name) => name === ETSY_SESSION_COOKIE ? { value: encrypted } : undefined },
  });
  assert.equal(result.session.accessToken, "123.fresh");
  assert.equal(result.session.refreshToken, "new-refresh");
  assert.equal(result.session.shopId, 456);
  assert.ok(result.cookieValue);
});

test("listing normalization matches Etsy title, tag, and draft requirements", { concurrency: false }, () => {
  const listing = normalizeEtsyListing({
    title: "Printable wall art",
    description: "A reviewed digital print.",
    price: "6.99",
    taxonomyId: 123,
    tags: ["wall art", "printable"],
  });
  const parameters = etsyDraftParameters(listing);
  assert.equal(parameters.get("type"), "download");
  assert.equal(parameters.get("when_made"), "2020_2026");
  assert.equal(parameters.get("tags"), "wall art,printable");

  assert.throws(
    () => normalizeEtsyListing({ ...listing, title: "Art 😀" }),
    /unsupported character/,
  );
  assert.throws(
    () => normalizeEtsyListing({ ...listing, title: "Art & print & poster" }),
    /only once/,
  );
  assert.deepEqual(missingEtsyScopes("listings_r shops_r"), ["listings_w"]);
});

test("Next middleware accepts the full supported Etsy multipart upload", () => {
  assert.equal(nextConfig.experimental?.middlewareClientMaxBodySize, "220mb");
});
