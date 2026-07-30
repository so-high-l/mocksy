import { NextResponse } from "next/server";
import { getGeminiApiKey } from "../../../../../lib/api-keys";
import { getGeminiBatch, getResolvedBatchImage, isSuccessfulBatchState, normalizeBatchState } from "../../../../../lib/gemini-batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validBatchName(name) {
  return typeof name === "string" && /^batches\/[A-Za-z0-9_-]{1,200}$/.test(name);
}

function streamBuffer(bytes) {
  const chunkSize = 64 * 1024;
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  });
}

export async function GET(request) {
  try {
    const name = request.nextUrl.searchParams.get("name");
    const index = Number(request.nextUrl.searchParams.get("index"));
    if (!validBatchName(name) || !Number.isInteger(index) || index < 0 || index > 99) {
      return NextResponse.json({ error: "That batch image reference is invalid." }, { status: 400 });
    }

    const apiKey = await getGeminiApiKey(request);
    if (!apiKey) return NextResponse.json({ error: "Connect a Gemini API key to retrieve this image." }, { status: 409 });
    const batch = await getGeminiBatch({ apiKey, name });
    if (!isSuccessfulBatchState(normalizeBatchState(batch))) {
      return NextResponse.json({ error: "This batch has not completed successfully yet." }, { status: 409 });
    }
    const image = await getResolvedBatchImage({ apiKey, batch, index });
    if (!image) return NextResponse.json({ error: "This mockup image was not returned by Google." }, { status: 404 });

    const bytes = Buffer.from(image.data, "base64");
    const extension = image.mimeType.includes("jpeg") ? "jpg" : image.mimeType.includes("webp") ? "webp" : "png";
    return new NextResponse(streamBuffer(bytes), {
      headers: {
        "Content-Type": image.mimeType,
        "Content-Disposition": `inline; filename="etsy-mockup-${index + 1}.${extension}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Batch image retrieval failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The generated image could not be retrieved." },
      { status: 502 },
    );
  }
}
