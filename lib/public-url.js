function firstHeaderValue(value) {
  return String(value || "").split(",", 1)[0].trim();
}

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

  const forwardedHost = firstHeaderValue(request?.headers?.get?.("x-forwarded-host"));
  const host = forwardedHost || firstHeaderValue(request?.headers?.get?.("host"));
  const forwardedProtocol = firstHeaderValue(request?.headers?.get?.("x-forwarded-proto"));
  const fallbackOrigin = request?.nextUrl?.origin || validHttpOrigin(request?.url);

  if (host) {
    const fallbackProtocol = (() => {
      try {
        return new URL(fallbackOrigin).protocol.replace(":", "");
      } catch {
        return "https";
      }
    })();
    const protocol = forwardedProtocol || fallbackProtocol;
    const forwardedOrigin = validHttpOrigin(`${protocol}://${host}`);
    if (forwardedOrigin) return forwardedOrigin;
  }

  return fallbackOrigin || "http://localhost:3000";
}

export function getPublicUrl(request, pathname, configuredUrl = "") {
  return new URL(pathname, getPublicOrigin(request, configuredUrl));
}
