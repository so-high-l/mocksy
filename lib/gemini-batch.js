import { makeMockupPrompt } from "./mockup-prompt";

const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_UPLOAD_ROOT = "https://generativelanguage.googleapis.com/upload/v1beta";

const TERMINAL_STATES = new Set([
  "JOB_STATE_SUCCEEDED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
  "BATCH_STATE_SUCCEEDED",
  "BATCH_STATE_FAILED",
  "BATCH_STATE_CANCELLED",
  "BATCH_STATE_EXPIRED",
]);

const GEMINI_ASPECT_RATIOS = {
  "1:1": "ASPECT_RATIO_ONE_BY_ONE",
  "2:3": "ASPECT_RATIO_TWO_BY_THREE",
  "3:2": "ASPECT_RATIO_THREE_BY_TWO",
  "3:4": "ASPECT_RATIO_THREE_BY_FOUR",
  "4:3": "ASPECT_RATIO_FOUR_BY_THREE",
  "4:5": "ASPECT_RATIO_FOUR_BY_FIVE",
  "5:4": "ASPECT_RATIO_FIVE_BY_FOUR",
  "9:16": "ASPECT_RATIO_NINE_BY_SIXTEEN",
  "16:9": "ASPECT_RATIO_SIXTEEN_BY_NINE",
  "21:9": "ASPECT_RATIO_TWENTY_ONE_BY_NINE",
  "1:8": "ASPECT_RATIO_ONE_BY_EIGHT",
  "8:1": "ASPECT_RATIO_EIGHT_BY_ONE",
  "1:4": "ASPECT_RATIO_ONE_BY_FOUR",
  "4:1": "ASPECT_RATIO_FOUR_BY_ONE",
};

const GEMINI_IMAGE_SIZES = {
  "512": "IMAGE_SIZE_FIVE_TWELVE",
  "1K": "IMAGE_SIZE_ONE_K",
  "2K": "IMAGE_SIZE_TWO_K",
  "4K": "IMAGE_SIZE_FOUR_K",
};

function geminiImageResponseFormat(aspectRatio, imageSize) {
  return {
    aspectRatio: GEMINI_ASPECT_RATIOS[aspectRatio] || "ASPECT_RATIO_FOUR_BY_FIVE",
    imageSize: GEMINI_IMAGE_SIZES[imageSize] || "IMAGE_SIZE_TWO_K",
  };
}

function errorMessage(payload, fallback) {
  return payload?.error?.message || payload?.message || payload?.detail || fallback;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function assertGoogleResponse(response, fallback) {
  const payload = await readJson(response);
  if (!response.ok) throw new Error(errorMessage(payload, `${fallback} (${response.status})`));
  return payload;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.inlinedResponses)) return value.inlinedResponses;
  if (Array.isArray(value?.responses)) return value.responses;
  return [];
}

export function normalizeBatchState(batch) {
  return batch?.state || batch?.metadata?.state || "JOB_STATE_PENDING";
}

export function isTerminalBatchState(state) {
  return TERMINAL_STATES.has(state);
}

export function isSuccessfulBatchState(state) {
  return state === "JOB_STATE_SUCCEEDED" || state === "BATCH_STATE_SUCCEEDED";
}

export function getBatchStats(batch) {
  const stats = batch?.batchStats || batch?.metadata?.batchStats || {};
  const requestCount = Number(stats.requestCount || 0);
  const successfulRequestCount = Number(stats.successfulRequestCount || 0);
  const failedRequestCount = Number(stats.failedRequestCount || 0);
  const pendingRequestCount = Number(
    stats.pendingRequestCount ?? Math.max(requestCount - successfulRequestCount - failedRequestCount, 0),
  );
  return { requestCount, successfulRequestCount, failedRequestCount, pendingRequestCount };
}

export function getInlineResponses(batch) {
  const candidates = [
    batch?.dest?.inlinedResponses,
    batch?.output?.inlinedResponses,
    batch?.response?.inlinedResponses,
    batch?.response?.output?.inlinedResponses,
    batch?.response?.dest?.inlinedResponses,
  ];
  return candidates.flatMap((candidate) => normalizeArray(candidate));
}

export function getResponsesFileName(batch) {
  return batch?.output?.responsesFile
    || batch?.response?.responsesFile
    || batch?.response?.output?.responsesFile
    || batch?.dest?.fileName
    || batch?.dest?.file_name
    || "";
}

export function findResponseImage(inlineResponse) {
  const parts = (inlineResponse?.response?.candidates || []).flatMap((candidate) => candidate?.content?.parts || []);
  const images = parts.filter((part) => {
    const image = part.inlineData || part.inline_data;
    return !part.thought && typeof image?.data === "string" && image.data.length > 100;
  });
  const fallbackImages = parts.filter((part) => {
    const image = part.inlineData || part.inline_data;
    return typeof image?.data === "string" && image.data.length > 100;
  });
  const finalPart = images.at(-1) || fallbackImages.at(-1);
  const image = finalPart?.inlineData || finalPart?.inline_data;
  if (!image) return null;
  return {
    data: image.data,
    mimeType: image.mimeType || image.mime_type || "image/png",
  };
}

