import { NextResponse } from "next/server";
import { getGeminiApiKey } from "../../../../lib/api-keys";
import {
  batchErrorMessage,
  cancelGeminiBatch,
  describeBatchResponses,
  getBatchResponses,
  findGeminiBatchByDisplayName,
  getBatchStats,
  getGeminiBatch,
  isSuccessfulBatchState,
  isTerminalBatchState,
  normalizeBatchState,
} from "../../../../lib/gemini-batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validBatchName(name) {
  return typeof name === "string" && /^batches\/[A-Za-z0-9_-]{1,200}$/.test(name);
}

function validDisplayName(name) {
  return typeof name === "string" && /^mocksy-[a-z0-9-]{8,100}$/.test(name);
}

function stateLabel(state) {
  if (state.includes("PENDING")) return "Queued at Google";
  if (state.includes("RUNNING")) return "Generating at Google";
  if (state.includes("SUCCEEDED")) return "Batch complete";
  if (state.includes("CANCELLED")) return "Batch cancelled";
  if (state.includes("EXPIRED")) return "Batch expired";
  if (state.includes("FAILED")) return "Batch failed";
  return "Preparing batch";
}

async function batchPayload(apiKey, batch) {
  const state = normalizeBatchState(batch);
  const terminal = isTerminalBatchState(state);
  const successful = isSuccessfulBatchState(state);
  const stats = getBatchStats(batch);
  const described = successful
    ? describeBatchResponses(await getBatchResponses({ apiKey, batch }))
    : { results: [], requestErrors: [] };
  const responseCount = described.results.length + described.requestErrors.length;
  const total = stats.requestCount || responseCount;
  return {
    name: batch.name,
    displayName: batch.displayName,
    state,
    stateLabel: stateLabel(state),
    terminal,
    successful,
    createTime: batch.createTime || batch.metadata?.createTime || null,
    updateTime: batch.updateTime || batch.metadata?.updateTime || null,
    endTime: batch.endTime || batch.metadata?.endTime || null,
    progress: {
      total,
      successful: stats.successfulRequestCount || described.results.length,
      failed: stats.failedRequestCount || described.requestErrors.length,
      pending: stats.pendingRequestCount || (terminal ? 0 : Math.max(total - stats.successfulRequestCount - stats.failedRequestCount, 0)),
    },
    results: described.results,
    requestErrors: described.requestErrors,
    error: terminal && !successful ? batchErrorMessage(batch) : null,
  };
}

export async function GET(request) {
  try {
    const apiKey = await getGeminiApiKey(request);
    if (!apiKey) return NextResponse.json({ error: "Connect a Gemini API key to check this batch." }, { status: 409 });

    const displayName = request.nextUrl.searchParams.get("displayName");
    if (displayName) {
      if (!validDisplayName(displayName)) return NextResponse.json({ error: "That batch reference is invalid." }, { status: 400 });
      const recovered = await findGeminiBatchByDisplayName({ apiKey, displayName });
      if (!recovered) return NextResponse.json({ error: "The previous batch submission was not found." }, { status: 404 });
      return NextResponse.json({ found: true, batch: await batchPayload(apiKey, recovered) });
    }

    const name = request.nextUrl.searchParams.get("name");
    if (!validBatchName(name)) return NextResponse.json({ error: "That batch job reference is invalid." }, { status: 400 });
    return NextResponse.json({ batch: await batchPayload(apiKey, await getGeminiBatch({ apiKey, name })) });
  } catch (error) {
    console.error("Batch status check failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The batch status could not be checked." },
      { status: 502 },
    );
  }
}

export async function DELETE(request) {
  try {
    const name = request.nextUrl.searchParams.get("name");
    if (!validBatchName(name)) return NextResponse.json({ error: "That batch job reference is invalid." }, { status: 400 });
    const apiKey = await getGeminiApiKey(request);
    if (!apiKey) return NextResponse.json({ error: "Connect a Gemini API key to cancel this batch." }, { status: 409 });
    await cancelGeminiBatch({ apiKey, name });
    const batch = await getGeminiBatch({ apiKey, name });
    return NextResponse.json({ batch: await batchPayload(apiKey, batch) });
  } catch (error) {
    console.error("Batch cancellation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The batch could not be cancelled." },
      { status: 502 },
    );
  }
}
