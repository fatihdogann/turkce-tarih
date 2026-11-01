#!/usr/bin/env node
// Türkçe tarih/saat CLI: `turkce-tarih "yarın akşam 7'de"`
import { parseTr, toIso, type ParseTrOptions } from "./parse.js";

const USAGE = `Kullanım: turkce-tarih "<türkçe tarih ifadesi>"

Seçenekler:
  --json                 JSON çıktısı
  --ref <iso-tarih>      Referans anı (ör. "2026-11-01T10:00:00+03:00")
  --tz <iana-bölge>      Zaman dilimi (varsayılan Europe/Istanbul)
  --default-time <SS:DD> Metinde saat yoksa kullanılacak saat (varsayılan 09:00)
  -h, --help             Bu yardım`;

const argv = process.argv.slice(2);
const textParts: string[] = [];
let json = false;
const options: ParseTrOptions = {};

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--json") json = true;
  else if (a === "--ref") options.referenceDate = new Date(argv[++i] ?? "");
  else if (a === "--tz") options.timeZone = argv[++i];
  else if (a === "--default-time") options.defaultTime = argv[++i];
  else if (a === "-h" || a === "--help") {
    console.log(USAGE);
    process.exit(0);
  } else textParts.push(a);
}

if (options.referenceDate && Number.isNaN(options.referenceDate.getTime())) {
  console.error("hata: --ref değeri geçerli bir tarih değil");
  process.exit(2);
}

const text = textParts.join(" ").trim();
if (text === "") {
  console.error(USAGE);
  process.exit(2);
}

let res: ReturnType<typeof parseTr>;
try {
  res = parseTr(text, options);
} catch (err) {
  console.error(`hata: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
}
if (!res) {
  if (json) console.log(JSON.stringify({ match: null }));
  else console.error("eşleşme bulunamadı");
  process.exit(1);
}

const tz = options.timeZone;
if (json) {
  console.log(
    JSON.stringify(
      { iso: toIso(res.date, tz), matchedText: res.matchedText, rest: res.rest, confidence: res.confidence },
      null,
      2,
    ),
  );
} else {
  console.log(toIso(res.date, tz));
  if (res.rest) console.log(`kalan: ${res.rest}`);
}
