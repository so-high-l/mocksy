import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createSessionToken,
  getAppPassword,
  isAuthConfigured,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "../../../../lib/auth";

export const runtime = "nodejs";

function passwordsMatch(received, expected) {
  const receivedBuffer = Buffer.from(received || "");
  const expectedBuffer = Buffer.from(expected || "");
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Login is not configured. Add APP_PASSWORD and SESSION_SECRET to your Vercel environment variables." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  if (!passwordsMatch(body.password, getAppPassword())) {
    return NextResponse.json({ error: "That password is not correct." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  return response;
}