export function findGeneratedImage(response) {
  return findResponseImage({ response });
}

function responseMetadata(inlineResponse, index) {
  const metadata = inlineResponse?.metadata || {};
  const parsedIndex = Number(metadata.index);
  const keyIndex = typeof metadata.key === "string" ? metadata.key.match(/mockup-(\d+)/) : null;
  return {
    index: Number.isInteger(parsedIndex) && parsedIndex >= 0
      ? parsedIndex
      : keyIndex
        ? Math.max(Number(keyIndex[1]) - 1, 0)
        : index,
    key: typeof metadata.key === "string" ? metadata.key : `mockup-${index + 1}`,
    prompt: typeof metadata.prompt === "string" ? metadata.prompt : "",
  };
}

function normalizeResponseFileLine(entry, index) {
  const metadata = {
    ...(entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : {}),
    ...(typeof entry?.key === "string" ? { key: entry.key } : {}),
  };
  if (entry?.response) return { metadata, response: entry.response };
  if (entry?.error) return { metadata, error: entry.error };
  if (entry?.candidates) return { metadata: { ...metadata, key: metadata.key || `mockup-${index + 1}` }, response: entry };
  return { metadata, error: { message: "Google returned an unrecognized batch response row." } };
}

export async function getBatchResponses({ apiKey, batch }) {
  const inlineResponses = getInlineResponses(batch);
  if (inlineResponses.length) return inlineResponses;

  const responsesFile = getResponsesFileName(batch);
  if (!responsesFile) return [];
  const response = await fetch(`${GEMINI_API_ROOT.replace("/v1beta", "/download/v1beta")}/${responsesFile}:download?alt=media`, {
    headers: { "x-goog-api-key": apiKey },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      // The raw text becomes the fallback error below.
    }
    throw new Error(errorMessage(payload, text || "Google could not download the batch response file."));
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return normalizeResponseFileLine(JSON.parse(line), index);
      } catch {
        return { metadata: { key: `mockup-${index + 1}` }, error: { message: "Google returned an invalid batch response row." } };
      }
    });
}

export function describeBatchResults(batch) {
  return describeBatchResponses(getInlineResponses(batch));
}

export function describeBatchResponses(responses) {
  const results = [];
  const requestErrors = [];
  responses.forEach((inlineResponse, responseIndex) => {
    const metadata = responseMetadata(inlineResponse, responseIndex);
    if (inlineResponse?.error) {
      requestErrors.push({
        ...metadata,
        message: inlineResponse.error.message || "This mockup request failed.",
        code: inlineResponse.error.code || null,
      });
      return;
    }
    const image = findResponseImage(inlineResponse);
    if (!image) {
      requestErrors.push({ ...metadata, message: "Google completed this request without returning an image." });
      return;
    }
    const extension = image.mimeType.includes("jpeg") ? "jpg" : image.mimeType.includes("webp") ? "webp" : "png";
    results.push({
      ...metadata,
      id: `${metadata.key}-${metadata.index}`,
      mimeType: image.mimeType,
      filename: `etsy-mockup-${metadata.index + 1}.${extension}`,
    });
  });
  return {
    results: results.sort((a, b) => a.index - b.index),
    requestErrors: requestErrors.sort((a, b) => a.index - b.index),
  };
}

