import { NextResponse } from "next/server";
import { decryptSecurePayload, encryptSecurePayload } from "../../../../lib/api-keys";
import {
  ETSY_OAUTH_COOKIE,
  ETSY_OAUTH_SCOPES,
  ETSY_SESSION_COOKIE,
  EtsyApiError,
  etsyCookieOptions,
  exchangeEtsyToken,
  getEtsyPublicOrigin,
  missingEtsyScopes,
  requestEtsy,
} from "../../../../lib/etsy";

export const runtime = "nodejs";

function settingsRedirect(request, parameter, value) {
  const url = new URL("/settings", getEtsyPublicOrigin(request));
  url.searchParams.set(parameter, value);
  url.hash = "etsy";
  return url;
}

function failedCallback(request, message) {
  const response = NextResponse.redirect(settingsRedirect(request, "etsy_error", message));
  response.cookies.set(ETSY_OAUTH_COOKIE, "", { ...etsyCookieOptions(0), maxAge: 0 });
  return response;
}

export async function GET(request) {
  const authorizationError = request.nextUrl.searchParams.get("error");
  if (authorizationError) {
    return failedCallback(request, "Etsy authorization was cancelled or declined.");
  }

  try {
    const flow = await decryptSecurePayload(request.cookies.get(ETSY_OAUTH_COOKIE)?.value);
    const state = request.nextUrl.searchParams.get("state") || "";
    const code = request.nextUrl.searchParams.get("code") || "";
    if (!flow?.state || !flow?.verifier || !flow?.redirectUri || !flow?.createdAt) {
      return failedCallback(request, "The Etsy connection request expired. Start it again from Settings.");
    }
    if (Date.now() - Number(flow.createdAt) > 10 * 60 * 1000 || state !== flow.state) {
      return failedCallback(request, "The Etsy connection could not be verified. Start it again from Settings.");
    }
    if (!code) return failedCallback(request, "Etsy did not return an authorization code.");

    const token = await exchangeEtsyToken({
      grant_type: "authorization_code",
      redirect_uri: flow.redirectUri,
      code,
      code_verifier: flow.verifier,
    });
    if (!token.refresh_token) {
      throw new EtsyApiError("Etsy did not return a refresh token. Revoke Mocksy in Etsy and connect it again.", 502);
    }
    const missingScopes = token.scope ? missingEtsyScopes(token.scope) : [];
    if (missingScopes.length) {
      throw new EtsyApiError(
        `Etsy did not grant the required permissions: ${missingScopes.join(", ")}. Reconnect and approve all requested access.`,
        403,
      );
    }
    const userIdMatch = token.access_token.match(/^(\d+)\./);
    const userId = Number(userIdMatch?.[1]);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new EtsyApiError("Etsy authorized the app but returned an invalid shop owner ID.", 502);
    }

    const shopPayload = await requestEtsy(
      `/application/users/${userId}/shops`,
      { accessToken: token.access_token },
    );
    const shop = Array.isArray(shopPayload?.results) ? shopPayload.results[0] : shopPayload;
    if (!shop?.shop_id) throw new Error("No Etsy shop was found for this account.");

    const session = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
      scope: token.scope || ETSY_OAUTH_SCOPES,
      userId,
      shopId: Number(shop.shop_id),
      shopName: String(shop.shop_name || "Etsy shop"),
      currencyCode: String(shop.currency_code || ""),
    };
    const response = NextResponse.redirect(settingsRedirect(request, "etsy", "connected"));
    response.cookies.set(ETSY_SESSION_COOKIE, await encryptSecurePayload(session), etsyCookieOptions());
    response.cookies.set(ETSY_OAUTH_COOKIE, "", { ...etsyCookieOptions(0), maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Etsy OAuth callback failed:", error);
    return failedCallback(
      request,
      error instanceof Error ? error.message : "Etsy could not be connected.",
    );
  }
}
