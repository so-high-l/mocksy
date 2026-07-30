export const MAX_ETSY_LISTING_IMAGES = 20;
export const MAX_ETSY_IMAGE_BYTES = 20 * 1024 * 1024;
export const ETSY_LISTING_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function text(value, maximumLength, preserveLines = false) {
  if (typeof value !== "string") return "";
  const cleaned = preserveLines
    ? value.trim().replace(/\r/g, "").replace(/\n{3,}/g, "\n\n")
    : value.trim().replace(/\s+/g, " ");
  return cleaned.slice(0, maximumLength);
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function normalizeEtsyListing(value) {
  const input = value && typeof value === "object" ? value : {};
  const title = text(input.title, 140);
  const description = text(input.description, 13000, true);
  const tags = (Array.isArray(input.tags) ? input.tags : [])
    .map((tag) => text(tag, 40).toLowerCase())
    .filter(Boolean);
  const price = Number(input.price);
  const taxonomyId = positiveInteger(input.taxonomyId);
  const shopSectionId = input.shopSectionId ? positiveInteger(input.shopSectionId) : 0;

  if (!title) throw new Error("Add a listing title.");
  if (title.length > 140) throw new Error("Keep the Etsy title at 140 characters or fewer.");
  if (!/^[\p{L}\p{Nd}\p{P}\p{Sm}\p{Zs}™©®]+$/u.test(title)) {
    throw new Error("The Etsy title contains an unsupported character, such as an emoji.");
  }
  const repeatedLimitedCharacter = ["%", ":", "&", "+"]
    .find((character) => title.split(character).length > 2);
  if (repeatedLimitedCharacter) {
    throw new Error(`Etsy allows “${repeatedLimitedCharacter}” only once in a listing title.`);
  }
  if (!description) throw new Error("Add a listing description.");
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) throw new Error("Enter a valid positive listing price.");
  if (!taxonomyId) throw new Error("Choose an Etsy category.");
  if (input.shopSectionId && !shopSectionId) throw new Error("Choose a valid shop section or leave it blank.");
  if (!tags.length) throw new Error("Add at least one Etsy tag.");
  if (tags.length > 13) throw new Error("Etsy allows up to 13 tags.");
  if (new Set(tags).size !== tags.length) throw new Error("Remove duplicate Etsy tags.");
  const longTag = tags.find((tag) => tag.length > 20);
  if (longTag) throw new Error(`Shorten “${longTag}” to 20 characters or fewer.`);
  const invalidTag = tags.find((tag) => !/^[\p{L}\p{Nd}\p{Zs}\-'™©®]+$/u.test(tag));
  if (invalidTag) throw new Error(`“${invalidTag}” contains a character Etsy does not allow in tags.`);

  return {
    title,
    description,
    tags,
    price: price.toFixed(2),
    taxonomyId,
    shopSectionId,
  };
}

export function etsyDraftParameters(listing) {
  const parameters = new URLSearchParams({
    quantity: "999",
    title: listing.title,
    description: listing.description,
    price: listing.price,
    who_made: "i_did",
    when_made: "2020_2026",
    taxonomy_id: String(listing.taxonomyId),
    tags: listing.tags.join(","),
    is_supply: "false",
    should_auto_renew: "true",
    type: "download",
  });
  if (listing.shopSectionId) parameters.set("shop_section_id", String(listing.shopSectionId));
  return parameters;
}
