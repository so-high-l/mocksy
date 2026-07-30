import { NextResponse } from "next/server";
import { getOpenAIApiKey } from "../../../lib/api-keys";
import { selectFrameForArtwork } from "../../../lib/frame-selection";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_ANALYSIS_SIZE = 6 * 1024 * 1024;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const artwork = formData.get("artwork");
    if (!(artwork instanceof File)) {
      return NextResponse.json({ error: "Choose an artwork file first." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(artwork.type)) {
      return NextResponse.json({ error: "Use a PNG, JPG, or WebP artwork file." }, { status: 400 });
    }
    if (artwork.size > MAX_ANALYSIS_SIZE) {
      return NextResponse.json({ error: "The artwork preview is too large for frame analysis." }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await artwork.arrayBuffer());
    const artworkDataUrl = `data:${artwork.type};base64,${imageBuffer.toString("base64")}`;
    const frameProfile = await selectFrameForArtwork({
      apiKey: await getOpenAIApiKey(request),
      artworkDataUrl,
    });

    return NextResponse.json({
      frameProfile,
      configured: frameProfile.source === "gpt-4o-mini",
    });
  } catch (error) {
    console.error("Frame analysis failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The frame could not be selected." },
      { status: 500 },
    );
  }
}
