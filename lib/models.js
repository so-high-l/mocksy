export const MODEL_OPTIONS = [
  {
    id: "gemini-3.1-flash-lite-image",
    name: "Nano Banana 2 Lite",
    shortName: "Lite",
    description: "Fastest and lowest-cost option for quick drafts.",
    speed: "Fastest",
    sizes: ["1K"],
    provider: "gemini",
    providerName: "Google Gemini",
    batch: true,
  },
  {
    id: "gemini-3-pro-image",
    name: "Nano Banana Pro",
    shortName: "Pro",
    description: "Highest quality and strongest instruction following.",
    speed: "Premium",
    sizes: ["1K", "2K", "4K"],
    provider: "gemini",
    providerName: "Google Gemini",
    batch: true,
  },
  {
    id: "gemini-3.1-flash-image",
    name: "Nano Banana 2",
    shortName: "Banana 2",
    description: "The best balance of quality, speed, and cost.",
    speed: "Balanced",
    sizes: ["1K", "2K", "4K"],
    provider: "gemini",
    providerName: "Google Gemini",
    batch: true,
  },
  {
    id: "flux-2-klein-9b",
    name: "FLUX.2 Klein 9B",
    shortName: "Klein",
    description: "Fast, affordable image editing with a pinned model for consistency.",
    speed: "Fast",
    sizes: ["1K", "2K"],
    provider: "bfl",
    providerName: "Black Forest Labs",
    batch: false,
  },
];

export const DEFAULT_MODEL_ID = "gemini-3.1-flash-lite-image";

export function getModel(modelId) {
  return MODEL_OPTIONS.find((model) => model.id === modelId)
    || MODEL_OPTIONS.find((model) => model.id === DEFAULT_MODEL_ID)
    || MODEL_OPTIONS[0];
}
