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
  MAX_ETSY_TOTAL_IMAGE_BYTES,
  normalizeEtsyListing,
} from "../../../../lib/etsy-listing";

export const runtime = "nodejs";
export const maxDuration = 180;
const MAX_ETSY_REQUEST_BYTES = 220 * 1024 * 1024;

function safeStatus(value, fallback = 500) {
  const status = Number(value);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : fallback;
}

function errorResponse(message, {
  status = 500,
  code = "ETSY_DRAFT_FAILED",
  stage = "server",
  retryable = false,
  cookieValue = "",
  ...details
} = {}) {
  const response = NextResponse.json({
    ok: false,
    error: message,
    message,
    code,
    stage,
    retryable,
    ...details,
  }, { status: safeStatus(status) });
  return applyRefreshedEtsyCookie(response, cookieValue);
}

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
    try {
      sessionResult = await readEtsySession(request);
    } catch (sessionError) {
      console.error("Etsy session could not be read:", sessionError);
      return errorResponse(
        sessionError?.status === 401
          ? "Your Etsy connection has expired. Reconnect Etsy in Settings, then return to Final Review."
          : sessionError?.message || "Mocksy could not verify the Etsy connection.",
        {
          status: sessionError?.status || 500,
          code: sessionError?.status === 401 ? "ETSY_RECONNECT_REQUIRED" : "ETSY_SESSION_FAILED",
          stage: "authentication",
          retryable: sessionError?.status >= 500,
        },
      );
    }
    if (!sessionResult.session) {
      return errorResponse("Connect Etsy in Settings before creating a draft.", {
        status: 401,
        code: "ETSY_NOT_CONNECTED",
        stage: "authentication",
      });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!/^multipart\/form-data(?:;|$)/i.test(contentType) || !/boundary=/i.test(contentType)) {
      return errorResponse("The listing upload must be sent as multipart form data.", {
        status: 415,
        code: "INVALID_UPLOAD_CONTENT_TYPE",
        stage: "parsing",
        cookieValue: sessionResult.cookieValue,
      });
    }

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_ETSY_REQUEST_BYTES) {
      return errorResponse("The listing upload exceeds Mocksy’s 220 MB request limit. Choose fewer or smaller images.", {
        status: 413,
        code: "UPLOAD_REQUEST_TOO_LARGE",
        stage: "validation",
        cookieValue: sessionResult.cookieValue,
      });
    }

    let formData;
    try {
      formData = await request.formData();
    } catch (parseError) {
      console.warn("Etsy draft form data could not be parsed:", parseError);
      return errorResponse(
        "Mocksy could not read the listing upload. The request was incomplete or exceeded the server upload limit. Reload Final Review and try again with fewer or smaller images.",
        {
          status: 400,
          code: "FORM_DATA_PARSE_FAILED",
          stage: "parsing",
          retryable: true,
          cookieValue: sessionResult.cookieValue,
        },
      );
    }

    let rawListing;
    try {
      rawListing = JSON.parse(String(formData.get("listing") || ""));
    } catch {
      return errorResponse("The listing details were incomplete or invalid. Reload Final Review and try again.", {
        status: 400,
        code: "INVALID_LISTING_PAYLOAD",
        stage: "parsing",
        retryable: true,
        cookieValue: sessionResult.cookieValue,
      });
    }

    let listing;
    try {
      listing = normalizeEtsyListing(rawListing);
    } catch (validationError) {
      return errorResponse(validationError.message || "Review the listing details and try again.", {
        status: 400,
        code: "LISTING_VALIDATION_FAILED",
        stage: "validation",
        cookieValue: sessionResult.cookieValue,
      });
    }

    const images = formData.getAll("images").filter((image) => image instanceof File && image.size);
    if (!images.length) {
      return errorResponse("Choose at least one listing image.", {
        status: 400,
        code: "LISTING_IMAGES_REQUIRED",
        stage: "validation",
        cookieValue: sessionResult.cookieValue,
      });
    }
    if (images.length > MAX_ETSY_LISTING_IMAGES) {
      return errorResponse(`Choose no more than ${MAX_ETSY_LISTING_IMAGES} listing images.`, {
        status: 400,
        code: "TOO_MANY_LISTING_IMAGES",
        stage: "validation",
        cookieValue: sessionResult.cookieValue,
      });
    }
    try {
      images.forEach(validateListingImage);
    } catch (imageError) {
      return errorResponse(imageError.message || "One of the selected listing images is invalid.", {
        status: 400,
        code: "LISTING_IMAGE_VALIDATION_FAILED",
        stage: "validation",
        cookieValue: sessionResult.cookieValue,
      });
    }
    const totalImageBytes = images.reduce((total, image) => total + image.size, 0);
    if (totalImageBytes > MAX_ETSY_TOTAL_IMAGE_BYTES) {
      return errorResponse("The selected listing images exceed Mocksy’s 200 MB upload limit. Choose fewer or smaller images.", {
        status: 413,
        code: "LISTING_IMAGES_TOO_LARGE",
        stage: "validation",
        cookieValue: sessionResult.cookieValue,
      });
    }

    const { session, cookieValue } = sessionResult;
    let draft;
    try {
      draft = await requestEtsy(`/application/shops/${session.shopId}/listings`, {
        accessToken: session.accessToken,
        method: "POST",
        body: etsyDraftParameters(listing),
      });
    } catch (draftError) {
      console.error("Etsy draft request failed:", draftError);
      const authorizationFailed = [401, 403].includes(Number(draftError?.status));
      return errorResponse(
        authorizationFailed
          ? "Etsy rejected the shop authorization. Reconnect Etsy in Settings, then return to Final Review."
          : draftError?.message || "Etsy did not confirm that the draft was created.",
        {
          status: draftError?.status || 502,
          code: authorizationFailed ? "ETSY_RECONNECT_REQUIRED" : "ETSY_DRAFT_CREATE_FAILED",
          stage: "draft",
          retryable: false,
          safeToRetry: false,
          checkDraftsFirst: !authorizationFailed,
          cookieValue,
        },
      );
    }
    const listingId = Number(draft?.listing_id || draft?.results?.[0]?.listing_id);
    if (!listingId) {
      return errorResponse("Etsy accepted the request but did not return a draft listing ID. Check Etsy drafts before trying again.", {
        status: 502,
        code: "ETSY_DRAFT_ID_MISSING",
        stage: "draft",
        retryable: false,
        safeToRetry: false,
        checkDraftsFirst: true,
        manageUrl: etsyDraftManageUrl(),
        cookieValue,
      });
    }

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
      console.error(`Etsy draft ${listingId} image upload failed:`, uploadError);
      const message = `Etsy draft ${listingId} was created, but only ${uploadedImages} of ${images.length} images uploaded: ${uploadError.message || "image upload failed"}`;
      return errorResponse(message, {
        status: 502,
        code: "ETSY_IMAGE_UPLOAD_PARTIAL",
        stage: "images",
        retryable: false,
        safeToRetry: false,
        partial: true,
        listingId,
        uploadedImages,
        totalImages: images.length,
        manageUrl: etsyDraftManageUrl(),
        cookieValue,
      });
    }

    const response = NextResponse.json({
      ok: true,
      partial: false,
      code: "ETSY_DRAFT_CREATED",
      stage: "complete",
      message: `Etsy draft ${listingId} was created with ${uploadedImages} photos.`,
      listingId,
      state: draft.state || "draft",
      uploadedImages,
      shopName: session.shopName,
      manageUrl: etsyDraftManageUrl(),
    });
    return applyRefreshedEtsyCookie(response, cookieValue);
  } catch (error) {
    console.error("Etsy draft creation failed:", error);
    return errorResponse(
      error instanceof EtsyApiError
        ? error.message
        : "An unexpected server error stopped the Etsy draft. Check Etsy drafts before trying again.",
      {
        status: error?.status || 500,
        code: "ETSY_DRAFT_UNEXPECTED_ERROR",
        stage: "server",
        retryable: false,
        safeToRetry: false,
        checkDraftsFirst: true,
        manageUrl: etsyDraftManageUrl(),
        cookieValue: sessionResult?.cookieValue || "",
      },
    );
  }
}
