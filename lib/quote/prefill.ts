// 把場租系統的專案轉成報價單工具（quote-tool/index.html）的初始資料。
// 只帶入不用重打的資訊：客戶、活動名稱、每個檔期的場地／日期／時間。金額與方案仍由同事在報價單上決定。

// 場租系統場域 id → quote-tool/config.js 的 spaces id
const SPACE_MAP: Record<string, string> = {
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

export interface QuoteSourceProject {
  customerName: string;
  customerPhone: string;
  company: string | null;
  taxId: string | null;
  eventOrVenueUse: string;
  rentals: {
    date: string;
    endDate: string | null;
    startTime: string;
    endTime: string;
    spaceIds: string[];
  }[];
}

// ponytail: 跨日檔期每天各開一列、沿用同樣起訖時間；上限 31 天，超過的請手動調整
function eachDay(start: string, end: string | null): string[] {
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

export function projectToQuote(p: QuoteSourceProject) {
  const skipped = new Set<string>();
  const lines = [...p.rentals]
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .flatMap((r) =>
      eachDay(r.date, r.endDate).flatMap((date) =>
        [...new Set(r.spaceIds.map((id) => SPACE_MAP[id] ?? (skipped.add(id), "")))]
          .filter(Boolean)
          .map((space) => ({
            space, plan: "A", date, start: r.startTime, end: r.endTime,
            holiday: false, override: "", reason: "",
          })),
      ),
    );
  return {
    prefill: {
      event: p.eventOrVenueUse,
      client: {
        name: p.company || p.customerName,
        taxId: p.taxId ?? "",
        contact: p.customerName,
        phone: p.customerPhone,
        email: "",
        address: "",
      },
      ...(lines.length ? { lines } : {}), // 沒有可帶入的檔期就保留工具預設的空白列
    },
    skipped: [...skipped], // 報價工具沒有對應空間的場域 id
  };
}
