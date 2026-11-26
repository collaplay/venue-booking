// 把場租系統的專案轉成報價單工具（quote-tool/index.html）的資料。
// 專案是正本：客戶、檔期（空間／日期／時間）、場地費、長期合作折扣都從專案來，報價單上鎖住不能改。
// 報價單自己只管專案沒有的東西：加購明細、付款條件、Email、地址、語言。

import CONFIG from "@/quote-tool/config.js";
import { getSpaceNameById } from "@/lib/config/config";
import { SPACE_MAP } from "./standard-price";

export interface QuoteSourceProject {
  customerName: string;
  customerPhone: string;
  company: string | null;
  taxId: string | null;
  eventOrVenueUse: string;
  discountPercent?: number | null;
  rentals: {
    date: string;
    endDate: string | null;
    startTime: string;
    endTime: string;
    spaceIds: string[];
    rentalAmount: number;
    pricePlan?: string;
    isHoliday?: boolean;
    priceNote?: string | null;
  }[];
}

// 報價工具價目表裡沒有、但專案可能選到的空間：英文版報價單用的名稱
const EXTRA_EN: Record<string, string> = {
  "4f-product-photo": "4F Photo Studio",
  "3f-focus-area": "3F Focus Area",
};

export function projectToQuote(p: QuoteSourceProject) {
  const d = p.discountPercent && p.discountPercent >= 1 && p.discountPercent <= 99 ? p.discountPercent : null;

  // 一個檔期印成一列（多個空間用＋串起來）；客人要看各空間分開的金額時，在專案把檔期拆開
  const lines = [...p.rentals]
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .map((r) => {
      const zh: string[] = [], en: string[] = [];
      for (const id of r.spaceIds) {
        const s = CONFIG.spaces.find((x) => x.id === SPACE_MAP[id]);
        const nameZh = s?.zh ?? getSpaceNameById(id);
        if (zh.includes(nameZh)) continue; // 舊的教室 1、2 是同一間
        zh.push(nameZh);
        en.push(s?.en ?? EXTRA_EN[id] ?? nameZh);
      }
      return {
        locked: true,
        label: { zh: zh.join("＋"), en: en.join(" + ") },
        space: SPACE_MAP[r.spaceIds[0]] ?? CONFIG.spaces[0].id, // 鎖定列不靠它計價，只為相容報價工具的資料格式
        plan: r.pricePlan === "B" ? "B" : "A",
        date: r.date,
        endDate: r.endDate && r.endDate > r.date ? r.endDate : "",
        start: r.startTime,
        end: r.endTime,
        holiday: !!r.isHoliday,
        override: String(r.rentalAmount), // 專案的場地費就是折後實收，報價單直接照列
        reason: r.priceNote ?? "",
      };
    });

  return {
    fromProject: true,
    event: p.eventOrVenueUse,
    // Email、地址專案沒有，不放進來，才不會蓋掉報價單上自己填的
    client: { name: p.company || p.customerName, taxId: p.taxId ?? "", contact: p.customerName, phone: p.customerPhone },
    lines,
    discount: 100, // 折扣已含在各列金額裡，報價工具不再另外打折
    discountNote: d, // 只給編輯區顯示「已含 85 折」
  };
}
