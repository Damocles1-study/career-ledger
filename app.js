"use strict";
(() => {
const { CITIES, CITY_ORDER, ROUTES, ROUTE_ORDER, DEG, LEVELS, SCEN, DIVISOR, GENDER, SCORE_DIMS } = window.DATA;
const $ = id => document.getElementById(id);
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"];
const TAGS = ["A", "B", "C", "D"];

// ───────── 格式化 ─────────
const W = x => {                                  // 元 → "12.3 万"
  const v = x / 1e4, a = Math.abs(v);
  const s = a >= 100 ? Math.round(v).toLocaleString("zh-CN") : a >= 10 ? v.toFixed(1) : v.toFixed(1);
  return s.replace(/\.0$/, "") + " 万";
};
const Wn = x => W(x).replace(" 万", "");
const Y = x => Math.round(x).toLocaleString("zh-CN");
const P = x => Math.round(x * 100) + "%";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ───────── 默认状态 ─────────
const DEFAULT = {
  slots: [{ r: "gwy", c: "sb", d: 0 }, { r: "dc", c: "sh", d: 0 }, { r: "js", c: "sz", d: 0 }],
  gender: "m", level: "mid", gradYears: 3, gradCost: 2.5,
  famPool: 15, famDown: true, famWed: true, famGrad: true, init: 1, parents: 0,
  life: 1, housing: "share", fundRent: true, ret: 1,
  marryOn: true, marryAge: 29, wed: 0, shareMode: "custom",
  houseOn: true, buyAge: 30, area: 90, locMult: 1, down: 20, rate: 3.0, trend: -1,
  carOn: true, carAge: 27, carPrice: 12,
  kids: 1, kidAge: 31, matMode: "stat",
  fiscal: "base", tech: "base", age35: "exp", commuteOn: true,
  chartMode: "net", horizon: 50,
  tries: 2, prepMode: "work", fallback: "zx", probs: {},
  weights: [1, 1, 1, 1, 1, 1, 2],
  preset: 0,
};
const clone = o => JSON.parse(JSON.stringify(o));
let G = clone(DEFAULT);

const PRESETS = [
  { name: "苏北本科：回老家 or 出去闯", desc: "盐城/徐州公务员 · 上海大厂 · 苏州教师",
    set: { gender: "m", slots: [{ r: "gwy", c: "sb", d: 0 }, { r: "dc", c: "sh", d: 0 }, { r: "js", c: "sz", d: 0 }] } },
  { name: "研究生三选一", desc: "上海大厂(硕) · 苏州公务员(硕) · 南京国企(硕)",
    set: { slots: [{ r: "dc", c: "sh", d: 1 }, { r: "gwy", c: "sz", d: 1 }, { r: "gq", c: "nj", d: 1 }] } },
  { name: "女生视角：编制还是大厂", desc: "苏州教师 · 上海大厂 · 南京事业编",
    set: { gender: "f", slots: [{ r: "js", c: "sz", d: 0 }, { r: "dc", c: "sh", d: 0 }, { r: "sy", c: "nj", d: 0 }] } },
  { name: "普通本科的现实选项", desc: "苏州中小厂 · 苏中银行 · 苏北乡镇公务员",
    set: { level: "low", slots: [{ r: "zx", c: "sz", d: 0 }, { r: "bank", c: "sm", d: 0 }, { r: "gwyx", c: "sb", d: 0 }] } },
  { name: "要不要读研", desc: "同为上海大厂：本科 · 硕士；对照苏州公务员本科",
    set: { slots: [{ r: "dc", c: "sh", d: 0 }, { r: "dc", c: "sh", d: 1 }, { r: "gwy", c: "sz", d: 0 }] } },
  { name: "苏南三城的编制", desc: "苏州 · 南京 · 无锡常州公务员，外加上海外企",
    set: { slots: [{ r: "gwy", c: "sz", d: 0 }, { r: "gwy", c: "nj", d: 0 }, { r: "gwy", c: "xc", d: 0 }, { r: "wq", c: "sh", d: 0 }] } },
];

// ───────── 个税 ─────────
function annualTax(t) {
  if (t <= 0) return 0;
  const B = [[36000, .03, 0], [144000, .10, 2520], [300000, .20, 16920], [420000, .25, 31920], [660000, .30, 52920], [960000, .35, 85920], [Infinity, .45, 181920]];
  for (const [cap, r, d] of B) if (t <= cap) return t * r - d;
}
function bonusTax(b) {
  if (b <= 0) return 0;
  const m = b / 12;
  const B = [[3000, .03, 0], [12000, .10, 210], [25000, .20, 1410], [35000, .25, 2660], [55000, .30, 4410], [80000, .35, 7160], [Infinity, .45, 15160]];
  for (const [cap, r, d] of B) if (m <= cap) return b * r - d;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// 增长因子：第 y 年（0 起）相对第 0 年
function growth(g, y, adj, adjYears = 10) {
  let f = 1;
  for (let k = 1; k <= y; k++) {
    let r = k <= 10 ? g[0] : k <= 20 ? g[1] : g[2];
    if (k <= adjYears) r += adj;
    f *= 1 + r;
  }
  return f;
}

const effDeg = (rk, d) => Math.max(d, ROUTES[rk].minDeg || 0);

// ───────── 单年收入 ─────────
// ctx: { age, y(工龄), female, birthsBefore, birthNow, renting, kids }
function income(rk, ck, d, ctx) {
  const R = ROUTES[rk], C = CITIES[ck], L = LEVELS[G.level];
  d = effDeg(rk, d);
  const mat = G.matMode === "stat" && ctx.female;
  if (R.kind !== "ent") {
    const F = SCEN.fiscal[G.fiscal];
    const lvl = R.kind === "gov" ? F.level : 1 + (F.level - 1) * 0.5;
    const adj = R.kind === "gov" ? F.gAdj : F.gAdj * 0.5;
    const gf = growth(R.g, ctx.y, adj);
    let net = R.net[ck] * R.deg[d] * L.gov * lvl * gf;
    let fund = R.fund[ck] * 12 * R.deg[d] * gf;
    if (ctx.y === 0) { const pr = R.kind === "gov" ? 0.9 : 0.95; net *= pr; fund *= pr; }
    if (mat && ctx.birthNow) net *= 0.97;
    const contrib = clamp(net * 0.85 / 12, C.soc[0], C.soc[1]);
    return { net, fund, contrib, annuity: R.annuity * contrib * 12, gross: null };
  }
  // 企业
  const T = SCEN.tech[G.tech];
  let y = ctx.y;
  if (mat) y = Math.max(0, y - ctx.birthsBefore);
  const after35 = ctx.age >= 35;
  let gf;
  if (after35 && G.age35 !== "good") {
    const y35 = Math.max(0, y - (ctx.age - 35));        // 35 岁时的工龄
    gf = growth(R.g, y35, T.gAdj) * Math.pow(1 + R.g[2], ctx.age - 35);
  } else gf = growth(R.g, y, T.gAdj);
  let base = R.base[ck] * R.deg[d] * L.ent * T.level * gf;
  if (after35) {
    if (G.age35 === "exp") base *= 1 - R.risk35 * SCEN.age35.exp.cut;
    if (G.age35 === "bad") base *= 1 - SCEN.age35.bad.cut;
  }
  const soc = clamp(base, C.soc[0], C.soc[1]) * 0.105;
  const fr = ck === "sh" ? R.fundRate.sh : R.fundRate.js;
  const fb = Math.min(base, C.fundHi);
  const fundP = fb * fr;
  let deduct = 60000 + (ctx.renting ? C.rentDed * 12 : 0) + ctx.kids * 1000 * 12;
  const taxable = base * 12 - (soc + fundP) * 12 - deduct;
  let bonus = R.bonusM * base;
  if (ctx.y === 0) bonus *= 0.5;                         // 7 月入职，首年年终约半年
  if (mat && ctx.birthNow) bonus *= 0.5;
  let net = base * 12 - (soc + fundP) * 12 - annualTax(taxable) + bonus - bonusTax(bonus);
  if (ctx.y === 0 && R.signon) net += R.signon * 0.8;
  return { net, fund: fundP * 2 * 12, contrib: clamp(base, C.soc[0], C.soc[1]), annuity: 0, gross: base * 12 + bonus };
}

// ───────── 主模拟 ─────────
// opt: { gender, delay, pre(保底路线), noBuy, matMode, shareMode, wed, marryAge }
function simulate(slot, opt = {}) {
  const gk = opt.gender || G.gender, gd = GENDER[gk], female = gk === "f";
  const C = CITIES[slot.c], R = ROUTES[slot.r];
  const d = effDeg(slot.r, slot.d);
  const eduY = d === 0 ? 0 : d === 1 ? G.gradYears : G.gradYears + 4;
  const eduEnd = 22 + eduY;
  const delay = opt.delay || 0;
  const forever = delay === Infinity;
  const workStart = eduEnd + (forever ? 0 : delay);
  const retire = gd.retire;
  const marryAge = opt.marryAge ?? G.marryAge;
  const shareMode = opt.shareMode || G.shareMode;
  const savedMat = G.matMode; if (opt.matMode) G.matMode = opt.matMode;
  const r = G.ret / 100, trend = G.trend / 100, rate = G.rate / 100;

  let cash = G.init * 1e4, fund = 0, fam = G.famPool * 1e4, famUsed = 0;
  let own = false, loan = 0, pay = 0, hv = 0, share = 1;
  let persAcc = 0, annAcc = 0, contribYears = 0, idxSum = 0, cum = 0;
  const rows = [], births = [];
  if (G.kids >= 1) births.push(G.kidAge);
  if (G.kids >= 2) births.push(G.kidAge + 3);
  const house = { done: false };

  for (let age = 22; age < retire; age++) {
    let inc = 0, fin = 0, cost = 0, phase = "", ev = [];
    let contrib = 0, ann = 0, hours = 0, weeks = 0;
    const renting = !own && G.housing !== "home";
    const kidsNow = births.filter(b => age >= b && age < b + 18).length;
    const ctxBase = { age, female, birthsBefore: births.filter(b => b < age).length, birthNow: births.includes(age), renting, kids: kidsNow };
    let student = false, fullPrep = false;

    if (age < eduEnd) {
      student = true; phase = d === 2 && age >= 22 + G.gradYears ? "读博" : "读研";
      let gc = phase === "读博" ? 0 : G.gradCost * 1e4;   // 博士补助基本覆盖生活
      if (G.famGrad && fam > 0) { const u = Math.min(fam, gc); fam -= u; famUsed += u; gc -= u; }
      cash -= gc;
    } else if (forever || age < workStart) {
      const pre = opt.pre || "zx";
      if (forever || G.prepMode === "work") {
        const yy = age - eduEnd;
        const x = income(pre, slot.c, d, { ...ctxBase, y: yy });
        inc = x.net; fin = x.fund; contrib = x.contrib; ann = x.annuity;
        hours = ROUTES[pre].hours; weeks = ROUTES[pre].weeks;
        phase = forever ? ROUTES[pre].short + "（保底）" : "在职备考 · " + ROUTES[pre].short;
      } else { fullPrep = true; phase = "全职备考"; cost += 12000; }
    } else {
      const x = income(slot.r, slot.c, d, { ...ctxBase, y: age - workStart });
      inc = x.net; fin = x.fund; contrib = x.contrib; ann = x.annuity;
      hours = R.hours; weeks = R.weeks;
      phase = R.short;
    }

    // 生活开销
    if (!student && !fullPrep) {
      const home = G.housing === "home" && !own;
      const rent = own || home ? 0 : C.rent * (G.housing === "whole" ? 1.45 : 1);
      cost += (C.live * G.life * (home ? 0.7 : 1) + rent) * 12;
      if (renting && G.fundRent) { const w = Math.min(rent * 12, fund + fin); fund -= w; cash += w; }
      cost += G.parents * 12;
    }
    // 车
    if (G.carOn && age === G.carAge) { cash -= G.carPrice * 1e4; ev.push("买车"); }
    if (G.carOn && age > G.carAge) cost += C.carHold;
    // 婚
    if (G.marryOn && age === marryAge) {
      let w = (opt.wed ?? (G.wed > 0 ? G.wed : (gk === "m" ? C.wedM : C.wedF))) * 1e4;
      if (G.famWed && fam > 0) { const u = Math.min(fam, w); fam -= u; famUsed += u; w -= u; }
      cash -= w; ev.push("结婚");
    }
    // 孩子
    for (const b of births) {
      if (age >= b && age < b + 18) cost += C.child * 1e4 * 0.5;
      if (age >= b && age < b + 3) cost -= 3600 * 0.5;
      if (age === b) ev.push("生娃");
    }
    // 买房
    if (G.houseOn && !opt.noBuy && age === G.buyAge && !own) {
      const married = G.marryOn && G.buyAge >= marryAge;
      share = !married ? 1 : shareMode === "custom" ? gd.houseShare : shareMode === "half" ? 0.5 : 1;
      const unit = C.price * G.locMult * Math.pow(1 + trend, age - 22);
      const total = unit * G.area;
      const downAmt = total * G.down / 100 * share;
      let need = downAmt + (total * 0.015 + G.area * 1500) * share;
      const avail = cash + fund + (G.famDown ? fam : 0);
      const u1 = Math.min(fund, downAmt); fund -= u1; need -= u1;
      if (G.famDown && fam > 0) { const u = Math.min(fam, need); fam -= u; famUsed += u; need -= u; }
      cash -= need;
      loan = total * (1 - G.down / 100) * share;
      const n = 30, mr = rate;
      pay = loan * mr / (1 - Math.pow(1 + mr, -n));
      hv = total; own = true;
      Object.assign(house, { done: true, age, total, need: downAmt + (total * 0.015 + G.area * 1500) * share, avail, share, pay, unit });
      ev.push("买房");
    }
    // 月供（先用公积金冲抵）
    let payCash = 0;
    if (own && loan > 0 && !(house.age === age && false)) {
      const p = Math.min(pay, loan * (1 + rate));
      const fromFund = Math.min(p, fund + fin);
      fund -= fromFund; payCash = p - fromFund; cash -= payCash;
      loan = Math.max(0, loan * (1 + rate) - p);
      if (house.age === age) { house.payCash1 = payCash; house.inc1 = inc; }
    }
    if (own && age > house.age) hv *= 1 + trend;

    cash += inc - cost; fund += fin; cum += inc;
    cash *= cash > 0 ? 1 + r : 1;
    fund *= 1.015;
    if (contrib > 0) {
      persAcc += 0.08 * contrib * 12; annAcc += ann; contribYears++;
      idxSum += clamp(contrib / C.avg, 0.6, 3);
    }
    const equity = own ? hv * share - loan : 0;
    rows.push({ age, cash, fund, equity, net: cash + fund + equity, liquid: cash + fund, cum, inc, fin, cost, hours, weeks, phase, ev, ann, famUsed });
  }
  G.matMode = savedMat;

  // 养老金
  const idx = contribYears ? idxSum / contribYears : 0;
  const div = DIVISOR[retire] || 139;
  const basic = C.avg * (1 + idx) / 2 * contribYears * 0.01;
  const PEN_HAIRCUT = 0.9;                          // 未来养老金调整放缓，统一打 9 折
  const pension = (basic + persAcc / div + annAcc / div) * PEN_HAIRCUT;
  const payYears = Math.max(0, gd.life - retire);
  const lifetime = cum + pension * 12 * payYears;
  const at = a => rows.find(x => x.age === a) || rows[rows.length - 1];
  return { rows, at, pension, basic, persM: persAcc / div, annM: annAcc / div, contribYears, idx, retire, payYears, lifetime, cum, house, eduEnd, workStart, d, female };
}

// ───────── 概率与期望 ─────────
function probOf(i) {
  const s = G.slots[i], key = s.r + s.c + s.d;
  if (G.probs[key] != null) return G.probs[key];
  const R = ROUTES[s.r];
  let p = R.prob * LEVELS[G.level].prob * (effDeg(s.r, s.d) >= 1 ? 1.3 : 1);
  return clamp(Math.round(p * 20) / 20, 0.05, 0.95);
}
function expected(i) {
  const s = G.slots[i], p = probOf(i), N = G.tries;
  const same = s.r === G.fallback;
  const parts = [];
  let left = 1;
  for (let k = 0; k < N; k++) {
    const w = left * p; left -= w;
    parts.push({ w, sim: simulate(s, { delay: k, pre: G.fallback }) });
  }
  if (!same) parts.push({ w: left, sim: simulate(s, { delay: Infinity, pre: G.fallback }) });
  else parts[0].w += left;
  const ev = f => parts.reduce((a, x) => a + x.w * f(x.sim), 0);
  return { p, succ: 1 - (same ? 0 : left), at35: ev(x => x.at(35).net), at45: ev(x => x.at(45).net), life: ev(x => x.lifetime), parts };
}

// ───────── 状态读写 ─────────
const LS = "career_ledger_v1";
function save() {
  try { localStorage.setItem(LS, JSON.stringify(G)); } catch (e) {}
}
function load() {
  try {
    const h = location.hash.slice(1);
    if (h.startsWith("s=")) {
      const o = JSON.parse(decodeURIComponent(escape(atob(h.slice(2)))));
      G = Object.assign(clone(DEFAULT), o); return;
    }
  } catch (e) {}
  try { const s = localStorage.getItem(LS); if (s) G = Object.assign(clone(DEFAULT), JSON.parse(s)); } catch (e) {}
}
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800);
}

// ───────── 控件绑定 ─────────
const FMT = {
  gradYears: v => v + " 年", gradCost: v => v + " 万／年", famPool: v => v + " 万", init: v => v + " 万",
  parents: v => v ? Y(v) + " 元" : "不给", ret: v => v + "%", marryAge: v => v + " 岁",
  wed: v => v > 0 ? v + " 万" : "按习俗默认", buyAge: v => v + " 岁", area: v => v + " ㎡",
  locMult: v => "× " + (+v).toFixed(2), rate: v => (+v).toFixed(2) + "%", trend: v => (v > 0 ? "+" : "") + v + "%",
  kidAge: v => v + " 岁",
};
const NUMERIC = new Set(["gradYears", "gradCost", "famPool", "init", "parents", "ret", "marryAge", "wed", "buyAge", "area", "locMult", "down", "rate", "trend", "carAge", "carPrice", "kids", "kidAge", "life", "horizon", "tries"]);
function setRangeFill(el) {
  const p = (el.value - el.min) / (el.max - el.min) * 100;
  el.style.setProperty("--p", p + "%");
}
function syncControls() {
  document.querySelectorAll("[data-k]").forEach(el => {
    const k = el.dataset.k, v = G[k];
    if (el.classList.contains("seg")) {
      el.querySelectorAll("button").forEach(b => b.classList.toggle("on", String(v) === b.dataset.v));
    } else if (el.type === "checkbox") el.checked = !!v;
    else if (el.type === "range") { el.value = v; setRangeFill(el); }
    else el.value = v;
  });
  document.querySelectorAll("[data-v]").forEach(el => {
    if (el.tagName === "BUTTON") return;
    const k = el.dataset.v; if (FMT[k]) el.textContent = FMT[k](G[k]);
  });
  document.querySelectorAll("[data-chips]").forEach(box => {
    const k = box.dataset.chips;
    box.querySelectorAll("button").forEach(b => b.classList.toggle("on", +b.dataset.c === +G[k]));
  });
  $("carV").textContent = G.carAge + " 岁 · " + G.carPrice + " 万";
  $("levelHint").textContent = LEVELS[G.level].name + "：企业起薪 × " + LEVELS[G.level].ent + "、上岸概率 × " + LEVELS[G.level].prob + "，体制内只差约 ±3%。";
  $("lifeHint").textContent = "不含房租的月生活费：上海约 " + Y(CITIES.sh.live * G.life) + "、苏州约 " + Y(CITIES.sz.live * G.life) + "、苏北约 " + Y(CITIES.sb.live * G.life) + " 元。";
  $("fiscalHint").textContent = SCEN.fiscal[G.fiscal].desc + "。";
  $("techHint").textContent = SCEN.tech[G.tech].desc + "。";
  $("age35Hint").textContent = SCEN.age35[G.age35].desc + "（大厂被优化概率按 40%、中小厂 35%、外企 25%）。";
  const gk = G.gender, ex = G.slots.map(s => CITIES[s.c]).filter((c, i, a) => a.indexOf(c) === i);
  $("wedHint").innerHTML = "拖到 0＝按习俗默认（" + (gk === "m" ? "男方：彩礼＋婚礼净支出" : "女方：嫁妆＋婚礼净支出") + "，" +
    ex.map(c => c.short + " " + (gk === "m" ? c.wedM : c.wedF) + " 万").join("、") + "）。苏北彩礼普遍高于苏南。";
  document.querySelectorAll(".preset").forEach((b, i) => b.classList.toggle("on", i === G.preset));
  const tb = $("themeBtn"), th = document.documentElement.dataset.theme;
  tb.textContent = "外观：" + (th === "light" ? "浅色" : th === "dark" ? "深色" : "跟随系统");
}
function bindControls() {
  document.querySelectorAll("[data-chips]").forEach(box => {
    box.innerHTML = box.dataset.opts.split(",").map(v => `<button type="button" data-c="${v}">${v} 万</button>`).join("");
    box.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      G[box.dataset.chips] = +b.dataset.c; G.preset = -1; update();
    });
  });
  document.addEventListener("click", e => {
    const b = e.target.closest(".seg[data-k] button"); if (!b) return;
    const k = b.parentElement.dataset.k;
    let v = b.dataset.v; if (NUMERIC.has(k)) v = +v;
    G[k] = v;
    if (k === "gender") G.marryAge = GENDER[v].marry;
    if (!["chartMode", "horizon"].includes(k)) G.preset = -1;
    update();
  });
  document.addEventListener("input", e => {
    const el = e.target; if (!el.dataset || !el.dataset.k || el.closest(".seg")) return;
    const k = el.dataset.k;
    if (el.type === "checkbox") G[k] = el.checked;
    else if (el.type === "range") { G[k] = +el.value; setRangeFill(el); }
    else G[k] = NUMERIC.has(k) ? +el.value : el.value;
    G.preset = -1;
    scheduleUpdate();
  });
  $("shareBtn").onclick = () => {
    const url = location.href.split("#")[0] + "#s=" + btoa(unescape(encodeURIComponent(JSON.stringify(G))));
    const done = () => toast("链接已复制，发给别人打开就是同一套设置");
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt("复制这个链接：", url));
    else prompt("复制这个链接：", url);
  };
  $("resetBtn").onclick = () => { G = clone(DEFAULT); history.replaceState(null, "", location.pathname); update(); toast("已恢复默认"); };
  $("themeBtn").onclick = () => {
    const root = document.documentElement, cur = root.dataset.theme;
    const next = !cur ? "light" : cur === "light" ? "dark" : "";
    if (next) root.dataset.theme = next; else delete root.dataset.theme;
    try { localStorage.setItem("career_theme", next); } catch (e) {}
    syncControls(); render();
  };
}
let raf = 0;
function scheduleUpdate() { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }

