import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTr, toIso } from "../dist/index.js";

// Sabit referans: 2026-11-01 Pazar 10:00, Europe/Istanbul (UTC+3, yaz saati yok)
const REF = new Date("2026-11-01T10:00:00+03:00");
const P = (t, o = {}) => parseTr(t, { referenceDate: REF, ...o });
const iso = (t, o) => {
  const r = P(t, o);
  return r ? toIso(r.date) : null;
};
const D = "2026-11-01"; // referans günü

function eq(input, expected, opts) {
  test(`"${input}" → ${expected}`, () => {
    assert.equal(iso(input, opts), expected);
  });
}
function isNull(input, opts) {
  test(`"${input}" → null`, () => {
    assert.equal(iso(input, opts), null);
  });
}
function check(input, fn) {
  test(`"${input}" özel kontrol`, () => {
    fn(P(input));
  });
}

// ---------- Göreli günler ----------
eq("bugün", `${D}T09:00:00+03:00`);
eq("yarın", "2026-11-02T09:00:00+03:00");
eq("yarına", "2026-11-02T09:00:00+03:00");
check("yarınki toplantı", (r) => {
  assert.equal(toIso(r.date), "2026-11-02T09:00:00+03:00");
  assert.equal(r.rest, "toplantı");
});
eq("dün", "2026-10-31T09:00:00+03:00");
eq("dün akşam", "2026-10-31T19:00:00+03:00");
eq("öbür gün", "2026-11-03T09:00:00+03:00");
eq("evvelsi gün", "2026-10-30T09:00:00+03:00");
eq("önceki gün", "2026-10-31T09:00:00+03:00");
eq("bu akşam", `${D}T19:00:00+03:00`);
eq("bu gece", `${D}T22:00:00+03:00`);
eq("bugün saat 14.30", `${D}T14:30:00+03:00`);
eq("yarın sabah koşusu", "2026-11-02T09:00:00+03:00");
check("yarın sabah koşusu", (r) => assert.equal(r.rest, "koşusu"));
check("bugünkü toplantı", (r) => {
  assert.equal(toIso(r.date), `${D}T09:00:00+03:00`);
  assert.equal(r.rest, "toplantı");
});
eq("yarın gece", "2026-11-02T22:00:00+03:00");
eq("dün gece yarısı", "2026-10-31T00:00:00+03:00");

// ---------- Göreli süreler (referans saati korunur) ----------
eq("3 gün sonra", "2026-11-04T10:00:00+03:00");
eq("3 gün sonrası", "2026-11-04T10:00:00+03:00");
eq("10 gün önce", "2026-10-22T10:00:00+03:00");
eq("2 hafta sonra", "2026-11-15T10:00:00+03:00");
eq("3 hafta önce", "2026-10-11T10:00:00+03:00");
eq("1 ay önce", "2026-10-01T10:00:00+03:00");
eq("6 ay sonra", "2027-05-01T10:00:00+03:00");
eq("1 yıl sonra", "2027-11-01T10:00:00+03:00");
eq("2 yıl önce", "2024-11-01T10:00:00+03:00");
eq("1 yıl evvel", "2025-11-01T10:00:00+03:00");
eq("5 saat sonra", `${D}T15:00:00+03:00`);
eq("8 saat önce", `${D}T02:00:00+03:00`);
eq("45 dakika sonra", `${D}T10:45:00+03:00`);
eq("90 dakika önce", `${D}T08:30:00+03:00`);
eq("10 dk sonra", `${D}T10:10:00+03:00`);
eq("30 sn sonra", `${D}T10:00:30+03:00`);
eq("yarım saat sonra", `${D}T10:30:00+03:00`);
eq("yarım saat önce", `${D}T09:30:00+03:00`);
eq("3 gün sonra 9'da", "2026-11-04T09:00:00+03:00");
check("2 saat sonra toplantı", (r) => {
  assert.equal(toIso(r.date), `${D}T12:00:00+03:00`);
  assert.equal(r.rest, "toplantı");
});
isNull("3 gün içinde"); // "içinde" desteklenmez

for (const [word, n] of Object.entries({ bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10 })) {
  const day = String(1 + n).padStart(2, "0");
  eq(`${word} gün sonra`, `2026-11-${day}T10:00:00+03:00`);
}

