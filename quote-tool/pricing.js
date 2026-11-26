// 依價目表 v2 算標準價。回傳 { amount, zh, en }；manual 空間回傳 null。
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const overlap = (s, e, a, b) => Math.max(0, Math.min(e, b) - Math.max(s, a));
const fmt = n => n.toLocaleString('en-US');
const isWeekend = date => [0, 6].includes(new Date(date + 'T00:00').getDay());

function afterHours(s, e, cfg) {
  const [o, c] = cfg.openHours.map(toMin);
  const blocks = Math.ceil((overlap(s, e, 0, o) + overlap(s, e, c, 24 * 60)) / 30);
  return { amount: blocks * cfg.afterHoursPer30, blocks };
}

function standardPrice(line, cfg) {
  const space = cfg.spaces.find(x => x.id === line.space);
  if (!space || space.rule === 'manual' || !line.start || !line.end || !line.date) return null;
  const s = toMin(line.start), e = toMin(line.end);
  if (e <= s) return null;
  const ah = afterHours(s, e, cfg);
  const zh = [], en = [];
  let amount = 0;

  if (space.rule === 'hall') {
    const h = cfg.hall, day = line.holiday || isWeekend(line.date) ? 'weekend' : 'weekday';
    const plan = h.plans[line.plan || 'A'];
    const blocks = Math.ceil(Math.max(0, e - s - h.baseMin[day]) / 30);
    amount = plan[day] + blocks * h.otPer30[day];
    const baseH = h.baseMin[day] / 60;
    zh.push(`${day === 'weekend' ? '假日' : '平日'} ${plan.zh}，基本 ${baseH} 小時 $${fmt(plan[day])}`);
    en.push(`${day === 'weekend' ? 'Weekend' : 'Weekday'} ${plan.en}, first ${baseH} hrs $${fmt(plan[day])}`);
    if (blocks) {
      zh.push(`超時 ${blocks} × 30 分 $${fmt(h.otPer30[day])}`);
      en.push(`overtime ${blocks} × 30 min @ $${fmt(h.otPer30[day])}`);
    }
  } else if (space.rule === 'photo') {
    const p = cfg.photo, open = toMin(p.open), biz = toMin(p.bizStart);
    const nonBizH = Math.ceil(overlap(s, e, open, biz) / 60);
    const bizH = Math.ceil(overlap(s, e, biz, 24 * 60) / 60);
    if (nonBizH) {
      const extra = Math.max(0, nonBizH - p.minHours);
      amount += p.minHours * p.nonBizPerHour + extra * p.extraPerHour;
      zh.push(`非營業時段攝影 ${Math.max(nonBizH, p.minHours)} 小時（2 小時起租）`);
      en.push(`Photo shoot outside opening hours, ${Math.max(nonBizH, p.minHours)} hrs (2-hr minimum)`);
    }
    if (bizH) {
      amount += bizH * p.bizPerHour;
      zh.push(`營業時段 ${bizH} 小時 $${fmt(p.bizPerHour)}`);
      en.push(`during opening hours ${bizH} hrs @ $${fmt(p.bizPerHour)}`);
    }
    // 酒吧 10:00 前使用收人事費；16:00 後是營業時段，不另收
    const early = Math.ceil(overlap(s, e, 0, open) / 30);
    if (early) {
      amount += early * cfg.afterHoursPer30;
      zh.push(`10:00 前人事費 ${early} × 30 分 $${fmt(cfg.afterHoursPer30)}`);
      en.push(`staffing before 10:00, ${early} × 30 min @ $${fmt(cfg.afterHoursPer30)}`);
    }
  }

  if (space.rule === 'hall' && ah.blocks) {
    amount += ah.amount;
    zh.push(`非營業時間人事費 ${ah.blocks} × 30 分 $${fmt(cfg.afterHoursPer30)}`);
    en.push(`after-hours staffing ${ah.blocks} × 30 min @ $${fmt(cfg.afterHoursPer30)}`);
  }
  return { amount, zh: zh.join('；'), en: en.join('; ') };
}

// 合計：金額皆含稅
function totals(q, cfg) {
  const venue = q.lines.reduce((t, l) => t + lineAmount(l, cfg), 0);
  // 折扣逐列計算（報價單每列直接印折扣後金額），合計才會等於各列相加
  const discount = q.lines.reduce((t, l) => t + lineAmount(l, cfg) - discounted(lineAmount(l, cfg), q), 0);
  const addons = q.addons.reduce((t, a) => t + (Number(a.qty) || 0) * (Number(a.unit) || 0), 0);
  const total = venue - discount + addons;
  const net = Math.round(total / 1.05);
  const deposit = q.fullPay ? total : q.depositManual !== '' && q.depositManual != null ? Number(q.depositManual) : Math.round(total * 0.5);
  return { venue, discount, addons, total, net, tax: total - net, deposit, balance: total - deposit };
}

// 套用長期合作折扣後的單列金額（q.discount：85＝85 折；空白或 100＝不打折）
function discounted(amount, q) {
  return Math.round(amount * (q.discount || 100) / 100);
}

function lineAmount(l, cfg) {
  if (l.override !== '' && l.override != null) return Number(l.override) || 0;
  const p = standardPrice(l, cfg);
  return p ? p.amount : 0;
}

if (typeof module !== 'undefined') module.exports = { standardPrice, totals, lineAmount, discounted, isWeekend };