// ───────── 选路线 ─────────
function renderPresets() {
  $("presets").innerHTML = PRESETS.map((p, i) => `<button class="preset" data-p="${i}"><b>${p.name}</b><span>${p.desc}</span></button>`).join("");
  $("presets").onclick = e => {
    const b = e.target.closest(".preset"); if (!b) return;
    const p = PRESETS[+b.dataset.p];
    const keep = { chartMode: G.chartMode, horizon: G.horizon };
    G = Object.assign(clone(DEFAULT), clone(p.set), keep, { preset: +b.dataset.p });
    G.marryAge = GENDER[G.gender].marry;
    update();
  };
}
const routeOpts = sel => ROUTE_ORDER.map(k => `<option value="${k}"${k === sel ? " selected" : ""}>${ROUTES[k].name}</option>`).join("");
const cityOpts = sel => CITY_ORDER.map(k => `<option value="${k}"${k === sel ? " selected" : ""}>${CITIES[k].name}</option>`).join("");
function slotLabel(s) {
  const d = effDeg(s.r, s.d);
  return `${ROUTES[s.r].short} · ${CITIES[s.c].short} · ${DEG[d].name}`;
}
function renderSlots() {
  const html = G.slots.map((s, i) => `
    <div class="slot" style="--sc:${COLORS[i]}" data-i="${i}">
      <div class="head"><span class="tag">路线 ${TAGS[i]}</span>${G.slots.length > 1 ? `<button class="x" data-act="rm" aria-label="删除这条路线">×</button>` : ""}</div>
      <label class="f">岗位</label><select data-s="r" aria-label="岗位">${routeOpts(s.r)}</select>
      <label class="f">城市</label><select data-s="c" aria-label="城市">${cityOpts(s.c)}</select>
      <label class="f">学历</label>
      <div class="seg" data-s="d">${DEG.map((x, j) => `<button data-sd="${j}" class="${effDeg(s.r, s.d) === j ? "on" : ""}">${x.name}</button>`).join("")}</div>
      ${ROUTES[s.r].minDeg && s.d < ROUTES[s.r].minDeg ? `<div class="note" style="margin-top:6px">这条路基本要求硕士，已按硕士计算。</div>` : ""}
    </div>`).join("") + (G.slots.length < 4 ? `<button class="addslot" data-act="add">＋ 再加一条对比</button>` : "");
  $("slots").innerHTML = html;
}
function bindSlots() {
  const box = $("slots");
  box.addEventListener("change", e => {
    const sel = e.target.closest("select[data-s]"); if (!sel) return;
    const i = +sel.closest(".slot").dataset.i;
    G.slots[i][sel.dataset.s] = sel.value; G.preset = -1; update();
  });
  box.addEventListener("click", e => {
    const t = e.target.closest("[data-act],[data-sd]"); if (!t) return;
    if (t.dataset.act === "add") {
      const used = new Set(G.slots.map(s => s.r));
      const r = ROUTE_ORDER.find(k => !used.has(k)) || "sy";
      G.slots.push({ r, c: G.slots[0].c, d: 0 });
    } else if (t.dataset.act === "rm") {
      G.slots.splice(+t.closest(".slot").dataset.i, 1);
    } else {
      const i = +t.closest(".slot").dataset.i; G.slots[i].d = +t.dataset.sd;
    }
    G.preset = -1; update();
  });
}

