export const FEATURE_MODULES = Object.freeze([
  Object.freeze({
    id: "mockups",
    href: "/",
    label: "Mockup Studio",
    note: "AI scenes",
    icon: "images",
    input: "artwork",
    output: "mockups",
  }),
  Object.freeze({
    id: "dpi",
    href: "/dpi",
    label: "300 DPI",
    note: "Print ready",
    icon: "gauge",
    input: "artwork[]",
    output: "printReadyArtwork[]",
  }),
  Object.freeze({
    id: "seo",
    href: "/seo",
    label: "Etsy SEO",
    note: "Listing copy",
    icon: "search",
    input: "listingImage",
    output: "listingSeo",
  }),
]);

export const MAIN_WORKFLOW = Object.freeze({
  id: "listing-workflow",
  href: "/workflow",
  label: "Full listing flow",
  status: "active",
  steps: Object.freeze(["artwork", "dpi", "mockups", "seo", "review"]),
});

export function getFeature(id) {
  return FEATURE_MODULES.find((feature) => feature.id === id) || null;
}
