function validHttpOrigin(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.origin : "";
  } catch {
    return "";
  }
}

export function getPublicOrigin(request, configuredUrl = "") {
  const configuredOrigin = validHttpOrigin(configuredUrl);
  if (configuredOrigin) return configuredOrigin;

  return "http://localhost:3000";
}

export function getPublicUrl(request, pathname, configuredUrl = "") {
  return new URL(pathname, getPublicOrigin(request, configuredUrl));
}
