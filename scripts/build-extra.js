// Mehr Songs: Die Songs aus data/billions.json (Spotify > 1 Mrd. Streams), die noch nicht in data/songs.json stehen,
// werden bei Deezer nachgeschlagen (Rang, Cover, Veröffentlichung) und als data/extra.json gespeichert.
// Ihr Jahr kommt von Deezer und ist nicht geprüft (oft das Jahr eines Albums/Remasters) – darum nutzt das Spiel sie
// nur für Fragen, bei denen das Jahr keine Rolle spielt (Welcher Song läuft? / Von wem? / Welches Cover?).
// Aufruf: node scripts/build-extra.js   (Zwischenstand in data/extra-cache.json, Abbrechen und neu starten geht)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const songs = JSON.parse(fs.readFileSync(path.join(root, 'data/songs.json'), 'utf8')).songs;
const bill = JSON.parse(fs.readFileSync(path.join(root, 'data/billions.json'), 'utf8')).tracks;
// Zusätze in Klammern UND nach „ - “ zählen nicht („Numb - Unshatter Film Soundtrack“ ist dieselbe Nummer wie „Numb“)
const norm = s => String(s).toLowerCase().replace(/\(.*?\)|\[.*?\]|feat\..*$|ft\..*$/g, '').replace(/\s+-\s+.*$/, '').replace(/[^a-z0-9äöüß]+/g, ' ').trim();
const have = new Set(songs.flatMap(s => [String(s.id), norm(s.t) + '|' + norm(s.a)]));
const cacheF = path.join(root, 'data/extra-cache.json');
const cache = fs.existsSync(cacheF) ? JSON.parse(fs.readFileSync(cacheF, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const todo = bill.filter(t => !have.has(String(t.id)) && !have.has(norm(t.title) + '|' + norm(t.artist)));
  console.log(`${todo.length} Songs nachzuschlagen (${Object.keys(cache).length} schon im Zwischenstand)`);
  let n = 0;
  for (const t of todo) {
    if (cache[t.id]) continue;
    try {
      const r = await fetch(`https://api.deezer.com/track/${t.id}`);
      const d = await r.json();
      if (d.error) { if (d.error.code === 4) { await sleep(5000); continue; } cache[t.id] = { err: d.error.code }; }
      else cache[t.id] = { t: d.title_short || d.title, a: d.artist?.name, c: d.album?.md5_image || d.md5_image || '', r: d.rank || 0,
        y: +(String(d.album?.release_date || d.release_date || '').slice(0, 4)) || 0, p: !!d.preview };
    } catch (e) { await sleep(2000); continue; }
    if (++n % 50 === 0) { fs.writeFileSync(cacheF, JSON.stringify(cache)); console.log(n); }
    await sleep(140);   // Deezer erlaubt etwa 50 Anfragen in 5 Sekunden
  }
  fs.writeFileSync(cacheF, JSON.stringify(cache));
  const seen = new Set(have);
  const out = [];
  for (const t of todo) {
    const d = cache[t.id];
    if (!d || d.err || !d.p || !d.c || !d.t || !d.a || !d.y) continue;
    const k = norm(d.t) + '|' + norm(d.a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id: t.id, t: d.t, a: d.a, y: d.y, c: d.c, r: d.r, ya: 1 });
  }
  fs.writeFileSync(path.join(root, 'data/extra.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), songs: out }));
  console.log(`fertig: ${out.length} zusätzliche Songs → data/extra.json`);
})();
