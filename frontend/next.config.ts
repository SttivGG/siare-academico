import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: { cpus: 1 },
  async headers() {
    return [{ source: "/recuperar/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/login/mfa", headers: [{ key: "Cache-Control", value: "no-store" }] }];
  },
};

export default nextConfig;