// ---------- Haftanın günleri (hafta Pazartesi başlar) ----------
eq("pazartesi", "2026-11-02T09:00:00+03:00");
eq("salı", "2026-11-03T09:00:00+03:00");
eq("çarşamba", "2026-11-04T09:00:00+03:00");
eq("perşembe", "2026-11-05T09:00:00+03:00");
eq("cuma", "2026-11-06T09:00:00+03:00");
eq("cumartesi", "2026-11-07T09:00:00+03:00");
eq("pazar", `${D}T09:00:00+03:00`);
eq("Salı günü", "2026-11-03T09:00:00+03:00");
eq("salıya", "2026-11-03T09:00:00+03:00");
eq("pazara", `${D}T09:00:00+03:00`);
eq("bu salı", "2026-11-03T09:00:00+03:00");
eq("bu cuma", "2026-11-06T09:00:00+03:00");
eq("bu pazartesi", "2026-11-02T09:00:00+03:00");
eq("bu pazar", `${D}T09:00:00+03:00`);
eq("haftaya salı", "2026-11-03T09:00:00+03:00");
eq("önümüzdeki salı", "2026-11-03T09:00:00+03:00");
eq("gelecek çarşamba", "2026-11-04T09:00:00+03:00");
eq("önümüzdeki hafta perşembe", "2026-11-05T09:00:00+03:00");
eq("gelecek pazartesi", "2026-11-02T09:00:00+03:00");
eq("geçen pazartesi", "2026-10-26T09:00:00+03:00");
eq("geçen salı", "2026-10-27T09:00:00+03:00");
eq("geçen cumartesi", "2026-10-31T09:00:00+03:00");
eq("geçen pazar", "2026-10-25T09:00:00+03:00");
eq("önceki çarşamba", "2026-10-28T09:00:00+03:00");
eq("geçen hafta salı", "2026-10-20T09:00:00+03:00");
eq("geçen hafta cuma", "2026-10-23T09:00:00+03:00");
eq("salı akşam 7'de", "2026-11-03T19:00:00+03:00");
eq("cuma akşamı", "2026-11-06T19:00:00+03:00");
eq("haftaya", "2026-11-08T09:00:00+03:00");
eq("önümüzdeki hafta", "2026-11-08T09:00:00+03:00");
eq("geçen hafta", "2026-10-25T09:00:00+03:00");
eq("geçen ay", "2026-10-01T09:00:00+03:00");
eq("gelecek ay", "2026-12-01T09:00:00+03:00");
eq("geçen yıl", "2025-11-01T09:00:00+03:00");
eq("gelecek yıl", "2027-11-01T09:00:00+03:00");
eq("bu hafta", `${D}T09:00:00+03:00`);

// ---------- Tarihler ----------
eq("15 Kasım", "2026-11-15T09:00:00+03:00");
eq("15 kasım'da", "2026-11-15T09:00:00+03:00");
eq("15 Kasım 2026", "2026-11-15T09:00:00+03:00");
eq("15 Kasım 2026'da", "2026-11-15T09:00:00+03:00");
eq("1 Ocak", "2027-01-01T09:00:00+03:00");
eq("29 Şubat", "2028-02-29T09:00:00+03:00");
eq("31 Nisan", null); // Nisan 30 çeker
eq("15.11.2026", "2026-11-15T09:00:00+03:00");
eq("15.11.26", "2026-11-15T09:00:00+03:00");
eq("15/11", "2026-11-15T09:00:00+03:00");
eq("15-11-2026", "2026-11-15T09:00:00+03:00");
eq("1.1", "2027-01-01T09:00:00+03:00");
eq("1/1/2027", "2027-01-01T09:00:00+03:00");
eq("ayın 15'i", "2026-11-15T09:00:00+03:00");
eq("ayın 15'inde", "2026-11-15T09:00:00+03:00");
eq("ayın 3'ü", "2026-11-03T09:00:00+03:00");
eq("ayın 30'u", "2026-11-30T09:00:00+03:00");
eq("ayın 31'i", "2026-12-31T09:00:00+03:00");
eq("15'inde", "2026-11-15T09:00:00+03:00");
eq("25'inde", "2026-11-25T09:00:00+03:00");
eq("5'inde", "2026-11-05T09:00:00+03:00");
eq("Kasım'ın 15'i", "2026-11-15T09:00:00+03:00");
eq("Kasım 15", "2026-11-15T09:00:00+03:00");
eq("12 Mart 2027", "2027-03-12T09:00:00+03:00");
check("15 Kasım 2026'da toplantı", (r) => {
  assert.equal(toIso(r.date), "2026-11-15T09:00:00+03:00");
  assert.equal(r.rest, "toplantı");
});
eq("mayısta", null); // tek başına ay adı desteklenmez
eq("2026'da", null); // yalnız yıl desteklenmez
eq("her pazartesi", "2026-11-02T09:00:00+03:00"); // "her" yoksayılır, tekil yorum

