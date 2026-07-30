import { NextResponse } from "next/server";
import { getGeminiApiKey } from "../../../../../lib/api-keys";
import { startGeminiArtworkUpload } from "../../../../../lib/gemini-batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : "";
    const byteLength = Number(payload.byteLength);
    const submissionId = typeof payload.submissionId === "string" ? payload.submissionId.toLowerCase() : "";
    if (!ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "Use a PNG, JPG, or WebP artwork file." }, { status: 400 });
    }
    if (!Number.isSafeInteger(byteLength) || byteLength < 1) {
      return NextResponse.json({ error: "The artwork size is invalid." }, { status: 400 });
    }
    if (!/^[a-z0-9-]{8,100}$/.test(submissionId)) {
      return NextResponse.json({ error: "That upload reference is invalid." }, { status: 400 });
    }

    const apiKey = await getGeminiApiKey(request);
    if (!apiKey) return NextResponse.json({ error: "Connect a Gemini API key before uploading artwork." }, { status: 409 });
    const uploadSession = await startGeminiArtworkUpload({
      apiKey,
      byteLength,
      mimeType,
      displayName: `Mocksy artwork ${submissionId}`,
    });
    return NextResponse.json(
      uploadSession,
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    console.error("Artwork upload preparation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The artwork upload could not be prepared." },
      { status: 502 },
    );
  }
}
