import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 報價單工具的原始檔由 route handler 用 fs 讀取，部署時要一起打包
  outputFileTracingIncludes: { "/dashboard/quote": ["./quote-tool/*"] },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
