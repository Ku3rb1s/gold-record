// Noch mehr Songs aus Deezer-Playlists (Charts, Jahrzehnte, Genres, viele deutsche Listen) → data/more.json
// Pro Album eine Abfrage: liefert Jahr und Genre. Das Jahr ist ungeprüft (oft Best-of/Remaster) → ya: 2,
// diese Songs kommen nur in Fragen ohne Jahr (Hören, Interpret, Cover, „nicht von“) und in Genre-/Sprach-Themen.
// Aufruf: node scripts/build-more.js   (Zwischenstand in data/more-cache.json)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const load = f => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8')).songs;
const known = [...load('songs.json'), ...load('extra.json')];
const norm = s => String(s).toLowerCase().replace(/\(.*?\)|\[.*?\]|feat\..*$|ft\..*$| - .*$/g, '').replace(/[^a-z0-9äöüß]+/g, ' ').trim();
const have = new Set(known.flatMap(s => [String(s.id), norm(s.t) + '|' + norm(s.a)]));
const deArtists = new Set(known.filter(s => s.de).map(s => norm(s.a)));
const cacheF = path.join(root, 'data/more-cache.json');
const cache = fs.existsSync(cacheF) ? JSON.parse(fs.readFileSync(cacheF, 'utf8')) : { pl: {}, album: {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let t = 0; t < 6; t++) {
    try { const d = await (await fetch(url)).json(); if (d.error?.code === 4) { await sleep(5000); continue; } return d; } catch { await sleep(2000); }
  }
  return { error: 'x' };
}
// [Suchbegriff, deutsch?, Jahrzehnt-Hinweis]
const Q = [
  ['Deutschpop Hits', 1], ['Deutschrap Hits', 1], ['Deutschrap Klassiker', 1], ['Schlager Hits', 1], ['Schlager Klassiker', 1],
  ['Neue Deutsche Welle', 1, 1980], ['Deutsche Hits 80er', 1, 1980], ['Deutsche Hits 90er', 1, 1990], ['Deutsche Hits 2000er', 1, 2000],
  ['Deutschrock', 1], ['Deutsche Kultsongs', 1], ['Liedermacher', 1], ['Ballermann Hits', 1], ['Top Deutschland', 1], ['Deutsche Indie', 1],
  ['60s Hits', 0, 1960], ['70s Hits', 0, 1970], ['80s Hits', 0, 1980], ['90s Hits', 0, 1990], ['2000s Hits', 0, 2000], ['2010s Hits', 0, 2010],
  ['Rock Classics', 0], ['Hip Hop Classics', 0], ['Dance Classics', 0], ['R&B Classics', 0], ['Disco Classics', 0, 1970], ['Eurodance', 0, 1990],
  ['One Hit Wonders', 0], ['Indie Classics', 0], ['Soul Classics', 0], ['Pop Hits', 0], ['Summer Hits', 0], ['Party Hits', 0],
];
const MAP = { 132: 'pop', 116: 'hiphop', 152: 'rock', 85: 'rock', 464: 'rock', 113: 'dance', 106: 'dance', 165: 'rnb', 197: 'latin', 173: 'pop', 84: 'pop', 466: 'pop', 129: 'pop', 98: 'pop', 169: 'rnb', 144: 'reggae' };
const deWord = /\b(ich|du|der|die|das|und|nicht|ein|eine|mein|dein|wir|ist|mit|für|auf|liebe|herz|nacht|immer|kein|wenn|so|zu|bis|vom|im|am)\b|[äöüß]/i;

(async () => {
  const tracks = new Map();   // id → {t,a,r,c,al,de,hint}
  for (const [q, de, hint] of Q) {
    if (!cache.pl[q]) {
      const s = await get(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(q)}&limit=10`);
      const pls = (s.data || []).filter(p => p.nb_tracks >= 30).sort((a, b) => (/deezer/i.test(b.user?.name) - /deezer/i.test(a.user?.name)) || b.nb_tracks - a.nb_tracks).slice(0, 2);
      const got = [];
      for (const p of pls) {
        const d = await get(`https://api.deezer.com/playlist/${p.id}/tracks?limit=200`);
        for (const t of d.data || []) got.push({ id: t.id, t: t.title_short || t.title, a: t.artist?.name, r: t.rank || 0, c: t.album?.md5_image || t.md5_image || '', al: t.album?.id, p: !!t.preview });
        await sleep(200);
      }
      cache.pl[q] = got;
      fs.writeFileSync(cacheF, JSON.stringify(cache));
      console.log(q, got.length);
      await sleep(200);
    }
    for (const t of cache.pl[q]) {
      if (!t.p || !t.c || !t.t || !t.a || t.r < 150000) continue;
      const k = norm(t.t) + '|' + norm(t.a);
      if (have.has(String(t.id)) || have.has(k)) continue;
      const o = tracks.get(k) || { ...t, de: false, hint: 0 };
      if (de && (deArtists.has(norm(t.a)) || deWord.test(t.t))) o.de = true;
      if (hint) o.hint = hint;
      tracks.set(k, o);
    }
  }
  console.log('Kandidaten:', tracks.size);
  let n = 0;
  for (const o of tracks.values()) {
    if (o.al && !(o.al in cache.album)) {
      const d = await get(`https://api.deezer.com/album/${o.al}`);
      cache.album[o.al] = { y: +(String(d.release_date || '').slice(0, 4)) || 0, g: d.genre_id ?? -1 };
      if (++n % 100 === 0) { fs.writeFileSync(cacheF, JSON.stringify(cache)); console.log(n); }
      await sleep(140);
    }
  }
  fs.writeFileSync(cacheF, JSON.stringify(cache));
  const out = [];
  for (const o of tracks.values()) {
    const al = cache.album[o.al] || {};
    let y = al.y || 0;
    // Jahrzehnt-Playlist: liegt das Albumjahr außerhalb (Best-of), grob die Mitte des Jahrzehnts nehmen
    if (o.hint && (y < o.hint || y > o.hint + 9)) y = o.hint + 5;
    if (!y) continue;
    out.push({ id: o.id, t: o.t, a: o.a, y, c: o.c, r: o.r, ya: 2, ...(o.de ? { de: true } : {}), ...(MAP[al.g] ? { g: MAP[al.g] } : {}) });
  }
  fs.writeFileSync(path.join(root, 'data/more.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), songs: out }));
  console.log(`fertig: ${out.length} Songs (${out.filter(s => s.de).length} deutsch) → data/more.json`);
})();
