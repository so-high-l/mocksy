import { NextResponse } from "next/server";
import {
  applyRefreshedEtsyCookie,
  EtsyApiError,
  etsyDraftManageUrl,
  readEtsySession,
  requestEtsy,
} from "../../../../lib/etsy";
import {
  ETSY_LISTING_IMAGE_TYPES,
  etsyDraftParameters,
  MAX_ETSY_IMAGE_BYTES,
  MAX_ETSY_LISTING_IMAGES,
  normalizeEtsyListing,
} from "../../../../lib/etsy-listing";

export const runtime = "nodejs";
export const maxDuration = 180;
const MAX_ETSY_UPLOAD_BYTES = 200 * 1024 * 1024;

function safeFilename(value, index) {
  const base = String(value || `mocksy-listing-image-${index + 1}`)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `mocksy-listing-image-${index + 1}`;
  return `${base}.jpg`;
}

function validateListingImage(file, index) {
  if (!ETSY_LISTING_IMAGE_TYPES.has(file.type)) {
    throw new Error(`${file.name || `Image ${index + 1}`} is not a supported JPG, PNG, or WebP image.`);
  }
  if (file.size > MAX_ETSY_IMAGE_BYTES) {
    throw new Error(`${file.name || `Image ${index + 1}`} is larger than 20 MB.`);
  }
}

async function jpegListingImage(file, index) {
  validateListingImage(file, index);
  const sharp = (await import("sharp")).default;
  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input, { failOn: "error", limitInputPixels: 100_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  if (output.length > MAX_ETSY_IMAGE_BYTES) {
    throw new Error(`${file.name || `Image ${index + 1}`} is still larger than 20 MB after optimization.`);
  }
  return new File([output], safeFilename(file.name, index), { type: "image/jpeg" });
}

export async function POST(request) {
  let sessionResult;
  try {
    sessionResult = await readEtsySession(request);
    if (!sessionResult.session) {
      return NextResponse.json({ error: "Connect Etsy in Settings before creating a draft." }, { status: 401 });
    }

    const formData = await request.formData();
    const rawListing = JSON.parse(String(formData.get("listing") || "{}"));
    const listing = normalizeEtsyListing(rawListing);
    const images = formData.getAll("images").filter((image) => image instanceof File && image.size);
    if (!images.length) {
      return NextResponse.json({ error: "Choose at least one listing image." }, { status: 400 });
    }
    if (images.length > MAX_ETSY_LISTING_IMAGES) {
      return NextResponse.json(
        { error: `Choose no more than ${MAX_ETSY_LISTING_IMAGES} listing images.` },
        { status: 400 },
      );
    }
    images.forEach(validateListingImage);
    const totalImageBytes = images.reduce((total, image) => total + image.size, 0);
    if (totalImageBytes > MAX_ETSY_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "The selected listing images exceed Mocksy’s 200 MB upload limit. Choose fewer or smaller images." },
        { status: 413 },
      );
    }

    const { session, cookieValue } = sessionResult;
    const draft = await requestEtsy(`/application/shops/${session.shopId}/listings`, {
      accessToken: session.accessToken,
      method: "POST",
      body: etsyDraftParameters(listing),
    });
    const listingId = Number(draft?.listing_id || draft?.results?.[0]?.listing_id);
    if (!listingId) throw new EtsyApiError("Etsy created the request but did not return a draft listing ID.", 502);

    let uploadedImages = 0;
    try {
      for (let index = 0; index < images.length; index += 1) {
        const image = await jpegListingImage(images[index], index);
        const upload = new FormData();
        upload.append("image", image, image.name);
        upload.append("rank", String(index + 1));
        await requestEtsy(`/application/shops/${session.shopId}/listings/${listingId}/images`, {
          accessToken: session.accessToken,
          method: "POST",
          body: upload,
        });
        uploadedImages += 1;
      }
    } catch (uploadError) {
      const partial = NextResponse.json({
        error: `Etsy draft ${listingId} was created, but only ${uploadedImages} of ${images.length} images uploaded: ${uploadError.message || "image upload failed"}`,
        listingId,
        uploadedImages,
        manageUrl: etsyDraftManageUrl(),
        partial: true,
      }, { status: 502 });
      return applyRefreshedEtsyCookie(partial, cookieValue);
    }

    const response = NextResponse.json({
      ok: true,
      listingId,
      state: draft.state || "draft",
      uploadedImages,
      shopName: session.shopName,
      manageUrl: etsyDraftManageUrl(),
    });
    return applyRefreshedEtsyCookie(response, cookieValue);
  } catch (error) {
    console.error("Etsy draft creation failed:", error);
    const response = NextResponse.json(
      { error: error instanceof Error ? error.message : "The Etsy draft could not be created." },
      { status: error?.status || 500 },
    );
    return applyRefreshedEtsyCookie(response, sessionResult?.cookieValue || "");
  }
}
