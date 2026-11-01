// Türkçe doğal dil tarih/saat ayrıştırıcı — bağımlılıksız.
// Tüm işlemler "duvar saati" (seçilen zaman dilimindeki yerel zaman) uzayında yapılır;
// girdi/çıktı Date örnekleridir (mutlak an).

export interface ParseTrOptions {
  /** Referans anı. Varsayılan: Date.now() */
  referenceDate?: Date;
  /** IANA zaman dilimi. Varsayılan: "Europe/Istanbul" (sabit UTC+3). */
  timeZone?: string;
  /** Metinde saat yoksa kullanılacak saat ("SS:DD"). Varsayılan: "09:00". */
  defaultTime?: string;
}

export interface ParseTrResult {
  date: Date;
  /** Eşleşen orijinal metin. */
  matchedText: string;
  /** Eşleşen kısım çıkarıldıktan sonra kalan metin. */
  rest: string;
  /** 0-1 arası sezgisel güven puanı. */
  confidence: number;
}

const DEFAULT_TZ = "Europe/Istanbul";
const DEFAULT_TIME = "09:00";

// ---------- Türkçe duyarlı küçük harf (uzunluk koruyan) ----------

function trLower(s: string): string {
  let out = "";
  for (const ch of s) {
    if (ch === "İ") out += "i";
    else if (ch === "I") out += "ı";
    else if (ch === "’") out += "'";
    else {
      const lc = ch.toLowerCase();
      // Uzunluk koru: bazı Unicode harflerin lower'ı 2 birimdir (ör. ß→ss).
      out += lc.length === 1 ? lc : ch;
    }
  }
  return out;
}

// ---------- Zaman dilimi yardımcıları (Intl tabanlı, bağımlılıksız) ----------

interface Wall {
  y: number;
  m: number; // 1-12
  d: number;
  hh: number;
  mm: number;
  ss: number;
}

function zoneOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const { type, value } of dtf.formatToParts(date)) p[type] = Number(value);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

function wallParts(date: Date, tz: string): Wall {
  const off = zoneOffsetMinutes(date, tz);
  const t = new Date(date.getTime() + off * 60000);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    hh: t.getUTCHours(),
    mm: t.getUTCMinutes(),
    ss: t.getUTCSeconds(),
  };
}

// Duvar saati bileşenlerinden mutlak Date üretir (iki geçişli ofset; sabit ofsetli
// bölgelerde birebir, DST'li bölgelerde geçiş saatlerinde yaklaşık).
function wallToUtc(w: Wall, tz: string): Date {
  const wallMs = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm, w.ss);
  let utc = wallMs - zoneOffsetMinutes(new Date(wallMs), tz) * 60000;
  utc = wallMs - zoneOffsetMinutes(new Date(utc), tz) * 60000;
  return new Date(utc);
}

// ---------- Duvar-saati aritmetiği ----------

const asUTCms = (w: Wall) => Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm, w.ss);

function wallFromMs(ms: number): Wall {
  const t = new Date(ms);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    hh: t.getUTCHours(),
    mm: t.getUTCMinutes(),
    ss: t.getUTCSeconds(),
  };
}