const MONTH_TABLE = {
  ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6,
  temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
};
for (const [name, num] of Object.entries(MONTH_TABLE)) {
  eq(`5 ${name} 2027`, `2027-${String(num).padStart(2, "0")}-05T09:00:00+03:00`);
}

// ---------- Saatler ----------
eq("saat 14.30", `${D}T14:30:00+03:00`);
eq("14:30", `${D}T14:30:00+03:00`);
eq("14.30", `${D}T14:30:00+03:00`);
eq("14:30'da", `${D}T14:30:00+03:00`);
eq("saat 14.30'da", `${D}T14:30:00+03:00`);
eq("9.30", "2026-11-02T09:30:00+03:00"); // tarihsiz + geçmiş → en yakın gelecek (ertesi gün)
eq("23.59", `${D}T23:59:00+03:00`);
eq("1.15", "2026-11-02T01:15:00+03:00");
eq("12.30", `${D}T12:30:00+03:00`); // 30.ay geçersiz → saat yorumu
eq("14.13", `${D}T14:13:00+03:00`);
eq("24:00", null);
eq("45.13", null);
eq("akşam 7'de", `${D}T19:00:00+03:00`);
eq("akşam 7", `${D}T19:00:00+03:00`);
eq("AKŞAM 7'DE", `${D}T19:00:00+03:00`);
eq("sabah 9", "2026-11-02T09:00:00+03:00"); // bugün 09:00 geçmiş → ertesi gün
eq("sabah 7.30", "2026-11-02T07:30:00+03:00");
eq("öğlen 12'de", `${D}T12:00:00+03:00`);
eq("öğlen 3'te", `${D}T15:00:00+03:00`);
eq("öğle 3'te", `${D}T15:00:00+03:00`);
eq("öğleden sonra 3'te", `${D}T15:00:00+03:00`);
eq("öğleden sonra 5 buçukta", `${D}T17:30:00+03:00`);
eq("gece 3'te", "2026-11-02T03:00:00+03:00");
eq("gece 9", `${D}T21:00:00+03:00`);
eq("gece 11'de", `${D}T23:00:00+03:00`);
eq("gece 12'de", "2026-11-02T00:00:00+03:00");
eq("gece yarısı", "2026-11-02T00:00:00+03:00");
eq("akşam", `${D}T19:00:00+03:00`);
eq("sabah", "2026-11-02T09:00:00+03:00");
eq("öğlen", `${D}T12:00:00+03:00`);
eq("gece", `${D}T22:00:00+03:00`);
eq("sabaha karşı 6'da", "2026-11-02T06:00:00+03:00");
eq("sabaha karşı", "2026-11-02T06:00:00+03:00");
eq("7'de", `${D}T19:00:00+03:00`); // belirsiz → gelecekteki en yakın (19:00)
eq("7 buçukta", `${D}T19:30:00+03:00`);
eq("9da", `${D}T21:00:00+03:00`);
eq("saat dokuzda", `${D}T21:00:00+03:00`);
eq("saat dokuz", `${D}T21:00:00+03:00`);
eq("ikide", `${D}T14:00:00+03:00`);
eq("yedide", `${D}T19:00:00+03:00`);
eq("on'da", `${D}T22:00:00+03:00`);
eq("12'de", `${D}T12:00:00+03:00`);
eq("akşam 10'da", `${D}T22:00:00+03:00`);
eq("akşam 19'da", `${D}T19:00:00+03:00`);
eq("sabah 12'de", `${D}T12:00:00+03:00`);
eq("saat on bir", `${D}T11:00:00+03:00`);
eq("saat on ikide", `${D}T12:00:00+03:00`);

// ---------- 0.2.0: kesirli ve bileşik süreler ----------
eq("1,5 saat sonra", `${D}T11:30:00+03:00`);
eq("1.5 saat sonra", `${D}T11:30:00+03:00`); // 1 Mayıs değil
eq("bir buçuk saat sonra", `${D}T11:30:00+03:00`);
eq("2 buçuk saat sonra", `${D}T12:30:00+03:00`);
eq("yirmi gün sonra", "2026-11-21T10:00:00+03:00");
eq("yirmi beş dakika sonra", `${D}T10:25:00+03:00`);
eq("on iki saat önce", "2026-10-31T22:00:00+03:00");
eq("1,5 ay sonra", "2026-12-16T10:00:00+03:00");
eq("10 dakikaya", `${D}T10:10:00+03:00`);
eq("2 güne", "2026-11-03T10:00:00+03:00");

