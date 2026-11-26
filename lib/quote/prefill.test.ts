// npx tsx lib/quote/prefill.test.ts —— 專案轉報價單、標準價的自我檢查
import assert from "assert";
import { projectToQuote } from "./prefill";
import { applyDiscount, rentalStandardPrice } from "./standard-price";

// 標準價：平日教室 A 方案 3 小時＝3,800；跨日每天各算；交誼廳沒有標準價
const classroom = { spaceIds: ["4f-multipurpose-room-1", "4f-multipurpose-room-2"], date: "2026-08-11", endDate: null, startTime: "13:00", endTime: "16:00" };
assert.strictEqual(rentalStandardPrice(classroom)!.amount, 3800); // 舊的教室 1、2 只算一間
assert.strictEqual(rentalStandardPrice({ ...classroom, endDate: "2026-08-12" })!.amount, 7600);
assert.strictEqual(rentalStandardPrice({ ...classroom, pricePlan: "B" })!.amount, 5500 + 2 * 400);
const mixed = rentalStandardPrice({ ...classroom, spaceIds: ["5f-exhibition-hall", "4f-event-lounge"], date: "2026-10-10", endTime: "18:00" })!;
assert.strictEqual(mixed.amount, 5000 + 2 * 500);
assert.deepStrictEqual(mixed.noPrice, ["4f-event-lounge"]);
assert.strictEqual(rentalStandardPrice({ ...classroom, date: "" }), null);
assert.strictEqual(applyDiscount(3800, 85), 3230);
assert.strictEqual(applyDiscount(3800, null), 3800);

const base = { customerName: "王小明", customerPhone: "0912", company: null, taxId: null, eventOrVenueUse: "新品發表" };
// 專案的場地費是折後實收：報價單各列直接照列，不另外列折扣
const q = projectToQuote({
  ...base, discountPercent: 85,
  rentals: [
    { ...classroom, date: "2026-08-12", rentalAmount: 1000, priceNote: "老朋友" },
    { ...classroom, rentalAmount: 3230 },
  ],
});
assert.deepStrictEqual(q.lines.map((l) => `${l.date} ${l.override} ${l.reason}`), ["2026-08-11 3230 ", "2026-08-12 1000 老朋友"]); // 依日期排序
assert.deepStrictEqual([q.discount, q.discountNote], [100, 85]);
assert.strictEqual(q.client.name, "王小明"); // 沒公司名就用聯絡人
assert.ok(!("email" in q.client));
// 多空間一列；沒折扣
const m = projectToQuote({ ...base, company: "甲公司", rentals: [{ ...classroom, spaceIds: ["5f-exhibition-hall", "4f-product-photo"], endDate: "2026-08-12", rentalAmount: 9000 }] });
assert.strictEqual(m.lines[0].label.zh, "5F 展演空間＋攝影室");
assert.strictEqual(m.lines[0].endDate, "2026-08-12");
assert.deepStrictEqual([m.discount, m.discountNote, m.client.name], [100, null, "甲公司"]);
console.log("ok");
