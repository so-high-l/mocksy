import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { encryptSecurePayload } from "../../../../lib/api-keys";
import {
  ETSY_OAUTH_COOKIE,
  ETSY_OAUTH_SCOPES,
  etsyCookieOptions,
  getEtsyCredentials,
  getEtsyPublicOrigin,
  getEtsyRedirectConfiguration,
} from "../../../../lib/etsy";

export const runtime = "nodejs";

function base64Url(buffer) {
  return buffer.toString("base64url");
}

function settingsError(request, message) {
  const url = new URL("/settings", getEtsyPublicOrigin(request));
  url.searchParams.set("etsy_error", message);
  url.hash = "etsy";
  return NextResponse.redirect(url);
}

export async function GET(request) {
  const credentials = getEtsyCredentials();
  if (!credentials.configured) {
    return settingsError(
      request,
      "Add ETSY_API_KEY and ETSY_SHARED_SECRET before connecting Etsy.",
    );
  }

  const redirect = getEtsyRedirectConfiguration(request);
  if (!redirect.configured) {
    return settingsError(
      request,
      "Set ETSY_REDIRECT_URI to your public HTTPS Mocksy URL ending in /api/etsy/callback, then register that identical URL in your Etsy app.",
    );
  }
  if (!redirect.valid) return settingsError(request, redirect.error);

  const state = base64Url(randomBytes(32));
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const redirectUri = redirect.redirectUri;
  const authorizationUrl = new URL("https://www.etsy.com/oauth/connect");
  authorizationUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: credentials.keystring,
    redirect_uri: redirectUri,
    scope: ETSY_OAUTH_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const flow = await encryptSecurePayload({
    state,
    verifier,
    redirectUri,
    createdAt: Date.now(),
  });
  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(ETSY_OAUTH_COOKIE, flow, etsyCookieOptions(10 * 60));
  return response;
}
