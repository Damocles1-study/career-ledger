/* 所有可调的口径都集中在这里。金额单位：元（除非字段名带 W＝万元）。
   基准：2026 年 11 月，「普通 211／双一流本科、转正后第一年」的中位情形。 */
"use strict";

window.DATA = (() => {

// ───────── 城市 ─────────
// soc: 社保缴费基数上下限（上海 2026.7 起 37731/7546；江苏 2026 年度 25127/5025，全省统一）
// fundHi: 公积金基数上限（上海与社保同；江苏各市按 3 倍社平自定，此处取近似值）
// avg: 计发养老金用的社平工资（上海 2025 年度 12577；江苏按 25127/3 ≈ 8376，全省统筹）
// rent: 租房（合租单间／老小区一居）月租；live: 不含房租的月生活费（吃穿、交通、通讯、社交人情、旅行、数码等摊到每月）
// price: 刚需板块二手房单价（2026.10 各平台口径的折中）；child: 养娃年花费（万元，0–17 岁平均）
// wedM / wedF: 婚嫁净支出（万元，已扣礼金回流；彩礼／婚房按江苏常见习俗，可在页面改）
// commute: 往返通勤分钟／天；rentDed: 个税住房租金专项扣除（元／月）
const CITIES = {
  sh: { name: "上海", short: "上海", region: "沪", soc: [7546, 37731], fundHi: 37731, avg: 12577,
        rent: 3300, live: 5000, price: 40000, priceNote: "外环外刚需（嘉定／松江／青浦／临港）；全市二手均价约 5.2–5.8 万",
        child: 5.0, wedM: 15, wedF: 6, commute: 85, rentDed: 1500, conv: 5, carHold: 14000 },
  sz: { name: "苏州", short: "苏州", region: "苏南", soc: [5025, 25127], fundHi: 32000, avg: 8376,
        rent: 1900, live: 3600, price: 18000, priceNote: "吴中／相城／吴江／高新区外围；园区核心 3 万+；全市均价各平台 1.45–2.1 万",
        child: 3.5, wedM: 15, wedF: 6, commute: 60, rentDed: 1100, conv: 4, carHold: 9000 },
  nj: { name: "南京", short: "南京", region: "苏南", soc: [5025, 25127], fundHi: 32000, avg: 8376,
        rent: 2000, live: 3600, price: 20000, priceNote: "江宁／江北／栖霞刚需；全市二手均价约 2.4 万",
        child: 3.5, wedM: 15, wedF: 6, commute: 60, rentDed: 1500, conv: 4.5, carHold: 9000 },
  xc: { name: "无锡·常州", short: "锡常", region: "苏南", soc: [5025, 25127], fundHi: 30000, avg: 8376,
        rent: 1500, live: 3200, price: 13500, priceNote: "无锡约 1.5 万、常州约 1.2 万",
        child: 3.0, wedM: 16, wedF: 6, commute: 45, rentDed: 1100, conv: 3.5, carHold: 8500 },
  sm: { name: "苏中（南通·扬州·泰州）", short: "苏中", region: "苏中", soc: [5025, 25127], fundHi: 28000, avg: 8376,
        rent: 1200, live: 3000, price: 11500, priceNote: "南通约 1.4 万、扬州约 1.2 万、泰州不到 1 万",
        child: 2.6, wedM: 18, wedF: 6, commute: 40, rentDed: 1100, conv: 3, carHold: 8000 },
  sb: { name: "苏北（徐州·盐城·淮安·连云港·宿迁）", short: "苏北", region: "苏北", soc: [5025, 25127], fundHi: 26000, avg: 8376,
        rent: 1000, live: 2700, price: 8500, priceNote: "徐州约 0.8 万，盐城／淮安市区 0.8–1.1 万，县城 0.5–0.7 万",
        child: 2.2, wedM: 22, wedF: 7, commute: 35, rentDed: 800, conv: 2.5, carHold: 7500 },
};
const CITY_ORDER = ["sh", "sz", "nj", "xc", "sm", "sb"];

// ───────── 路线 ─────────
// kind: gov=机关事业（直接给「年到手」口径）  soe=国企/银行（同样给到手口径）  ent=企业（给税前月 base，页面现算五险一金和个税）
// net[城市]: 转正后第一年到手现金（含年终绩效、扣完五险一金个税），元/年
// fund[城市]: 双边公积金合计，元/月
// g: 实际增长率（剔除通胀）[第 1–10 年, 第 11–20 年, 20 年后]
// deg: 学历系数 [本科, 硕士, 博士]；minDeg: 0 本科可报，1 至少硕士
// hours: 周工时（含常态加班）；weeks: 年工作周数；annuity: 职业/企业年金合计缴费率
// prob: 认真准备一年的上岸／拿 offer 概率（主观先验，普通 211 本科口径）
// score: 非财务维度 1–5 [稳定, 时间, 成长, 婚恋与社会评价, 心理负荷低]
const ROUTES = {
  gwy: { name: "公务员 · 市／区机关", short: "公务员", kind: "gov",
    net:  { sh: 145000, sz: 135000, nj: 128000, xc: 125000, sm: 105000, sb: 96000 },
    fund: { sh: 3800,   sz: 4200,   nj: 3800,   xc: 3700,   sm: 3000,   sb: 2600 },
    g: [0.03, 0.02, 0.01], deg: [1, 1.07, 1.18], hours: 44, weeks: 48, annuity: 0.12, minDeg: 0,
    prob: 0.20, score: [5, 3.5, 2.5, 5, 3.5],
    note: "一级科员起步；硕士定级高一档、职级晋升约快 1–2 年。苏南 2023–24 年绩效已有一轮压降，本表已按压降后口径。" },
  gwyx: { name: "公务员 · 县区／乡镇", short: "乡镇公务员", kind: "gov",
    net:  { sh: 135000, sz: 128000, nj: 118000, xc: 118000, sm: 98000, sb: 88000 },
    fund: { sh: 3400,   sz: 3800,   nj: 3400,   xc: 3400,   sm: 2700, sb: 2300 },
    g: [0.03, 0.02, 0.01], deg: [1, 1.06, 1.15], hours: 50, weeks: 48, annuity: 0.12, minDeg: 0,
    prob: 0.30, score: [5, 2.5, 2, 4, 2.5],
    note: "已含乡镇工作补贴；苏州的县级市（昆山、张家港、常熟）往往高于市区。值班、驻村、迎检多，实际工时偏长。" },
  xds: { name: "选调生（定向／优秀选调）", short: "选调生", kind: "gov",
    net:  { sh: 145000, sz: 135000, nj: 128000, xc: 125000, sm: 105000, sb: 96000 },
    fund: { sh: 3800,   sz: 4200,   nj: 3800,   xc: 3700,   sm: 3000,   sb: 2600 },
    g: [0.045, 0.025, 0.01], deg: [1, 1.07, 1.18], hours: 50, weeks: 48, annuity: 0.12, minDeg: 0,
    prob: 0.08, score: [5, 2.5, 3.5, 5, 2.5],
    note: "江苏选调限定名校（本科多为一流高校，硕士放宽），先下基层 2 年，晋升通道明显快于普通公务员。" },
  sy: { name: "事业编 · 管理／专技", short: "事业编", kind: "gov",
    net:  { sh: 128000, sz: 120000, nj: 113000, xc: 110000, sm: 93000, sb: 85000 },
    fund: { sh: 3500,   sz: 3900,   nj: 3500,   xc: 3400,   sm: 2800, sb: 2400 },
    g: [0.028, 0.02, 0.01], deg: [1, 1.07, 1.16], hours: 40, weeks: 48, annuity: 0.12, minDeg: 0,
    prob: 0.25, score: [5, 4, 2, 4.5, 4],
    note: "同城同级一般比公务员少 1–2 万／年；专技岗靠职称涨薪（中级约 5–8 年、高级 15 年+）。" },
  js: { name: "中小学教师（在编）", short: "教师", kind: "gov",
    net:  { sh: 135000, sz: 140000, nj: 130000, xc: 125000, sm: 102000, sb: 90000 },
    fund: { sh: 3300,   sz: 3800,   nj: 3500,   xc: 3400,   sm: 2800,   sb: 2400 },
    g: [0.03, 0.02, 0.015], deg: [1, 1.05, 1.15], hours: 47, weeks: 40, annuity: 0.12, minDeg: 0,
    prob: 0.25, score: [4.5, 3.5, 2.5, 4.5, 3],
    note: "《教师法》要求不低于当地公务员平均工资：苏南基本落实（园区、高新区的学校还更高），苏北绩效常有拖欠。含寒暑假，所以年工作周按 40 记；班主任另加。" },
  gx: { name: "高校行政／辅导员", short: "高校", kind: "gov",
    net:  { sh: 130000, sz: 120000, nj: 120000, xc: 110000, sm: 95000, sb: 88000 },
    fund: { sh: 3500,   sz: 3600,   nj: 3400,   xc: 3200,   sm: 2700, sb: 2400 },
    g: [0.025, 0.02, 0.01], deg: [1, 1, 1.12], hours: 42, weeks: 44, annuity: 0.12, minDeg: 1,
    prob: 0.12, score: [4.5, 4, 2, 4, 4],
    note: "基本要硕士起步；很多是人事代理／备案制而非事业编，签之前要问清楚。" },
  gq: { name: "国企／央企（电网·烟草·能源·运营商）", short: "国企", kind: "soe",
    net:  { sh: 160000, sz: 150000, nj: 145000, xc: 140000, sm: 128000, sb: 120000 },
    fund: { sh: 5200,   sz: 5000,   nj: 4800,   xc: 4600,   sm: 4000,   sb: 3700 },
    g: [0.035, 0.02, 0.01], deg: [1, 1.12, 1.25], hours: 44, weeks: 48, annuity: 0.08, minDeg: 0,
    prob: 0.15, score: [4.5, 3.5, 2.5, 4.5, 3.5],
    note: "这里取头部单位（电网、烟草等）的口径，普通地方国企要打 7–8 折。有企业年金，公积金比例高。" },
  bank: { name: "银行（国有行／城商行）", short: "银行", kind: "soe",
    net:  { sh: 130000, sz: 120000, nj: 115000, xc: 110000, sm: 95000, sb: 85000 },
    fund: { sh: 3400,   sz: 3500,   nj: 3200,   xc: 3000,   sm: 2600, sb: 2300 },
    g: [0.03, 0.015, 0.005], deg: [1, 1.08, 1.15], hours: 50, weeks: 48, annuity: 0.08, minDeg: 0,
    prob: 0.45, score: [3, 2, 2.5, 3.5, 2],
    note: "2023 年以来金融业持续降薪、绩效延付和追索；揽储、营销指标压力大。科技岗比柜面高 2–4 万。" },
  dc: { name: "互联网大厂／头部科技（开发）", short: "大厂", kind: "ent",
    base: { sh: 17000, sz: 14000, nj: 14000, xc: 12000, sm: 10500, sb: 9500 },
    bonusM: 3, signon: 20000, fundRate: { sh: 0.12, js: 0.12 },
    g: [0.07, 0.03, 0.005], deg: [1, 1.25, 1.6], hours: 58, weeks: 48, annuity: 0, minDeg: 0,
    prob: 0.25, risk35: 0.40, score: [2, 1.5, 5, 3.5, 2],
    note: "上海口径＝普通 211 本科拿到大厂开发 offer 的中位（月 base 1.7 万 × 16 薪 ≈ 27 万）；顶尖学校／AI 岗明显更高。江苏城市对应华为、荣耀、微软、各厂研发中心等，苏北基本没有，只能远程或本地头部企业。" },
  zx: { name: "中小厂／外包开发", short: "中小厂", kind: "ent",
    base: { sh: 11000, sz: 9000, nj: 9000, xc: 8000, sm: 7000, sb: 6000 },
    bonusM: 1.5, signon: 0, fundRate: { sh: 0.07, js: 0.08 },
    g: [0.06, 0.03, 0.005], deg: [1, 1.18, 1.3], hours: 50, weeks: 48, annuity: 0, minDeg: 0,
    prob: 0.85, risk35: 0.35, score: [1.5, 2.5, 3.5, 2.5, 2.5],
    note: "最贴近「普通计算机本科」的现实：2025 届本科平均月薪 6435 元、一线 8051 元（麦可思）。社保有时按最低基数交，入职要问清。" },
  wq: { name: "外企研发", short: "外企", kind: "ent",
    base: { sh: 15000, sz: 13500, nj: 12500, xc: 11500, sm: 10000, sb: 9000 },
    bonusM: 2, signon: 0, fundRate: { sh: 0.12, js: 0.12 },
    g: [0.05, 0.025, 0.01], deg: [1, 1.2, 1.35], hours: 42, weeks: 48, annuity: 0, minDeg: 0,
    prob: 0.30, risk35: 0.25, score: [2.5, 4, 4, 3.5, 3.5],
    note: "工作生活平衡最好的一条，但外企在华收缩是长期趋势；苏州园区、上海张江、南京研发中心较集中。" },
};
const ROUTE_ORDER = ["gwy", "gwyx", "xds", "sy", "js", "gx", "gq", "bank", "dc", "zx", "wq"];

const DEG = [
  { name: "本科", short: "本", years: 0 },
  { name: "硕士", short: "硕", years: 3 },
  { name: "博士", short: "博", years: 7 },
];

// 竞争力分档：影响企业起薪、上岸概率；体制内只轻微影响
const LEVELS = {
  low:  { name: "普通（双非／一般院校）", ent: 0.8, gov: 0.97, prob: 0.7 },
  mid:  { name: "中等（211／双一流）",   ent: 1.0, gov: 1.0,  prob: 1.0 },
  high: { name: "较强（985／强实习）",   ent: 1.3, gov: 1.03, prob: 1.35 },
};

// 情景
const SCEN = {
  fiscal: {
    tight: { name: "财政收紧", level: 0.92, gAdj: -0.01, desc: "地方绩效再压一轮（约 −8%），十年内增速 −1 个点" },
    base:  { name: "基准",     level: 1.00, gAdj: 0,     desc: "名义工资随国标调整，绩效持平" },
    loose: { name: "改善",     level: 1.03, gAdj: 0.008, desc: "国标基本工资上调落实到位、绩效小幅回补" },
  },
  tech: {
    bear: { name: "AI 冲击", level: 0.9, gAdj: -0.02, desc: "传统开发岗收缩，起薪 −10%，涨幅 −2 个点" },
    base: { name: "基准",    level: 1.0, gAdj: 0,     desc: "AI 岗热、基础岗平，整体与 2026 届持平" },
    bull: { name: "景气",    level: 1.08, gAdj: 0.015, desc: "AI 带动新一轮扩招和涨薪" },
  },
  age35: {
    good: { name: "稳住",   desc: "35 岁后保持岗位，按第 11 年起的增速走", cut: 0 },
    exp:  { name: "期望值", desc: "按「被优化概率 × 收入降幅」折算进收入", cut: 0.4 },
    bad:  { name: "被优化", desc: "35 岁被优化，换到收入低 40% 的岗位，之后基本不涨", cut: 0.4 },
  },
};

// 个人养老金计发月数（按退休年龄）
const DIVISOR = { 55: 170, 56: 164, 57: 158, 58: 152, 59: 145, 60: 139, 61: 132, 62: 125, 63: 117 };

const GENDER = {
  m: { name: "男", retire: 63, life: 80, marry: 29, houseShare: 0.7 },
  f: { name: "女", retire: 58, life: 84, marry: 28, houseShare: 0.3 },
};

const SCORE_DIMS = ["稳定性", "时间自由", "成长与可迁移", "婚恋与社会评价", "心理负荷低"];

return { CITIES, CITY_ORDER, ROUTES, ROUTE_ORDER, DEG, LEVELS, SCEN, DIVISOR, GENDER, SCORE_DIMS };
})();