// ───────── 计算缓存 ─────────
let SIMS = [], EVS = [];

// ───────── 总览 ─────────
function pressure(ratio) {
  if (ratio < 0.25) return ["轻松", "good"];
  if (ratio < 0.35) return ["可控", ""];
  if (ratio < 0.5) return ["吃力", "warn"];
  return ["高压", "crit"];
}
function renderOverview() {
  $("sumcards").innerHTML = G.slots.map((s, i) => {
    const S = SIMS[i], R = ROUTES[s.r], C = CITIES[s.c];
    const w0 = S.rows.find(x => x.age === S.workStart) || S.rows[0];
    const w4 = S.rows.find(x => x.age === S.workStart + 4) || w0;
    const hrs = w4.hours * w4.weeks + (G.commuteOn ? C.commute / 60 * 5 * w4.weeks : 0);
    const hourly = hrs ? w4.inc / hrs : 0;
    const flags = [];
    if (S.house.done) {
      const short = S.house.need - S.house.avail;
      const ratio = (S.house.payCash1 || 0) / Math.max(1, S.house.inc1 || 1);
      if (short > 0) flags.push(`<span class="flag crit">${S.house.age} 岁首付差 ${W(short)}</span>`);
      else flags.push(`<span class="flag good">${S.house.age} 岁首付够</span>`);
      if (ratio < 0.005) flags.push(`<span class="flag good">公积金基本覆盖月供</span>`);
      else { const [pl, pc] = pressure(ratio); flags.push(`<span class="flag ${pc}">月供压力${pl} ${P(ratio)}</span>`); }
    }
    flags.push(`<span class="flag">每年上岸率 ${P(probOf(i))}</span>`);
    if (s.r === "dc" && s.c === "sb") flags.push(`<span class="flag warn">苏北几乎没有大厂岗位</span>`);
    if (s.r === "js") flags.push(`<span class="flag warn">小学岗在收缩</span>`);
    return `<div class="sumcard" style="--sc:${COLORS[i]}">
      <div class="t">${TAGS[i]} · ${esc(slotLabel(s))}<small>${esc(R.name)}，${S.workStart} 岁入职，${S.retire} 岁退休</small></div>
      <div class="kv">
        <div><div class="k">首年月均到手</div><div class="v">${Y(w0.inc / 12)}<small>元</small></div><div class="d">全包 ${W(w0.inc + w0.fin + w0.ann)}／年</div></div>
        <div><div class="k">第 5 年时薪</div><div class="v">${Math.round(hourly)}<small>元/时</small></div><div class="d">月均到手 ${Y(w4.inc / 12)}</div></div>
        <div><div class="k">35 岁净资产</div><div class="v">${Wn(S.at(35).net)}<small>万</small></div><div class="d">其中现金+公积金 ${W(S.at(35).liquid)}</div></div>
        <div><div class="k">45 岁净资产</div><div class="v">${Wn(S.at(45).net)}<small>万</small></div><div class="d">期望值 ${W(EVS[i].at45)}</div></div>
        <div><div class="k">退休金（今天的钱）</div><div class="v">${Y(S.pension)}<small>元/月</small></div><div class="d">领 ${S.payYears} 年</div></div>
        <div><div class="k">一生到手 + 养老金</div><div class="v">${Math.round(S.lifetime / 1e4)}<small>万</small></div><div class="d">工作 ${S.contribYears} 年</div></div>
      </div>
      <div>${flags.join("")}</div>
    </div>`;
  }).join("");
}

