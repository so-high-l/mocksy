import { NextResponse } from "next/server";
import { getOpenAIApiKey } from "../../../lib/api-keys";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gpt-4o-mini";
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PRODUCT_TYPES = new Set(["digital-download", "printable"]);
const LISTING_TYPES = new Set(["single-print", "set-of-3", "other"]);
const FILE_PACKAGES = new Set(["standard-single", "custom"]);
const AI_OPTIONS = new Set(["yes", "no"]);
const SEO_STYLES = new Set(["balanced", "search-focused", "natural-premium"]);

const STANDARD_SINGLE_FILE_DETAILS = [
  "Five high-resolution 300 DPI JPG files:",
  "• 2:3 ratio: 4x6, 6x9, 8x12, 10x15, 12x18, 16x24, 20x30, 24x36",
  "• 3:4 ratio: 6x8, 9x12, 12x16, 15x20, 18x24",
  "• 4:5 ratio: 4x5, 8x10, 12x15, 16x20",
  "• 11:14 ratio: 11x14",
  "• ISO A-series: A1, A2, A3, A4",
  "Delivery: Etsy makes the digital files available after payment under Purchases and Reviews.",
].join("\n");

function cleanText(value, maximumLength, preserveLines = false) {
  if (typeof value !== "string") return "";
  const cleaned = preserveLines
    ? value.trim().replace(/\r/g, "").replace(/\n{3,}/g, "\n\n")
    : value.trim().replace(/\s+/g, " ");
  return cleaned.slice(0, maximumLength);
}

function cleanDescription(value) {
  return cleanText(value, 9000, true).replaceAll("**", "");
}

function cleanTag(value) {
  const cleaned = cleanText(value, 100)
    .toLowerCase()
    .replace(/[&+]/g, " and ")
    .replace(/[^a-z0-9'\- ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= 20) return cleaned;
  const shortened = cleaned.slice(0, 20);
  const lastSpace = shortened.lastIndexOf(" ");
  return (lastSpace >= 10 ? shortened.slice(0, lastSpace) : shortened).trim();
}

function titleProblems(value) {
  const title = cleanText(value, 200);
  const problems = [];
  if (title.length < 90 || title.length > 140) problems.push("use 90–140 characters");
  if (/\bwall\s*art\s*roses\b/i.test(title)) problems.push("remove the shop name");
  if (/\b(?:19|20)\d{2}(?:[-/]\d{1,2})?\b/.test(title)) problems.push("remove dates and years");
  if (/\s[-–—]\s/.test(title)) problems.push("replace dash-separated keyword blocks with natural comma-separated phrases");
  if (/\b(?:home|wall) decor\b/i.test(title)) problems.push("replace generic decor filler with a specific supported style or room");
  if (/\b(?:large|oversized|extra large|xl)\b/i.test(title)) problems.push("remove unsupported physical-size language");
  if (/\b(?:instant download|high resolution|300 dpi|jpg files?|file ratios?)\b/i.test(title)) problems.push("remove fulfillment and file-specification language");
  if (/\b(?:beautiful|stunning|perfect|unique|must-have)\b/i.test(title)) problems.push("remove promotional filler");
  if (/\bprintable\b/i.test(title) && /\bdigital download\b/i.test(title)) problems.push("use one product-format phrase, not both printable and digital download");
  return problems;
}

function cleanList(value, itemLength, maximumItems) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, itemLength)).filter(Boolean).slice(0, maximumItems)
    : [];
}

function readEtsyUrl(value) {
  const cleaned = cleanText(value, 600);
  if (!cleaned) return { value: "" };
  try {
    const url = new URL(cleaned);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || (hostname !== "etsy.com" && !hostname.endsWith(".etsy.com"))) {
      return { error: "Use a full https:// Etsy URL for shop sections and exact sets." };
    }
    return { value: cleaned };
  } catch {
    return { error: "One of the Etsy links is not a valid full URL." };
  }
}

