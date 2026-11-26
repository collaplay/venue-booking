import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 報價單工具的原始檔由 route handler 用 fs 讀取，部署時要一起打包
  outputFileTracingIncludes: { "/dashboard/quote": ["./quote-tool/*"] },
  // 前台（首頁、活動行事曆、活動頁、會員頁、註冊）目前不使用，一律導到後台；要恢復前台時拿掉這段即可。
  // 保留：/login、/profile（改密碼與登出）、/api/*（含錄音室線上預約）
  async redirects() {
    const to = (source: string, destination = "/dashboard") => ({ source, destination, permanent: false });
    return [to("/"), to("/calendar"), to("/event/:path*"), to("/user/:path*"), to("/register", "/login")];
  },
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
