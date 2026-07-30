import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_CHUNK_SIZE = 16 * 1024 * 1024;

function validGoogleUploadUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "generativelanguage.googleapis.com"
      && url.pathname === "/upload/v1beta/files"
      && url.searchParams.has("upload_id");
  } catch {
    return false;
  }
}

function googleErrorMessage(payload, text, status) {
  return payload?.error?.message || payload?.message || text || `Google rejected the artwork upload (${status}).`;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const uploadUrl = formData.get("uploadUrl");
    const chunk = formData.get("chunk");
    const offset = Number(formData.get("offset"));
    const finalize = formData.get("finalize") === "true";

    if (!validGoogleUploadUrl(uploadUrl)) {
      return NextResponse.json({ error: "That Google upload session is invalid." }, { status: 400 });
    }
    if (!(chunk instanceof File) || chunk.size < 1 || chunk.size > MAX_CHUNK_SIZE) {
      return NextResponse.json({ error: "The artwork chunk is invalid." }, { status: 400 });
    }
    if (!Number.isInteger(offset) || offset < 0) {
      return NextResponse.json({ error: "The artwork chunk offset is invalid." }, { status: 400 });
    }

    const bytes = Buffer.from(await chunk.arrayBuffer());
    const googleResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(bytes.length),
        "Content-Type": chunk.type || "application/octet-stream",
        "X-Goog-Upload-Offset": String(offset),
        "X-Goog-Upload-Command": finalize ? "upload, finalize" : "upload",
      },
      body: bytes,
    });

    const text = await googleResponse.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      // Google sometimes returns an empty body for non-final upload chunks.
    }

    if (!googleResponse.ok) {
      const message = googleErrorMessage(payload, text, googleResponse.status);
      console.error("Google artwork upload rejected:", {
        status: googleResponse.status,
        offset,
        chunkSize: chunk.size,
        finalize,
        message,
      });
      return NextResponse.json(
        { error: message },
        { status: 502 },
      );
    }

    if (!finalize) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, private" } });

    const uploadedFile = payload.file || payload;
    if (!uploadedFile?.name) {
      return NextResponse.json({ error: "Google uploaded the artwork but did not return its file reference." }, { status: 502 });
    }
    return NextResponse.json({ file: uploadedFile }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("Artwork chunk upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The artwork chunk could not be uploaded." },
      { status: 502 },
    );
  }
}