function normalizeVisualAnalysis(value) {
  const analysis = value && typeof value === "object" ? value : {};
  return {
    mainSubject: cleanText(analysis.mainSubject, 180),
    dominantColors: cleanList(analysis.dominantColors, 50, 5),
    secondaryColors: cleanList(analysis.secondaryColors, 50, 5),
    artStyle: cleanText(analysis.artStyle, 180),
    mood: cleanText(analysis.mood, 180),
    bestRooms: cleanList(analysis.bestRooms, 80, 5),
    likelyBuyer: cleanText(analysis.likelyBuyer, 240),
    primarySearchPhrase: cleanText(analysis.primarySearchPhrase, 100),
    longTailPhrases: cleanList(analysis.longTailPhrases, 120, 5),
  };
}

function normalizedSeo(value) {
  if (!value || typeof value !== "object") throw new Error("GPT-4o mini returned an incomplete SEO result.");
  const title = cleanText(value.title, 140);
  const description = cleanDescription(value.description);
  const visualAnalysis = normalizeVisualAnalysis(value.visualAnalysis);
  const primaryKeyword = cleanText(value.primaryKeyword, 100) || visualAnalysis.primarySearchPhrase;
  const imageAltText = cleanText(value.imageAltText, 250);
  const strategy = cleanText(value.strategy, 700, true);
  const tags = Array.isArray(value.tags)
    ? [...new Set(value.tags.map(cleanTag).filter(Boolean))].slice(0, 13)
    : [];
  const secondaryKeywords = cleanList(value.secondaryKeywords, 100, 8);
  const suggestedAttributes = cleanList(value.suggestedAttributes, 100, 8);
  const suppliedCheck = value.qualityCheck && typeof value.qualityCheck === "object" ? value.qualityCheck : {};
  const qualityCheck = {
    titleWithin140: title.length > 0 && title.length <= 140,
    titleNatural: titleProblems(title).length === 0,
    exactly13Tags: tags.length === 13,
    tagsWithin20: tags.every((tag) => tag.length <= 20),
    tagsUnique: new Set(tags).size === tags.length,
    subjectNotGuessed: Boolean(suppliedCheck.subjectNotGuessed),
    fileDetailsMatch: Boolean(suppliedCheck.fileDetailsMatch),
    aiDisclosureMatches: Boolean(suppliedCheck.aiDisclosureMatches),
    noFixedPrice: Boolean(suppliedCheck.noFixedPrice),
    setLinksGenuine: Boolean(suppliedCheck.setLinksGenuine),
    noInternalNotes: Boolean(suppliedCheck.noInternalNotes),
  };

  if (!title || !description || !primaryKeyword || tags.length !== 13 || visualAnalysis.longTailPhrases.length !== 5) {
    throw new Error("GPT-4o mini did not return a complete title, description, visual analysis, and 13 tags.");
  }
  return {
    visualAnalysis,
    title,
    description,
    tags,
    primaryKeyword,
    secondaryKeywords,
    imageAltText,
    suggestedAttributes,
    strategy,
    qualityCheck,
  };
}