// ───────── 折线图 ─────────
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1, step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
  const out = []; for (let v = a; v <= b + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}
function renderLine() {
  const host = $("lineChart");
  const width = Math.max(300, host.clientWidth || 600);
  const height = Math.round(clamp(width * 0.56, 280, 440));
  const m = { l: width < 500 ? 44 : 56, r: 16, t: 16, b: 34 };
  const key = G.chartMode;
  const maxAge = Math.min(G.horizon, Math.max(...SIMS.map(s => s.retire)) - 1);
  const series = SIMS.map((S, i) => ({ i, pts: S.rows.filter(r => r.age <= maxAge).map(r => [r.age, r[key], r]) }));
  const all = series.flatMap(s => s.pts.map(p => p[1]));
  let lo = Math.min(0, ...all), hi = Math.max(...all, 1);
  const ticks = niceTicks(lo / 1e4, hi / 1e4).map(v => v * 1e4);
  lo = ticks[0]; hi = ticks[ticks.length - 1];
  const x = a => m.l + (a - 22) / (maxAge - 22) * (width - m.l - m.r);
  const y = v => m.t + (1 - (v - lo) / (hi - lo)) * (height - m.t - m.b);
  let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="各路线${key === "net" ? "净资产" : key === "liquid" ? "现金加公积金" : "累计到手"}随年龄变化">`;
  for (const t of ticks) {
    s += `<line class="${t === 0 ? "zero" : "grid"}" x1="${m.l}" x2="${width - m.r}" y1="${y(t)}" y2="${y(t)}"/>`;
    s += `<text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${Math.round(t / 1e4)}${t === ticks[ticks.length - 1] ? "万" : ""}</text>`;
  }
  const step = maxAge - 22 > 30 ? 5 : maxAge - 22 > 16 ? 4 : 2;
  for (let a = 22; a <= maxAge; a += step) s += `<text x="${x(a)}" y="${height - 10}" text-anchor="middle">${a}${a === 22 ? " 岁" : ""}</text>`;
  for (const se of series) {
    const d = se.pts.map((p, j) => (j ? "L" : "M") + x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1)).join("");
    s += `<path d="${d}" fill="none" stroke="${COLORS[se.i]}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (const p of se.pts) if (p[2].ev.includes("买房")) s += `<circle cx="${x(p[0])}" cy="${y(p[1])}" r="4.5" fill="var(--surface)" stroke="${COLORS[se.i]}" stroke-width="2"><title>买房</title></circle>`;
  }
  s += `<line class="cross" id="lcCross" x1="0" x2="0" y1="${m.t}" y2="${height - m.b}" style="display:none"/>`;
  s += `<g id="lcDots"></g></svg><div class="tooltip" id="lcTip"></div>`;
  host.innerHTML = s;
  $("lineLegend").innerHTML = SIMS.map((S, i) => `<span class="i"><span class="sw" style="background:${COLORS[i]}"></span>${TAGS[i]} ${esc(slotLabel(G.slots[i]))}</span>`).join("") + `<span class="i">○ 买房那一年</span>`;

  const svg = host.querySelector("svg"), tip = $("lcTip"), cross = $("lcCross"), dots = $("lcDots");
  const showAt = clientX => {
    const rc = svg.getBoundingClientRect();
    const px = (clientX - rc.left) * width / rc.width;
    const age = Math.round(clamp(22 + (px - m.l) / (width - m.l - m.r) * (maxAge - 22), 22, maxAge));
    cross.setAttribute("x1", x(age)); cross.setAttribute("x2", x(age)); cross.style.display = "";
    let rowsH = "", dh = "";
    for (const se of series) {
      const p = se.pts.find(q => q[0] === age); if (!p) continue;
      dh += `<circle cx="${x(age)}" cy="${y(p[1])}" r="4" fill="${COLORS[se.i]}"/>`;
      const extra = [p[2].phase, ...p[2].ev].filter(Boolean).join(" · ");
      rowsH += `<div class="r"><span><span style="color:${COLORS[se.i]}">●</span> ${TAGS[se.i]}</span><span class="v">${W(p[1])}</span></div><div class="e">${esc(extra)}｜到手 ${W(p[2].inc)}</div>`;
    }
    dots.innerHTML = dh;
    tip.innerHTML = `<div class="h">${age} 岁${age === 22 ? "（本科毕业）" : ""}</div>${rowsH}`;
    tip.style.display = "block";
    const tx = x(age) * rc.width / width;
    const tw = tip.offsetWidth;
    tip.style.left = (tx + 14 + tw > rc.width ? Math.max(0, tx - tw - 14) : tx + 14) + "px";
    tip.style.top = "8px";
  };
  const hide = () => { tip.style.display = "none"; cross.style.display = "none"; dots.innerHTML = ""; };
  svg.addEventListener("pointermove", e => showAt(e.clientX));
  svg.addEventListener("pointerdown", e => showAt(e.clientX));
  svg.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") hide(); });
  svg.addEventListener("touchmove", e => { if (e.touches[0]) showAt(e.touches[0].clientX); }, { passive: true });
}