function addDaysW(w: Wall, n: number): Wall {
  return wallFromMs(asUTCms(w) + n * 86400000);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addMonthsW(w: Wall, n: number): Wall {
  let t = w.m - 1 + n;
  const y = w.y + Math.floor(t / 12);
  t = ((t % 12) + 12) % 12;
  const m = t + 1;
  return { y, m, d: Math.min(w.d, daysInMonth(y, m)), hh: w.hh, mm: w.mm, ss: w.ss };
}

function addYearsW(w: Wall, n: number): Wall {
  return addMonthsW(w, n * 12);
}

// 0 = Pazartesi ... 6 = Pazar ("hafta Pazartesi başlar")
function dow(y: number, m: number, d: number): number {
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

const dayNum = (w: { y: number; m: number; d: number }) => w.y * 10000 + w.m * 100 + w.d;

// ---------- Sözlükler ----------

const WEEKDAYS: Record<string, number> = {
  pazartesi: 0,
  salı: 1,
  çarşamba: 2,
  perşembe: 3,
  cuma: 4,
  cumartesi: 5,
  pazar: 6,
};

const MONTHS: Record<string, number> = {
  ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6,
  temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
};

const NUMW = "(?:(?<!on\\s)(?:bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz)|on(?!\\s*(?:bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\\b))";

const NUMBER_WORDS: Record<string, number> = {
  bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6,
  yedi: 7, sekiz: 8, dokuz: 9, on: 10,
};

// Gün bölümü varsayılanları (metinde saat yoksa)
const DAYPART_DEFAULT: Record<string, [number, number]> = {
  sabah: [9, 0],
  "sabaha karşı": [6, 0],
  öğle: [12, 0],
  öğlen: [12, 0],
  "öğleden sonra": [15, 0],
  akşam: [19, 0],
  gece: [22, 0],
};

// Gün bölümü + saat eşlemesi (belirsiz saati gün bölümüne göre çözer)
function mapDaypart(dp: string, h: number): number {
  switch (dp) {
    case "sabah":
    case "sabaha karşı":
      return h; // 0-12 olduğu gibi
    case "öğle":
    case "öğlen":
      return h === 12 ? 12 : h < 12 ? h + 12 : h;
    case "öğleden sonra":
      return h < 12 ? h + 12 : h;
    case "akşam":
      return h < 12 ? h + 12 : h === 12 ? 0 : h;
    case "gece":
      return h === 12 ? 0 : h <= 6 ? h : h + 12;
    default:
      return h;
  }
}

// ---------- Kalıp regexleri ----------
// Metin önce trLower ile normalize edilir; indeksler orijinal metinle aynıdır.

const L = "a-zçğıöşü";
// Kelime başı koruması: harf/rakam içindeki gövdeler eşleşmez (ör. "kayak"→"ay").
const PRE = `(?<![\\d${L}])`;
// Sayısal kalıplar için ek koruma (nokta dahil: "2026.11" yıl.ay diye okunmaz).
const PRE_NUM = `(?<![\\d.${L}])`;
const POST = `(?![${L}])`;
const POST_ND = `(?![${L}\\d])`;
const APOS = `(?:['’][${L}]+)?`;

const NUM = String.raw`\d{1,2}`;
const WS = String.raw`\s+`;

const REL = `bugün|yarın|dün|öbür${WS}gün|evvelsi${WS}gün|önceki${WS}gün`;
const SFX_REL = `(?:['’][${L}]+|(?:n)?(?:a|e|[ıiuü]|da|de|ta|te|ın|in|un|ün)|n?k[ıiuü]|ce)?`;

const WD_ALT = "pazartesi|cumartesi|salı|çarşamba|perşembe|cuma|pazar";
const SFX_WD = `(?:['’][${L}]+|gün(?:ü|ün(?:de|kü)?)?|y?(?:a|e|[ıiuü]|da|de|ta|te|nın|nin|ın|in)|(?:d[ae])?k[ıiuü])?`;

const DP_ALT = `sabaha\\s*karşı|öğleden\\s*sonra|öğlen|öğle|sabah|akşam|gece`;
const SFX_DP = `(?:['’][${L}]+|leyin|leri?|ları|nki|ki|deki?|y?(?:a|e|[ıiuü]))?`;

const MONTH_ALT = "ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık";
const SFX_MONTH = `(?:['’][${L}]+|['’]?(?:ın|in|unda|ünde|da|de|ta|te|a|e))?`;

// Saat biçimleri
const HSEP = `(${NUM})[:.](${NUM})(?:${APOS})`; // 14:30, 14.30'da
const HBU = `(?:\\s*(buçuk)(?:t[ae])?)?`; // 7 buçuk(ta)
const HDIG = `(${NUM})(?:['’]?(?:d[ae]|t[ae]))?${HBU}`; // 9, 9'da, 9da, 7 buçukta
const HWORD = `(${NUMW})(?:['’]?(?:d[ae]|t[ae]))?`; // saat dokuz, dokuz(da), on'da
const HWORD_LOC = `(${NUMW})['’]?(?:d[ae]|t[ae])`; // kelime saat + bulunma eki zorunlu

interface TimePart {
  hh: number;
  mm: number;
  ss: number;
  /** explicit: sabit saat; ambiguous: ÖÖ/ÖS belirsiz (h/h+12); fixed: gün bölümüyle çözülmüş. */
  mode: "explicit" | "ambiguous" | "fixed";
}

interface DatePart {
  y: number;
  m: number;
  d: number;
  /** Geçmişe bakan ifade (dün, geçen..., N...önce): belirsiz saat sabah yorumuna gider. */
  past: boolean;
}

interface Cand {
  start: number;
  end: number;
  kind: "date" | "time";
  date?: DatePart;
  time?: TimePart;
  dConf: number;
  tConf?: number;
}

interface Pattern {
  re: RegExp;
  kind: "date" | "time";
  make: (m: RegExpExecArray, ctx: Ctx) => Omit<Cand, "start" | "end"> | null;
}

interface Ctx {
  ref: Wall;
}

// ---------- Tarih çözücüleri ----------

function wdNext(ref: Wall, target: number, mode: "next" | "past" | "nextWeek" | "lastWeek"): { y: number; m: number; d: number } {
  const td = dow(ref.y, ref.m, ref.d);
  let delta: number;
  if (mode === "next") delta = (target - td + 7) % 7;
  else if (mode === "past") delta = -(((td - target + 7) % 7) || 7);
  else if (mode === "nextWeek") delta = ((7 - td) % 7 || 7) + target;
  else delta = -(td + 7) + target; // lastWeek: geçen haftanın pazartesisi + hedef
  const b = addDaysW(ref, delta);
  return { y: b.y, m: b.m, d: b.d };
}

function nextDayOfYear(ref: Wall, m: number, d: number): { y: number; m: number; d: number } | null {
  if (m < 1 || m > 12) return null;
  let y = ref.y;
  for (let i = 0; i < 60; i++) {
    if (d <= daysInMonth(y, m) && dayNum({ y, m, d }) >= dayNum(ref)) return { y, m, d };
    y++;
  }
  return null;
}

function nextDayOfMonth(ref: Wall, d: number): { y: number; m: number; d: number } | null {
  if (d < 1 || d > 31) return null;
  let cur: Wall = { y: ref.y, m: ref.m, d: 1, hh: 0, mm: 0, ss: 0 };
  for (let i = 0; i < 60; i++) {
    if (d <= daysInMonth(cur.y, cur.m) && dayNum({ y: cur.y, m: cur.m, d }) >= dayNum(ref))
      return { y: cur.y, m: cur.m, d };
    cur = addMonthsW(cur, 1);
  }
  return null;
}

const n = (s: string | undefined) => Number(s);

function absDate(y: number, m: number, d: number, conf: number): Omit<Cand, "start" | "end"> | null {
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  return { kind: "date", date: { y, m, d, past: false }, dConf: conf };
}

function futureMonthDay(ref: Wall, m: number, d: number, conf: number): Omit<Cand, "start" | "end"> | null {
  const found = nextDayOfYear(ref, m, d);
  if (!found) return null;
  return { kind: "date", date: { ...found, past: false }, dConf: conf };
}

// ---------- Kalıplar (öncelik sırasıyla; aynı başlangıçta önce gelen kazanır) ----------

const PATTERNS: Pattern[] = [
  // ---- TARİH ----
  {
    // 15.11.2026, 15/11, 15-11-2026, 15.11.26
    kind: "date",
    re: new RegExp(`${PRE_NUM}(${NUM})[./-](${NUM})(?:[./-](\\d{4}|\\d{2}))?${APOS}${POST_ND}`, "g"),
    make(m, ctx) {
      const d = n(m[1]), mo = n(m[2]);
      if (m[3] !== undefined) {
        const raw = n(m[3]);
        const year = m[3].length === 2 ? 2000 + raw : raw;
        return absDate(year, mo, d, 0.95);
      }
      return futureMonthDay(ctx.ref, mo, d, 0.85);
    },
  },
  {
    // ayın 15'i, ayın 15'inde, ayın 15
    kind: "date",
    re: new RegExp(`${PRE}ayın${WS}(${NUM})(?:['’](?:[ıiuü]|inde|ında|inc(?:i|ı)(?:si)?|uncu|üncü|ınc[ıi]))?${APOS}${POST}`, "g"),
    make(m, ctx) {
      const found = nextDayOfMonth(ctx.ref, n(m[1]));
      if (!found) return null;
      return { kind: "date", date: { ...found, past: false }, dConf: 0.85 };
    },
  },
  {
    // 15'inde, 25'inci (çıplak gün + iyelik eki)
    kind: "date",
    re: new RegExp(`${PRE_NUM}(${NUM})['’]?(?:inde|ında|inc[ıi](?:si)?|uncu|üncü|ınc[ıi])(?:[${L}]+)?${POST}`, "g"),
    make(m, ctx) {
      const found = nextDayOfMonth(ctx.ref, n(m[1]));
      if (!found) return null;
      return { kind: "date", date: { ...found, past: false }, dConf: 0.8 };
    },
  },
  {
    // 15 Kasım, 15 Kasım 2026, 15 kasım'da
    kind: "date",
    re: new RegExp(`${PRE_NUM}(${NUM})${WS}(${MONTH_ALT})${SFX_MONTH}(?:${WS}(\\d{4}|\\d{2})${APOS})?${POST_ND}`, "g"),
    make(m, ctx) {
      const mo = MONTHS[m[2]];
      if (!mo) return null;
      if (m[3] !== undefined) {
        const raw = n(m[3]);
        const year = m[3].length === 2 ? 2000 + raw : raw;
        return absDate(year, mo, n(m[1]), 0.95);
      }
      return futureMonthDay(ctx.ref, mo, n(m[1]), 0.85);
    },
  },
  {
    // Kasım 15, Kasım'ın 15'i
    kind: "date",
    re: new RegExp(`${PRE}(${MONTH_ALT})${SFX_MONTH}(?:['’](?:ın|in))?${WS}(${NUM})${APOS}${POST}`, "g"),
    make(m, ctx) {
      const mo = MONTHS[m[1]];
      if (!mo) return null;
      return futureMonthDay(ctx.ref, mo, n(m[2]), 0.85);
    },
  },
  {
    // geçen hafta salı, önceki hafta cuma
    kind: "date",
    re: new RegExp(`${PRE}(geçen|önceki|evvelki)${WS}hafta${WS}(${WD_ALT})${SFX_WD}${POST}`, "g"),
    make(m, ctx) {
      const w = WEEKDAYS[m[2]];
      if (w === undefined) return null;
      return { kind: "date", date: { ...wdNext(ctx.ref, w, "lastWeek"), past: true }, dConf: 0.9 };
    },
  },
  {
    // haftaya salı, önümüzdeki (hafta) çarşamba, gelecek (hafta) perşembe
    kind: "date",
    re: new RegExp(`${PRE}(?:haftaya|önümüzdeki(?:${WS}hafta)?|gelecek(?:${WS}hafta)?)${WS}(${WD_ALT})${SFX_WD}${POST}`, "g"),
    make(m, ctx) {
      const w = WEEKDAYS[m[1]];
      if (w === undefined) return null;
      return { kind: "date", date: { ...wdNext(ctx.ref, w, "nextWeek"), past: false }, dConf: 0.9 };
    },
  },
  {
    // bugün, yarın, dün, öbür gün, evvelsi gün, önceki gün (+ ekler: yarına, yarınki...)
    kind: "date",
    re: new RegExp(`${PRE}(${REL})${SFX_REL}${POST}`, "g"),
    make(m, ctx) {
      const off: Record<string, [number, boolean]> = {
        "bugün": [0, false],
        "yarın": [1, false],
        "dün": [-1, true],
        "öbür gün": [2, false],
        "evvelsi gün": [-2, true],
        "önceki gün": [-1, true],
      };
      const key = m[1].replace(/\s+/g, " ");
      const hit = off[key];
      if (!hit) return null;
      const b = addDaysW(ctx.ref, hit[0]);
      return { kind: "date", date: { y: b.y, m: b.m, d: b.d, past: hit[1] }, dConf: 0.9 };
    },
  },
  {
    // bu akşam, bu gece, bu sabah, bu öğlen... (tarih + gömülü saat)
    kind: "date",
    re: new RegExp(`${PRE}bu${WS}(${DP_ALT})${SFX_DP}${POST}`, "g"),
    make(m, ctx) {
      const dp = m[1].replace(/\s+/g, " ");
      const [hh, mm] = DAYPART_DEFAULT[dp] ?? [0, 0];
      return {
        kind: "date",
        date: { y: ctx.ref.y, m: ctx.ref.m, d: ctx.ref.d, past: false },
        time: { hh, mm, ss: 0, mode: "fixed" },
        dConf: 0.85,
        tConf: 0.8,
      };
    },
  },
  {
    // süreler: 3 gün sonra, 2 hafta önce, yarım saat sonra, 45 dakika sonra...
    kind: "date",
    re: new RegExp(
      `${PRE}(yarım${WS}saat|\\d{1,3}${WS}(?:saat|dakika|dk|sn|saniye|gün|hafta|ay|yıl)|(${NUMW})${WS}(?:saat|dakika|gün|hafta|ay|yıl))${WS}(sonra|sonrası|önce|öncesinde|evvel)${POST}`,
      "g",
    ),
    make(m, ctx) {
      const dir = m[3] === "sonra" || m[3] === "sonrası" ? 1 : -1;
      const past = dir < 0;
      const keepRefTime: TimePart = { hh: ctx.ref.hh, mm: ctx.ref.mm, ss: ctx.ref.ss, mode: "fixed" };
      let months = 0;
      let ms = 0;
      if (m[1].startsWith("yarım")) {
        ms = 30 * 60000;
      } else {
        const dm = /(\d{1,3})\s*(saat|dakika|dk|sn|saniye|gün|hafta|ay|yıl)/.exec(m[1]);
        let val: number, unit: string;
        if (dm) {
          val = Number(dm[1]);
          unit = dm[2];
        } else {
          const wm = new RegExp(`(${NUMW})\\s*(saat|dakika|gün|hafta|ay|yıl)$`).exec(m[1]);
          if (!wm) return null;
          val = NUMBER_WORDS[wm[1]];
          unit = wm[2];
          if (val === undefined) return null;
        }
        if (unit === "ay") months = dir * val;
        else if (unit === "yıl") months = dir * val * 12;
        else {
          const unitMs: Record<string, number> = {
            saat: 3600000, dakika: 60000, dk: 60000, sn: 1000, saniye: 1000,
            gün: 86400000, hafta: 7 * 86400000,
          };
          const u = unitMs[unit];
          if (!u) return null;
          ms = val * u;
        }
      }
      if (months !== 0) {
        const b = addMonthsW(ctx.ref, months);
        return { kind: "date", date: { y: b.y, m: b.m, d: b.d, past }, dConf: 0.9, time: keepRefTime };
      }
      const w = wallFromMs(asUTCms(ctx.ref) + dir * ms);
      return {
        kind: "date",
        date: { y: w.y, m: w.m, d: w.d, past },
        time: { hh: w.hh, mm: w.mm, ss: w.ss, mode: "fixed" },
        dConf: 0.9,
        tConf: 0.8,
      };
    },
  },
  {
    // geçen salı, önceki çarşamba
    kind: "date",
    re: new RegExp(`${PRE}(geçen|önceki|evvelki)${WS}(${WD_ALT})${SFX_WD}${POST}`, "g"),
    make(m, ctx) {
      const w = WEEKDAYS[m[2]];
      if (w === undefined) return null;
      return { kind: "date", date: { ...wdNext(ctx.ref, w, "past"), past: true }, dConf: 0.9 };
    },
  },
  {
    // bu salı, bu cuma
    kind: "date",
    re: new RegExp(`${PRE}bu${WS}(${WD_ALT})${SFX_WD}${POST}`, "g"),
    make(m, ctx) {
      const w = WEEKDAYS[m[1]];
      if (w === undefined) return null;
      return { kind: "date", date: { ...wdNext(ctx.ref, w, "next"), past: false }, dConf: 0.85 };
    },
  },
  {
    // çıplak hafta günü: salı, cumartesi, pazara, salı günü...
    kind: "date",
    re: new RegExp(`${PRE}(${WD_ALT})${SFX_WD}${POST}`, "g"),
    make(m, ctx) {
      const w = WEEKDAYS[m[1]];
      if (w === undefined) return null;
      return { kind: "date", date: { ...wdNext(ctx.ref, w, "next"), past: false }, dConf: 0.85 };
    },
  },
  {
    // geçen/önceki/evvelki/önümüzdeki/gelecek/bu + hafta|ay|yıl, tek başına haftaya
    kind: "date",
    re: new RegExp(
      `${PRE}(?:(geçen|önceki|evvelki|önümüzdeki|gelecek)${WS}(hafta|ay|yıl)(?:['’]?(?:da|de|ta|te))?|bu${WS}(hafta|ay|yıl)(?:['’]?(?:da|de|ta|te))?|haftaya)${POST}`,
      "g",
    ),
    make(m, ctx) {
      const past = m[1] === "geçen" || m[1] === "önceki" || m[1] === "evvelki";
      if (m[2] === "hafta") {
        const b = addDaysW(ctx.ref, past ? -7 : 7);
        return { kind: "date", date: { y: b.y, m: b.m, d: b.d, past }, dConf: 0.85 };
      }
      if (m[2] === "ay" || m[2] === "yıl") {
        const months = (m[2] === "yıl" ? 12 : 1) * (past ? -1 : 1);
        const b = addMonthsW(ctx.ref, months);
        return { kind: "date", date: { y: b.y, m: b.m, d: b.d, past }, dConf: 0.85 };
      }
      if (m[3]) {
        // bu hafta/ay/yıl → bugün
        return { kind: "date", date: { y: ctx.ref.y, m: ctx.ref.m, d: ctx.ref.d, past: false }, dConf: 0.85 };
      }
      if (m[0] === "haftaya") {
        const b = addDaysW(ctx.ref, 7);
        return { kind: "date", date: { y: b.y, m: b.m, d: b.d, past: false }, dConf: 0.85 };
      }
      return null;
    },
  },

  // ---- SAAT ----
  {
    // gece yarısı
    kind: "time",
    re: new RegExp(`${PRE}gece\\s*yarısı${APOS}${POST}`, "g"),
    make() {
      return { kind: "time", time: { hh: 0, mm: 0, ss: 0, mode: "explicit" }, dConf: 0, tConf: 0.9 };
    },
  },
  {
    // akşam 7'de, sabah 9, öğlen 3'te, gece 11'de, sabaha karşı 6'da...
    kind: "time",
    re: new RegExp(`${PRE}(${DP_ALT})${SFX_DP}\\s*(?:saat\\s*)?(?:${HSEP}|${HDIG}|${HWORD_LOC})${POST}`, "g"),
    make(m) {
      const dp = m[1].replace(/\s+/g, " ");
      if (m[2] !== undefined && m[3] !== undefined) {
        const hh = n(m[2]), mm = n(m[3]);
        if (hh > 23 || mm > 59) return null;
        return { kind: "time", time: { hh, mm, ss: 0, mode: "explicit" }, dConf: 0, tConf: 0.95 };
      }
      if (m[4] !== undefined) {
        const raw = n(m[4]);
        if (raw > 23) return null;
        const mm = m[5] ? 30 : 0;
        return { kind: "time", time: { hh: mapDaypart(dp, raw), mm, ss: 0, mode: "fixed" }, dConf: 0, tConf: 0.85 };
      }
      if (m[6] !== undefined) {
        const raw = NUMBER_WORDS[m[6]];
        if (raw === undefined || raw > 23) return null;
        return { kind: "time", time: { hh: mapDaypart(dp, raw), mm: 0, ss: 0, mode: "fixed" }, dConf: 0, tConf: 0.85 };
      }
      return null;
    },
  },
  {
    // akşam, sabah, öğleden sonra... (tek başına gün bölümü)
    kind: "time",
    re: new RegExp(`${PRE}(${DP_ALT})${SFX_DP}${POST}`, "g"),
    make(m) {
      const dp = m[1].replace(/\s+/g, " ");
      const [hh, mm] = DAYPART_DEFAULT[dp] ?? [0, 0];
      return { kind: "time", time: { hh, mm, ss: 0, mode: "fixed" }, dConf: 0, tConf: 0.8 };
    },
  },
  {
    // saat 14.30, saat 9, saat dokuzda
    kind: "time",
    re: new RegExp(`${PRE}saat${WS}(?:${HSEP}|${HDIG}|${HWORD})${POST}`, "g"),
    make(m) {
      if (m[1] !== undefined && m[2] !== undefined) {
        const hh = n(m[1]), mm = n(m[2]);
        if (hh > 23 || mm > 59) return null;
        return { kind: "time", time: { hh, mm, ss: 0, mode: "explicit" }, dConf: 0, tConf: 0.95 };
      }
      if (m[3] !== undefined) {
        const hh = n(m[3]);
        if (hh > 23) return null;
        const mm = m[4] ? 30 : 0;
        const mode: TimePart["mode"] = hh >= 13 || hh === 0 ? "explicit" : "ambiguous";
        return { kind: "time", time: { hh, mm, ss: 0, mode }, dConf: 0, tConf: mode === "ambiguous" ? 0.75 : 0.95 };
      }
      if (m[5] !== undefined) {
        const hh = NUMBER_WORDS[m[5]];
        if (hh === undefined || hh > 23) return null;
        const mode: TimePart["mode"] = hh >= 13 || hh === 0 ? "explicit" : "ambiguous";
        return { kind: "time", time: { hh, mm: 0, ss: 0, mode }, dConf: 0, tConf: mode === "ambiguous" ? 0.75 : 0.95 };
      }
      return null;
    },
  },
  {
    // çıplak saat: 14:30, 9da, 9'da, 7 buçukta, dokuzda
    kind: "time",
    re: new RegExp(
      `${PRE_NUM}(?:${HSEP}|(${NUM})(?:['’]?(?:d[ae]|t[ae]))${HBU}|(${NUM})\\s*buçuk(?:t[ae])?|${HWORD_LOC})${POST}`,
      "g",
    ),
    make(m) {
      if (m[1] !== undefined && m[2] !== undefined) {
        const hh = n(m[1]), mm = n(m[2]);
        if (hh > 23 || mm > 59) return null;
        return { kind: "time", time: { hh, mm, ss: 0, mode: "explicit" }, dConf: 0, tConf: 0.95 };
      }
      let hh: number | undefined;
      let mm = 0;
      if (m[3] !== undefined) {
        hh = n(m[3]);
        if (m[4]) mm = 30;
      } else if (m[5] !== undefined) {
        hh = n(m[5]);
        mm = 30;
      } else if (m[6] !== undefined) {
        hh = NUMBER_WORDS[m[6]];
      }
      if (hh === undefined || hh > 23) return null;
      const mode: TimePart["mode"] = m[1] !== undefined || hh >= 13 || hh === 0 ? "explicit" : "ambiguous";
      return { kind: "time", time: { hh, mm, ss: 0, mode }, dConf: 0, tConf: 0.7 };
    },
  },
];

// ---------- Eşleşme taraması ----------

function scan(text: string, ctx: Ctx): Cand[] {
  const byStart = new Map<number, Cand>();
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      if (m[0].length === 0) {
        p.re.lastIndex++;
        continue;
      }
      const made = p.make(m, ctx);
      if (made && !byStart.has(m.index)) byStart.set(m.index, { start: m.index, end: m.index + m[0].length, ...made });
    }
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

// ---------- Sonuç ----------

function parseDefaultTime(s: string | undefined): [number, number] {
  if (!s) return [9, 0];
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`Geçersiz defaultTime: "${s}" (beklenen "SS:DD")`);
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) throw new Error(`Geçersiz defaultTime: "${s}"`);
  return [hh, mm];
}