async function repairTitle({ apiKey, rejectedTitle, result, productType, mainKeyword }) {
  const problems = titleProblems(rejectedTitle);
  if (!problems.length) return cleanText(rejectedTitle, 140);

  const visual = result?.visualAnalysis && typeof result.visualAnalysis === "object" ? result.visualAnalysis : {};
  const repairResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 180,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "etsy_title_repair",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title"],
            properties: { title: { type: "string", minLength: 90, maxLength: 140 } },
          },
        },
      },
      messages: [
        {
          role: "system",
          content: [
            "Rewrite one Etsy title for printable wall art.",
            "Write a natural buyer-facing title between 90 and 140 characters. Length is not a ranking score, so never pad it.",
            "Use two to four comma-separated phrase groups. Lead with the most specific accurate subject plus wall art or art print, then add distinct visible color, style, botanical or room-intent facets.",
            "Use exactly one format phrase: Printable Wall Art, Printable Art, or Digital Download.",
            "Never include WallArtRoses, any shop or brand name, dates, years, file names, SKUs, physical-size claims, file counts, ratios, 300 DPI, high resolution, instant download, home decor, wall decor, promotional filler, or dash-separated keyword blocks.",
            "Do not repeat wall art, print, printable, digital, floral, or another core noun merely to reach a length target.",
            "Return only the JSON object required by the schema.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Rejected title: ${cleanText(rejectedTitle, 200)}`,
            `Problems to fix: ${problems.join("; ")}`,
            `Primary keyword: ${cleanText(mainKeyword, 100) || cleanText(result?.primaryKeyword, 100) || cleanText(visual.primarySearchPhrase, 100)}`,
            `Main subject: ${cleanText(visual.mainSubject, 180)}`,
            `Colors: ${cleanList(visual.dominantColors, 50, 5).concat(cleanList(visual.secondaryColors, 50, 5)).join(", ")}`,
            `Style: ${cleanText(visual.artStyle, 180)}`,
            `Best rooms: ${cleanList(visual.bestRooms, 80, 5).join(", ")}`,
            `Product format: ${productType === "printable" ? "Printable Wall Art" : "Digital Download"}`,
          ].join("\n"),
        },
      ],
    }),
  });

  const repairPayload = await repairResponse.json().catch(() => ({}));
  if (!repairResponse.ok) throw new Error("GPT-4o mini created an unusable title and could not repair it.");
  const repairedTitle = cleanText(JSON.parse(repairPayload?.choices?.[0]?.message?.content || "{}").title, 140);
  const remainingProblems = titleProblems(repairedTitle);
  if (remainingProblems.length) throw new Error(`GPT-4o mini created an unusable title: ${remainingProblems.join(", ")}.`);
  return repairedTitle;
}

export async function GET(request) {
  return NextResponse.json({ configured: Boolean(await getOpenAIApiKey(request)), model: MODEL });
}

