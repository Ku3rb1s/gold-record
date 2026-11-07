// Prüft die Jahre der Songs aus data/extra.json und data/more.json (bisher ungeprüft, Deezer-Albumjahr) gegen MusicBrainz.
// Gleiche Regel wie in Older or Newer (scripts/mb.js): früheste offizielle Veröffentlichung als Album/Single/EP,
// ohne Compilations, Live-Mitschnitte, Remixe.
// Übernommen wird ein MusicBrainz-Jahr nur, wenn es plausibel ist: nicht mehr als 1 Jahr NACH dem Deezer-Albumjahr
// (ein Original kann nicht später erscheinen als das Album, auf dem es bei Deezer liegt – sonst war es ein falscher Treffer).
// Ergebnis: data/years.json (Deezer-ID → geprüftes Jahr). Das Spiel setzt damit das Jahr und behandelt den Song als geprüft.
// Zwischenstand: data/mb-more.json (ID → Jahr, 0 = nicht gefunden); abbrechen und neu starten geht jederzeit.
// Bereits von Older or Newer nachgeschlagene IDs (../Older-or-Newer/data/mb-years.json) werden mitbenutzt (nur gelesen).
// Aufruf: node scripts/check-years-more.js   (gut 1 s pro Song wegen des MusicBrainz-Limits)
//         node scripts/check-years-more.js --write   (nur years.json aus dem Zwischenstand neu schreiben, ohne Abfragen)
const fs = require('fs'), path = require('path');
const { originalYear } = require('./mb.js');
const DATA = path.join(__dirname, '..', 'data');
const CACHE = path.join(DATA, 'mb-more.json');
const load = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')).songs;
const songs = [...load('extra.json'), ...load('more.json')].filter(s => s.ya);
let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch {}
// Ergebnisse von Older or Newer mitlesen (nur lesen) – auch während des Laufs, die andere Sitzung fragt MusicBrainz parallel ab
function readOon() { try { const oon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'Older-or-Newer', 'data', 'mb-years.json'), 'utf8')); for (const k in oon) if (!(k in cache) && oon[k]) cache[k] = oon[k]; } catch {} }
readOon();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function writeYears() {
  const out = {}; let ok = 0, late = 0, none = 0;
  for (const s of songs) {
    const y = cache[s.id];
    if (y === undefined) continue;
    if (!y) { none++; continue; }
    // Song aus einer Jahrzehnt-Playlist (h): das Jahr muss in diesem Jahrzehnt liegen (sonst falscher Treffer, z. B. Neuaufnahme)
    if (s.h && (y < s.h || y > s.h + 9)) { late++; continue; }
    // sonst: nicht später als das Deezer-Album, auf dem der Song liegt (ein Original erscheint nicht nach dem Album)
    if (!s.h && y > s.y + 1) { late++; continue; }
    out[s.id] = y; ok++;
  }
  fs.writeFileSync(path.join(DATA, 'years.json'), JSON.stringify(out));
  return { ok, late, none };
}
if (process.argv.includes('--write')) { console.log('years.json neu geschrieben', JSON.stringify(writeYears())); return; }
(async () => {
  // bekannteste zuerst: die kommen im Spiel am häufigsten dran
  const todo = songs.filter(s => !(s.id in cache)).sort((a, b) => (b.r || 0) - (a.r || 0));
  console.log(`${songs.length} Songs, ${songs.length - todo.length} schon bekannt, ${todo.length} offen`);
  for (const [i, s] of todo.entries()) {
    if (i % 25 === 0) readOon();
    if (s.id in cache) continue;
    try { cache[s.id] = (await originalYear(s.t, s.a)).year; }
    catch (e) { console.log('Fehler bei', s.a, '-', s.t, e.message); await sleep(5000); continue; }
    if (i % 25 === 0) { fs.writeFileSync(CACHE, JSON.stringify(cache)); const r = writeYears(); console.log(i, '/', todo.length, JSON.stringify(r)); }
  }
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  console.log('fertig', JSON.stringify(writeYears()));
})();
