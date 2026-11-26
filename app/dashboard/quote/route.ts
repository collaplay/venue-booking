// 報價單工具（/dashboard/quote）
// 送出 quote-tool/ 裡的純網頁報價工具，加上管理員登入檢查。
// 改價格／條款 → quote-tool/config.js；改計價 → quote-tool/pricing.js（改完跑 node quote-tool/test.js）
// 匯款帳號不進 repo（repo 是公開的），由環境變數 QUOTE_BANK_ACCOUNT 帶入。
//
// ?project=<id>（從專案頁「建立報價單」進來）：
// - 專案是正本：客戶、檔期、場地費、長期合作折扣每次都從專案重新帶入，報價單上鎖住
// - 報價單自己的內容（加購、付款條件、Email、地址、語言）存在 project_quote_draft，每個專案一份
// - 儲存時可把加購合計寫回專案的餐飲費

import { readFileSync } from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildLoginUrlWithNext } from "@/lib/utils/login-next";
import { projectToQuote } from "@/lib/quote/prefill";
import { computeProjectRentalPendingAmount } from "@/lib/utils/project-rental-pending";
import {
  ADMIN_PROJECTS_ANY_WINDOW_CACHE_TAG,
  ADMIN_PROJECTS_LIST_CACHE_TAG,
  projectDetailTag,
} from "@/lib/services/project/project.service";

const read = (name: string) =>
  readFileSync(path.join(process.cwd(), "quote-tool", name), "utf8");

// 轉成可安全放進 <script> 的 JSON（專案欄位是使用者輸入，< 要跳脫以免提早結束 script）
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
const escHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// 回傳登入中的管理員；沒登入回傳 null，不是管理員回傳 undefined
async function getAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true, name: true },
  });
  return user?.isAdmin ? user : undefined;
}

// 專案目前的餐飲費合計（待定的不算）
const fnbTotal = (rentals: { fnbAmount: number; fnbAmountPending: boolean }[]) =>
  rentals.reduce((t, r) => t + (r.fnbAmountPending ? 0 : r.fnbAmount), 0);

// 報價單加購合計（數量 × 單價），非數字當 0
const addonsTotal = (q: Record<string, unknown>) =>
  (Array.isArray(q.addons) ? q.addons : []).reduce(
    (t: number, a) => t + Math.max(0, Math.round((Number(a?.qty) || 0) * (Number(a?.unit) || 0))),
    0,
  );