export async function POST(request) {
  try {
    const apiKey = await getOpenAIApiKey(request);
    if (!apiKey) {
      return NextResponse.json({ error: "Add your OpenAI API key in Settings before generating SEO." }, { status: 400 });
    }

    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File) || !image.size) {
      return NextResponse.json({ error: "Choose a listing image first." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(image.type)) {
      return NextResponse.json({ error: "Use a JPG, PNG, or WebP listing image." }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "The SEO preview image must be smaller than 4 MB." }, { status: 400 });
    }

    const requestedProductType = cleanText(formData.get("productType"), 40);
    const productType = PRODUCT_TYPES.has(requestedProductType) ? requestedProductType : "digital-download";
    const requestedListingType = cleanText(formData.get("listingType"), 40);
    const listingType = LISTING_TYPES.has(requestedListingType) ? requestedListingType : "single-print";
    const requestedFilePackage = cleanText(formData.get("filePackage"), 40);
    const filePackage = FILE_PACKAGES.has(requestedFilePackage) ? requestedFilePackage : "standard-single";
    const requestedAiAssisted = cleanText(formData.get("aiAssisted"), 10);
    if (!AI_OPTIONS.has(requestedAiAssisted)) {
      return NextResponse.json({ error: "Choose whether this artwork is AI-assisted." }, { status: 400 });
    }
    if (filePackage === "standard-single" && listingType !== "single-print") {
      return NextResponse.json({ error: "Sets and other listing types need their exact custom file and delivery details." }, { status: 400 });
    }

    const customFileDetails = cleanText(formData.get("digitalFiles"), 3500, true);
    const digitalFiles = filePackage === "standard-single" ? STANDARD_SINGLE_FILE_DETAILS : customFileDetails;
    if (!digitalFiles) {
      return NextResponse.json({ error: "Add the exact files, sizes, and delivery details included with this listing." }, { status: 400 });
    }

    const shopSection = readEtsyUrl(formData.get("shopSectionUrl"));
    const exactSetUrl = readEtsyUrl(formData.get("exactSetUrl"));
    const additionalSetUrl = readEtsyUrl(formData.get("additionalSetUrl"));
    const linkError = shopSection.error || exactSetUrl.error || additionalSetUrl.error;
    if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });

    const exactSetName = cleanText(formData.get("exactSetName"), 200);
    const additionalSetName = cleanText(formData.get("additionalSetName"), 200);
    if (Boolean(exactSetName) !== Boolean(exactSetUrl.value)) {
      return NextResponse.json({ error: "Add both the exact set name and its Etsy URL, or leave both blank." }, { status: 400 });
    }
    if (Boolean(additionalSetName) !== Boolean(additionalSetUrl.value)) {
      return NextResponse.json({ error: "Add both the additional set name and its Etsy URL, or leave both blank." }, { status: 400 });
    }

    const mainKeyword = cleanText(formData.get("mainKeyword"), 100);
    const inspiration = cleanText(formData.get("inspiration"), 3500, true);
    const targetBuyer = cleanText(formData.get("targetBuyer"), 300);
    const artworkName = cleanText(formData.get("artworkName"), 200);
    const existingListing = cleanText(formData.get("existingListing"), 6000, true);
    const requestedStyle = cleanText(formData.get("seoStyle"), 40);
    const seoStyle = SEO_STYLES.has(requestedStyle) ? requestedStyle : "balanced";
    const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const imageDataUrl = `data:${image.type};base64,${imageBase64}`;

    const listingTypeLabel = {
      "single-print": "SINGLE PRINT",
      "set-of-3": "SET OF 3",
      other: "OTHER",
    }[listingType];

    const listingContext = [
      "SHOP: WallArtRoses",
      `LISTING TYPE: ${listingTypeLabel}`,
      `PRODUCT FORMAT: ${productType === "printable" ? "PRINTABLE WALL ART" : "DIGITAL DOWNLOAD"}`,
      `ARTWORK OR COLLECTION NAME: ${artworkName || "UNKNOWN"}`,
      `DIGITAL FILES AND DELIVERY DETAILS (use exactly; do not add or alter sizes):\n${digitalFiles}`,
      `AI-ASSISTED ARTWORK: ${requestedAiAssisted.toUpperCase()}`,
      `SHOP SECTION URL: ${shopSection.value || "NONE"}`,
      `EXACT SET CONTAINING THIS ARTWORK: ${exactSetName ? `${exactSetName}\n${exactSetUrl.value}` : "NONE"}`,
      `ADDITIONAL EXACT SET CONTAINING THIS ARTWORK: ${additionalSetName ? `${additionalSetName}\n${additionalSetUrl.value}` : "NONE"}`,
      `PREFERRED ROOMS OR AUDIENCE: ${targetBuyer || "NONE SUPPLIED — infer only from visible evidence"}`,
      `EXISTING TITLE, TAGS, OR DESCRIPTION: ${existingListing || "NONE"}`,
      `SELLER-PREFERRED MAIN KEYWORD: ${mainKeyword || "NONE — infer the strongest accurate phrase"}`,
      `BESTSELLER INSPIRATION: ${inspiration || "NONE"}`,
      `SEO EMPHASIS: ${seoStyle}`,
    ].join("\n\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 4500,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "wall_art_roses_etsy_listing",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["visualAnalysis", "title", "description", "tags", "primaryKeyword", "secondaryKeywords", "imageAltText", "suggestedAttributes", "strategy", "qualityCheck"],
              properties: {
                visualAnalysis: {
                  type: "object",
                  additionalProperties: false,
                  required: ["mainSubject", "dominantColors", "secondaryColors", "artStyle", "mood", "bestRooms", "likelyBuyer", "primarySearchPhrase", "longTailPhrases"],
                  properties: {
                    mainSubject: { type: "string" },
                    dominantColors: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
                    secondaryColors: { type: "array", minItems: 0, maxItems: 5, items: { type: "string" } },
                    artStyle: { type: "string" },
                    mood: { type: "string" },
                    bestRooms: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
                    likelyBuyer: { type: "string" },
                    primarySearchPhrase: { type: "string" },
                    longTailPhrases: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } },
                  },
                },
                title: { type: "string", minLength: 90, maxLength: 140 },
                description: { type: "string" },
                tags: { type: "array", minItems: 13, maxItems: 13, items: { type: "string", minLength: 2, maxLength: 20 } },
                primaryKeyword: { type: "string" },
                secondaryKeywords: { type: "array", minItems: 5, maxItems: 8, items: { type: "string" } },
                imageAltText: { type: "string" },
                suggestedAttributes: { type: "array", minItems: 4, maxItems: 8, items: { type: "string" } },
                strategy: { type: "string" },
                qualityCheck: {
                  type: "object",
                  additionalProperties: false,
                  required: ["titleWithin140", "titleNatural", "exactly13Tags", "tagsWithin20", "tagsUnique", "subjectNotGuessed", "fileDetailsMatch", "aiDisclosureMatches", "noFixedPrice", "setLinksGenuine", "noInternalNotes"],
                  properties: {
                    titleWithin140: { type: "boolean" },
                    titleNatural: { type: "boolean" },
                    exactly13Tags: { type: "boolean" },
                    tagsWithin20: { type: "boolean" },
                    tagsUnique: { type: "boolean" },
                    subjectNotGuessed: { type: "boolean" },
                    fileDetailsMatch: { type: "boolean" },
                    aiDisclosureMatches: { type: "boolean" },
                    noFixedPrice: { type: "boolean" },
                    setLinksGenuine: { type: "boolean" },
                    noInternalNotes: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
        messages: [
          {
            role: "system",
            content: [
              "You are an Etsy SEO strategist specializing in printable wall art for the shop WallArtRoses.",
              "Analyze the attached artwork carefully and create one complete, conversion-focused Etsy listing. Use only details genuinely visible in the image and seller-supplied facts. If a flower, plant, or subject cannot be identified confidently, use an accurate general description such as abstract floral or botanical instead of inventing a species.",
              "Never use competitor shop names, protected artist names, unsupported claims, or misleading terms. For newly created artwork, use vintage-inspired rather than vintage.",
              "VISUAL ANALYSIS: identify the main subject, dominant and secondary colors, art style, mood, best rooms, likely buyer, strongest primary search phrase, and exactly five supporting long-tail phrases.",
              "TITLE: create one natural title between 90 and 140 characters, ideally 10–15 useful words. Length is not a ranking score: stop when all accurate search facets are covered and never pad toward 140. Use two to four comma-separated phrase groups. Lead with the most specific confident subject plus wall art or art print, then add distinct visible color, style, botanical, room-intent, and product-format facets. Use exactly one format phrase: Printable Wall Art, Printable Art, or Digital Download.",
              "TITLE HARD BANS: never include WallArtRoses or any shop/brand name; a date, year, month, filename, SKU, or listing ID; generic home decor or wall decor; large, oversized, XL, or another unsupported physical-size claim; file counts, ratios, JPG, 300 DPI, high resolution, or instant download; promotional filler such as beautiful, stunning, perfect, unique, or must-have; both printable and digital download in the same title; or spaced hyphens/dashes used as keyword separators. Vintage-inspired may keep its internal hyphen. Never copy metadata or seller-context labels into the title.",
              "TITLE QUALITY TEST: every comma-separated phrase must add one new, visible, buyer-searchable fact. Do not repeat wall art, print, printable, digital, floral, or another core noun just to make the title longer. Prefer a shorter specific title over a longer generic one.",
              "TAGS: create exactly 13 unique natural buyer-search phrases, each 20 characters or fewer including spaces and with no commas. Cover a useful mix of subject, color, style, room, mood, product format, and gift intent. Avoid near duplicates and do not repeatedly rephrase the same keyword.",
              "DESCRIPTION: return polished paste-ready buyer-facing copy with these uppercase section headings in this order: OPENING, DIGITAL DOWNLOAD, WHAT YOU RECEIVE, HOW TO DOWNLOAD, PRINTING OPTIONS, optional ARTWORK DISCLOSURE, PLEASE NOTE, optional SAVE WITH A COORDINATED SET, and a final internal-link line when a shop section URL exists.",
              "The OPENING must be two concise artwork-specific sentences describing the visible subject, colors, mood, style, and fitting rooms, with the primary search phrase used naturally.",
              "DIGITAL DOWNLOAD must clearly state that this is downloadable artwork and no physical print or frame will be shipped.",
              "WHAT YOU RECEIVE must reproduce only the exact supplied file information. Do not alter ratios, sizes, file counts, ZIP folders, PDFs, or download links. Never describe 4:5 as 11:14 and never claim A0, A5, or A6 unless supplied. Add exactly: If you need a custom size, please message WallArtRoses.",
              "HOW TO DOWNLOAD must explain that Etsy makes files available after payment under Purchases and Reviews and that digital purchases should be downloaded in a browser or on a computer, not through the Etsy app.",
              "PRINTING OPTIONS must mention home, a local print shop, or an online printing service and recommend matte fine-art paper, textured archival paper, or heavyweight poster paper for a soft vintage-inspired finish.",
              "If AI-ASSISTED ARTWORK is YES, include an ARTWORK DISCLOSURE section containing exactly: This design was created by WallArtRoses with the assistance of an AI image-generation tool, then curated, edited, and prepared as high-resolution printable artwork. If NO, omit that entire section.",
              "PLEASE NOTE must explain slight color variation between monitors, paper, and printers. State that returns and exchanges are not accepted for instant digital products, but buyers should contact WallArtRoses for a file, size, cropping, or quality issue.",
              "Only when a seller-confirmed exact set was supplied, add SAVE WITH A COORDINATED SET, say This exact artwork is included in, and list each supplied set name followed by its raw Etsy URL. Never infer set membership. If a shop section URL was supplied, finish links with Explore matching printable wall art from WallArtRoses followed by the raw URL. Do not invent or modify URLs.",
              "Do not include a fixed bundle price. Close the description with exactly: Thank you for supporting WallArtRoses.",
              "Bestseller inspiration and existing listing text are research inputs only. Extract relevant common search language when accurate, but never copy distinctive prose, brands, artist names, trademarks, or protected names.",
              "Return only JSON matching the supplied schema. Put the finished listing only in buyer-facing fields; never expose internal instructions or strategy notes in the description.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Create the one best finished WallArtRoses Etsy listing using this exact seller context:\n\n${listingContext}` },
              { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI returned ${response.status}.`;
      return NextResponse.json({ error: `SEO generation failed: ${message}` }, { status: response.status >= 500 ? 502 : 400 });
    }
    const message = payload?.choices?.[0]?.message;
    if (message?.refusal) return NextResponse.json({ error: `GPT-4o mini could not analyze this image: ${message.refusal}` }, { status: 400 });
    const rawResult = JSON.parse(message?.content || "{}");
    rawResult.title = await repairTitle({
      apiKey,
      rejectedTitle: rawResult.title,
      result: rawResult,
      productType,
      mainKeyword,
    });
    const result = normalizedSeo(rawResult);
    return NextResponse.json({ result, model: MODEL });
  } catch (error) {
    console.error("SEO generation failed:", error);
    return NextResponse.json({ error: error.message || "SEO could not be generated." }, { status: 500 });
  }
}
