import { NextResponse } from "next/server";
import {
  ETSY_OAUTH_COOKIE,
  ETSY_SESSION_COOKIE,
  etsyCookieOptions,
} from "../../../../lib/etsy";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ETSY_SESSION_COOKIE, "", { ...etsyCookieOptions(0), maxAge: 0 });
  response.cookies.set(ETSY_OAUTH_COOKIE, "", { ...etsyCookieOptions(0), maxAge: 0 });
  return response;
}
