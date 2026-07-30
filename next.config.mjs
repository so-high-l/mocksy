/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    // middleware.js must buffer and clone multipart requests before route handlers
    // receive them. Next 15 defaults this buffer to 10 MB, which truncates normal
    // multi-image Etsy uploads and makes request.formData() fail.
    middlewareClientMaxBodySize: "220mb",
  },
};

export default nextConfig;
