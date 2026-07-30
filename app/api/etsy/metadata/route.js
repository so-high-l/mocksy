import { NextResponse } from "next/server";
import {
  applyRefreshedEtsyCookie,
  getRelevantEtsyTaxonomy,
  readEtsySession,
  requestEtsy,
} from "../../../../lib/etsy";

export const dynamic = "force-dynamic";

export async function GET(request) {
  let sessionResult;
  try {
    sessionResult = await readEtsySession(request);
    const { session, cookieValue } = sessionResult;
    if (!session) return NextResponse.json({ error: "Connect Etsy before loading listing details." }, { status: 401 });

    const [sectionsPayload, categories] = await Promise.all([
      requestEtsy(`/application/shops/${session.shopId}/sections`, { accessToken: session.accessToken }),
      getRelevantEtsyTaxonomy(),
    ]);
    const configuredTaxonomyId = Number(process.env.ETSY_TAXONOMY_ID || 0);
    const configuredCategory = configuredTaxonomyId
      ? categories.find((category) => category.id === configuredTaxonomyId)
        || { id: configuredTaxonomyId, name: `Category ${configuredTaxonomyId}`, path: `Configured Etsy category #${configuredTaxonomyId}` }
      : null;
    const availableCategories = configuredCategory
      ? [configuredCategory, ...categories.filter((category) => category.id !== configuredCategory.id)]
      : categories;
    const digitalPrint = availableCategories.find((category) => category.name.toLowerCase() === "digital prints");
    const response = NextResponse.json({
      shop: {
        id: session.shopId,
        name: session.shopName,
        currencyCode: session.currencyCode,
      },
      sections: (sectionsPayload?.results || []).map((section) => ({
        id: Number(section.shop_section_id),
        title: String(section.title || ""),
      })),
      categories: availableCategories,
      defaultTaxonomyId: configuredTaxonomyId || digitalPrint?.id || availableCategories[0]?.id || null,
    });
    return applyRefreshedEtsyCookie(response, cookieValue);
  } catch (error) {
    const response = NextResponse.json(
      { error: error instanceof Error ? error.message : "Etsy listing details could not be loaded." },
      { status: error?.status || 502 },
    );
    return applyRefreshedEtsyCookie(response, sessionResult?.cookieValue || "");
  }
}
