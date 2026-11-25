// npx tsx lib/quote/prefill.test.ts —— 專案轉報價單的自我檢查
import assert from "assert";
import { projectToQuote } from "./prefill";

const { prefill, skipped } = projectToQuote({
  customerName: "王小明", customerPhone: "0912", company: null, taxId: null, eventOrVenueUse: "新品發表",
  rentals: [
    { date: "2026-12-05", endDate: "2026-12-06", startTime: "13:00", endTime: "17:00", spaceIds: ["5f-exhibition-hall", "4f-product-photo"] },
    { date: "2026-12-01", endDate: null, startTime: "10:00", endTime: "12:00", spaceIds: ["4f-multipurpose-room-1", "4f-multipurpose-room-2"] },
  ],
});
assert.strictEqual(prefill.client.name, "王小明"); // 沒公司名就用聯絡人
assert.deepStrictEqual(prefill.lines!.map((l) => `${l.space} ${l.date} ${l.start}`), [
  "workshop 2026-12-01 10:00", // 依日期排序；舊的教室 1、2 合併成一列
  "event 2026-12-05 13:00",
  "event 2026-12-06 13:00", // 跨日展開
]);
assert.deepStrictEqual(skipped, ["4f-product-photo"]);
assert.strictEqual(projectToQuote({ customerName: "a", customerPhone: "", company: "甲公司", taxId: "1", eventOrVenueUse: "", rentals: [] }).prefill.lines, undefined);
console.log("ok");
