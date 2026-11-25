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
import { getSpaceNameById } from "@/lib/config/config";
import { projectToQuote } from "@/lib/quote/prefill";

const read = (name: string) =>
  readFileSync(path.join(process.cwd(), "quote-tool", name), "utf8");

// 轉成可安全放進 <script> 的 JSON（專案欄位是使用者輸入，< 要跳脫以免提早結束 script）
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
const escHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// 回傳登入中的管理員；不是管理員回傳 null
async function getAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true, name: true },
  });
  return user?.isAdmin ? user : undefined;
}

export async function GET(request: Request) {
  const { pathname, search, searchParams } = new URL(request.url);
  const admin = await getAdmin();
  if (admin === null) redirect(buildLoginUrlWithNext(pathname + search));
  if (!admin) redirect("/");

  const config = read("config.js").replace(
    "__QUOTE_BANK_ACCOUNT__",
    () => process.env.QUOTE_BANK_ACCOUNT ?? "",
  );
  // ?project=<id>：從專案頁「建立報價單」進來，帶入客戶與檔期
  const projectId = searchParams.get("project");
  let prefillScript = "", notice = "";
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { rentals: true },
    });
    if (!project) return new Response("找不到這個專案", { status: 404 });
    // 有存過草稿就載入草稿；?fresh=1 或沒存過 → 從專案資料帶入
    // 草稿表還沒建（migration 未套用）時當作沒有草稿，頁面照常可用
    const draft = searchParams.get("fresh")
      ? null
      : await prisma.projectQuoteDraft.findUnique({ where: { projectId } }).catch(() => null);
    const { prefill, skipped } = projectToQuote(project);
    const self = `/dashboard/quote?project=${encodeURIComponent(projectId)}`;
    // Q 與 renderEditor 定義在 index.html 的主 script，這段接在它後面執行
    prefillScript = `<script>{const p=${safeJson(draft ? draft.data : prefill)};Object.assign(Q,p,{client:{...Q.client,...p.client}});renderEditor();}
async function saveToProject(){const el=document.getElementById('save-status');el.textContent='儲存中…';
  try{const r=await fetch(${safeJson(self)},{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Q)});
    if(!r.ok)throw 0;el.textContent='已儲存到專案（'+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})+'），其他同事從這個專案點進來會看到這份';}
  catch{el.textContent='儲存失敗，請再試一次；急用可先按「儲存草稿」下載到電腦';}}</script>`;
    const when = draft?.updatedAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    notice = `　<button onclick="saveToProject()">儲存到專案</button>　<span id="save-status">` +
      (draft
        ? `已載入${draft.updatedBy ? ` ${escHtml(draft.updatedBy)} ` : ""}${when} 存的報價單。<a href="${self}&fresh=1" style="text-decoration:underline">改從專案資料重新帶入</a>`
        : `已帶入專案「${escHtml(project.eventOrVenueUse)}」的客戶與檔期，方案與金額請確認` +
          (skipped.length ? `；未帶入：${escHtml(skipped.map(getSpaceNameById).join("、"))}（報價工具沒有這個空間）` : "")) +
      `</span>`;
  }

  // 用函式當 replacement，避免檔案內容裡的 $ 被當成特殊符號
  const html = read("index.html")
    .replace('<script src="config.js"></script>', () => `<script>${config}</script>`)
    .replace('<script src="pricing.js"></script>', () => `<script>${read("pricing.js")}</script>`)
    .replace('<div id="editor"></div>', (m) => `<div class="back"><a href="${projectId ? `/dashboard/projects/${encodeURIComponent(projectId)}` : "/dashboard"}">← ${projectId ? "回專案" : "回後台"}</a>${notice}</div>${m}`)
    .replace("</body>", () => `${prefillScript}</body>`)
    .replace("</style>", () => `.back{position:absolute;top:0;left:24px;right:24px;font-size:12px;color:#777;line-height:24px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.back button{padding:1px 10px;font-size:12px}.back a{color:inherit;text-decoration:none}@media print{.back{display:none}}</style>`);

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}

// 儲存報價單草稿到專案（每個專案只留最新一份）
export async function POST(request: Request) {
  const url = new URL(request.url);
  const admin = await getAdmin();
  if (!admin) return new Response("未授權", { status: 401 });
  // 只接受本站頁面送出的請求
  if (request.headers.get("origin") !== url.origin) return new Response("來源不符", { status: 403 });

  const projectId = url.searchParams.get("project");
  const text = await request.text();
  if (!projectId || text.length > 200_000) return new Response("資料不正確", { status: 400 });
  let data: unknown;
  try { data = JSON.parse(text); } catch { return new Response("資料不正確", { status: 400 }); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return new Response("資料不正確", { status: 400 });
  if (!(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })))
    return new Response("找不到這個專案", { status: 404 });

  // ponytail: 報價工具有些欄位直接當 HTML 印出，草稿會給其他同事開，所以存檔時把所有 < 換成全形，擋掉夾帶的標籤；
  // 若日後報價內容真的需要半形 <，改成在 index.html 逐欄位 esc()
  const clean = JSON.parse(JSON.stringify(data).replace(/</g, "＜"));
  await prisma.projectQuoteDraft.upsert({
    where: { projectId },
    create: { projectId, data: clean, updatedBy: admin.name },
    update: { data: clean, updatedBy: admin.name },
  });
  return Response.json({ ok: true });
}