function resolveWall(dp: DatePart | null, tp: TimePart | null, ref: Wall, defH: number, defM: number): Wall | null {
  if (!dp && !tp) return null;
  const base: Wall = dp
    ? { y: dp.y, m: dp.m, d: dp.d, hh: 0, mm: 0, ss: 0 }
    : { y: ref.y, m: ref.m, d: ref.d, hh: 0, mm: 0, ss: 0 };
  if (!tp) {
    base.hh = defH;
    base.mm = defM;
    return base;
  }
  base.hh = tp.hh;
  base.mm = tp.mm;
  base.ss = tp.ss;
  const refDt = asUTCms(ref);
  const nextDay = () => {
    Object.assign(base, addDaysW(base, 1));
  };
  if (!dp) {
    // Tarihsiz: gelecekteki en yakın yorum.
    if (tp.mode === "ambiguous" && tp.hh < 12) {
      if (asUTCms(base) > refDt) return base;
      const later = { ...base, hh: tp.hh + 12 };
      if (asUTCms(later) > refDt) {
        base.hh = tp.hh + 12;
        return base;
      }
      nextDay();
      return base;
    }
    if (asUTCms(base) <= refDt) nextDay();
    return base;
  }
  // Tarihli: yalnız belirsiz saat geleceğe kayar; explicit/fixed olduğu gibi kalır.
  if (tp.mode === "ambiguous" && !dp.past) {
    if (asUTCms(base) > refDt) return base;
    if (tp.hh < 12) {
      const later = { ...base, hh: tp.hh + 12 };
      if (asUTCms(later) > refDt) {
        base.hh = tp.hh + 12;
        return base;
      }
    }
    nextDay();
  }
  return base;
}

