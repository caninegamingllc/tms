/** @type {import('next').NextConfig} */
const nextConfig = {
  // Match lib/document-storage MAX_FILE_SIZE (25 MB), with headroom for multipart overhead.
  experimental: {
    serverActions: {
      bodySizeLimit: "26mb"
    }
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()"
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