// ---------- 0.2.0: göreli günler, gün bölümleri, ISO ----------
eq("yarından sonra", "2026-11-03T09:00:00+03:00");
eq("ertesi gün", "2026-11-02T09:00:00+03:00");
eq("akşamüstü", `${D}T17:00:00+03:00`);
eq("yarın akşam üstü 5'te", "2026-11-02T17:00:00+03:00");
eq("2026-11-15", "2026-11-15T09:00:00+03:00");
eq("2026-11-15 14:30", "2026-11-15T14:30:00+03:00");
isNull("2026-02-30");

// ---------- 0.2.0: dönem sonu/başı ----------
eq("hafta sonu", `${D}T09:00:00+03:00`); // referans pazar: bugün hafta sonu
eq("hafta sonu", "2026-11-07T09:00:00+03:00", { referenceDate: new Date("2026-11-03T10:00:00+03:00") });
eq("hafta başı", "2026-11-02T09:00:00+03:00");
eq("ay sonu", "2026-11-30T09:00:00+03:00");
eq("ay sonuna kadar", "2026-11-30T09:00:00+03:00");
eq("ay başı", `${D}T09:00:00+03:00`); // bugün ayın 1'i
eq("yıl sonu", "2026-12-31T09:00:00+03:00");
eq("Kasım sonunda", "2026-11-30T09:00:00+03:00");
eq("aralık başında", "2026-12-01T09:00:00+03:00");
eq("ekim sonu", "2027-10-31T09:00:00+03:00");

// ---------- 0.2.0: çeyrek ----------
eq("3'ü çeyrek geçe", `${D}T15:15:00+03:00`);
eq("üçü çeyrek geçe", `${D}T15:15:00+03:00`);
eq("4'e çeyrek var", `${D}T15:45:00+03:00`);
eq("dörde çeyrek kala", `${D}T15:45:00+03:00`);
eq("akşam 7'yi çeyrek geçe", `${D}T19:15:00+03:00`);
eq("yarın sabah dokuzu çeyrek geçe", "2026-11-02T09:15:00+03:00");

// ---------- 0.2.0: "günü" ve "kadar" kalan metne kalmaz ----------
check("Cuma günü toplantı", (r) => {
  assert.equal(toIso(r.date), "2026-11-06T09:00:00+03:00");
  assert.equal(r.rest, "toplantı");
});
check("salıya kadar raporu bitir", (r) => {
  assert.equal(r.matchedText, "salıya kadar");
  assert.equal(r.rest, "raporu bitir");
});
check("sabah 9'a kadar", (r) => {
  assert.equal(toIso(r.date), "2026-11-02T09:00:00+03:00");
  assert.equal(r.rest, "");
});

// ---------- Metin içinden bulma (bileşim) ----------
check("yarın 9'da diş hekimi", (r) => {
  assert.equal(toIso(r.date), "2026-11-02T09:00:00+03:00");
  assert.equal(r.matchedText, "yarın 9'da");
  assert.equal(r.rest, "diş hekimi");
});
check("yarın, diş hekimi, 9'da", (r) => {
  assert.equal(toIso(r.date), "2026-11-02T09:00:00+03:00");
  assert.equal(r.matchedText, "yarın 9'da");
  assert.equal(r.rest, "diş hekimi");
});
check("15 Kasım'da 9'da toplantı", (r) => {
  assert.equal(toIso(r.date), "2026-11-15T09:00:00+03:00");
  assert.equal(r.rest, "toplantı");
});
check("akşam 7'de yarın", (r) => {
  assert.equal(toIso(r.date), "2026-11-02T19:00:00+03:00");
  assert.equal(r.matchedText, "akşam 7'de yarın");
  assert.equal(r.rest, "");
});
check("yarın veya salı", (r) => {
  assert.equal(toIso(r.date), "2026-11-02T09:00:00+03:00"); // ilk tarih kazanır
  assert.equal(r.rest, "veya salı");
});
check("yarın 14:30'da müsait misin", (r) => {
  assert.equal(toIso(r.date), "2026-11-02T14:30:00+03:00");
  assert.equal(r.rest, "müsait misin");
});
check("yarın akşam 7'de diş hekimi", (r) => {
  assert.equal(toIso(r.date), "2026-11-02T19:00:00+03:00");
  assert.equal(r.matchedText, "yarın akşam 7'de");
  assert.equal(r.rest, "diş hekimi");
});
check("bugün 14:30 görüşme var", (r) => {
  assert.equal(toIso(r.date), `${D}T14:30:00+03:00`);
  assert.equal(r.rest, "görüşme var");
});
check("yarın 9'da 10'da çakışma", (r) => {
  assert.equal(toIso(r.date), "2026-11-02T09:00:00+03:00"); // tarihe en yakın saat kazanır
  assert.equal(r.rest, "10'da çakışma");
});
check("14:30", (r) => {
  assert.equal(toIso(r.date), `${D}T14:30:00+03:00`);
  assert.equal(r.matchedText, "14:30");
  assert.equal(r.rest, "");
});
check("sabah koşusu", (r) => {
  assert.equal(toIso(r.date), "2026-11-02T09:00:00+03:00");
  assert.equal(r.rest, "koşusu");
});
check("geçen hafta salı 9'da", (r) => assert.equal(toIso(r.date), "2026-10-20T09:00:00+03:00"));
check("dün 7'de", (r) => assert.equal(toIso(r.date), "2026-10-31T07:00:00+03:00")); // geçmiş ifade → sabah yorumu
check("dün 14:30", (r) => assert.equal(toIso(r.date), "2026-10-31T14:30:00+03:00"));
check("yarın akşam 7'de matchedText", (r) => assert.equal(r.matchedText, "yarın akşam 7'de"));