function renderMilestones() {
  const ages = [25, 30, 35, 40, 45, 50];
  let h = `<tr><th>路线</th>${ages.map(a => `<th class="num">${a} 岁</th>`).join("")}<th class="num">退休金/月</th></tr>`;
  SIMS.forEach((S, i) => {
    h += `<tr><td><span class="sw" style="background:${COLORS[i]}"></span>${TAGS[i]} ${esc(slotLabel(G.slots[i]))}</td>${ages.map(a => {
      const v = S.at(a).net; return `<td class="num ${v < 0 ? "neg" : ""}">${W(v)}</td>`; }).join("")}<td class="num">${Y(S.pension)}</td></tr>`;
  });
  $("milestoneTable").innerHTML = h;
  // 逐年
  const maxA = Math.max(...SIMS.map(s => s.retire)) - 1;
  let t = `<tr><th>年龄</th>${SIMS.map((S, i) => `<th class="num" colspan="2" style="color:${COLORS[i]}">${TAGS[i]} 到手 / 净资产</th>`).join("")}</tr>`;
  for (let a = 22; a <= maxA; a++) {
    t += `<tr><td>${a}</td>${SIMS.map(S => { const r = S.rows.find(x => x.age === a);
      return r ? `<td class="num">${W(r.inc)}${r.ev.length ? `<br><span class="note">${r.ev.join("·")}</span>` : ""}</td><td class="num ${r.net < 0 ? "neg" : ""}">${W(r.net)}</td>` : `<td class="num">退休</td><td></td>`; }).join("")}</tr>`;
  }
  $("yearTable").innerHTML = t;
}

