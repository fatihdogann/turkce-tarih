import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");
const REF = "2026-11-01T10:00:00+03:00";

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

test("temiz çıktı: ISO ilk satır", () => {
  const r = run(["yarın akşam 7'de", "--ref", REF]);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.startsWith("2026-11-02T19:00:00+03:00"), r.stdout);
});

test("kalan metin yazdırılır", () => {
  const r = run(["yarın 9'da diş hekimi", "--ref", REF]);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes("kalan: diş hekimi"), r.stdout);
});

test("--json tam sonuç döner", () => {
  const r = run(["yarın 9'da diş hekimi", "--ref", REF, "--json"]);
  assert.equal(r.status, 0);
  const j = JSON.parse(r.stdout);
  assert.equal(j.iso, "2026-11-02T09:00:00+03:00");
  assert.equal(j.matchedText, "yarın 9'da");
  assert.equal(j.rest, "diş hekimi");
  assert.ok(typeof j.confidence === "number");
});

test("eşleşme yoksa çıkış kodu 1 ve stderr", () => {
  const r = run(["merhaba dünya", "--ref", REF]);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes("eşleşme bulunamadı"));
});

test("--tz UTC ofsetli çıktı", () => {
  const r = run(["yarın", "--ref", "2026-11-01T10:00:00Z", "--tz", "UTC"]);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.startsWith("2026-11-02T09:00:00+00:00"), r.stdout);
});

test("geçersiz --ref çıkış kodu 2", () => {
  const r = run(["yarın", "--ref", "geçersiz"]);
  assert.equal(r.status, 2);
});

test("argümansız kullanım metni", () => {
  const r = run([]);
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes("Kullanım"));
});

test("dist/cli.js shebang içerir", () => {
  const first = readFileSync(CLI, "utf8").split("\n")[0];
  assert.equal(first, "#!/usr/bin/env node");
});