export async function startGeminiArtworkUpload({ apiKey, byteLength, mimeType, displayName }) {
  const startResponse = await fetch(`${GEMINI_UPLOAD_ROOT}/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { displayName: displayName.slice(0, 120) } }),
  });
  if (!startResponse.ok) {
    await assertGoogleResponse(startResponse, "Google could not prepare the artwork upload");
  }
  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Google did not return an artwork upload address.");
  const chunkGranularity = Number(startResponse.headers.get("x-goog-upload-chunk-granularity") || 0);
  return {
    uploadUrl,
    chunkGranularity: Number.isInteger(chunkGranularity) && chunkGranularity > 0 ? chunkGranularity : 2 * 1024 * 1024,
  };
}

export async function getGeminiFile({ apiKey, name }) {
  if (!/^files\/[a-z0-9-]{1,100}$/.test(name || "")) throw new Error("The Google file reference is invalid.");
  const response = await fetch(`${GEMINI_API_ROOT}/${name}`, {
    headers: { "x-goog-api-key": apiKey },
    cache: "no-store",
  });
  return assertGoogleResponse(response, "Google could not verify the uploaded artwork");
}

export async function waitForGeminiFile({ apiKey, file, timeout = 30_000 }) {
  let currentFile = file;
  const deadline = Date.now() + timeout;
  while (currentFile.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    currentFile = await getGeminiFile({ apiKey, name: currentFile.name });
  }
  if (currentFile.state === "FAILED") {
    throw new Error(currentFile?.error?.message || "Google could not process the uploaded artwork.");
  }
  if (currentFile.state === "PROCESSING") {
    throw new Error("The artwork upload is still processing. Please try again shortly.");
  }
  if (!currentFile.uri || !currentFile.mimeType) throw new Error("Google did not return a usable artwork file.");
  return currentFile;
}

export async function uploadArtworkToGemini({ apiKey, bytes, mimeType, displayName }) {
  const uploadSession = await startGeminiArtworkUpload({
    apiKey,
    byteLength: bytes.length,
    mimeType,
    displayName,
  });

  const uploadResponse = await fetch(uploadSession.uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  const uploaded = await assertGoogleResponse(uploadResponse, "Google could not upload the artwork");
  const file = uploaded.file || uploaded;
  if (!file?.uri || !file?.name) throw new Error("Google uploaded the artwork but did not return a usable file reference.");
  return waitForGeminiFile({ apiKey, file });
}

export async function createGeminiBatch({
  apiKey,
  modelId,
  file,
  assignments,
  frameInstruction,
  aspectRatio,
  imageSize,
  displayName,
}) {
  const requests = assignments.map((prompt, index) => ({
    request: {
      contents: [{
        role: "user",
        parts: [
          { text: makeMockupPrompt(prompt, frameInstruction) },
          { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
        ],
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        responseFormat: { image: geminiImageResponseFormat(aspectRatio, imageSize) },
      },
    },
    metadata: {
      key: `mockup-${index + 1}`,
      index,
      prompt,
    },
  }));

  const response = await fetch(`${GEMINI_API_ROOT}/models/${encodeURIComponent(modelId)}:batchGenerateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      batch: {
        displayName,
        inputConfig: { requests: { requests } },
      },
    }),
  });
  const batch = await assertGoogleResponse(response, "Google could not create the batch job");
  if (!batch?.name) throw new Error("Google accepted the batch but did not return its job name.");
  return batch;
}

export async function generateGeminiDirect({
  apiKey,
  modelId,
  file,
  prompt,
  frameInstruction,
  aspectRatio,
  imageSize,
}) {
  const response = await fetch(`${GEMINI_API_ROOT}/models/${encodeURIComponent(modelId)}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: makeMockupPrompt(prompt, frameInstruction) },
          { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
        ],
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        responseFormat: { image: geminiImageResponseFormat(aspectRatio, imageSize) },
      },
    }),
  });

  const payload = await assertGoogleResponse(response, "Google could not generate this mockup");
  const image = findGeneratedImage(payload);
  if (!image) throw new Error("Google completed without returning an image.");
  const extension = image.mimeType.includes("jpeg") ? "jpg" : image.mimeType.includes("webp") ? "webp" : "png";
  return {
    dataUrl: `data:${image.mimeType};base64,${image.data}`,
    mimeType: image.mimeType,
    extension,
  };
}

export async function getGeminiBatch({ apiKey, name }) {
  const response = await fetch(`${GEMINI_API_ROOT}/${name}`, {
    headers: { "x-goog-api-key": apiKey },
    cache: "no-store",
  });
  return assertGoogleResponse(response, "Google could not check the batch job");
}

export async function cancelGeminiBatch({ apiKey, name }) {
  const response = await fetch(`${GEMINI_API_ROOT}/${name}:cancel`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: "{}",
  });
  return assertGoogleResponse(response, "Google could not cancel the batch job");
}

export async function findGeminiBatchByDisplayName({ apiKey, displayName }) {
  const response = await fetch(`${GEMINI_API_ROOT}/batches?pageSize=50`, {
    headers: { "x-goog-api-key": apiKey },
    cache: "no-store",
  });
  const payload = await assertGoogleResponse(response, "Google could not list recent batch jobs");
  return (payload.batches || []).find((batch) => batch.displayName === displayName) || null;
}

export function getBatchImage(batch, index) {
  const responses = getInlineResponses(batch);
  const inlineResponse = responses.find((response, responseIndex) => responseMetadata(response, responseIndex).index === index);
  return inlineResponse ? findResponseImage(inlineResponse) : null;
}

export async function getResolvedBatchImage({ apiKey, batch, index }) {
  const responses = await getBatchResponses({ apiKey, batch });
  const inlineResponse = responses.find((response, responseIndex) => responseMetadata(response, responseIndex).index === index);
  return inlineResponse ? findResponseImage(inlineResponse) : null;
}

export function batchErrorMessage(batch) {
  return batch?.error?.message || batch?.metadata?.error?.message || "The Google batch job did not complete.";
}
