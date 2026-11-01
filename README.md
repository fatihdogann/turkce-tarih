# turkce-tarih

[![CI](https://github.com/fatihdogann/turkce-tarih/actions/workflows/ci.yml/badge.svg)](https://github.com/fatihdogann/turkce-tarih/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A520-green.svg)](package.json)

**Turkish natural-language date/time parser — zero-dependency TypeScript library + CLI.**

Parses Turkish natural language date/time expressions like `"yarın akşam 7'de"` (tomorrow at 7 in the evening) into a JavaScript `Date`, and reports what part of the text was matched and what remains. Ships as an ESM library with type declarations and a CLI.

```js
import { parseTr, toIso } from "turkce-tarih";

parseTr("yarın akşam 7'de diş hekimi");
// → {
//     date: 2026-11-02T16:00:00.000Z,        // 19:00 Europe/Istanbul
//     matchedText: "yarın akşam 7'de",
//     rest: "diş hekimi",
//     confidence: 0.88,
//   }
```

## Install

```bash
npm install turkce-tarih   # library + CLI (Node 20+)
```

Requires Node 20 or newer. Runtime dependencies: none.

## API

### `parseTr(text, options?) → ParseTrResult | null`

Returns `null` when no date/time expression is found.

| Result field    | Type     | Description                                              |
| --------------- | -------- | -------------------------------------------------------- |
| `date`          | `Date`   | Resolved absolute instant.                               |
| `matchedText`   | `string` | The matched substring of the original input.             |
| `rest`          | `string` | Input with the matched parts removed, whitespace/punctuation cleaned. |
| `confidence`    | `number` | Heuristic score in `(0, 1]` — see [Confidence](#confidence). |

| Option           | Type     | Default              | Description                                                            |
| ---------------- | -------- | -------------------- | ---------------------------------------------------------------------- |
| `referenceDate`  | `Date`   | `new Date()`         | "Now" for relative expressions.                                        |
| `timeZone`       | `string` | `"Europe/Istanbul"`  | Any IANA zone. Istanbul is fixed UTC+3 (no DST), which the parser is exact for. DST zones are best-effort near transitions. |
| `defaultTime`    | `string` | `"09:00"`            | Time applied when the text contains no time expression (`"SS:DD"`).     |

Throws on an invalid `timeZone` or malformed `defaultTime`.

### `toIso(date, timeZone?) → string`

Formats a `Date` as ISO 8601 with the wall-clock time and UTC offset of the given zone:

```js
toIso(new Date("2026-11-02T16:00:00Z")); // "2026-11-02T19:00:00+03:00"
```

## CLI

```bash
$ turkce-tarih "yarın akşam 7'de"
2026-11-02T19:00:00+03:00

$ turkce-tarih "yarın 9'da diş hekimi"
2026-11-02T09:00:00+03:00
kalan: diş hekimi

$ turkce-tarih "yarın akşam 7'de" --json
{
  "iso": "2026-11-02T19:00:00+03:00",
  "matchedText": "yarın akşam 7'de",
  "rest": "",
  "confidence": 0.88
}
```

| Flag                    | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `--json`                | Full result as JSON.                               |
| `--ref <iso>`           | Reference instant, e.g. `2026-11-01T10:00:00+03:00`.|
| `--tz <iana-zone>`      | Override time zone.                                |
| `--default-time <SS:DD>`| Default time when text has none (default `09:00`). |

Exit codes: `0` matched, `1` no match, `2` usage/option error.

## Examples

All results below use reference **Sunday 2026-11-01 10:00 (Europe/Istanbul, UTC+3)**:

| Input                       | Result (`toIso`)               | `rest`          |
| --------------------------- | ------------------------------ | --------------- |
| `bugün`                     | `2026-11-01T09:00:00+03:00`    |                 |
| `yarın`                     | `2026-11-02T09:00:00+03:00`    |                 |
| `yarın akşam 7'de`          | `2026-11-02T19:00:00+03:00`    |                 |
| `yarın 9'da diş hekimi`     | `2026-11-02T09:00:00+03:00`    | `diş hekimi`    |
| `öbür gün`                  | `2026-11-03T09:00:00+03:00`    |                 |
| `dün`                       | `2026-10-31T09:00:00+03:00`    |                 |
| `evvelsi gün`               | `2026-10-30T09:00:00+03:00`    |                 |
| `3 gün sonra`               | `2026-11-04T10:00:00+03:00`    |                 |
| `2 hafta sonra`             | `2026-11-15T10:00:00+03:00`    |                 |
| `1 ay önce`                 | `2026-10-01T10:00:00+03:00`    |                 |
| `yarım saat sonra`          | `2026-11-01T10:30:00+03:00`    |                 |
| `salı`                      | `2026-11-03T09:00:00+03:00`    |                 |
| `önümüzdeki salı`           | `2026-11-03T09:00:00+03:00`    |                 |
| `geçen pazartesi`           | `2026-10-26T09:00:00+03:00`    |                 |
| `15 Kasım 2026`             | `2026-11-15T09:00:00+03:00`    |                 |
| `ayın 15'i`                 | `2026-11-15T09:00:00+03:00`    |                 |
| `15'inde`                   | `2026-11-15T09:00:00+03:00`    |                 |
| `15.11.2026`                | `2026-11-15T09:00:00+03:00`    |                 |
| `15/11`                     | `2026-11-15T09:00:00+03:00`    |                 |
| `saat 14.30`                | `2026-11-01T14:30:00+03:00`    |                 |
| `akşam 7'de`                | `2026-11-01T19:00:00+03:00`    |                 |
| `gece yarısı`               | `2026-11-02T00:00:00+03:00`    |                 |
| `7 buçukta`                 | `2026-11-01T19:30:00+03:00`    |                 |
| `öğlen`                     | `2026-11-01T12:00:00+03:00`    |                 |

## Supported patterns

- **Relative days:** `bugün`, `yarın`, `dün`, `öbür gün`, `evvelsi gün`, `önceki gün` — with suffixes (`yarına`, `yarınki`, `bugünkü`).
- **Relative durations:** `{n} gün|hafta|ay|yıl|saat|dakika|dk|sn önce|sonra` — digits (`3 gün sonra`) and number words `bir`–`on` (`üç gün sonra`), plus `yarım saat önce/sonra`.
- **Weekdays:** all seven, bare (`salı`, `salıya`, `salı günü`), `bu X`, `haftaya X`, `önümüzdeki/gelecek (hafta) X`, `geçen/önceki X`, `geçen hafta X`. Weeks start on Monday.
- **Month words:** `geçen/bu/önümüzdeki/gelecek hafta|ay|yıl`, `haftaya`.
- **Dates:** `15 Kasım`, `15 Kasım 2026`, `15 kasım'da`, `Kasım 15`, `Kasım'ın 15'i`, `ayın 15'i/15'inde`, bare `15'inde`, numeric `15.11.2026`, `15/11`, `15-11-2026`, two-digit years (`15.11.26` → 2026).
- **Times:** `14:30`, `14.30` (+ suffix: `14:30'da`), `saat 14.30`, `saat 9`, bare hours with locative suffix (`7'de`, `9da`, `dokuzda`, `on'da`), `7 buçuk(ta)`, hour words (`ikide`, `yedide`), day-part words alone (`sabah`, `öğlen`, `öğleden sonra`, `akşam`, `gece`, `sabaha karşı`) or with an hour (`akşam 7'de`, `öğlen 3'te`, `gece 11'de`), `gece yarısı`.
- **Find-in-text:** date and time parts are located anywhere in the text and combined; the remainder is returned in `rest`.

### Day-part hour mapping

| Expression            | Result                                            |
| --------------------- | ------------------------------------------------- |
| `sabah h`             | `h` as-is (00–12)                                 |
| `öğlen h`             | `h + 12` for 1–11, `12` → 12:00                   |
| `öğleden sonra h`     | `h + 12` for 1–11                                 |
| `akşam h`             | `h + 12` for 1–11, `12` → 00:00                   |
| `gece h`              | `h` for 1–6, `h + 12` for 7–11, `12` → 00:00      |
| day-part alone        | sabah 09:00 · sabaha karşı 06:00 · öğlen 12:00 · öğleden sonra 15:00 · akşam 19:00 · gece 22:00 |

### Ambiguity rules (deterministic, documented)

- **Ambiguous bare hours** (`7'de`, `saat 9`, `7 buçukta`) resolve to the **nearest future** interpretation relative to the reference: at 10:00, `7'de` → 19:00 today; `9da` → 21:00 today.
- **Past-looking expressions** (`dün`, `geçen ...`, `n ... önce`) with an ambiguous hour take the **morning** interpretation: `dün 7'de` → 07:00.
- **No time in text** → `defaultTime` (default 09:00), applied as-is to the resolved day.
- **Durations** (`3 gün sonra`) keep the reference time-of-day instead of the default.
- **Explicit date + explicit clock** (`bugün 14:30`, `dün 14:30`) is kept as-is, even when it lies in the past.
- Time-only input (`14:30`) rolls to the nearest future occurrence.
- Weeks start on **Monday**; `haftaya X` = X of next calendar week; `bu X`/bare `X` = nearest upcoming occurrence (today counts); `geçen X` = nearest past occurrence; `geçen hafta X` = X of the previous calendar week.
- Yearless dates (`15 Kasım`, `ayın 15'i`) resolve to the next future occurrence (today counts). Day first, month second: `15/11` is 15 November; `11/15` does not parse as a date.

## Limitations — explicitly not supported

- **Recurring expressions:** `her pazartesi`, `her gün` parse as the single next occurrence; the recurring part is ignored, not returned.
- **Ranges:** `15-20 Kasım`, `9 ile 12 arası`.
- **`N gün içinde`** ("within N days") and `N günde bir` ("every N days").
- **`hafta sonu`, `ay sonu/başı`, `çeyrek`**, `9 sularında`, `9'u gibi` (accusative time forms), `önümüzdeki günlerde`.
- **Compound number words:** `on bir`, `yirmi üç` — only number words 1–10 and `yarım` are supported; `saat on bir` returns `null`.
- **Bare digits/hours without a suffix, separator or `saat`:** `9 elma` does not parse as a time; standalone month names (`Kasım'da` alone) and years (`2026'da`) do not parse.
- **Invalid calendar dates** return `null`: `31 Nisan`, `30.2`, `24:00` as a time.
- **One datetime per text:** `yarın veya salı` returns the first date; `yarın 9'da 10'da` returns the time nearest to the date.
- **Turkish only** — month/weekday names are Turkish; English inputs are not parsed.
- **Time zones:** exact for fixed-offset zones (Europe/Istanbul, UTC); for DST zones, resolutions within a ±1h transition window are best-effort.
- Case-insensitive matching covers correct Turkish casing including `İ/ı`; it is not a spell-checker and does not tolerate typos (`yrın`).

## Confidence

A heuristic in `(0, 1]`, computed per matched part and averaged:

- explicit numeric date with year `0.95`; relative days/durations and qualified weekdays `0.9`; weekdays and yearless dates `0.85`; bare possessive days `0.8`;
- clock time `0.95`; day-part + hour `0.85`; day-part alone `0.8`; ambiguous bare hour `0.7` (`0.75` with `saat`);
- date + explicit time: average; date only: `0.8 ×` (default time assumed); time only: `0.9 ×` (date inferred).

Treat it as a rough signal for filtering, not a probability.

## Development

```bash
npm test     # build + 215 node:test assertions
npm run build
```

Tests pin the reference to **2026-11-01 (Sunday) 10:00 Europe/Istanbul** — a fixed UTC+3 zone with no DST — so expectations are exact.

## License

[MIT](LICENSE) © Mehmet Fatih Doğan
