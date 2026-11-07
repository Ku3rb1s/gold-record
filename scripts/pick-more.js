// Strengere Auswahl für data/more.json – nur aus dem Zwischenspeicher von build-more.js (keine neuen Abfragen).
// Raus: Coverversionen bekannter Songs, Remixe/Medleys/Live/Demo, sehr unbekannte Songs.
// Deutsch: deutscher Titel, bekannter deutscher Interpret – oder nur in deutschen Playlists zu finden.
// Aufruf: node scripts/pick-more.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const load = f => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8')).songs;
const known = [...load('songs.json'), ...load('extra.json')];
const cache = JSON.parse(fs.readFileSync(path.join(root, 'data/more-cache.json'), 'utf8'));
const norm = s => String(s).toLowerCase().replace(/\(.*?\)|\[.*?\]|feat\..*$|ft\..*$| - .*$/g, '').replace(/[^a-z0-9äöüß]+/g, ' ').trim();
const haveId = new Set(known.map(s => String(s.id))), haveKey = new Set(known.map(s => norm(s.t) + '|' + norm(s.a)));
const knownTitle = new Map(); for (const s of known) knownTitle.set(norm(s.t), Math.max(knownTitle.get(norm(s.t)) || 0, s.r || 0));
const deArtists = new Set(known.filter(s => s.de).map(s => norm(s.a)));
const DE_Q = new Set(['Deutschpop Hits', 'Deutschrap Hits', 'Deutschrap Klassiker', 'Schlager Hits', 'Schlager Klassiker', 'Neue Deutsche Welle', 'Deutsche Hits 80er',
  'Deutsche Hits 90er', 'Deutsche Hits 2000er', 'Deutschrock', 'Deutsche Kultsongs', 'Liedermacher', 'Ballermann Hits', 'Top Deutschland', 'Deutsche Indie']);
const HINT = { 'Neue Deutsche Welle': 1980, 'Deutsche Hits 80er': 1980, 'Deutsche Hits 90er': 1990, 'Deutsche Hits 2000er': 2000, '60s Hits': 1960, '70s Hits': 1970,
  '80s Hits': 1980, '90s Hits': 1990, '2000s Hits': 2000, '2010s Hits': 2010, 'Disco Classics': 1970, 'Eurodance': 1990,
  'Greatest Hits 2000s': 2000, 'Greatest Hits 2010s': 2010, 'Britpop': 1990, 'Grunge': 1990, 'Motown Classics': 1960, 'Power Ballads': 1980, 'Pop Punk': 2000,
  '80s Rock': 1980, '90s Pop': 1990, '00s Rock': 2000, '2000s RnB': 2000, '90s Hip Hop': 1990, '70s Rock': 1970, '60s Rock': 1960 };
const MAP = { 132: 'pop', 116: 'hiphop', 152: 'rock', 85: 'rock', 464: 'rock', 113: 'dance', 106: 'dance', 165: 'rnb', 197: 'latin', 173: 'pop', 84: 'pop', 466: 'pop', 129: 'pop', 98: 'pop', 169: 'rnb', 144: 'reggae' };
const deWord = /\b(ich|du|der|die|das|und|nicht|nie|ein|eine|mein|dein|wir|ist|mit|für|auf|liebe|herz|nacht|immer|kein|wenn|zu|bis|vom|im|am|zeit|leben|welt|land|tag|geht|bist|hab|doch|lass|weg|mehr|noch|nur|schon|sein|alles|mal|wie|was|wer|wo|heute|morgen|gestern|sommer|regen|sonne|stadt|kinder|männer|frauen|mädchen|junge|schön|gegenwart|verschwendete|knutschen)\b|[äöüß]/i;
const french = /(le|la|les|des|une|est|je|pour|avec|dans|mon|ma|toi|moi|qui|pas)/i;
const junk = /\b(remix|karaoke|live|instrumental|medley|mega ?mix|party mix|hit ?mix|re-?recorded|acoustic|unplugged|demo\d*|tribute|in the style of|originally performed|sped up|slowed|nightcore|radio edit|extended|club mix|airplay mix|original mix|version)\b|_demo/i;

const tracks = new Map();
for (const [q, list] of Object.entries(cache.pl)) for (const t of list) {
  if (!t.p || !t.c || !t.t || !t.a) continue;
  const k = norm(t.t) + '|' + norm(t.a);
  if (haveId.has(String(t.id)) || haveKey.has(k)) continue;
  const o = tracks.get(k) || { ...t, qs: new Set() };
  o.qs.add(q); if (t.r > o.r) Object.assign(o, { id: t.id, r: t.r, c: t.c, al: t.al });
  tracks.set(k, o);
}
const out = [], why = {};
const drop = r => { why[r] = (why[r] || 0) + 1; };
// je Titel nur die bekannteste Fassung (Coverversionen raus)
const bestOfTitle = new Map(); for (const o of tracks.values()) bestOfTitle.set(norm(o.t), Math.max(bestOfTitle.get(norm(o.t)) || 0, o.r));
for (const o of tracks.values()) {
  // Deutsch: bekannter deutscher Interpret oder deutscher Titel (nicht französisch) – Charts/Party-Listen allein reichen nicht
  const qs = [...o.qs];
  const de = deArtists.has(norm(o.a)) || (deWord.test(o.t) && !french.test(o.t));
  if (junk.test(o.t)) { drop('Remix/Live/Medley'); continue; }
  const nt = norm(o.t);
  if ((knownTitle.get(nt) || 0) > o.r || bestOfTitle.get(nt) > o.r) { drop('Coverversion'); continue; }
  if (o.r < (de ? 180000 : 350000)) { drop('zu unbekannt'); continue; }
  const al = cache.album[o.al] || {};
  let y = al.y || 0;
  const hint = qs.map(q => HINT[q]).find(Boolean);
  if (hint && (y < hint || y > hint + 9)) y = hint + 5;
  if (!y) { drop('kein Jahr'); continue; }
  out.push({ id: o.id, t: o.t, a: o.a, y, c: o.c, r: o.r, ya: 2, ...(de ? { de: true } : {}), ...(MAP[al.g] ? { g: MAP[al.g] } : {}) });
}
// Interpret mit mindestens einem deutschen Song → alle seine Songs deutsch (z. B. Kraftklub, Casper)
const deA = new Set(out.filter(x => x.de).map(x => norm(x.a)));
for (const x of out) if (!x.de && deA.has(norm(x.a)) && !french.test(x.t)) x.de = true;
fs.writeFileSync(path.join(root, 'data/more.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), songs: out }));
console.log(`behalten: ${out.length} (deutsch ${out.filter(s => s.de).length}) – aussortiert:`, why);