// ───────── 收入构成 ─────────
function hbars(rows, max, fmt) {
  return rows.map(r => {
    const tot = r.segs.reduce((a, s) => a + s.v, 0);
    return `<div class="bar"><div class="lab"><span>${r.label}</span><span class="v">${fmt(tot)}</span></div>
      <div class="track">${r.segs.map(s => `<div class="seg" title="${esc(s.n)} ${fmt(s.v)}" style="width:${Math.max(0, s.v / max * 100)}%;background:${s.c}"></div>`).join("")}</div>
      ${r.sub ? `<div class="sub2">${r.sub}</div>` : ""}</div>`;
  }).join("");
}
function renderIncome() {
  const yrs = [0, 4, 9];
  const data = yrs.map(k => SIMS.map((S, i) => {
    const r = S.rows.find(x => x.age === S.workStart + k) || S.rows[S.rows.length - 1];
    return { i, inc: r.inc, fin: r.fin, ann: r.ann, age: r.age };
  }));
  const max = Math.max(...data.flat().map(d => d.inc + d.fin + d.ann));
  $("incomeBars").innerHTML = yrs.map((k, j) => `<div class="card"><h3 style="margin-top:0">第 ${k + 1} 年</h3><div class="bars">${hbars(data[j].map(d => ({
    label: `<span style="color:${COLORS[d.i]}">●</span> ${TAGS[d.i]} ${ROUTES[G.slots[d.i].r].short}`,
    segs: [{ v: d.inc, c: COLORS[d.i], n: "到手" }, { v: d.fin, c: "var(--baseline)", n: "公积金" }, { v: d.ann, c: "var(--surface-3)", n: "年金" }],
    sub: `${d.age} 岁 · 到手 ${W(d.inc)} · 公积金 ${W(d.fin)}${d.ann ? " · 年金 " + W(d.ann) : ""}`,
  })), max, W)}</div></div>`).join("");
}

// ───────── 时薪 ─────────
function renderHours() {
  const rows = SIMS.map((S, i) => {
    const C = CITIES[G.slots[i].c];
    const r = S.rows.find(x => x.age === S.workStart + 4) || S.rows[0];
    const work = r.hours * r.weeks, com = G.commuteOn ? C.commute / 60 * 5 * r.weeks : 0;
    return { i, h: r.inc / (work + com), work, com, inc: r.inc };
  });
  const max = Math.max(...rows.map(r => r.h));
  $("hourBars").innerHTML = hbars(rows.map(r => ({
    label: `<span style="color:${COLORS[r.i]}">●</span> ${TAGS[r.i]} ${esc(slotLabel(G.slots[r.i]))}`,
    segs: [{ v: r.h, c: COLORS[r.i], n: "时薪" }],
    sub: `年到手 ${W(r.inc)} ÷（工作 ${Y(r.work)} 小时${r.com ? " + 通勤 " + Y(r.com) + " 小时" : ""}）`,
  })), max, v => Math.round(v) + " 元/时");
}

// ───────── 买房 ─────────
function renderHouse() {
  let h = `<tr><th>路线</th><th class="num">总价</th><th class="num">你要掏的首付+税费装修</th><th class="num">当时手里有</th><th class="num">月供（你的份额）</th><th class="num">公积金冲抵后现金月供</th><th class="num">占月均到手</th><th>最早凑够首付</th></tr>`;
  SIMS.forEach((S, i) => {
    const s = G.slots[i];
    if (!G.houseOn) return;
    const H = S.house;
    if (!H.done) { h += `<tr><td>${TAGS[i]}</td><td colspan="7" class="note">买房年龄早于入职或已关闭</td></tr>`; return; }
    const ratio = (H.payCash1 || 0) / Math.max(1, H.inc1 || 1);
    const [pl, pc] = pressure(ratio);
    // 最早可买：不买房的模拟里，现金+公积金+家里支持 ≥ 当年所需
    const nb = simulate(s, { noBuy: true });
    let first = "—";
    for (const r of nb.rows) {
      if (r.age < S.workStart) continue;
      const unit = CITIES[s.c].price * G.locMult * Math.pow(1 + G.trend / 100, r.age - 22);
      const tot = unit * G.area;
      const need = (tot * G.down / 100 + tot * 0.015 + G.area * 1500) * H.share;
      const fam = G.famDown ? Math.max(0, G.famPool * 1e4 - r.famUsed) : 0;
      if (r.liquid + fam >= need) { first = r.age + " 岁"; break; }
    }
    h += `<tr><td><span class="sw" style="background:${COLORS[i]}"></span>${TAGS[i]} ${esc(slotLabel(s))}${H.share < 1 ? `<br><span class="note">按 ${P(H.share)} 份额</span>` : ""}</td>
      <td class="num">${W(H.total)}<br><span class="note">${Y(H.unit)} 元/㎡</span></td>
      <td class="num">${W(H.need)}</td>
      <td class="num ${H.avail < H.need ? "neg" : "pos"}">${W(H.avail)}</td>
      <td class="num">${Y(H.pay / 12)}</td>
      <td class="num">${Y((H.payCash1 || 0) / 12)}</td>
      <td class="num"><span class="flag ${pc}" style="margin:0">${pl} ${P(ratio)}</span></td>
      <td>${first}</td></tr>`;
  });
  $("houseTable").innerHTML = G.houseOn ? h : `<tr><td class="note">已关闭「计入买房」。</td></tr>`;
  let c = `<tr><th>城市</th><th class="num">刚需单价</th><th class="num">${G.area}㎡ 总价</th><th class="num">月租（合租）</th><th>板块说明</th></tr>`;
  for (const k of CITY_ORDER) {
    const C = CITIES[k];
    c += `<tr><td>${C.short}</td><td class="num">${Y(C.price)}</td><td class="num">${W(C.price * G.area)}</td><td class="num">${Y(C.rent)}</td><td class="note">${C.priceNote}</td></tr>`;
  }
  $("cityTable").innerHTML = c;
}

