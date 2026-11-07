// Mitwirkende Interpreten (Duette, Gäste) aller Songs bei Deezer nachschlagen: /track/{id} → contributors.
// Deezer nennt im Feld „artist“ nur den Hauptinterpreten – bei „Komet“ steht dort nur Udo Lindenberg, Apache 207 fehlt.
// Ohne diese Liste käme Apache 207 bei „Von wem ist Komet?“ als falsche Antwort.
// Ergebnis: data/feat.json  { "<Deezer-ID>": ["Apache 207", …] }  (nur Songs mit weiteren Interpreten)
// Aufruf: node scripts/build-feat.js   (Zwischenstand in data/feat-cache.json, Abbrechen und neu starten geht)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const load = f => { try { return JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8')).songs; } catch { return []; } };
const songs = [...load('songs.json'), ...load('extra.json'), ...load('more.json')];
const cacheF = path.join(root, 'data/feat-cache.json');
const cache = fs.existsSync(cacheF) ? JSON.parse(fs.readFileSync(cacheF, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let t = 0; t < 5; t++) {
    try {
      const d = await (await fetch(url, { headers: { 'User-Agent': 'GoldRecord/1.0' } })).json();
      if (d.error?.code === 4) { await sleep(5000); continue; }
      return d;
    } catch { await sleep(2000); }
  }
  return null;
}
function write() {
  const out = {};
  for (const s of songs) { const c = cache[s.id]; if (c?.length) out[s.id] = c; }
  fs.writeFileSync(path.join(root, 'data/feat.json'), JSON.stringify(out));
  return Object.keys(out).length;
}
(async () => {
  const todo = songs.filter(s => !(s.id in cache));
  console.log(songs.length, 'Songs,', todo.length, 'offen');
  let n = 0;
  for (const s of todo) {
    const d = await get(`https://api.deezer.com/track/${s.id}`);
    if (d && !d.error) {
      const main = (d.artist?.name || s.a).toLowerCase();
      cache[s.id] = [...new Set((d.contributors || []).map(c => c.name).filter(x => x && x.toLowerCase() !== main))];
    }
    await sleep(130);
    if (++n % 200 === 0) { fs.writeFileSync(cacheF, JSON.stringify(cache)); console.log(n, '/', todo.length, 'mit Gästen:', write()); }
  }
  fs.writeFileSync(cacheF, JSON.stringify(cache));
  console.log('fertig, mit Gästen:', write());
})();