export async function GET(request: Request) {
  const { pathname, search, searchParams } = new URL(request.url);
  const admin = await getAdmin();
  if (admin === null) redirect(buildLoginUrlWithNext(pathname + search));
  if (!admin) redirect("/profile");

  const config = read("config.js").replace(
    "__QUOTE_BANK_ACCOUNT__",
    () => process.env.QUOTE_BANK_ACCOUNT ?? "",
  );

  const projectId = searchParams.get("project");
  // 空白報價單（從側邊選單進來）：提醒不會存進系統
  let projectScript = "", notice = `<span id="save-status">這是空白報價單，內容不會存進系統；已經有專案的話，請從專案頁開啟報價單，客戶與檔期會自動帶入。</span>`;
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { rentals: true },
    });
    if (!project) return new Response("找不到這個專案", { status: 404 });
    // 草稿表還沒建（migration 未套用）時當作沒存過，頁面照常可用
    const draft = await prisma.projectQuoteDraft.findUnique({ where: { projectId } }).catch(() => null);
    const saved = (draft?.data && typeof draft.data === "object" && !Array.isArray(draft.data) ? draft.data : {}) as Record<string, unknown>;
    const fromProject = projectToQuote(project);
    // 先放存過的內容，再用專案資料蓋上去；client 逐欄合併，保留報價單上填的 Email、地址
    const state = {
      ...saved,
      ...fromProject,
      // 報價日期每次開啟都帶今天（台北時間）：重發報價時用新日期
      date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date()),
      projectFnb: fnbTotal(project.rentals), // 專案目前的餐飲費，報價單上用來提示是否與加購一致
      client: { ...(saved.client as object | undefined), ...fromProject.client },
    };
    const self = `/dashboard/quote?project=${encodeURIComponent(projectId)}`;
    // Q、renderEditor、totals、money 定義在 index.html 的主 script，這段接在它後面執行
    projectScript = `<script>{const p=${safeJson(state)};Object.assign(Q,p,{client:{...Q.client,...p.client}});renderEditor();}
// 加購合計與專案餐飲費不一致時，用頁面內的視窗問要怎麼處理；回傳 'sync'｜'keep'｜'cancel'
function askFnb(addons){return new Promise(res=>{const d=document.getElementById('fnb-dlg');
  d.querySelector('p').innerHTML='專案的餐飲費目前是 <b>'+money(Q.projectFnb||0)+'</b>，<br>報價單的加購合計（餐飲、設備等）是 <b>'+money(addons)+'</b>。';
  d.querySelector('[value=sync]').textContent='把專案的餐飲費更新為 '+money(addons);
  // 直接聽按鈕與 Esc，不依賴 dialog 的 close 事件（重複開啟時該事件不一定會送達）
  d.querySelectorAll('button').forEach(b=>b.onclick=e=>{e.preventDefault();d.close();res(b.value);});
  d.oncancel=()=>res('cancel');d.showModal();});}
async function saveToProject(){const el=document.getElementById('save-status');
  const addons=totals(Q,CONFIG).addons;
  const pair=addons+'/'+(Q.projectFnb||0);
  const choice=addons!==(Q.projectFnb||0)&&Q.fnbKept!==pair?await askFnb(addons):'keep';
  if(choice==='keep')Q.fnbKept=pair;
  if(choice==='cancel')return false;
  const sync=choice==='sync';
  el.className='';el.textContent='儲存中…';
  try{const r=await fetch(${safeJson(self)}+(sync?'&syncFnb=1':''),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Q)});
    if(!r.ok)throw 0;window.quoteDirty=false;if(sync){Q.projectFnb=addons;renderPreview();}
    el.className='ok';el.textContent='✓ 已儲存（'+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})+'）'+(sync?'，專案的餐飲費已更新為 '+money(addons):'')+'。其他同事從這個專案點進來會看到這份';return true;}
  catch{el.className='err';el.textContent='✕ 儲存失敗，請再試一次';return false;}}
// 列印前有未儲存的修改就先存一次，確保印出去的內容等於系統裡存的；取消或儲存失敗就不印
const printNow=printPdf;printPdf=async()=>{if(window.quoteDirty&&!(await saveToProject()))return;printNow();};
// 儲存後又改了內容：把「已儲存」換成「有未儲存的修改」，避免誤以為已經存好（每次畫面更新時檢查）
const drawPreview=renderPreview;renderPreview=()=>{drawPreview();if(window.quoteDirty){const el=document.getElementById('save-status');el.className='warn';el.textContent='● 有未儲存的修改，記得按「儲存到專案」';}};
// 有未儲存的修改時，離開或重新整理前請瀏覽器提醒
window.addEventListener('beforeunload',e=>{if(window.quoteDirty)e.preventDefault();});</script>`;
    const when = draft?.updatedAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    notice = `<span id="save-status">專案「${escHtml(project.eventOrVenueUse)}」：場地與金額來自專案` +
      (draft ? `；加購與付款條件是${draft.updatedBy ? ` ${escHtml(draft.updatedBy)} ` : ""}${when} 存的版本` : "；加購與付款條件填好後請儲存") +
      `</span><button onclick="saveToProject()">儲存到專案</button><button class="alt" onclick="printPdf()">列印／存 PDF</button>` +
      `<dialog id="fnb-dlg"><form method="dialog"><h4>餐飲費與專案不一致</h4><p></p>` +
      `<button value="sync"></button><button value="keep" class="alt">只儲存報價單，不動專案的金額</button><button value="cancel" class="alt">取消</button></form></dialog>`;
  }

  // 用函式當 replacement，避免檔案內容裡的 $ 被當成特殊符號
  const html = read("index.html")
    .replace('<script src="config.js"></script>', () => `<script>${config}</script>`)
    .replace('<script src="pricing.js"></script>', () => `<script>${read("pricing.js")}</script>`)
    .replace("const LOGO = 'logo.png';", () => `const LOGO = 'data:image/png;base64,${readFileSync(path.join(process.cwd(), "quote-tool", "logo.png")).toString("base64")}';`)
    .replace('<div id="editor"></div>', (m) => `<div class="back"><a href="${projectId ? `/dashboard/projects/${encodeURIComponent(projectId)}` : "/dashboard"}">← ${projectId ? "回專案" : "回後台"}</a>${notice}</div>${m}`)
    .replace("</body>", () => `${projectScript}</body>`)
    // 頂部工具列：固定在最上方，左邊返回、中間狀態、右邊儲存；只在螢幕上顯示，列印時隱藏
    .replace("</style>", () => `.back{position:fixed;top:0;left:0;right:0;z-index:10;height:48px;padding:0 24px;display:flex;align-items:center;gap:16px;background:#fff;border-bottom:1px solid var(--line);font-size:13px;color:var(--muted)}.back a{color:var(--ink);text-decoration:none;white-space:nowrap}.back #save-status{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.back button{background:var(--accent);white-space:nowrap}.back #save-status.ok{color:#1a7f37;font-weight:700}.back #save-status.err{color:#a33;font-weight:700}.back #save-status.warn{color:#b26a00;font-weight:700}.back button.alt{background:#fff;color:var(--ink);border:1px solid var(--line)}#fnb-dlg{border:0;border-radius:12px;padding:24px;max-width:420px;font-size:14px;color:var(--ink);box-shadow:0 8px 40px rgba(0,0,0,.25)}#fnb-dlg::backdrop{background:rgba(0,0,0,.4)}#fnb-dlg h4{margin:0 0 8px;font-size:16px;color:#a33}#fnb-dlg p{margin:0 0 16px;line-height:1.8}#fnb-dlg button{display:block;width:100%;margin-top:8px;padding:10px;white-space:normal}#fnb-dlg button.alt{background:#fff;color:var(--ink);border:1px solid var(--line)}#fnb-note.warn{background:#fdecea;border-left:4px solid #a33;color:#a33;padding:10px 12px;border-radius:4px;font-size:13px;font-weight:700}@media screen{body{padding-top:72px}#editor{top:72px;max-height:calc(100vh - 96px)}}@media screen and (max-width:1100px){body{padding-top:64px}}@media print{.back{display:none}}</style>`);

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}