function cleanRest(text: string, spans: Array<{ start: number; end: number }>): string {
  let rest = "";
  let last = 0;
  for (const s of spans) {
    rest += text.slice(last, s.start) + " ";
    last = s.end;
  }
  rest += text.slice(last);
  rest = rest.replace(/\s+/g, " ").trim();
  rest = rest.replace(/^[\s.,;:!?–—-]+/, "").replace(/[\s.,;:!?–—-]+$/, "");
  rest = rest.replace(/([.,;:!?])\s*(?:[.,;:!?]\s*)+/g, "$1 ").trim();
  return rest;
}

function buildMatchedText(text: string, a: Cand, b: Cand | null): string {
  if (!b) return text.slice(a.start, a.end).trim();
  const [first, second] = a.start <= b.start ? [a, b] : [b, a];
  const gap = text.slice(first.end, second.start);
  if (/^[\s,;:]*$/.test(gap)) return text.slice(first.start, second.end).trim();
  return `${text.slice(first.start, first.end).trim()} ${text.slice(second.start, second.end).trim()}`;
}

export function parseTr(text: string, options: ParseTrOptions = {}): ParseTrResult | null {
  if (typeof text !== "string" || text.trim() === "") return null;
  const tz = options.timeZone ?? DEFAULT_TZ;
  const refDate = options.referenceDate ?? new Date();
  const ref = wallParts(refDate, tz);
  const [defH, defM] = parseDefaultTime(options.defaultTime);
  const ctx: Ctx = { ref };

  const norm = trLower(text);
  const cands = scan(norm, ctx);

  // En erken başlangıçlı tarih adayı (birleşik "bu akşam" ve süre adayları saat de taşıyabilir).
  const dateCand = cands.find((c) => c.kind === "date" && c.date) ?? null;

  // Zaman adayları: tarih aralığıyla çakışmayanlar arasından tarih aralığına en yakın.
  const timePool = cands.filter(
    (c) => c.time !== undefined && c.kind === "time" && c !== dateCand && !(dateCand && overlaps(c, dateCand)),
  );
  let timeCand: Cand | null = null;
  if (timePool.length > 0) {
    if (dateCand) {
      const dist = (c: Cand) => (c.start >= dateCand.end ? c.start - dateCand.end : dateCand.start - c.end);
      const after = (c: Cand) => (c.start >= dateCand.end ? 0 : 1);
      timePool.sort(
        (a, b) =>
          dist(a) - dist(b) ||
          after(a) - after(b) ||
          (b.tConf ?? 0) - (a.tConf ?? 0) ||
          a.start - b.start,
      );
    } else {
      timePool.sort((a, b) => a.start - b.start || (b.tConf ?? 0) - (a.tConf ?? 0));
    }
    timeCand = timePool[0];
  }

  if (!dateCand && !timeCand) return null;

  const dp: DatePart | null = dateCand?.date ?? null;
  const tp: TimePart | null = timeCand?.time ?? dateCand?.time ?? null;

  const wall = resolveWall(dp, tp, ref, defH, defM);
  if (!wall) return null;
  const date = wallToUtc(wall, tz);

  // Güven: tarih + saat ortalama; yalnız tarih varsayılan saat cezası; yalnız saat tarih çıkarımı cezası.
  let confidence: number;
  const dc = dateCand?.dConf ?? 0;
  const tc = timeCand?.tConf ?? dateCand?.tConf;
  if (dateCand && tc !== undefined) confidence = (dc + tc) / 2;
  else if (dateCand) confidence = dc * 0.8;
  else confidence = (tc ?? 0.5) * 0.9;
  confidence = Math.round(confidence * 100) / 100;

  const spans: Array<{ start: number; end: number }> = [];
  if (dateCand) spans.push(dateCand);
  if (timeCand) spans.push(timeCand);
  spans.sort((a, b) => a.start - b.start);
  const matchedText = dateCand
    ? buildMatchedText(text, dateCand, timeCand)
    : text.slice(timeCand!.start, timeCand!.end).trim();
  const rest = cleanRest(text, spans);

  return { date, matchedText, rest, confidence };
}

/** Date örneğini seçilen zaman diliminde ISO 8601 (+ofset) metnine çevirir. */
export function toIso(date: Date, timeZone: string = DEFAULT_TZ): string {
  const w = wallParts(date, timeZone);
  const off = zoneOffsetMinutes(date, timeZone);
  const sign = off < 0 ? "-" : "+";
  const a = Math.abs(off);
  const p2 = (v: number) => String(v).padStart(2, "0");
  return `${w.y}-${p2(w.m)}-${p2(w.d)}T${p2(w.hh)}:${p2(w.mm)}:${p2(w.ss)}${sign}${p2(Math.floor(a / 60))}:${p2(a % 60)}`;
}
