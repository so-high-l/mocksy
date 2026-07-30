import { NextResponse } from "next/server";
import { getApiKeyForProvider, getOpenAIApiKey } from "../../../lib/api-keys";
import { DEFAULT_MODEL_ID, getModel } from "../../../lib/models";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const model = getModel(request.nextUrl.searchParams.get("model") || DEFAULT_MODEL_ID);
  return NextResponse.json({
    configured: Boolean(await getApiKeyForProvider(request, model.provider)),
    frameConfigured: Boolean(await getOpenAIApiKey(request)),
    model: model.id,
    modelName: model.name,
    provider: model.provider,
    providerName: model.providerName,
    frameModel: "gpt-4o-mini",
  });
}
