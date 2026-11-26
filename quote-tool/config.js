// 報價單主資料：改價格、改條款只動這個檔。
// 這個 repo 是公開的：匯款帳號不要寫在這裡。
const CONFIG = {
  lessor: {
    zh: '多向度有限公司',
    en: '多向度有限公司 (CollaPlay)', // 公司英文登記名待補
    taxId: '97510850',
    repZh: '朱柏豪',
    repEn: 'Raymond Chu',
    email: 'collaplay.tpe@gmail.com',
    phone: '02-66270836',
    addrZh: '台北市萬華區武昌街二段83-6號',
    addrEn: 'No. 83-6, Sec. 2, Wuchang St., Wanhua Dist., Taipei City, Taiwan',
    bankZh: '新光銀行（103）西門分行（0055）',
    bankEn: 'Shin Kong Commercial Bank (103), Ximen Branch (0055)',
    account: '__QUOTE_BANK_ACCOUNT__', // 帳號不進 repo，由環境變數 QUOTE_BANK_ACCOUNT 帶入（見 app/dashboard/quote/route.ts）
    accountName: '多向度有限公司',
  },

  // rule: hall＝價目表 v2 A/B 方案；photo＝Tik & Sip 攝影；manual＝尚無正式價，手動輸入
  spaces: [
    { id: 'workshop', zh: '4F 多功能教室', en: '4F Workshop Room', rule: 'hall' },
    { id: 'event', zh: '5F 展演空間', en: '5F Event Hall', rule: 'hall' },
    { id: 'bar', zh: '4F Tik & Sip 葡萄酒吧', en: '4F Tik & Sip Wine Bar', rule: 'photo' },
    { id: 'lounge', zh: '4F 交誼廳', en: '4F Social Lounge', rule: 'manual' },
    { id: 'podcast', zh: '4F Podcast 錄音室', en: '4F Podcast Studio', rule: 'manual' },
    { id: 'media', zh: '4F 播映室', en: '4F Media Room', rule: 'manual' },
    { id: 'cafe', zh: '3F 社群咖啡館', en: '3F Community Café', rule: 'manual' }, // 官網無英文名，暫定
  ],

  // 價目表 v2（2026-05-15）
  hall: {
    plans: {
      A: { zh: 'A 課程、會議、講座', en: 'Plan A: Classes, Meetings & Talks', weekday: 3000, weekend: 5000 },
      B: { zh: 'B 商業活動及派對', en: 'Plan B: Commercial Events & Parties', weekday: 5500, weekend: 9000 },
    },
    baseMin: { weekday: 120, weekend: 240 },
    otPer30: { weekday: 400, weekend: 500 },
  },
  photo: { nonBizPerHour: 1500, minHours: 2, extraPerHour: 1000, bizPerHour: 3000, bizStart: '16:00', open: '10:00' },
  openHours: ['09:00', '22:00'], // 這段時間外收人事費
  afterHoursPer30: 500,

  // 場租餐飲菜單（2026-10）
  drinks: [
    { zh: '向日葵國寶茶（無咖啡因）', en: 'Sunflower Rooibos Tea (caffeine-free)', unit: 1500, temps: ['熱'] },
    { zh: '熱帶果乾茶（無咖啡因）', en: 'Tropical Fruit Tea (caffeine-free)', unit: 1500, temps: ['冰', '熱'] },
    { zh: '伯爵紅茶', en: 'Earl Grey Tea', unit: 1500, temps: ['冰', '熱'] },
    { zh: '美式黑咖啡', en: 'Americano', unit: 1800, temps: ['冰', '熱'] },
  ],
  drinkNote: { zh: '每桶 6L，約 20–30 杯', en: '6 L per dispenser, approx. 20–30 cups' },

  // tiers：可出現在哪個方案；min：最低訂購量
  pastries: [
    { zh: '迷迭香佛卡夏', en: 'Rosemary Focaccia', tiers: [150, 300] },
    { zh: '重乳酪小蛋糕', en: 'Mini Cheesecake', tiers: [150, 300] },
    { zh: '馬芬蛋糕', en: 'Muffin', tiers: [150, 300], flavors: [['香蕉', 'Banana'], ['可可', 'Cocoa']] },
    { zh: '胡桃布朗尼', en: 'Walnut Brownie', tiers: [300] },
    { zh: '脆皮伯爵泡芙', en: 'Earl Grey Cream Puff', tiers: [300], min: 15 },
    { zh: '德腸丹麥', en: 'Sausage Danish', tiers: [300] },
    { zh: '檸檬糖霜小可頌', en: 'Lemon-Glazed Mini Croissant', tiers: [300] },
  ],
  pastryPick: 2, // 每人選幾款

  equipment: [
    { zh: '神牛 Godox ML100R 持續燈（每支）', en: 'Godox ML100R Continuous Light (each)', unit: 200 },
    { zh: '影音包廂梳化（每小時）', en: 'Dressing Room (per hour)', unit: 300 },
  ],
  others: [
    { zh: '清潔費', en: 'Cleaning Fee', unit: 500 },
  ],

  // 2026-07 版條款；{valid} {payWhen} {payment} 會自動帶入（{payWhen}＝「確認報價後 N 日內」或指定的截止日）（{payment}＝「訂金 NT$x」或「全額 NT$x」）
  terms: {
    zh: [
      '本報價含稅價已含 5% 營業稅。合作雙方若有其他針對場地相關使用需求、以及出租方若有場地規範，需於活動前 14 日討論之並簽訂備忘錄。',
      '場地方提供額外酒水及餐食報價，若需要額外訂購，請於活動前 10 日確認。',
      '報價日已協助保留場地，惟本報價於報價日後 {valid} 天有效。請於{payWhen}完成{payment}匯款，以保留使用權。',
      // 陣列＝一條條款底下的分項：第一個是標題句，其餘印成子項目（2026-11 新退改規定）
      ['取消、改期規則：訂金收訖後，場地即為您保留並停止對外開放預約。如需取消，訂金依通知時間按以下比例退還，未退還部分為行政處理費：',
        '活動 30 日前取消：退還訂金 80%，或可選擇免費改期乙次。',
        '活動 29 日至 15 日前取消：退還訂金 50%，或可選擇免費改期乙次。',
        '活動 14 日（含）內取消：不予改期，亦不退還訂金。',
        '免費改期：活動 15 日前通知可改期乙次，新日期須在原活動日起半年內；改期後恕不受理取消退款。',
        '天候因素：活動當日如遇台北市政府宣布停止上班，可免費改期乙次，或全額退還訂金。',
        '場地方因素：如因 CollaPlay 因素致無法如期提供場地，將全額退還已付訂金，或依您的意願協助改期。'],
      '主辦方需自行完成場復，並通知空間夥伴確認。如有家具、場地、設備損壞之情事，將收取維修清潔費用。',
      '簽訂本報價單，即視為同意上述規範。',
    ],
    en: [
      'All amounts include 5% business tax. Any additional venue requirements from either party, and any venue rules set by the Lessor, shall be discussed and confirmed in a memorandum no later than 14 days before the event.',
      'Additional food and beverages can be quoted by the venue. Please confirm any orders no later than 10 days before the event.',
      'The venue is held for you as of the quotation date. This quotation is valid for {valid} days from the quotation date. Please transfer {payment} {payWhen} to secure your booking.',
      ['Cancellation & Rescheduling: Once the deposit is received, the venue is reserved for you and closed to other bookings. For cancellations, the deposit is refunded according to the notice period below; any non-refunded portion is retained as an administrative fee:',
        'Cancellation 30 or more days before the event: 80% of the deposit is refunded, or you may choose one free reschedule.',
        'Cancellation 29 to 15 days before the event: 50% of the deposit is refunded, or you may choose one free reschedule.',
        'Cancellation within 14 days of the event (inclusive): no rescheduling, and the deposit is non-refundable.',
        'Free reschedule: One reschedule is allowed with at least 15 days\' notice. The new date must fall within six months of the original event date. Rescheduled bookings cannot be cancelled or refunded.',
        'Weather: If the Taipei City Government announces a suspension of work on the event day, you may reschedule once free of charge or receive a full refund of the deposit.',
        'Venue: If CollaPlay is unable to provide the venue as scheduled, the deposit paid will be refunded in full, or we will help you reschedule at your preference.'],
      'The Client is responsible for restoring the venue after the event and having it checked by our staff. Any damage to furniture, premises or equipment will incur repair and cleaning charges.',
      'By signing this quotation, the Client agrees to the terms above.',
    ],
  },
};
if (typeof module !== 'undefined') module.exports = CONFIG;
