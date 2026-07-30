export const DEFAULT_FRAME_PROFILE = {
  label: "Slim medium walnut",
  instruction: "Use a slim medium walnut wood frame with a narrow warm-white mat consistently in every scene.",
  rationale: "A versatile warm neutral frame that works across most artwork and interiors.",
  source: "default",
};

function cleanString(value, maximumLength) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximumLength) : "";
}

export function normalizeFrameProfile(value) {
  if (!value || typeof value !== "object") return null;
  const label = cleanString(value.label, 70);
  const instruction = cleanString(value.instruction, 320)
    .replace(/\s*Use this exact frame treatment unchanged across the full batch\.?$/i, "");
  const rationale = cleanString(value.rationale, 180);
  const source = cleanString(value.source, 40) || "manual";
  const warning = cleanString(value.warning, 220);
  if (!label || !instruction) return null;
  return {
    label,
    instruction: `${instruction.replace(/[.]*$/, "")}. Use this exact frame treatment unchanged across the full batch.`,
    rationale,
    source,
    ...(warning ? { warning } : {}),
  };
}

export async function selectFrameForArtwork({ apiKey, artworkDataUrl }) {
  if (!apiKey) return DEFAULT_FRAME_PROFILE;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 220,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are an expert art framer and Etsy art director. Select one commercially appealing frame for the uploaded artwork. That exact frame will be reused across every mockup in the batch. Return JSON only.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Study the artwork's palette, contrast, style, and mood. Choose one frame that complements it without overpowering it. Prefer realistic, broadly available options such as slim natural oak, medium walnut, matte black metal, warm white wood, antique dark bronze, or muted antique gold. Specify material, color, profile, and whether to use a mat. Keep the frame slim or medium and suitable for premium Etsy wall-art photography. Return this shape: {"label":"short frame name","instruction":"Use a ... frame consistently in every scene.","rationale":"one short reason"}`,
              },
              { type: "image_url", image_url: { url: artworkDataUrl, detail: "low" } },
            ],
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `OpenAI returned ${response.status}`);
    const parsed = JSON.parse(payload?.choices?.[0]?.message?.content || "{}");
    const label = cleanString(parsed.label, 70);
    const instruction = cleanString(parsed.instruction, 260);
    const rationale = cleanString(parsed.rationale, 180);
    if (!label || !instruction) throw new Error("The frame response was incomplete.");

    return normalizeFrameProfile({
      label,
      instruction,
      rationale,
      source: "gpt-4o-mini",
    });
  } catch (error) {
    console.error("Smart frame selection failed:", error);
    return {
      ...DEFAULT_FRAME_PROFILE,
      warning: "Smart frame matching could not run, so the consistent walnut fallback was used.",
    };
  }
}
