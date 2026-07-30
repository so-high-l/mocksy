import { NextResponse } from "next/server";
import { decryptSecurePayload, encryptSecurePayload } from "../../../../lib/api-keys";
import {
  ETSY_OAUTH_COOKIE,
  ETSY_SESSION_COOKIE,
  etsyCookieOptions,
  exchangeEtsyToken,
  requestEtsy,
} from "../../../../lib/etsy";

export const runtime = "nodejs";

function settingsRedirect(request, parameter, value) {
  const url = new URL("/settings", request.nextUrl.origin);
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
    const userId = Number(String(token.access_token || "").split(".", 1)[0]);
    if (!userId) throw new Error("Etsy authorized the app but did not return a shop owner ID.");

    const shopPayload = await requestEtsy(`/application/users/${userId}/shops`);
    const shop = Array.isArray(shopPayload?.results) ? shopPayload.results[0] : shopPayload;
    if (!shop?.shop_id) throw new Error("No Etsy shop was found for this account.");

    const session = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
      scope: token.scope || "",
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
