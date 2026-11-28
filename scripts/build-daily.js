#!/usr/bin/env node
/* Tägliche Challenge als Datei: data/daily/JJJJ-MM-TT.json
   Lädt js/game.js in Node (vm, Browser-Teile durch Platzhalter ersetzt) und nimmt genau dieselbe Logik wie das Spiel
   (dailyData: Startwert 'gold-record-'+tag, pickTypes, makeQuestion, Ersatzfrage für Hörfragen). Keine Deezer-Anfragen –
   nur die Songdaten in data/*.json. Darum läuft es auch täglich als GitHub-Workflow (.github/workflows/daily.yml).

   node scripts/build-daily.js            fehlende Dateien von heute − 30 bis heute + 14 Tage anlegen (vorhandene bleiben)
   node scripts/build-daily.js --force    vorhandene Dateien im Bereich neu schreiben
   node scripts/build-daily.js --check    jede Datei im Bereich mit der Logik im Spiel vergleichen (Fehler → Exit-Code 1)
   node scripts/build-daily.js --day 2026-11-28   nur diesen Tag (mit --check/--force kombinierbar)
   Der Tag richtet sich wie im Spiel nach der Ortszeit – im Workflow TZ=Europe/Berlin. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'data', 'daily');
const args = process.argv.slice(2), has = f => args.includes(f);
const FORCE = has('--force'), CHECK = has('--check'), ONE = has('--day') ? args[args.indexOf('--day') + 1] : null;

// Platzhalter für alles Browserartige: jede Eigenschaft, jeder Aufruf, jedes new liefert wieder den Platzhalter
const stub = new Proxy(function () {}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === Symbol.iterator ? function* () {} : k === 'then' ? undefined : stub,
  set: () => true, apply: () => stub, construct: () => stub, has: () => true,
});
function loadGame(file = path.join(ROOT, 'js', 'game.js'), src = fs.readFileSync(file, 'utf8')) {
  const store = new Map();
  const ctx = {
    console, Math, Date, JSON, Promise, Map, Set, WeakMap, URLSearchParams, Intl, AbortController,
    document: stub, navigator: stub, location: stub, history: stub, Audio: stub, Image: stub, caches: undefined,
    addEventListener() {}, removeEventListener() {}, setInterval() {}, clearInterval() {}, setTimeout() {}, clearTimeout() {},
    requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    curLang: 'de', LANG: 'de', tx: s => s, setLang() {}, translatePage() {}, Sync: stub, Profile: stub, DZ: stub,
    fetch: async url => {
      const f = path.join(ROOT, String(url).split('?')[0]);
      if (!fs.existsSync(f)) return { ok: false, json: async () => ({}) };
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      return { ok: true, json: async () => d };
    },
  };
  ctx.self = ctx.window = ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'game.js' });
  return ctx;
}

const iso = d => d.toISOString().slice(0, 10);
function localToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function range() {
  if (ONE) return [ONE];
  const t = new Date(localToday() + 'T12:00:00Z'), out = [];
  for (let k = -30; k <= 14; k++) out.push(iso(new Date(t.getTime() + k * 864e5)));
  return out;
}
const fileOf = day => path.join(OUT, day + '.json');
const fmt = data => JSON.stringify(data) + '\n';

async function main() {
  const game = loadGame();
  await vm.runInContext('loadData()', game);
  const days = range().filter(d => vm.runInContext(`dayNo(${JSON.stringify(d)})`, game) >= 1);   // vor #1 gab es keine Challenge
  fs.mkdirSync(OUT, { recursive: true });
  const calc = day => vm.runInContext(`dailyData(${JSON.stringify(day)})`, game);
  // Prüft auch den Rückweg: das, was das Spiel aus der Datei liest (questionIn), ergibt wieder dieselbe Datei
  const roundTrip = data => vm.runInContext(`(d => d.items.map(questionIn).map(questionOut))(${JSON.stringify(data)})`, game);

  if (CHECK) {
    let bad = 0, missing = 0;
    for (const day of days) {
      if (!fs.existsSync(fileOf(day))) { missing++; console.log(`fehlt   ${day}`); continue; }
      const file = JSON.parse(fs.readFileSync(fileOf(day), 'utf8')), now = calc(day);
      const same = JSON.stringify(file) === JSON.stringify(now), rt = JSON.stringify(roundTrip(file)) === JSON.stringify(file.items);
      if (!same || !rt) {
        bad++;
        const k = file.items.findIndex((q, i) => JSON.stringify(q) !== JSON.stringify(now.items[i]));
        console.log(`ANDERS  ${day}${k >= 0 ? ` ab Frage ${k + 1} (${file.items[k].type} ↔ ${now.items[k]?.type})` : ''}${rt ? '' : ' · Rückweg weicht ab'}`);
      } else console.log(`ok      ${day} #${file.no}  ${file.items.map(q => q.type).join(' ')}`);
    }
    console.log(`\n${days.length - bad - missing} von ${days.length} Tagen stimmen mit der Logik im Spiel überein` + (bad ? `, ${bad} anders` : '') + (missing ? `, ${missing} fehlen` : ''));
    if (bad) console.log('Hinweis: Nach einem Songdaten-Update (data/*.json) weichen ältere Dateien ab – das ist gewollt, veröffentlichte Challenges bleiben fest.');
    process.exit(bad ? 1 : 0);
  }

  let wrote = 0;
  for (const day of days) {
    if (fs.existsSync(fileOf(day)) && !FORCE) continue;
    fs.writeFileSync(fileOf(day), fmt(calc(day)));
    wrote++; console.log('geschrieben ' + path.relative(ROOT, fileOf(day)));
  }
  console.log(`${wrote} neue Datei(en), ${days.length - wrote} vorhanden (${days[0]} bis ${days[days.length - 1]})`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { loadGame };
