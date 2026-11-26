// node test.js —— 價目表 v2 公式自我檢查
const assert = require('assert');
const CFG = require('./config.js');
const { standardPrice, totals, discounted } = require('./pricing.js');
const p = l => standardPrice(l, CFG).amount;

// 2026-08-11（二）教室 3 小時，對照實際報價 3,800
assert.strictEqual(p({ space: 'workshop', plan: 'A', date: '2026-08-11', start: '13:00', end: '16:00' }), 3800);
// 平日不滿基本時數仍收基本價
assert.strictEqual(p({ space: 'workshop', plan: 'A', date: '2026-08-11', start: '13:00', end: '14:00' }), 3000);
// 假日 B 方案 5 小時：9000 + 2×500
assert.strictEqual(p({ space: 'event', plan: 'B', date: '2026-10-10', start: '13:00', end: '18:00' }), 10000);
// 國定假日勾選以假日計
assert.strictEqual(p({ space: 'event', plan: 'A', date: '2026-10-09', holiday: true, start: '13:00', end: '17:00' }), 5000);
// 07:00 開始：超時 6 塊 + 人事費 4 塊（07:00–09:00）
assert.strictEqual(p({ space: 'workshop', plan: 'A', date: '2026-08-11', start: '07:00', end: '11:00' }), 3000 + 4 * 400 + 4 * 500);
// 酒吧攝影 3 小時非營業：2×1500 + 1000
assert.strictEqual(p({ space: 'bar', date: '2026-08-11', start: '10:00', end: '13:00' }), 4000);
// 酒吧跨 16:00：非營業 2h 3000 + 營業 1h 3000
assert.strictEqual(p({ space: 'bar', date: '2026-08-11', start: '14:00', end: '17:00' }), 6000);
// 酒吧 09:00 開始：09–10 人事費 2 塊
assert.strictEqual(p({ space: 'bar', date: '2026-08-11', start: '09:00', end: '12:00' }), 3000 + 2 * 500);
// manual 空間不算價
assert.strictEqual(standardPrice({ space: 'lounge', date: '2026-08-11', start: '10:00', end: '12:00' }, CFG), null);

// 合計：覆寫價、8 折、加購、預設 50% 訂金、含稅拆分
const t = totals({
  lines: [{ space: 'workshop', plan: 'A', date: '2026-08-11', start: '13:00', end: '16:00', override: '' },
          { space: 'lounge', override: '2000' }],
  addons: [{ qty: 2, unit: 1200 }],
  discount: 80, depositManual: '',
}, CFG);
assert.deepStrictEqual(t, { venue: 5800, discount: 1160, addons: 2400, total: 7040, net: 6705, tax: 335, deposit: 3520, balance: 3520 });
assert.strictEqual(totals({ lines: [], addons: [{ qty: 1, unit: 10000 }], depositManual: '3000' }, CFG).deposit, 3000);
// 全額付款：訂金＝合計、尾款 0（預覽不印這兩列）
assert.strictEqual(totals({ lines: [], addons: [{ qty: 1, unit: 10000 }], depositManual: '3000', fullPay: true }, CFG).balance, 0);
// 折扣逐列計算：報價單每列直接印折扣後金額
assert.strictEqual(discounted(3800, { discount: 85 }), 3230);
assert.strictEqual(discounted(3800, {}), 3800);
console.log('ok');
