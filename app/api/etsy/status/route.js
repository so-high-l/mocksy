import { NextResponse } from "next/server";
import {
  ETSY_SESSION_COOKIE,
  applyRefreshedEtsyCookie,
  etsyCookieOptions,
  getEtsyCredentials,
  getEtsyRedirectConfiguration,
  readEtsySession,
} from "../../../../lib/etsy";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const credentials = getEtsyCredentials();
  const redirect = getEtsyRedirectConfiguration(request);
  const base = {
    configured: credentials.configured,
    redirectUri: redirect.redirectUri,
    redirectConfigured: redirect.configured,
    redirectValid: redirect.valid,
    redirectIsHttps: redirect.isHttps,
    redirectError: redirect.error,
  };
  if (!credentials.configured) return NextResponse.json({ ...base, connected: false });

  try {
    const { session, cookieValue } = await readEtsySession(request);
    const response = NextResponse.json({
      ...base,
      connected: Boolean(session),
      shopId: session?.shopId || null,
      shopName: session?.shopName || "",
      currencyCode: session?.currencyCode || "",
    });
    return applyRefreshedEtsyCookie(response, cookieValue);
  } catch (error) {
    const response = NextResponse.json({
      ...base,
      connected: false,
      error: error instanceof Error ? error.message : "Reconnect Etsy from Settings.",
    });
    if ([400, 401, 403].includes(Number(error?.status))) {
      response.cookies.set(ETSY_SESSION_COOKIE, "", { ...etsyCookieOptions(0), maxAge: 0 });
    }
    return response;
  }
}
