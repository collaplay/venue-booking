// 專案檔期的標準價：直接用報價工具的價目表與計價規則（quote-tool/），兩邊永遠同一套數字。
import CONFIG from "@/quote-tool/config.js";
import { standardPrice } from "@/quote-tool/pricing.js";

// 場租系統場域 id → quote-tool/config.js 的 spaces id（沒列在這裡的空間，報價工具沒有價目）
export const SPACE_MAP: Record<string, string> = {
  "5f-exhibition-hall": "event",
  "4f-multipurpose-room": "workshop",
  "4f-multipurpose-room-1": "workshop",
  "4f-multipurpose-room-2": "workshop",
  "4f-tik-&-sip": "bar",
  "4f-event-lounge": "lounge",
  "4f-podcast-studio": "podcast",
  "4f-screening-room": "media",
  "3f-community-cafe": "cafe",
};

// ponytail: 跨日檔期每天各算一次、沿用同樣起訖時間；上限 31 天
export function eachDay(start: string, end: string | null): string[] {
  const days = [start];
  if (!end || end <= start) return days;
  const d = new Date(start + "T00:00:00Z");
  while (days.length < 31) {
    d.setUTCDate(d.getUTCDate() + 1);
    const s = d.toISOString().slice(0, 10);
    if (s > end) break;
    days.push(s);
  }
  return days;
}

export interface RentalForPricing {
  spaceIds: string[];
  date: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  pricePlan?: string;
  isHoliday?: boolean;
}

export interface RentalStandardPrice {
  /** 有標準價的空間加總（跨日＝每天各算一次） */
  amount: number;
  /** 計價明細（中文），一個空間一句 */
  details: string[];
  /** 沒有標準價的場域 id（報價工具標為手動報價，或沒有這個空間） */
  noPrice: string[];
}

export function rentalStandardPrice(r: RentalForPricing): RentalStandardPrice | null {
  if (!r.spaceIds?.length || !r.date || !r.startTime || !r.endTime) return null;
  const days = eachDay(r.date, r.endDate?.trim() || null);
  const out: RentalStandardPrice = { amount: 0, details: [], noPrice: [] };
  const seen = new Set<string>();
  for (const id of r.spaceIds) {
    const space = SPACE_MAP[id];
    if (space && seen.has(space)) continue; // 舊的教室 1、2 視為同一間
    if (space) seen.add(space);
    const prices = space
      ? days.map((date) =>
          standardPrice(
            { space, plan: r.pricePlan === "B" ? "B" : "A", date, start: r.startTime, end: r.endTime, holiday: !!r.isHoliday },
            CONFIG,
          ),
        )
      : [];
    if (!prices.length || prices.some((p) => !p)) {
      out.noPrice.push(id);
      continue;
    }
    out.amount += prices.reduce((t, p) => t + p!.amount, 0);
    out.details.push(prices[0]!.zh + (days.length > 1 ? `（共 ${days.length} 天）` : ""));
  }
  return out;
}

/** 套用長期合作折扣後的應收（85＝85 折）；沒有折扣回傳原價 */
export function applyDiscount(amount: number, discountPercent?: number | null): number {
  const d = Number(discountPercent);
  return d >= 1 && d <= 99 ? Math.round((amount * d) / 100) : amount;
}

export const PRICE_PLANS = [
  { value: "A", label: CONFIG.hall.plans.A.zh },
  { value: "B", label: CONFIG.hall.plans.B.zh },
];