// ───────── 男女 ─────────
function renderGender() {
  let h = `<tr><th>路线</th><th>性别</th><th class="num">35 岁</th><th class="num">45 岁</th><th class="num">退休</th><th class="num">养老金/月</th><th class="num">领取年数</th><th class="num">一生到手+养老金</th><th class="num">其中：生育影响</th><th class="num">其中：习俗分担</th></tr>`;
  const sum = { m: 0, f: 0 };
  G.slots.forEach((s, i) => {
    for (const gk of ["m", "f"]) {
      const o = { gender: gk, marryAge: G.marryAge === GENDER[G.gender].marry ? GENDER[gk].marry : G.marryAge };
      const S = simulate(s, o);
      const noMat = simulate(s, { ...o, matMode: "none" });
      const wedEq = G.wed > 0 ? G.wed : CITIES[s.c].wedM;
      const neutral = simulate(s, { ...o, shareMode: "half", wed: wedEq * 0.5 + (G.wed > 0 ? G.wed : CITIES[s.c].wedF) * 0.5 });
      const matD = S.at(45).net - noMat.at(45).net;
      const cusD = S.at(45).net - neutral.at(45).net;
      sum[gk] += S.lifetime;
      const col = gk === "m" ? "var(--male)" : "var(--female)";
      h += `<tr>${gk === "m" ? `<td rowspan="2"><span class="sw" style="background:${COLORS[i]}"></span>${TAGS[i]} ${esc(slotLabel(s))}</td>` : ""}
        <td style="color:${col};font-weight:600">${GENDER[gk].name}</td>
        <td class="num">${W(S.at(35).net)}</td><td class="num">${W(S.at(45).net)}</td>
        <td class="num">${S.retire} 岁</td><td class="num">${Y(S.pension)}</td><td class="num">${S.payYears} 年</td>
        <td class="num">${Math.round(S.lifetime / 1e4)} 万</td>
        <td class="num ${matD < -1 ? "neg" : ""}">${Math.abs(matD) < 1000 ? "≈0" : W(matD)}</td>
        <td class="num ${cusD > 1000 ? "pos" : cusD < -1000 ? "neg" : ""}">${Math.abs(cusD) < 1000 ? "≈0" : (cusD > 0 ? "+" : "") + W(cusD)}</td></tr>`;
    }
  });
  $("genderTable").innerHTML = h;
  $("genderNote").innerHTML = `「生育影响」「习俗分担」都是对 45 岁净资产的影响：前者＝开着「按统计规律」减去关掉；后者＝按习俗分担减去「首付对半、婚嫁支出取男女平均」。习俗分担对女性常是正数（个人花得少），但房产也记得少——它改变的是谁的名下有什么，不是家庭总财富。`;

  $("maleNotes").innerHTML = [
    "<b>婚房与彩礼压力集中在男方</b>，苏北尤甚。如果目标城市是上海，首付通常要靠家里 + 自己攒 5 年以上；表里的「习俗分担」列就是这笔差别。",
    "<b>退休晚 5 年、领养老金少 4–7 年</b>。体制内男性多交 5 年，基础养老金也更高，但一生领取总额反而可能不如女性。",
    "<b>35 岁风险对男性同样存在</b>，而且更常面对「家里唯一主要收入」的处境；企业路线建议至少存够 12 个月开支的应急金。",
    "江苏婚恋市场里「编制」对男性是加分项，但不是决定项——收入稳定、住房、离家远近一起看。",
  ].map(x => `<li>${x}</li>`).join("");
  $("femaleNotes").innerHTML = [
    "<b>生育的职业代价主要发生在企业</b>：当年绩效、晋升顺延、回来后的岗位调整。体制内产假工资照发，影响小得多——这是很多女生偏好编制的理性原因。",
    "<b>退休早（58 岁）、寿命长</b>：工作年限少 5 年，但养老金多领 7 年左右；体制内的职业年金对女性尤其划算。",
    "招聘中的婚育歧视是违法的，但在企业面试里仍真实存在；考编考公的笔试排名制相对更公平。",
    "<b>不要把「男方出房」当默认前提</b>：把「婚后买房谁出钱」切到「对半」或「全自己」，看看你自己的路线能否独立撑起一套房——这才是抗风险的底线。",
  ].map(x => `<li>${x}</li>`).join("");
}

// ───────── 学历 ─────────
function renderDegree() {
  let h = `<tr><th>路线</th><th>学历</th><th class="num">入职年龄</th><th class="num">首年到手</th><th class="num">每年上岸率</th><th class="num">35 岁</th><th class="num">45 岁</th><th class="num">一生到手+养老金</th><th>追平本科</th></tr>`;
  const seen = new Set();
  G.slots.forEach((s, i) => {
    const k = s.r + s.c; if (seen.has(k)) return; seen.add(k);
    const degs = ROUTES[s.r].minDeg ? [1, 2] : [0, 1, 2];
    const sims = degs.map(d => ({ d, S: simulate({ ...s, d }) }));
    const base = sims[0].S;
    sims.forEach(({ d, S }, j) => {
      const w0 = S.rows.find(x => x.age === S.workStart);
      let catchup = "—";
      if (j > 0) {
        const hit = S.rows.find(r => r.age >= S.workStart && r.net >= (base.rows.find(b => b.age === r.age) || {}).net);
        catchup = hit ? hit.age + " 岁" : "工作期内未追平";
      }
      const p = clamp(Math.round(ROUTES[s.r].prob * LEVELS[G.level].prob * (d >= 1 ? 1.3 : 1) * 20) / 20, 0.05, 0.95);
      h += `<tr>${j === 0 ? `<td rowspan="${degs.length}"><span class="sw" style="background:${COLORS[i]}"></span>${esc(ROUTES[s.r].short + " · " + CITIES[s.c].short)}</td>` : ""}
        <td>${DEG[d].name}</td><td class="num">${S.workStart}</td><td class="num">${W(w0.inc)}</td><td class="num">${P(p)}</td>
        <td class="num ${S.at(35).net < 0 ? "neg" : ""}">${W(S.at(35).net)}</td><td class="num">${W(S.at(45).net)}</td>
        <td class="num">${Math.round(S.lifetime / 1e4)} 万</td><td>${j === 0 ? "（基准）" : catchup}</td></tr>`;
    });
  });
  $("degreeTable").innerHTML = h;
  $("degreeNote").innerHTML = "怎么读：体制内的硕士溢价主要在<b>定级高一档、晋升快 1–2 年和选调资格</b>，钱上的回报偏慢，常常要 35–45 岁才追平；大厂的硕士溢价体现在起薪（约 +25%）和<b>拿到 offer 的概率</b>，后者在本表的「每年上岸率」里。博士只在高校教职、人才引进（安家费 10–50 万不等，未计入）、算法研究岗时才划算。读研期间的花费按「" + G.gradCost + " 万／年」" + (G.famGrad ? "，优先由家里支持" : "，全部自己承担") + "。";
}