// 儲存報價單到專案（每個專案只留最新一份）；?syncFnb=1 時同時把加購合計寫回專案的餐飲費
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
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { rentals: true } });
  if (!project) return new Response("找不到這個專案", { status: 404 });

  // ponytail: 報價工具有些欄位直接當 HTML 印出，存下來的內容會給其他同事開，所以存檔時把所有 < 換成全形，擋掉夾帶的標籤；
  // 若日後報價內容真的需要半形 <，改成在 index.html 逐欄位 esc()
  const clean = JSON.parse(JSON.stringify(data).replace(/</g, "＜"));

  await prisma.$transaction(async (tx) => {
    await tx.projectQuoteDraft.upsert({
      where: { projectId },
      create: { projectId, data: clean, updatedBy: admin.name },
      update: { data: clean, updatedBy: admin.name },
    });
    if (url.searchParams.get("syncFnb")) {
      // 加購在報價單上是整張單一筆、不分天：記在最早的檔期，其餘檔期歸零，專案合計才會等於報價單
      const total = addonsTotal(clean);
      const rentals = [...project.rentals].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
      for (const [i, r] of rentals.entries()) {
        const fnbAmount = i === 0 ? total : 0;
        await tx.projectRental.update({
          where: { id: r.id },
          data: {
            fnbAmount,
            fnbAmountPending: false,
            pendingAmount: computeProjectRentalPendingAmount({ rentalAmount: r.rentalAmount, fnbAmount, paidAmount: r.paidAmount }),
          },
        });
      }
    }
  });

  if (url.searchParams.get("syncFnb")) {
    revalidatePath("/dashboard/projects");
    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidateTag(ADMIN_PROJECTS_LIST_CACHE_TAG, "max");
    revalidateTag(ADMIN_PROJECTS_ANY_WINDOW_CACHE_TAG, "max");
    revalidateTag(projectDetailTag(projectId), "max");
  }
  return Response.json({ ok: true });
}
