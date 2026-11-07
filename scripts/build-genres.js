// Genres für alle Songs (data/songs.json + data/extra.json) bei Deezer nachschlagen: Track → Album → erstes Genre.
// Ergebnis: data/genres.json  { "<Deezer-ID>": "rock" | "pop" | "hiphop" | "dance" | "rnb" | "latin" | "schlager" | … }
// Aufruf: node scripts/build-genres.js   (Zwischenstand in data/genres-cache.json, Abbrechen und neu starten geht)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const load = f => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8')).songs;
const songs = [...load('songs.json'), ...load('extra.json')];
const cacheF = path.join(root, 'data/genres-cache.json');
const cache = fs.existsSync(cacheF) ? JSON.parse(fs.readFileSync(cacheF, 'utf8')) : { track: {}, album: {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let t = 0; t < 5; t++) {
    try {
      const d = await (await fetch(url)).json();
      if (d.error?.code === 4) { await sleep(5000); continue; }
      return d;
    } catch { await sleep(2000); }
  }
  return { error: 'x' };
}
// Deezer-Genre-IDs → eigene Kategorien
const MAP = { 132: 'pop', 116: 'hiphop', 152: 'rock', 85: 'rock', 464: 'rock', 113: 'dance', 106: 'dance', 165: 'rnb', 197: 'latin', 98: 'pop', 466: 'pop', 173: 'pop', 129: 'pop', 84: 'pop', 153: 'rock', 144: 'reggae', 169: 'rnb', 2: 'pop', 12: 'pop', 75: 'pop', 81: 'pop', 95: 'pop' };
(async () => {
  let n = 0;
  for (const s of songs) {
    if (!(s.id in cache.track)) {
      const d = await get(`https://api.deezer.com/track/${s.id}`);
      cache.track[s.id] = d.album?.id || 0;
      await sleep(130);
    }
    const al = cache.track[s.id];
    if (al && !(al in cache.album)) {
      const d = await get(`https://api.deezer.com/album/${al}`);
      cache.album[al] = d.genre_id ?? (d.genres?.data?.[0]?.id ?? -1);
      await sleep(130);
    }
    if (++n % 100 === 0) { fs.writeFileSync(cacheF, JSON.stringify(cache)); console.log(n); }
  }
  fs.writeFileSync(cacheF, JSON.stringify(cache));
  const out = {}, stat = {};
  for (const s of songs) {
    const gid = cache.album[cache.track[s.id]];
    const g = MAP[gid] || (gid > 0 ? 'other' : '');
    if (g) { out[s.id] = g; stat[g] = (stat[g] || 0) + 1; }
    stat['id' + gid] = (stat['id' + gid] || 0) + 1;
  }
  fs.writeFileSync(path.join(root, 'data/genres.json'), JSON.stringify(out));
  console.log('fertig', JSON.stringify(stat));
})();