// ───────── 概率 ─────────
function renderOdds() {
  $("fallbackSel").innerHTML = ["zx", "bank", "wq", "gq", "sy"].map(k => `<option value="${k}"${k === G.fallback ? " selected" : ""}>${ROUTES[k].name}</option>`).join("");
  const box = $("probBox"), sig = JSON.stringify(G.slots) + G.level + JSON.stringify(G.probs);
  if (box.dataset.sig !== sig) { box.dataset.sig = sig;
  box.innerHTML = `<legend>每年上岸概率</legend>` + G.slots.map((s, i) => {
    const p = probOf(i);
    return `<div class="ctl"><div class="row"><span class="lab"><span style="color:${COLORS[i]}">●</span> ${TAGS[i]} ${esc(slotLabel(s))}</span><span class="val">${P(p)}</span></div>
      <input type="range" min="5" max="95" step="5" value="${Math.round(p * 100)}" data-pi="${i}"></div>`;
  }).join("") + `<div class="hint">默认值＝路线基准 × 竞争力系数 ×（硕士 1.3）。</div>`;
  box.querySelectorAll("input[data-pi]").forEach(el => { setRangeFill(el); }); }
  let h = `<tr><th>路线</th><th class="num">试 ${G.tries} 年内上岸</th><th class="num">35 岁（走通）</th><th class="num">35 岁（期望）</th><th class="num">45 岁（走通）</th><th class="num">45 岁（期望）</th><th class="num">一生（期望）</th></tr>`;
  G.slots.forEach((s, i) => {
    const S = SIMS[i], E = EVS[i];
    h += `<tr><td><span class="sw" style="background:${COLORS[i]}"></span>${TAGS[i]} ${esc(slotLabel(s))}</td>
      <td class="num">${P(E.succ)}</td><td class="num">${W(S.at(35).net)}</td><td class="num"><b>${W(E.at35)}</b></td>
      <td class="num">${W(S.at(45).net)}</td><td class="num"><b>${W(E.at45)}</b></td><td class="num">${Math.round(E.life / 1e4)} 万</td></tr>`;
  });
  $("oddsTable").innerHTML = h;
  $("oddsNote").innerHTML = `期望＝Σ（第 k 年上岸的概率 × 晚 k 年入职的结果）+（一直没上岸的概率 × 一直做保底工作的结果）。「走通」就是前面曲线里的数字。`;
}
function bindOdds() {
  $("probBox").addEventListener("input", e => {
    const el = e.target.closest("input[data-pi]"); if (!el) return;
    const s = G.slots[+el.dataset.pi];
    G.probs[s.r + s.c + s.d] = +el.value / 100;
    $("probBox").dataset.sig = JSON.stringify(G.slots) + G.level + JSON.stringify(G.probs);
    setRangeFill(el);
    el.closest(".ctl").querySelector(".val").textContent = el.value + "%";
    clearTimeout(bindOdds.t); bindOdds.t = setTimeout(() => { compute(); renderAll(true); save(); }, 120);
  });
}

// ───────── 钱以外 ─────────
const WDIMS = [...SCORE_DIMS, "城市便利", "财务"];
function renderSoft() {
  const wb = $("weightBox");
  if (!wb.dataset.built) {
    wb.innerHTML = `<legend>你的权重</legend>` + WDIMS.map((d, j) => `<div class="ctl"><div class="row"><span class="lab">${d}</span><span class="val" id="wv${j}"></span></div>
      <input type="range" min="0" max="3" step="0.5" data-wi="${j}"></div>`).join("");
    wb.addEventListener("input", e => {
      const el = e.target.closest("input[data-wi]"); if (!el) return;
      G.weights[+el.dataset.wi] = +el.value; setRangeFill(el); renderSoft(); save();
    });
    wb.dataset.built = 1;
  }
  wb.querySelectorAll("input[data-wi]").forEach(el => { const j = +el.dataset.wi; el.value = G.weights[j]; setRangeFill(el); $("wv" + j).textContent = "× " + G.weights[j]; });
  const lifeMax = Math.max(...EVS.map(e => e.life)), lifeMin = Math.min(...EVS.map(e => e.life));
  const rows = G.slots.map((s, i) => {
    const sc = [...ROUTES[s.r].score, CITIES[s.c].conv, lifeMax === lifeMin ? 4 : 2 + 3 * (EVS[i].life - lifeMin) / (lifeMax - lifeMin)];
    const wsum = G.weights.reduce((a, b) => a + b, 0) || 1;
    const tot = sc.reduce((a, v, j) => a + v * G.weights[j], 0) / wsum;
    return { i, sc, tot };
  });
  $("scoreBars").innerHTML = hbars(rows.map(r => ({
    label: `<span style="color:${COLORS[r.i]}">●</span> ${TAGS[r.i]} ${esc(slotLabel(G.slots[r.i]))}`,
    segs: [{ v: r.tot, c: COLORS[r.i], n: "加权分" }], sub: "",
  })), 5, v => v.toFixed(2) + " / 5");
  let h = `<tr><th>维度</th>${G.slots.map((s, i) => `<th class="num" style="color:${COLORS[i]}">${TAGS[i]} ${ROUTES[s.r].short}</th>`).join("")}</tr>`;
  WDIMS.forEach((d, j) => { h += `<tr><td>${d}</td>${rows.map(r => `<td class="num">${r.sc[j].toFixed(1)}</td>`).join("")}</tr>`; });
  $("scoreTable").innerHTML = h;
  $("routeNotes").innerHTML = G.slots.map((s, i) => `<li><b style="color:${COLORS[i]}">${TAGS[i]} ${esc(ROUTES[s.r].short)}</b>：${esc(ROUTES[s.r].note)}</li>`).join("");
}

// ───────── 主流程 ─────────
function compute() {
  SIMS = G.slots.map(s => simulate(s));
  EVS = G.slots.map((s, i) => expected(i));
}
function renderAll(skipSetup) {
  if (!skipSetup) { renderSlots(); syncControls(); }
  renderOverview(); renderLine(); renderMilestones(); renderIncome(); renderHours(); renderHouse();
  renderGender(); renderDegree(); renderOdds(); renderSoft();
  $("ovSub").innerHTML = `当前设置：${GENDER[G.gender].name}性 · ${LEVELS[G.level].name}。每张卡是一条路线的关键数字。「月均到手」＝全年到手 ÷ 12（含年终）；「全包」＝到手 + 双边公积金 + 年金。`;
}
function render() { renderAll(false); }
function update() { compute(); renderAll(false); save(); }

// 目录高亮
function bindToc() {
  const links = [...document.querySelectorAll("#toc a")];
  const secs = links.map(a => document.querySelector(a.getAttribute("href")));
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const i = secs.indexOf(e.target);
      links.forEach((a, j) => a.classList.toggle("on", j === i));
      const a = links[i]; if (a) a.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  secs.forEach(s => s && io.observe(s));
}

// 启动
try { const th = localStorage.getItem("career_theme"); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
load();
renderPresets(); bindControls(); bindSlots(); bindOdds(); bindToc();
update();
let lastW = 0;
new ResizeObserver(() => { const w = $("lineChart").clientWidth; if (Math.abs(w - lastW) > 4) { lastW = w; renderLine(); } }).observe($("lineChart"));
window.__dbg = { simulate, income, get G() { return G; }, get SIMS() { return SIMS; } };
})();
