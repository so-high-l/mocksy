import { NextResponse } from "next/server";
import {
  API_KEYS_COOKIE,
  apiKeysCookieOptions,
  encryptApiKeys,
  getStoredApiKeys,
  maskKey,
} from "../../../lib/api-keys";
import { startGeminiArtworkUpload } from "../../../lib/gemini-batch";

const PROVIDERS = {
  gemini: { env: "GEMINI_API_KEY", label: "Gemini" },
  bfl: { env: "BFL_API_KEY", label: "Black Forest Labs" },
  openai: { env: "OPENAI_API_KEY", label: "OpenAI" },
};

function providerPayload(provider, keys) {
  const definition = PROVIDERS[provider];
  const environmentKey = process.env[definition.env] || "";
  const storedKey = typeof keys[provider] === "string" ? keys[provider] : "";
  const activeKey = environmentKey || storedKey;
  return {
    configured: Boolean(activeKey),
    source: environmentKey ? "environment" : storedKey ? "encrypted-cookie" : "none",
    masked: maskKey(activeKey),
  };
}

function settingsPayload(keys = {}) {
  return Object.fromEntries(Object.keys(PROVIDERS).map((provider) => [provider, providerPayload(provider, keys)]));
}

function readProvider(body) {
  if (typeof body.provider === "string" && PROVIDERS[body.provider]) return body.provider;
  if (typeof body.gemini === "string") return "gemini";
  return "";
}

async function checkGeminiConnection(apiKey) {
  try {
    await startGeminiArtworkUpload({
      apiKey,
      byteLength: 1,
      mimeType: "image/png",
      displayName: "Mocksy connection check",
    });
    return { ok: true, message: "Google accepted the key and the project can create batch uploads." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Google could not validate this API key.",
    };
  }
}

export async function GET(request) {
  return NextResponse.json(settingsPayload(await getStoredApiKeys(request)));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const provider = readProvider(body);
  if (!provider) return NextResponse.json({ error: "Choose a supported API provider." }, { status: 400 });

  const definition = PROVIDERS[provider];
  if (body.action === "test") {
    const storedKeys = await getStoredApiKeys(request);
    const activeKey = process.env[definition.env] || storedKeys[provider] || "";
    if (!activeKey) return NextResponse.json({ error: `Connect a ${definition.label} API key first.` }, { status: 409 });
    if (provider !== "gemini") {
      return NextResponse.json({ error: "Connection testing is currently available for Google Gemini." }, { status: 400 });
    }
    const connection = await checkGeminiConnection(activeKey);
    return NextResponse.json(
      { ...settingsPayload(storedKeys), connection },
      { status: connection.ok ? 200 : 422 },
    );
  }

  if (process.env[definition.env]) {
    return NextResponse.json(
      { error: `This API key is managed by the ${definition.env} environment variable.` },
      { status: 409 },
    );
  }

  const apiKey = typeof body.apiKey === "string"
    ? body.apiKey.trim()
    : provider === "gemini" && typeof body.gemini === "string" ? body.gemini.trim() : "";
  if (!apiKey || apiKey.length < 20 || apiKey.length > 500) {
    return NextResponse.json({ error: `Enter a valid ${definition.label} API key.` }, { status: 400 });
  }

  const keys = { ...(await getStoredApiKeys(request)), [provider]: apiKey };
  const connection = provider === "gemini" ? await checkGeminiConnection(apiKey) : null;
  const response = NextResponse.json({ ...settingsPayload(keys), connection });
  response.cookies.set(API_KEYS_COOKIE, await encryptApiKeys(keys), apiKeysCookieOptions());
  return response;
}

export async function DELETE(request) {
  const provider = request.nextUrl.searchParams.get("provider") || "gemini";
  if (!PROVIDERS[provider]) return NextResponse.json({ error: "Choose a supported API provider." }, { status: 400 });

  const definition = PROVIDERS[provider];
  if (process.env[definition.env]) {
    return NextResponse.json(
      { error: `Remove ${definition.env} from the deployment environment to disconnect it.` },
      { status: 409 },
    );
  }

  const keys = await getStoredApiKeys(request);
  delete keys[provider];
  const response = NextResponse.json(settingsPayload(keys));
  if (Object.keys(keys).length) {
    response.cookies.set(API_KEYS_COOKIE, await encryptApiKeys(keys), apiKeysCookieOptions());
  } else {
    response.cookies.set(API_KEYS_COOKIE, "", { ...apiKeysCookieOptions(), maxAge: 0 });
  }
  return response;
}
