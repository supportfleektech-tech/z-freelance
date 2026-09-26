/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle so the Docker image can run without dev deps.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Native/WASM-backed drivers must not be processed by webpack's bundler.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  eslint: {
    // Linting is enforced by `npm run lint` in CI; don't couple it to `next build`.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
