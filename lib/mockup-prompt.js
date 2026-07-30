export const BASE_MOCKUP_INSTRUCTION = `Create a premium, photorealistic product mockup for an Etsy listing using the uploaded artwork as the hero product. Preserve the uploaded artwork exactly: do not redraw it, crop it, change its colors, alter its text, or add elements inside it. Place it naturally in a believable frame or product setting with correct perspective, reflections, material texture, lighting, and shadows. Keep the scene commercially useful, tasteful, uncluttered, and free of logos, watermarks, captions, interface elements, or unrelated text. The finished image must look like a professional product photograph and the artwork must be fully legible.`;

export function makeMockupPrompt(scenePrompt, frameInstruction) {
  const frameDirection = `Frame direction: ${frameInstruction} Do not vary the frame material, color, profile, or mat between images in this batch.`;
  if (!scenePrompt) {
    return `${BASE_MOCKUP_INSTRUCTION}\n\n${frameDirection}\n\nChoose the setting, styling, and camera angle yourself. Prioritize broad Etsy customer appeal.`;
  }

  return `${BASE_MOCKUP_INSTRUCTION}\n\n${frameDirection}\n\nMockup direction: ${scenePrompt}`;
}