// ---------- Büyük/küçük harf ve ek toleransı ----------
eq("YARIN", "2026-11-02T09:00:00+03:00");
eq("SALIYA", "2026-11-03T09:00:00+03:00");
eq("15 KASIM", "2026-11-15T09:00:00+03:00");
eq("Yarın ÖĞLEN", "2026-11-02T12:00:00+03:00");
eq("Salı'da", "2026-11-03T09:00:00+03:00");
eq("ÇARŞAMBAYA", "2026-11-04T09:00:00+03:00");
eq("yarın akşam 7'DE", "2026-11-02T19:00:00+03:00");
check("yarın’akşam yok (U+2019 normalizasyonu)", (r) => {
  assert.equal(toIso(r.date), "2026-11-02T09:00:00+03:00");
  assert.ok(r.matchedText.includes("’"));
});

// ---------- Seçenekler ve kenar durumlar ----------
isNull("merhaba dünya"); // "dünya" tuzağı: dün+ya reddedilir
isNull("");
isNull("   ");
isNull("bu mesajda tarih yok");
isNull("10 kg elma");
check("confidence aralığı", () => {
  for (const t of ["yarın", "15 Kasım 2026", "14:30", "yarın akşam 7'de", "salı", "gece yarısı"]) {
    const r = P(t);
    assert.ok(r.confidence > 0 && r.confidence <= 1, `${t}: ${r.confidence}`);
  }
});
check("confidence: saatli tarih > tarihsiz", () => {
  const withTime = P("15 Kasım 2026 14:30");
  const dateOnly = P("15 Kasım 2026");
  assert.equal(toIso(withTime.date), "2026-11-15T14:30:00+03:00");
  assert.ok(withTime.confidence > dateOnly.confidence);
});
eq("yarın (defaultTime 12:00)", "2026-11-02T12:00:00+03:00", { defaultTime: "12:00" });
check("timeZone UTC", () => {
  const r = parseTr("yarın", { referenceDate: new Date("2026-11-01T10:00:00Z"), timeZone: "UTC" });
  assert.equal(toIso(r.date, "UTC"), "2026-11-02T09:00:00+00:00");
});
check("toIso referans", () => assert.equal(toIso(REF), "2026-11-01T10:00:00+03:00"));
check("yarın", (r) => assert.ok(r.date instanceof Date));
check("tarihsiz saat ertesi güne kayar", () => {
  const r = parseTr("14:30", { referenceDate: new Date("2026-11-01T15:00:00+03:00") });
  assert.equal(toIso(r.date), "2026-11-02T14:30:00+03:00");
});
check("referans bu gün: ayın 15'i", () => {
  const r = parseTr("ayın 15'i", { referenceDate: new Date("2026-11-15T10:00:00+03:00") });
  assert.equal(toIso(r.date), "2026-11-15T09:00:00+03:00");
});
check("ay ekleme gün kırpma", () => {
  const r = parseTr("1 ay sonra", { referenceDate: new Date("2026-01-31T10:00:00+03:00") });
  assert.equal(toIso(r.date), "2026-02-28T10:00:00+03:00");
});
