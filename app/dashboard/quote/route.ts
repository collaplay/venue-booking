// 報價單工具（/dashboard/quote）
// 直接送出 quote-tool/ 裡 Raymond 寫的純網頁工具，只加上管理員登入檢查。
// 改價格／條款 → quote-tool/config.js；改計價 → quote-tool/pricing.js（改完跑 node quote-tool/test.js）
// 匯款帳號不進 repo（repo 是公開的），由環境變數 QUOTE_BANK_ACCOUNT 帶入。

import { readFileSync } from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildLoginUrlWithNext } from "@/lib/utils/login-next";

const read = (name: string) =>
  readFileSync(path.join(process.cwd(), "quote-tool", name), "utf8");

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(buildLoginUrlWithNext("/dashboard/quote"));
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) redirect("/");

  const config = read("config.js").replace(
    "__QUOTE_BANK_ACCOUNT__",
    () => process.env.QUOTE_BANK_ACCOUNT ?? "",
  );
  // 用函式當 replacement，避免檔案內容裡的 $ 被當成特殊符號
  const html = read("index.html")
    .replace('<script src="config.js"></script>', () => `<script>${config}</script>`)
    .replace('<script src="pricing.js"></script>', () => `<script>${read("pricing.js")}</script>`)
    .replace('<div id="editor"></div>', (m) => `<a href="/dashboard" class="back">← 回後台</a>${m}`)
    .replace("</style>", () => `.back{position:fixed;top:4px;left:24px;font-size:12px;color:#777;text-decoration:none}@media print{.back{display:none}}</style>`);

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}
