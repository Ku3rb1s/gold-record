/* Gold Record – Spielablauf und Anzeige
   Quiz-Leiter mit 15 Stufen: Jede richtige Antwort bringt eine Stufe höher, von der Kassette bis zum Diamanten.
   Gold (Stufe 5) und Platin (Stufe 10) sind sicher: Bei einem Fehler fällt man auf die letzte erreichte Sicherheitsstufe.
   Aussteigen geht jederzeit vor dem Antworten – dann bleibt die erreichte Stufe. */
const APP_VERSION = '1.7.1', APP_DATE = '07.11.2026'; // bei jedem Update erhöhen + CHANGELOG.md ergänzen
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// Die 15 Stufen (Index 0 = Frage 1). safe = Sicherheitsstufe
const STAGES = ['Demo-Tape', 'Kassette', 'Mixtape', 'Single', 'Gold', 'Radio-Hit', 'Top 40', 'Top 10', 'Nummer 1', 'Platin',
  'Doppel-Platin', 'Welttournee', 'Stadion', 'Hall of Fame', 'Diamant'];
const SAFE = [5, 10];             // nach so vielen richtigen Antworten ist man sicher
const MEDAL = n => n >= 15 ? '💎' : n >= 10 ? '💿' : n >= 5 ? '📀' : n >= 1 ? '📼' : '🎵';
// Themen (Kategorien) für eine Runde. Jahrzehnte nur mit geprüftem Jahr (außer 2010er: dort zählen auch die neuen Hits),
// Genres aus data/genres.json (Deezer, per scripts/build-genres.js) – fehlt die Datei, gibt es die Genre-Themen nicht
const POOL_NAMES = { all: 'Alle', intl: 'International', de: 'Deutsch', d70: '70er & älter', d80: '80er', d90: '90er', d00: '2000er', d10: '2010er & neuer',
  pop: 'Pop', rock: 'Rock', hiphop: 'Hip-Hop', dance: 'Dance & Electro', rnb: 'R&B & Soul' };
const THEME_MIN = 80;   // kleinere Themen sind nicht wählbar (zu wenige Songs für 15 Fragen ohne Wiederholung)
/* Schwierigkeit (unabhängig von den Jokern – die gibt es immer alle):
   h0/h1 = Ähnlichkeit der falschen Antworten bei Frage 1 bzw. 15 (0 = zufällig, 1 = sehr ähnlich)
   f0/f1 = Anteil der bekanntesten Songs (nach Deezer-Rang), aus dem bei Frage 1 bzw. 15 gezogen wird */
const DIFF = {
  easy: { h0: 0, h1: .55, f0: .12, f1: .5 },
  normal: { h0: 0, h1: 1, f0: .18, f1: 1 },
  hard: { h0: .35, h1: 1, f0: .4, f1: 1 },
};
const DIFF_NAMES = { easy: 'Leicht', normal: 'Normal', hard: 'Schwer' };
const DIFF_INFO = {
  easy: 'Nur große Hits, die falschen Antworten liegen weit daneben – zum Reinkommen.',
  normal: 'Wird nach oben immer kniffliger: unbekanntere Songs, ähnlichere Antworten.',
  hard: 'Von Anfang an knifflig – nahe Jahreszahlen, ähnliche Songs, auch Album-Tracks.',
};
// Joker wie im Fernsehen: 50:50, Publikum, Telefon und Zusatzjoker (jemand aus dem Publikum steht auf)
const JOKERS = ['fifty', 'people', 'phone', 'extra'];
const EXTRA_NAMES = ['Lena', 'Murat', 'Sophie', 'Jonas', 'Aylin', 'Tom', 'Mia', 'Elias', 'Nora', 'Ben', 'Sara', 'Luca', 'Emma', 'Noah'];
// Was der Freund am Telefon sagt – je nachdem, wie sicher er ist (0 unsicher … 2 ganz sicher)
const PHONE_LINES = [
  'Puh, schwierig … ich würde {a} sagen, aber verlass dich nicht drauf.',
  'Ich glaube, es ist {a}.',
  'Da bin ich mir ganz sicher: {a}!',
];
const TIMER_NAMES = { on: 'Mit Zeitlimit', off: 'Ohne Zeitlimit' };
const TIMER_INFO = {
  on: 'Frage 1–5 ohne Uhr, Frage 6–10 je 45 Sekunden, ab Frage 11 je 30 Sekunden.',
  off: 'Keine Uhr – denk so lange nach, wie du willst.',
};
// Zeitlimit je Frage (Index 0–14) in Sekunden
const timeFor = i => cfg().timer === 'off' ? 0 : i >= 10 ? 30 : i >= 5 ? 45 : 0;
const SNIPPET = 15;               // so viele Sekunden spielt eine Hörprobe normal („Nochmal hören“ – geht immer: die ganzen 30 von vorn)

const LOC = () => ({ de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', nb: 'nb-NO' }[curLang] || 'de-DE');
const fmtN = n => Math.round(n).toLocaleString(LOC());
const SITE = 'https://ku3rb1s.github.io/gold-record/';

// Gespeichert wird mit „gr.“ vorne – alle Spiele teilen sich den Browser-Speicher von ku3rb1s.github.io
const LS = {
  get(k, d) { try { const v = localStorage.getItem('gr.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gr.' + k, JSON.stringify(v)); } catch {} },
};
const opt = { pool: LS.get('pool', 'all'), diff: LS.get('diff', 'normal'), timer: LS.get('timer', 'on'), auto: LS.get('auto', true), sfx: LS.get('sfx', true), drama: LS.get('drama', true), vol: LS.get('vol', 80), muted: false };
if (!POOL_NAMES[opt.pool]) opt.pool = 'all';
if (!DIFF[opt.diff]) opt.diff = 'normal';
if (!TIMER_NAMES[opt.timer]) opt.timer = 'on';
// Im Spiel gelten die Einstellungen der Runde (Tägliche Challenge: immer Alle · Normal · mit Zeitlimit)
const cfg = () => G?.daily ? { pool: 'all', diff: 'normal', timer: 'on' } : opt;
const bestKey = (p = opt.pool, d = opt.diff) => `best.${p}.${d}`;

const modeLabel = () => G?.daily ? tx('Tägliche Challenge') + ' #' + dayNo(G.day)
  : [POOL_NAMES[opt.pool], DIFF_NAMES[opt.diff], TIMER_NAMES[opt.timer]].map(s => tx(s)).join(' · ');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* Zufall: normal Math.random; bei der Täglichen Challenge ein fester Startwert aus dem Datum,
   damit alle am selben Tag dieselben 15 Fragen bekommen (mulberry32) */
let R = Math.random;
function seeded(str) {
  let a = 0; for (const c of str) a = Math.imul(a ^ c.charCodeAt(0), 2654435761) >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const rnd = n => Math.floor(R() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cover = (s, size = 500) => s.c ? `https://e-cdns-images.dzcdn.net/images/cover/${s.c}/${size}x${size}-000000-80-0-0.jpg` : '';
const lerp = (a, b, k) => a + (b - a) * k;

/* ---------- Daten ---------- */
let SONGS = [], STREAMS = [], FAME = new Map(), GENRE = new Map();
async function loadData() {
  if (SONGS.length) return;
  const [a, b, x] = await Promise.all([
    fetch('data/songs.json?v=' + APP_VERSION).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    fetch('data/billions.json?v=' + APP_VERSION).then(r => r.ok ? r.json() : { tracks: [] }).catch(() => ({ tracks: [] })),
    fetch('data/extra.json?v=' + APP_VERSION).then(r => r.ok ? r.json() : { songs: [] }).catch(() => ({ songs: [] })),
    fetch('data/genres.json?v=' + APP_VERSION).then(r => r.ok ? r.json() : {}).catch(() => ({})),
    fetch('data/more.json?v=' + APP_VERSION).then(r => r.ok ? r.json() : { songs: [] }).catch(() => ({ songs: [] })),
  ]).then(([a, b, x, g, m]) => {
    for (const k in g) GENRE.set(+k, g[k]);
    for (const s of m.songs) if (s.g) GENRE.set(s.id, s.g);
    x.songs.push(...m.songs);
    return [a, b, x];
  });
  poolCache.clear();
  // songs.json: Jahr geprüft (MusicBrainz). extra.json (ya 1) und more.json (ya 2): weitere Hits, Jahr ungeprüft – nur für Fragen ohne Jahr
  SONGS = [...a.songs, ...x.songs];
  // Bekanntheit 0 (größter Hit) … 1 (am wenigsten bekannt) nach Deezer-Rang
  [...SONGS].sort((x, y) => (y.r || 0) - (x.r || 0)).forEach((s, i, all) => FAME.set(s.id, i / all.length));
  STREAMS = b.tracks.filter(t => t.streams).sort((x, y) => y.streams - x.streams);
}
const DEC = { d70: [0, 1979], d80: [1980, 1989], d90: [1990, 1999], d00: [2000, 2009], d10: [2010, 9999] };
const poolCache = new Map();
function poolOf(p) {
  if (poolCache.has(p)) return poolCache.get(p);
  const r = SONGS.filter(s => p === 'all' ? true : p === 'de' ? s.de : p === 'intl' ? !s.de
    : DEC[p] ? (!s.ya || (p === 'd10' && s.ya === 1)) && s.y >= DEC[p][0] && s.y <= DEC[p][1]
      : GENRE.get(s.id) === p);
  poolCache.set(p, r);
  return r;
}
const themeOk = p => poolOf(p).length >= THEME_MIN;

/* ---------- Fragen ----------
   Schwierigkeit h (0 = Frage 1 … 1 = Frage 15) steuert zwei Dinge:
   - Bekanntheit: anfangs nur die größten Hits (nach Deezer-Rang), zum Schluss alle Songs
   - Ähnlichkeit der falschen Antworten: anfangs zufällig, zum Schluss aus derselben Zeit (nahe Jahre, gleiche Sprache, gleicher Interpret) */
const TYPES = {
  listen: { q: 'Welcher Song läuft?', song: true, blind: true },
  artist: { q: 'Von wem ist dieser Song?', song: true },
  year: { q: 'Aus welchem Jahr ist dieser Song?', song: true },
  cover: { q: 'Welches Cover gehört zu diesem Song?', song: true },
  oldest: { q: 'Welcher dieser Songs ist am ältesten?' },
  newest: { q: 'Welcher dieser Songs ist am neuesten?' },
  streams: { q: 'Welcher Song hat bei Spotify die meisten Streams?' },
  decade: { q: 'Aus welchem Jahrzehnt ist dieser Song?', song: true },
  notby: { q: 'Welcher Song ist NICHT von {a}?' },
  flash: { q: 'Nur 3 Sekunden: Welcher Song läuft?', song: true, blind: true },
};
// Fragearten mit Jahr brauchen geprüfte Jahre (songs.json), die anderen dürfen auch extra.json nutzen
const NEEDS_YEAR = new Set(['year', 'oldest', 'newest', 'decade']);
const curve = i => Math.pow(i / 14, 1.4);
const hOf = i => { const D = DIFF[cfg().diff]; return lerp(D.h0, D.h1, curve(i)); };
// checked = nur Songs mit geprüftem Jahr (für Jahres- und Älteste-Fragen)
function famePool(i, checked = false) {
  const D = DIFF[cfg().diff];
  const all = poolOf(cfg().pool).filter(s => !checked || !s.ya).sort((a, b) => (b.r || 0) - (a.r || 0) || a.id - b.id);
  return all.slice(0, Math.max(60, Math.round(all.length * lerp(D.f0, D.f1, curve(i)))));
}
// Ähnlichste Kandidaten zuerst – bei leichten Fragen überdeckt Zufall die Ähnlichkeit
function similar(subj, cands, h, extra = () => 0) {
  return cands.map(s => ({ s, d: Math.abs(s.y - subj.y) + (s.de !== subj.de ? 8 : 0) + extra(s) + R() * lerp(60, 4, h) }))
    .sort((a, b) => a.d - b.d).map(x => x.s);
}
const kinds = () => Object.keys(TYPES).filter(t => t !== 'streams' || (STREAMS.length >= 40 && (cfg().pool === 'all' || cfg().pool === 'intl')));
function pickTypes() {
  // abwechslungsreich: jeder Typ höchstens 2-mal, nicht zweimal hintereinander;
  // Jahrzehnt nur am Anfang (leicht), 3-Sekunden-Intro erst ab Frage 8 (schwer)
  const ks = kinds();
  const ok = (k, i) => !(k === 'decade' && (i > 6 || DEC[cfg().pool])) && !(k === 'flash' && i < 7);
  const out = [];
  for (let i = 0; i < 15; i++) {
    let c = shuffle(ks.filter(k => k !== out[i - 1] && ok(k, i) && out.filter(x => x === k).length < 2));
    // zum Einstieg lieber Hören, Interpret oder Jahrzehnt
    if (i < 3) c = c.filter(k => k === 'listen' || k === 'artist' || k === 'decade').concat(c);
    out.push(c[0] || ks.filter(k => ok(k, i))[rnd(ks.filter(k => ok(k, i)).length)]);
  }
  return out;
}

function makeQuestion(i, type) {
  if (type === 'notby') { const q = notByQuestion(i); if (q) return q; type = 'artist'; }
  const h = hOf(i), pool = famePool(i, NEEDS_YEAR.has(type));
  const free = pool.filter(s => !G.used.has(s.id));
  const subj = free[rnd(free.length)] || pool[rnd(pool.length)];
  const Q = { type, i, h, fame: FAME.get(subj.id) ?? .5 };
  // Schwierigkeit fürs Publikum/Telefon: Frage-Nummer zählt mit, damit auch „Leicht“ nach oben etwas unsicherer wird
  Q.hp = Math.max(h, i / 14 * .6);
  if (type === 'listen' || type === 'flash' || type === 'artist' || type === 'cover') {
    Q.song = subj;
    const key = type === 'listen' || type === 'flash' ? s => s.t.toLowerCase() : type === 'artist' ? s => s.a.toLowerCase() : s => s.c;
    const seen = new Set([key(subj)]);
    // beim Cover: gleicher Interpret macht es schwer (Cover sehen sich oft ähnlich)
    const extra = type === 'cover' ? s => (s.a === subj.a ? -6 * h : 0) : type === 'listen' || type === 'flash' ? s => (s.a === subj.a ? -4 * h : 0) : () => 0;
    const wrong = [];
    const cand = distractors().filter(s => s.id !== subj.id && s.c), fresh = cand.filter(s => !G.used.has(s.id));
    for (const s of similar(subj, fresh.length > 200 ? fresh : cand, h, extra)) {
      if (seen.has(key(s)) || !key(s)) continue;
      seen.add(key(s)); wrong.push(s);
      if (wrong.length === 3) break;
    }
    Q.answers = shuffle([subj, ...wrong]).map(s => ({ s, ok: s === subj }));
  } else if (type === 'year') {
    Q.song = subj;
    // Abstand der Jahreszahlen: anfangs 8 Jahre, zum Schluss 1 Jahr
    const step = Math.max(1, Math.round(lerp(8, 1, h)));
    // Jahre rund um das richtige, nicht in der Zukunft
    const near = [-1, 1, -2, 2, -3, 3, -4, 4, -5, -6].map(k => subj.y + k * step).filter(y => y >= 1940 && y <= 2026);
    const ys = shuffle(near.slice(0, 6)).slice(0, 3);
    Q.answers = [subj.y, ...ys].sort((a, b) => a - b).map(y => ({ y, ok: y === subj.y }));
  } else if (type === 'decade') {
    Q.song = subj;
    // vier aufeinanderfolgende Jahrzehnte, das richtige an zufälliger Stelle
    const d = Math.floor(subj.y / 10) * 10;
    let first = d - 10 * rnd(4);
    first = Math.max(1950, Math.min(first, 2020 - 30));
    Q.answers = [0, 1, 2, 3].map(k => first + 10 * k).map(x => ({ dec: x, ok: x === d }));
  } else if (type === 'oldest' || type === 'newest') {
    // 4 Songs mit verschiedenen Jahren; zum Schluss liegen sie eng beieinander
    const gap = Math.max(1, Math.round(lerp(9, 1, h))), win = lerp(60, 8, h);
    let pick = null;
    for (let t = 0; t < 40 && !pick; t++) {
      const a = free[rnd(free.length)], got = [a];
      for (const s of shuffle(free.filter(s => Math.abs(s.y - a.y) <= win))) {
        if (got.every(g => Math.abs(g.y - s.y) >= gap && g.a !== s.a)) got.push(s);
        if (got.length === 4) { pick = got; break; }
      }
    }
    pick ??= shuffle(free).filter((s, k, arr) => arr.findIndex(x => x.y === s.y) === k).slice(0, 4);
    // „am neuesten“ = gespiegelt: Jahre negativ rechnen
    const sg = type === 'newest' ? -1 : 1;
    const ys = pick.map(s => s.y * sg).sort((p, q) => p - q);
    // Sicherheitsnetz: liegen die zwei vordersten zu eng beieinander, den zweiten ersetzen
    const lead = Math.max(2, Math.round(lerp(10, 2, h)));
    if (ys[1] - ys[0] < lead) {
      const second = pick.find(s => s.y * sg === ys[1]);
      const repl = free.find(s => s.y * sg - ys[0] >= lead && s.y * sg - ys[0] <= win + lead && !pick.includes(s) && pick.every(p => p.a !== s.a && p.y !== s.y));
      if (repl) pick[pick.indexOf(second)] = repl;
    }
    const best = Math.min(...pick.map(s => s.y * sg));
    Q.answers = shuffle(pick).map(s => ({ s, ok: s.y * sg === best }));
    Q.fame = pick.reduce((n, s) => n + (FAME.get(s.id) ?? .5), 0) / 4;
  } else if (type === 'streams') {
    // Vorsprung des Siegers vor dem Zweitplatzierten: anfangs 60 %, zum Schluss 8 %;
    // die drei anderen liegen umso näher beieinander, je höher die Frage
    const lead = lerp(1.6, 1.08, h), w = Math.round(lerp(STREAMS.length, 60, h));
    let picks = [];
    for (let t = 0; t < 60 && picks.length < 4; t++) {
      const wi = rnd(STREAMS.length), win = STREAMS[wi];
      const rest = shuffle(STREAMS.filter((s, k) => k > wi && k <= wi + w && s.streams * lead <= win.streams && s.artist !== win.artist));
      picks = [win];
      for (const s of rest) { if (!picks.some(p => p.artist === s.artist)) picks.push(s); if (picks.length === 4) break; }
    }
    // Notfall (kommt praktisch nicht vor): mit beliebigen, deutlich schwächeren Songs auffüllen
    for (const s of STREAMS) { if (picks.length >= 4) break; if (s.streams * 1.05 <= picks[0].streams && !picks.some(p => p.artist === s.artist)) picks.push(s); }
    const top = Math.max(...picks.map(t => t.streams));
    Q.answers = shuffle(picks).map(t => ({ st: t, ok: t.streams === top }));
    Q.fame = lerp(.2, .7, h);
  }
  if (Q.song) G.used.add(Q.song.id);
  for (const a of Q.answers) if (a.s) G.used.add(a.s.id);
  return Q;
}
// falsche Antworten: aus dem gewählten Thema, wenn es groß genug ist – sonst aus allen Songs
function distractors() { const p = poolOf(cfg().pool); return p.length >= 150 ? p : SONGS; }
// „Welcher Song ist NICHT von X?“: drei Songs eines Interpreten, einer von jemand anderem (später: ähnliche Zeit/Sprache)
function notByQuestion(i) {
  const h = hOf(i), D = DIFF[cfg().diff];
  const by = new Map();
  for (const s of poolOf(cfg().pool)) { const k = s.a.toLowerCase(); if (!by.has(k)) by.set(k, []); by.get(k).push(s); }
  let arts = [...by.values()].filter(l => new Set(l.map(s => s.t.toLowerCase())).size >= 3)
    .map(l => ({ l, f: Math.min(...l.map(s => FAME.get(s.id) ?? 1)) })).sort((a, b) => a.f - b.f || a.l[0].id - b.l[0].id);
  arts = arts.filter(x => !G.usedArtists?.has(x.l[0].a));
  if (!arts.length) return null;
  const top = arts.slice(0, Math.max(6, Math.round(arts.length * lerp(D.f0 + .2, D.f1, curve(i)))));
  const A = top[rnd(top.length)], seen = new Set();
  const three = shuffle([...A.l]).filter(s => !seen.has(s.t.toLowerCase()) && seen.add(s.t.toLowerCase())).slice(0, 3);
  const odd = similar(three[0], distractors().filter(s => s.a.toLowerCase() !== three[0].a.toLowerCase() && !seen.has(s.t.toLowerCase())), h)[0];
  if (!odd) return null;
  (G.usedArtists ??= new Set()).add(A.l[0].a);
  return { type: 'notby', i, h, hp: Math.max(h, i / 14 * .6), fame: A.f, qv: { a: three[0].a }, answers: shuffle([...three, odd]).map(s => ({ s, ok: s === odd })) };
}

/* ---------- Wiedergabe: Hörprobe von Deezer ----------
   Die Vorschau-Links laufen nach einiger Zeit ab – darum wird der Link erst kurz vorher per /track/{id} geholt. */
if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) document.documentElement.classList.add('ios');
const player = new Audio();
player.preload = 'auto';
let playingId = null, limit = SNIPPET;
const previews = new Map();
function previewOf(s) {
  if (!previews.has(s.id)) {
    const p = DZ.track(s.id).then(t => {
      if (!t.preview) throw new Error(tx('Keine Vorschau'));
      if (!s.c && t.album?.md5_image) s.c = t.album.md5_image;
      return t.preview;
    });
    p.catch(() => previews.delete(s.id));
    previews.set(s.id, p);
  }
  return previews.get(s.id);
}
async function play(s, full = false) {
  playingId = s.id; limit = full ? 31 : SNIPPET;
  if (G?.q?.type === 'flash' && G.q.song === s && !G.locked) limit = 3;
  renderPlaying();
  try {
    const url = await previewOf(s);
    if (playingId !== s.id) return;
    if (player.src !== url) player.src = url;
    player.currentTime = 0;
    applyVol();
    await player.play();
  } catch (e) {
    if (playingId === s.id) { playingId = null; renderPlaying(); }
    if (e?.name !== 'AbortError') toast(e?.name === 'NotAllowedError' ? tx('Tippe auf die Platte, um abzuspielen') : (e?.message || tx('Abspielen klappt gerade nicht')));
  }
}
// Hörprobe vorab laden, damit die nächste Frage ohne Wartesekunde startet
const preAudio = new Audio(); preAudio.preload = 'auto'; preAudio.muted = true;
function preload(s) { if (s) previewOf(s).then(u => { preAudio.src = u; }).catch(() => {}); }
function stop() { playingId = null; player.pause(); renderPlaying(); }
function toggle(s) { playingId === s.id && !player.paused ? stop() : play(s, limit > SNIPPET && G?.q?.song === s); }
player.addEventListener('timeupdate', () => { if (player.currentTime >= limit) stop(); });
player.addEventListener('ended', () => { playingId = null; renderPlaying(); });
player.addEventListener('playing', renderPlaying);
player.addEventListener('pause', renderPlaying);
function renderPlaying() {
  $$('#endList [data-play]').forEach(el => el.classList.toggle('playing', +el.dataset.play === playingId && !player.paused));
  const c = $('#qBox .qdisc'); if (!c) return;
  const on = playingId != null && +c.dataset.id === playingId;
  c.classList.toggle('playing', on && !player.paused);
  c.classList.toggle('waiting', on && player.paused);
}
function applyVol() {
  player.muted = opt.muted;
  player.volume = opt.vol / 100;
  $('#volBox').classList.toggle('off', opt.muted);
  const r = $('#vol');
  r.value = opt.vol; r.style.setProperty('--p', opt.vol + '%');
  $('#volVal').textContent = opt.muted ? '–' : opt.vol;
  $('#volMute use').setAttribute('href', opt.muted || !opt.vol ? '#i-mute' : '#i-vol');
}

/* ---------- Spiel ---------- */
let G = null;
async function startGame(daily = false, day = today()) {
  try { await loadData(); } catch { return toast(tx('Die Songliste konnte nicht geladen werden.')); }
  if (daily && LS.get('daily.' + day)) {
    if (day !== today()) return showDaily(day);
    renderHome(); return toast(tx('Die heutige Challenge hast du schon gespielt – morgen gibt es neue Fragen.'));
  }
  if (!daily && !themeOk(opt.pool)) { opt.pool = 'all'; LS.set('pool', 'all'); renderHome(); }
  stop();
  G = { daily, day, level: 0, used: new Set(), log: [], jokers: Object.fromEntries(JOKERS.map(k => [k, true])) };
  // Alle Fragen gleich zu Beginn bauen – bei der Täglichen Challenge mit dem Startwert des Tages
  R = daily ? seeded('gold-record-' + day) : Math.random;
  G.types = pickTypes();
  G.qs = G.types.map((t, i) => makeQuestion(i, t));
  R = Math.random;
  // nur ein Versuch pro Tag – auch wenn man mittendrin abbricht
  if (daily) LS.set('daily.' + day, { final: 0, row: '', done: false });
  show('game');
  nextQuestion();
}
const safeOf = n => SAFE.filter(s => s <= n).pop() || 0;
const stageName = n => n ? tx(STAGES[n - 1]) : tx('Noch keine Stufe');

async function nextQuestion(Q = G.qs[G.level]) {
  const i = G.level;
  // Hörfrage ohne Hörprobe (Deezer liefert keine) → andere Frage
  if (TYPES[Q.type].blind) {
    try { await previewOf(Q.song); } catch { Q = makeQuestion(i, 'artist'); }
  }
  if (!G) return;
  G.q = Q; G.locked = false; G.hidden = new Set(); G.poll = null;
  $('#helpBox').innerHTML = '';
  if (Q.song) previewOf(Q.song).catch(() => {});
  renderLadder();
  renderQuestion(true);
  renderJokers();
  $('#after').innerHTML = '';
  renderWalk();
  armTimer();
  if (Q.song && opt.auto) play(Q.song); else stop();
  // Streams: Cover nachladen (die Milliarden-Liste kennt nur die Deezer-ID)
  if (Q.type === 'streams') Q.answers.forEach(a => DZ.track(a.st.id).then(t => {
    const img = $(`#answers [data-sid="${a.st.id}"]`);
    if (img && t.album?.cover_medium) { img.src = t.album.cover_medium; img.classList.remove('ph'); }
  }).catch(() => {}));
}

const LETTERS = ['A', 'B', 'C', 'D'];
function answerHtml(a, k) {
  const Q = G.q;
  let body;
  if (Q.type === 'listen') body = `<span class="ans-2"><b>${esc(a.s.t)}</b><small>${esc(a.s.a)}</small></span>`;
  else if (Q.type === 'artist') body = `<b>${esc(a.s.a)}</b>`;
  else if (Q.type === 'year') body = `<b class="num">${a.y}</b>`;
  else if (Q.type === 'cover') body = `<img class="ans-cv" src="${cover(a.s, 250)}" alt="">`;
  else if (Q.type === 'flash') body = `<span class="ans-2"><b>${esc(a.s.t)}</b><small>${esc(a.s.a)}</small></span>`;
  else if (Q.type === 'decade') body = `<b class="num">${tx('{d}er', { d: a.dec })}</b>`;
  else if (Q.type === 'notby') body = `<span class="ans-2"><b>${esc(a.s.t)}</b></span>`;   // ohne Cover – gleiche Albumcover würden die Lösung verraten
  else if (Q.type === 'oldest' || Q.type === 'newest') body = `<img class="ans-th" src="${cover(a.s, 120)}" alt=""><span class="ans-2"><b>${esc(a.s.t)}</b><small>${esc(a.s.a)}</small></span>`;
  else body = `<img class="ans-th ph" data-sid="${a.st.id}" alt=""><span class="ans-2"><b>${esc(a.st.title)}</b><small>${esc(a.st.artist)}</small></span>`;
  return `<button class="ans ${Q.type === 'cover' ? 'is-cover' : ''}" data-k="${k}"><span class="ans-l">${LETTERS[k]}</span><span class="ans-b">${body}</span><span class="ans-x"></span></button>`;
}
function renderQuestion(fresh = false) {
  const Q = G.q, T = TYPES[Q.type];
  $('#qPill').textContent = tx('Frage {n} von 15', { n: Q.i + 1 }) + ' · ' + tx(STAGES[Q.i]);
  const safe = safeOf(G.level);
  $('#safePill').innerHTML = safe ? `◆ ${tx('Sicher: {s}', { s: tx(STAGES[safe - 1]) })}` : tx('Noch nichts sicher');
  let subj = '';
  if (Q.song) {
    const blind = T.blind && !G.locked;
    const showCover = !blind && Q.type !== 'cover';
    const line = Q.type === 'artist' ? `<b>${esc(Q.song.t)}</b>` : blind ? `<b>${tx('Hör genau hin…')}</b>` : Q.type === 'cover' ? `<b>${esc(Q.song.t)}</b><small>${esc(Q.song.a)}</small>` : `<b>${esc(Q.song.t)}</b><small>${esc(Q.song.a)}</small>`;
    subj = `<div class="q-song"><button class="qdisc" data-id="${Q.song.id}" aria-label="${esc(tx('Abspielen'))}">
        ${showCover ? `<img src="${cover(Q.song, 250)}" alt="">` : ''}<span class="vinyl"></span>
        <span class="pp"><svg class="ic i-play"><use href="#i-play"/></svg><span class="eq"><i></i><i></i><i></i><i></i></span></span></button>
      <div class="q-tx"><small class="q-q">${tx(T.q)}</small>${line}</div>
      <button class="replay" id="btnReplay" title="${esc(tx('Nochmal hören'))}"><svg class="ic"><use href="#i-replay"/></svg><span>${tx('Nochmal hören')}</span></button></div>`;
  } else subj = `<div class="q-only">${Q.qv ? tx(T.q, Object.fromEntries(Object.entries(Q.qv).map(([k, v]) => [k, esc(v)]))) : tx(T.q)}</div>`;
  $('#qBox').innerHTML = subj;
  $('#answers').className = 'answers t-' + Q.type;
  // je zwei Antworten in einer Reihe – die Reihe liegt auf einer durchgehenden Linie
  $('#answers').innerHTML = [0, 2].map(r => `<div class="arow">${Q.answers.slice(r, r + 2).map((a, j) => answerHtml(a, r + j)).join('')}</div>`).join('');
  if (fresh) $('#qBox').classList.remove('enter'), void $('#qBox').offsetWidth, $('#qBox').classList.add('enter');
  for (const k of G.hidden) $(`#answers [data-k="${k}"]`).classList.add('gone');
  if (G.poll) drawPoll();
  renderPlaying();
}

function renderLadder(el = $('#gameLadder'), n = G?.level ?? 0, cur = true) {
  el.innerHTML = STAGES.map((s, i) => {
    const cls = [SAFE.includes(i + 1) ? 'safe' : '', i < n ? 'done' : '', cur && i === n ? 'now' : '', i === 14 ? 'top' : ''].join(' ');
    return `<div class="rung ${cls}"><span class="rn">${i + 1}</span><span class="rs">${tx(s)}</span>${SAFE.includes(i + 1) ? '<span class="rd">◆</span>' : i === 14 ? '<span class="rd">💎</span>' : ''}</div>`;
  }).reverse().join('');
  // Handy: schmale Leiste über der Frage
  if (el.id === 'gameLadder') $('#miniLadder').innerHTML = STAGES.map((s, i) =>
    `<i class="${i < n ? 'done' : ''} ${i === n ? 'now' : ''} ${SAFE.includes(i + 1) ? 'safe' : ''}" title="${esc(tx(s))}"></i>`).join('');
}
function renderWalk() {
  const b = $('#btnWalk');
  b.classList.toggle('hidden', !G || G.level === 0 || G.locked);
  $('#walkTxt').textContent = G?.level ? tx('Aussteigen mit {s}', { s: tx(STAGES[G.level - 1]) }) : '';
}

/* ---------- Joker ---------- */
function renderJokers() {
  for (const b of $$('#jokers [data-jk]')) {
    const k = b.dataset.jk;
    b.disabled = !G || !G.jokers[k] || G.locked;
    b.classList.toggle('used', !G?.jokers[k]);
  }
}
function useJoker(k) {
  if (!G || G.locked || !G.jokers[k]) return;
  const Q = G.q;
  G.jokers[k] = false;
  G.usedJokers = (G.usedJokers || 0) + 1;
  if (k === 'phone') { sound('joker'); renderJokers(); return phoneCall(); }
  if (k === 'extra') { sound('joker'); renderJokers(); return extraJoker(); }
  if (k === 'fifty') {
    const wrong = shuffle(Q.answers.map((a, i) => i).filter(i => !Q.answers[i].ok && !G.hidden.has(i)));
    wrong.slice(0, 2).forEach(i => G.hidden.add(i));
    for (const i of G.hidden) $(`#answers [data-k="${i}"]`).classList.add('gone');
    if (G.poll) G.poll = audience();   // Publikum neu verteilen auf die übrigen zwei
    if (G.poll) drawPoll();
  } else {
    G.poll = audience();
    drawPoll();
  }
  sound('joker');
  renderJokers();
}
// Publikum: bei bekannten Songs und frühen Fragen meist richtig, bei unbekannten oft daneben
function audience() {
  const Q = G.q;
  const vis = Q.answers.map((a, i) => i).filter(i => !G.hidden.has(i));
  const pc = Math.max(.22, .82 - .4 * Q.fame - .25 * Q.hp);
  const w = vis.map(i => Q.answers[i].ok ? pc * (0.75 + Math.random() * .5) * vis.length / 2 : (1 - pc) * (0.3 + Math.random()));
  const sum = w.reduce((a, b) => a + b, 0);
  const pct = w.map(x => Math.round(x / sum * 100));
  pct[pct.indexOf(Math.max(...pct))] += 100 - pct.reduce((a, b) => a + b, 0);
  return Object.fromEntries(vis.map((i, k) => [i, pct[k]]));
}
// Telefon: ein Musik-Freund nennt eine Antwort. Wie sicher er ist (und ob er recht hat), hängt von Bekanntheit und Stufe ab
const ansLabel = (Q, i) => {
  const a = Q.answers[i], L = LETTERS[i];
  return Q.type === 'decade' ? `${L}: ${tx('{d}er', { d: a.dec })}` : Q.type === 'year' ? `${L}: ${a.y}` : Q.type === 'artist' ? `${L}: ${a.s.a}` : Q.type === 'cover' ? L : Q.type === 'streams' ? `${L}: ${a.st.title}` : `${L}: ${a.s.t}`;
};
const bubble = (ic, who, text, extra = '') => `<div class="call"><span class="call-ic">${ic}</span><span class="call-tx"><b>${who}</b><span>${text}</span></span>${extra}</div>`;
async function phoneCall() {
  const Q = G.q, box = $('#helpBox');
  box.innerHTML = bubble('📞', tx('Telefonjoker'), tx('Es klingelt …'));
  await sleep(1400);
  if (!G || G.q !== Q) return;
  const vis = Q.answers.map((a, i) => i).filter(i => !G.hidden.has(i));
  const right = Q.answers.findIndex(a => a.ok);
  const c = Math.min(.95, Math.max(.25, .95 - .45 * Q.fame - .35 * Q.hp));
  const knows = Math.random() < c;
  const others = vis.filter(i => i !== right);
  const pick = knows || !others.length ? right : others[Math.floor(Math.random() * others.length)];
  const sure = knows ? (c > .72 ? 2 : c > .45 ? 1 : 0) : (Math.random() < .3 ? 1 : 0);
  const line = PHONE_LINES[sure];
  box.innerHTML = bubble('📞', tx('Dein Musik-Freund am Telefon'), `„${tx(line, { a: `<b>${esc(ansLabel(Q, pick))}</b>` })}“`,
    `<span class="call-sure s${sure}">${'●'.repeat(sure + 1)}${'○'.repeat(2 - sure)}</span>`);
}
/* Zusatzjoker: Wer im Publikum die Antwort zu wissen glaubt, steht auf. Steht niemand auf, behält man den Joker.
   Wer aufsteht, ist sich sicher – liegt bei großen Hits fast immer richtig, bei unbekannten Songs öfter daneben. */
async function extraJoker() {
  const Q = G.q, box = $('#helpBox');
  box.innerHTML = bubble('🙋', tx('Zusatzjoker'), tx('Wer die Antwort weiß, steht bitte auf …'));
  await sleep(1600);
  if (!G || G.q !== Q || G.locked) return;
  const c = Math.min(.97, Math.max(.3, .97 - .4 * Q.fame - .3 * Q.hp));
  if (Math.random() > .45 + .55 * c) {
    G.jokers.extra = true; G.usedJokers--; renderJokers();
    box.innerHTML = bubble('🪑', tx('Zusatzjoker'), tx('Niemand steht auf – du behältst deinen Zusatzjoker.'));
    return;
  }
  const vis = Q.answers.map((a, i) => i).filter(i => !G.hidden.has(i));
  const right = Q.answers.findIndex(a => a.ok), others = vis.filter(i => i !== right);
  const pick = Math.random() < c || !others.length ? right : others[Math.floor(Math.random() * others.length)];
  const name = EXTRA_NAMES[Math.floor(Math.random() * EXTRA_NAMES.length)];
  box.innerHTML = bubble('🙋', tx('{n} aus dem Publikum', { n: name }), `„${tx('Ich bin mir sicher, das ist {a}.', { a: `<b>${esc(ansLabel(Q, pick))}</b>` })}“`);
}
function drawPoll() {
  $$('#answers .ans').forEach(b => {
    const v = G.poll[b.dataset.k];
    b.querySelector('.ans-x').innerHTML = v == null ? '' : `<span class="poll"><b><i style="width:${v}%"></i></b><em>${v} %</em></span>`;
  });
}

/* ---------- Zeitlimit ----------
   Die Uhr startet, wenn die Hörprobe spielt (Laden zählt nicht) – spätestens nach 3 Sekunden. Bei Fragen ohne Song sofort.
   Läuft sie ab, zählt das wie eine falsche Antwort. */
let timerRaf = 0, timerFallback = 0;
function armTimer(restart = false) {
  stopTimer();
  const t = timeFor(G.level);
  $('#timer').classList.toggle('hidden', !t);
  if (!t) { G.tTotal = 0; return; }
  G.tEnd = 0; G.tTotal = t * 1000; G.lastTick = 0;
  drawTimer(1, G.tTotal);
  timerFallback = setTimeout(startTimer, G.q.song && (opt.auto || restart) ? 3000 : 400);
}
function startTimer() {
  if (!G || G.locked || G.tEnd || !G.tTotal) return;
  clearTimeout(timerFallback);
  G.tEnd = performance.now() + G.tTotal;
  const step = now => {
    if (!G || G.locked) return;
    const left = G.tEnd - now;
    drawTimer(Math.max(0, left / G.tTotal), left);
    if (left <= 0) return choose(null);
    // Herzschlag-Ton in den letzten 8 Sekunden, einmal pro Sekunde
    const sec = Math.ceil(left / 1000);
    if (left < 8000 && sec !== G.lastTick) { G.lastTick = sec; sound('tick'); }
    timerRaf = requestAnimationFrame(step);
  };
  timerRaf = requestAnimationFrame(step);
}
function stopTimer() { cancelAnimationFrame(timerRaf); clearTimeout(timerFallback); }
function drawTimer(k, left) {
  const tb = $('#timer');
  tb.querySelector('.arc').style.strokeDashoffset = 100 * (1 - k);
  tb.querySelector('span').textContent = Math.max(0, Math.ceil(left / 1000));
  tb.classList.toggle('urgent', left < 8000);
}
player.addEventListener('playing', () => { if (G && G.q?.song && playingId === G.q.song.id && G.tTotal && !G.tEnd) startTimer(); });

/* ---------- Antworten ---------- */
async function choose(k) {
  if (!G || G.locked) return;
  if (k != null && G.hidden.has(k)) return;
  G.locked = true;
  stopTimer();
  renderJokers(); renderWalk();
  const Q = G.q, btns = $$('#answers .ans');
  btns.forEach(b => b.disabled = true);
  if (k != null) { btns[k].classList.add('locked'); sound('lock'); buzz(15); }
  // Spannung: eingeloggte Antwort leuchtet kurz orange, dann die Auflösung
  await sleep(k == null ? 300 : 1300);
  if (!G) return;
  const ok = k != null && Q.answers[k].ok;
  const right = Q.answers.findIndex(a => a.ok);
  btns[right].classList.add('right');
  if (k != null && !ok) btns[k].classList.add('wrong');   // bleibt orange (wie im Fernsehen) und bekommt ein ✗
  // Hörfrage: jetzt Titel und Cover zeigen; bei Jahr/Ältester/Streams die Zahlen dazuschreiben
  renderReveal();
  sound(!ok ? 'miss' : G.level + 1 === 15 ? 'win' : SAFE.includes(G.level + 1) ? 'safe' : 'ok');
  G.log.push({ Q, k, ok });
  if (ok) {
    G.level++;
    preload(G.qs[G.level]?.song);
    renderLadder();
    if (G.level === 15) { confetti(220); await sleep(1400); return endGame('win'); }
    if (SAFE.includes(G.level)) { buzz([30, 60, 30]); confetti(120); toast(`◆ ${tx('{s} ist sicher!', { s: tx(STAGES[G.level - 1]) })}`, 2200); }
    $('#after').innerHTML = `<div class="verdict good">${tx('Richtig!')}</div>
      <button class="big" id="btnNext">${tx('Weiter zu Frage {n}', { n: G.level + 1 })}<small>${tx(STAGES[G.level])}</small></button>
      <button class="ghost" id="btnWalk2"><svg class="ic"><use href="#i-exit"/></svg>${tx('Aussteigen mit {s}', { s: tx(STAGES[G.level - 1]) })}</button>`;
    $('#btnNext').onclick = () => nextQuestion();
    $('#btnWalk2').onclick = () => endGame('walk');
    $('#btnNext').focus({ preventScroll: true });
  } else {
    buzz(120);
    G.fell = safeOf(G.level);
    $('#after').innerHTML = `<div class="verdict bad">${k == null ? '⏱ ' + tx('Zeit abgelaufen') : tx('Leider falsch')}</div>
      <button class="big" id="btnEnd">${tx('Zum Ergebnis')}</button>`;
    $('#btnEnd').onclick = () => endGame('fall');
  }
  $('#after').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function renderReveal() {
  const Q = G.q;
  if (Q.song) {
    const blind = TYPES[Q.type].blind;
    if (blind || Q.type === 'cover') {
      const d = $('#qBox .qdisc');
      if (d && !d.querySelector('img')) d.insertAdjacentHTML('afterbegin', `<img src="${cover(Q.song, 250)}" alt="">`);
    }
    $('#qBox .q-tx').innerHTML = `<small class="q-q">${tx(TYPES[Q.type].q)}</small><b>${esc(Q.song.t)}</b><small>${esc(Q.song.a)} · ${Q.song.y}</small>`;
  }
  $$('#answers .ans').forEach((b, i) => {
    const a = Q.answers[i];
    const tag = Q.type === 'oldest' || Q.type === 'newest' ? a.s.y : Q.type === 'notby' ? esc(a.s.a) : Q.type === 'streams' ? tx('{n} Mrd.', { n: (a.st.streams / 1e9).toLocaleString(LOC(), { maximumFractionDigits: 2, minimumFractionDigits: 2 }) }) : '';
    if (tag) b.querySelector('.ans-x').innerHTML = `<span class="tag">${tag}</span>`;
  });
}

function endGame(how) {
  if (!G || G.ended) return;
  G.ended = true;
  stop(); stopTimer();
  const final = how === 'fall' ? G.fell : G.level;
  G.final = final; G.how = how;
  // Tägliche Challenge zählt nicht für die Rekorde je Einstellung, sondern wird für den Tag gemerkt
  const best = G.daily ? 0 : LS.get(bestKey(), 0), isBest = !G.daily && final > best;
  if (isBest) LS.set(bestKey(), final);
  // Fragen-Liste als Daten (so lässt sich das Ergebnis der Täglichen Challenge später nochmal zeigen)
  const items = G.log.map(({ Q, ok }) => {
    const r = Q.answers.find(x => x.ok);
    const sub = Q.type === 'year' ? `${Q.song.t} · ${r.y}` : Q.type === 'decade' ? `${Q.song.t} · ${Q.song.y}` : Q.type === 'artist' ? `${Q.song.t} · ${Q.song.a}`
      : Q.type === 'streams' ? `${r.st.title} · ${r.st.artist}` : `${r.s.t} · ${r.s.a}${Q.type === 'oldest' || Q.type === 'newest' ? ' · ' + r.s.y : ''}`;
    // Song zum Nachhören: der Frage-Song bzw. die richtige Antwort
    const sid = Q.song?.id || r.s?.id || r.st?.id;
    return { t: Q.type, qv: Q.qv, id: sid, sub, img: Q.song ? cover(Q.song, 120) : r.s ? cover(r.s, 120) : '', ok, i: Q.i };
  });
  const res = { final, how, level: G.level, row: shareRow(), items, done: true };
  if (G.daily) {
    // nachgespielte Tage (Archiv) zählen nicht für die Serie
    res.late = G.day !== today();
    LS.set('daily.' + G.day, res);
    if (!res.late) { const dl = LS.get('dailyLog', {}); dl[G.day] = final; LS.set('dailyLog', dl); }
  }
  recordStats(G);
  res.ach = checkAch(G);
  renderEnd(res, { daily: G.daily, day: G.day, best, isBest, label: modeLabel() });
  if (final >= 5) confetti(final >= 15 ? 260 : 140);
}
function renderEnd(res, o) {
  const { final, how, level } = res;
  $('#endMode').textContent = o.label;
  $('#endBest').textContent = o.daily ? '🔥 ' + tx('Serie: {n} Tage', { n: dailyStreak() }) : tx('Rekord: {s}', { s: stageName(Math.max(o.best, final)) });
  $('#endMedal').textContent = MEDAL(final);
  $('#endStage').textContent = stageName(final);
  $('#endKick').textContent = final ? tx('Stufe {n} von 15', { n: final }) : tx('Leider');
  $('#endSub').textContent = !how ? tx('Abgebrochen') : how === 'win' ? '🎉 ' + tx('Alle 15 Fragen richtig – Diamant!')
    : how === 'walk' ? tx('Ausgestiegen – {s} bleibt dir.', { s: stageName(final) })
      : final ? tx('Falsch bei Frage {n} – zurück auf die Sicherheitsstufe.', { n: level + 1 }) : tx('Falsch bei Frage {n} – nächstes Mal klappt es!', { n: level + 1 });
  if (o.isBest && final) $('#endSub').textContent += ' 🏆 ' + tx('Neuer Rekord!');
  $('#endAch').innerHTML = (res.ach || []).map(id => { const a = ACH.find(x => x[0] === id); return `<span class="ach-new">${a[1]} ${tx(a[2])}</span>`; }).join('');
  if (res.ach?.length) setTimeout(() => toast('🏅 ' + tx('Neuer Erfolg: {s}', { s: res.ach.map(id => tx(ACH.find(x => x[0] === id)[2])).join(', ') }), 3200), 600);
  $('#endNext').classList.toggle('hidden', !o.daily);
  if (o.daily) $('#endNext').textContent = tx('Die nächste Challenge gibt es morgen.');
  $('#endList').innerHTML = (res.items || []).map(it => `<div class="cell ${it.id ? 'tap' : ''}" ${it.id ? `data-play="${it.id}"` : ''}><span class="pl-wrap">${it.img ? `<img class="pl-cover" src="${it.img}" alt="">` : '<span class="pl-cover">🎵</span>'}${it.id ? '<span class="pl-pp"><svg class="ic"><use href="#i-play"/></svg></span>' : ''}</span>
      <span class="grow">${esc(tx(TYPES[it.t].q, it.qv))}<span class="sub">${esc(it.sub)}</span></span><span class="trail ${it.ok ? 'ok' : 'zero'}">${it.ok ? '✓' : '✗'} ${it.i + 1}</span></div>`).join('');
  END = { res, o };
  show('end');
}
let END = null;   // zuletzt gezeigtes Ergebnis (fürs Teilen)

const shareRow = () => G.log.map(l => l.ok ? (SAFE.includes(l.Q.i + 1) ? '🟨' : '🟩') : '🟥').join('') + (G.how === 'walk' ? '🚪' : '');
// Nummer der Täglichen Challenge (#1 = 07.11.2026)
const dayNo = d => Math.round((new Date(d + 'T12:00') - new Date('2026-11-07T12:00')) / 864e5) + 1;
function shareText() {
  const { res, o } = END;
  const head = o.daily ? `Gold Record #${dayNo(o.day)} – ${tx('Tägliche Challenge')}` : `Gold Record · ${o.label}`;
  const st = o.daily && dailyStreak() > 1 ? '\n🔥 ' + tx('Serie: {n} Tage', { n: dailyStreak() }) : '';
  return `${head}\n${MEDAL(res.final)} ${stageName(res.final)} (${res.final}/15)\n${res.row}${st}\n${SITE}`;
}
// Ergebnis der heutigen Challenge nochmal zeigen
function showDaily(d = today()) {
  const res = LS.get('daily.' + d);
  if (res) renderEnd({ ...res, ach: [] }, { daily: true, day: d, best: 0, label: tx('Tägliche Challenge') + ' #' + dayNo(d) + (res.late ? ' · ' + tx('nachgespielt') : '') });
}
// Archiv: alle bisherigen Tage (höchstens 30), neueste zuerst
function pastDays() {
  const out = [], d = new Date();
  for (let k = 1; k <= 30; k++) {
    d.setDate(d.getDate() - 1);
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dayNo(s) < 1) break;
    out.push(s);
  }
  return out;
}
const fmtDay = d => new Date(d + 'T12:00').toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'long' });
function renderArchive() {
  const days = pastDays();
  $('#archiveList').innerHTML = days.length ? days.map(d => {
    const r = LS.get('daily.' + d);
    const right = r ? `<span class="trail">${MEDAL(r.final)} ${r.final}/15${r.late ? ` <small>${tx('nachgespielt')}</small>` : ''}</span>`
      : `<span class="trail play">${tx('Spielen')}<svg class="ic chev"><use href="#i-chev"/></svg></span>`;
    return `<button class="cell tap" data-day="${d}"><span class="arch-no">#${dayNo(d)}</span>
      <span class="grow">${esc(fmtDay(d))}<span class="sub">${r ? stageName(r.final) : tx('noch nicht gespielt')}</span></span>${right}</button>`;
  }).join('') : `<div class="cell"><span class="grow">${tx('Noch keine früheren Challenges – die erste gab es heute.')}</span></div>`;
}

/* ---------- Erfolge ---------- */
// [id, Symbol, Name, Beschreibung]
const ACH = [
  ['first', '🎵', 'Erste Runde', 'Ein Spiel gespielt'],
  ['gold', '📀', 'Gold', 'Stufe 5 erreicht'],
  ['platin', '💿', 'Platin', 'Stufe 10 erreicht'],
  ['diamond', '💎', 'Diamant', 'Alle 15 Fragen richtig'],
  ['nojoker', '🦁', 'Ohne Netz', 'Platin erreicht, ohne einen Joker zu nutzen'],
  ['pure', '👑', 'Reiner Diamant', 'Diamant ohne einen einzigen Joker'],
  ['hard', '🔥', 'Profi', 'Diamant auf „Schwer“'],
  ['ears', '👂', 'Goldene Ohren', '3 Hörfragen in einem Spiel richtig'],
  ['flash', '⚡', 'Blitzmerker', 'Eine 3-Sekunden-Frage richtig'],
  ['walk', '🚪', 'Kluger Abgang', 'Mit Platin oder höher ausgestiegen'],
  ['daily3', '📅', 'Dranbleiben', '3 Tage in Folge die Tägliche Challenge gespielt'],
  ['daily7', '🗓️', 'Eine ganze Woche', '7 Tage in Folge die Tägliche Challenge gespielt'],
  ['games25', '🎧', 'Stammgast', '25 Spiele gespielt'],
];
function checkAch(g) {
  const have = LS.get('ach', {}), st = LS.get('stats', { games: 0 }), right = g.log.filter(l => l.ok);
  const cond = {
    first: true, gold: g.final >= 5 || g.level >= 5, platin: g.level >= 10, diamond: g.how === 'win',
    nojoker: g.level >= 10 && !g.usedJokers, pure: g.how === 'win' && !g.usedJokers, hard: g.how === 'win' && cfg().diff === 'hard',
    ears: right.filter(l => l.Q.type === 'listen' || l.Q.type === 'flash').length >= 3, flash: right.some(l => l.Q.type === 'flash'),
    walk: g.how === 'walk' && g.level >= 10, daily3: dailyStreak() >= 3, daily7: dailyStreak() >= 7, games25: st.games >= 25,
  };
  const fresh = ACH.filter(([id]) => cond[id] && !have[id]).map(([id]) => id);
  fresh.forEach(id => { have[id] = today(); });
  if (fresh.length) LS.set('ach', have);
  return fresh;
}
function renderAch() {
  const have = LS.get('ach', {});
  $('#achList').innerHTML = ACH.map(([id, ic, name, sub]) => `<div class="cell ach ${have[id] ? 'got' : 'locked'}"><span class="ach-ic">${have[id] ? ic : '🔒'}</span>
    <span class="grow">${tx(name)}<span class="sub">${tx(sub)}</span></span><span class="trail">${have[id] ? '✓' : ''}</span></div>`).join('');
}
// Tage in Folge, an denen die Tägliche Challenge gespielt wurde (bis heute bzw. gestern)
function dailyStreak() {
  const dl = LS.get('dailyLog', {}), d = new Date();
  const key = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!(key(d) in dl)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (key(d) in dl) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
/* ---------- Ergebnisbild zum Teilen (1080 × 1350, Hochformat für Story/Status) ----------
   Gezeichnet auf einem Canvas: Logo, Medaille, erreichte Stufe, die 15 Fragen als Kästchen, Modus und Link. */
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function shareImage() {
  const { res, o } = END, W = 1080, H = 1350;
  try { await document.fonts.load('900 80px Outfit'); await document.fonts.load('600 40px Outfit'); } catch {}
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  // Bühne: Mitternachtsblau mit Licht von oben
  let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#111a48'); g.addColorStop(.55, '#080c24'); g.addColorStop(1, '#05071a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  g = x.createRadialGradient(W / 2, -80, 40, W / 2, -80, 900); g.addColorStop(0, 'rgba(110,140,240,.45)'); g.addColorStop(1, 'rgba(110,140,240,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  g = x.createRadialGradient(W / 2, H + 120, 40, W / 2, H + 120, 700); g.addColorStop(0, 'rgba(120,80,220,.35)'); g.addColorStop(1, 'rgba(120,80,220,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const F = (w, s) => `${w} ${s}px Outfit, system-ui, sans-serif`;
  const center = (t, y, font, color) => { x.font = font; x.fillStyle = color; x.textAlign = 'center'; x.fillText(t, W / 2, y); };
  // Kopf: Logo + Name
  try { const logo = await loadImg('icon-192.png?v=2'); x.save(); x.beginPath(); x.roundRect(W / 2 - 230, 90, 96, 96, 24); x.clip(); x.drawImage(logo, W / 2 - 230, 90, 96, 96); x.restore(); } catch {}
  x.font = F(900, 64); x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText('Gold Record', W / 2 - 110, 160);
  // Modus / Challenge
  const sub = o.daily ? `${tx('Tägliche Challenge')} #${dayNo(o.day)}` : o.label;
  center(sub, 262, F(600, 38), '#a3b2e0');
  // Medaille und Stufe
  center(MEDAL(res.final), 470, '170px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif', '#fff');
  g = x.createLinearGradient(0, 520, 0, 640); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#e0a412');
  center(stageName(res.final), 620, F(900, 120), g);
  center(res.final ? tx('Stufe {n} von 15', { n: res.final }) : tx('Leider'), 700, F(700, 44), '#f2f4fb');
  // 15 Kästchen: grün richtig, gold = Sicherheitsstufe, rot falsch, grau nicht erreicht
  const n = 15, size = 50, gap = 12, total = n * size + (n - 1) * gap, x0 = (W - total) / 2, y0 = 780;
  const row = [...(res.row || '')].filter(ch => ch !== '🚪');
  for (let i = 0; i < n; i++) {
    const ch = row[i], col = ch === '🟩' ? '#46d483' : ch === '🟨' ? '#f5b301' : ch === '🟥' ? '#f87171' : 'rgba(255,255,255,.12)';
    x.fillStyle = col; x.beginPath(); x.roundRect(x0 + i * (size + gap), y0, size, size, 12); x.fill();
    if ([4, 9].includes(i)) { x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.roundRect(x0 + i * (size + gap) - 5, y0 - 5, size + 10, size + 10, 15); x.stroke(); }
  }
  center(res.how === 'walk' ? tx('Ausgestiegen – {s} bleibt dir.', { s: stageName(res.final) }) : res.how === 'win' ? tx('Alle 15 Fragen richtig – Diamant!') : '', 900, F(600, 36), '#c3cbe3');
  // Fuß: Aufforderung + Link
  x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.roundRect(120, 1080, W - 240, 150, 40); x.fill();
  x.strokeStyle = 'rgba(245,179,1,.6)'; x.lineWidth = 3; x.stroke();
  center(tx('Schaffst du mehr?'), 1145, F(800, 46), '#fde68a');
  center('ku3rb1s.github.io/gold-record', 1198, F(600, 34), '#a3b2e0');
  return new Promise(r => cv.toBlob(r, 'image/jpeg', .9));
}
async function shareResult(text = shareText()) {
  let file = null;
  try { const blob = await shareImage(); if (blob) file = new File([blob], 'gold-record.jpg', { type: 'image/jpeg' }); } catch {}
  try {
    if (file && navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text });
    if (navigator.share && !file) return await navigator.share({ text });
    // Desktop ohne Bild-Teilen: Bild speichern und Text kopieren
    if (file) { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    await navigator.clipboard?.writeText(text);
    toast(file ? tx('Bild gespeichert, Text kopiert') : tx('Ergebnis kopiert'));
  } catch { /* abgebrochen */ }
}

/* ---------- Statistik ---------- */
function recordStats(g) {
  const st = LS.get('stats', { games: 0, right: 0, asked: 0, best: 0, wins: 0, jokers: 0, types: {} });
  st.games++; st.best = Math.max(st.best, g.final); st.jokers += g.usedJokers || 0;
  if (g.how === 'win') st.wins++;
  st.dec ??= {};
  for (const l of g.log) {
    st.asked++; if (l.ok) st.right++;
    const t = (st.types[l.Q.type] ??= [0, 0]); t[1]++; if (l.ok) t[0]++;
    // Jahrzehnt des Frage-Songs (bzw. der richtigen Antwort) – nur mit geprüftem Jahr
    const s = l.Q.song || l.Q.answers.find(a => a.ok)?.s;
    if (s?.y && !s.ya) { const d = (st.dec[Math.floor(s.y / 10) * 10] ??= [0, 0]); d[1]++; if (l.ok) d[0]++; }
  }
  LS.set('stats', st);
  // Bestenliste: die 10 besten Runden
  const top = LS.get('top', []);
  top.push({ f: g.final, d: today(), p: g.daily ? 'daily' : cfg().pool, df: cfg().diff, j: g.usedJokers || 0 });
  top.sort((a, b) => b.f - a.f || a.j - b.j || (a.d < b.d ? 1 : -1));
  LS.set('top', top.slice(0, 10));
}
function renderStats() {
  const st = Sync.view('gr.stats', LS.get('stats', null)); // alle verbundenen Geräte zusammen
  if (!st?.games) { $('#statsBox').innerHTML = `<div class="group-f" style="margin-top:14px">${tx('Noch keine Spiele')}</div>`; return; }
  const pc = (a, b) => b ? Math.round(a / b * 100) + ' %' : '–';
  const rows = [
    [tx('Spiele'), fmtN(st.games)],
    [tx('Höchste Stufe'), stageName(st.best)],
    [tx('Diamant geholt'), fmtN(st.wins)],
    [tx('Richtige Antworten'), `${fmtN(st.right)} / ${fmtN(st.asked)} (${pc(st.right, st.asked)})`],
    [tx('Joker eingesetzt'), fmtN(st.jokers)],
  ];
  // Balken 0–100 %
  const bar = (label, [a, b]) => `<div class="sbar"><span class="sbar-l">${label}</span><span class="sbar-t"><i style="width:${b ? Math.round(a / b * 100) : 0}%"></i></span><b>${pc(a, b)}</b><small>${a}/${b}</small></div>`;
  const types = Object.keys(TYPES).filter(t => st.types[t]).map(t => bar(esc(tx(TYPES[t].q, { a: '…' })), st.types[t])).join('');
  const decs = Object.keys(st.dec || {}).sort().map(d => [d, st.dec[d]]);
  const rated = decs.filter(([, v]) => v[1] >= 3).map(([d, v]) => [d, v[0] / v[1]]);
  const bestD = rated.length > 1 ? rated.reduce((a, b) => b[1] > a[1] ? b : a) : null, worstD = rated.length > 1 ? rated.reduce((a, b) => b[1] < a[1] ? b : a) : null;
  const decHtml = decs.map(([d, v]) => bar(tx('{d}er', { d }), v)).join('');
  const top = LS.get('top', []);
  const topHtml = top.map((r, k) => `<div class="cell"><span class="top-no">${k + 1}</span><span class="grow">${MEDAL(r.f)} ${stageName(r.f)}<span class="sub">${esc(fmtDay(r.d))} · ${r.p === 'daily' ? tx('Tägliche Challenge') : tx(POOL_NAMES[r.p] || 'Alle') + ' · ' + tx(DIFF_NAMES[r.df] || 'Normal')}${r.j ? '' : ' · ' + tx('ohne Joker')}</span></span><b>${r.f}/15</b></div>`).join('');
  const bests = [];
  for (const p in POOL_NAMES) for (const d in DIFF) { const v = LS.get(bestKey(p, d), 0); if (v) bests.push([tx(POOL_NAMES[p]) + ' · ' + tx(DIFF_NAMES[d]), stageName(v)]); }
  const dl = LS.get('dailyLog', {});
  if (Object.keys(dl).length) rows.push([tx('Tägliche Challenge'), tx('{n} gespielt', { n: Object.keys(dl).length }) + ' · ' + tx('Serie: {n} Tage', { n: dailyStreak() })]);
  const grp = r => `<div class="group">${r.map(([k, v]) => `<div class="cell"><span class="grow">${k}</span><b>${v}</b></div>`).join('')}</div>`;
  $('#statsBox').innerHTML = `<div style="margin-top:14px">${grp(rows)}</div>`
    + (topHtml ? `<div class="group-h">${tx('Deine besten Runden')}</div><div class="group icons toplist">${topHtml}</div>` : '')
    + (decHtml ? `<div class="group-h">${tx('Trefferquote je Jahrzehnt')}</div><div class="sbars">${decHtml}</div>`
      + (bestD && worstD && bestD[0] !== worstD[0] ? `<div class="group-f">${tx('Am stärksten: {a} · am schwächsten: {b}', { a: tx('{d}er', { d: bestD[0] }), b: tx('{d}er', { d: worstD[0] }) })}</div>` : '') : '')
    + (types ? `<div class="group-h">${tx('Trefferquote je Frage')}</div><div class="sbars">${types}</div>` : '')
    + (bests.length ? `<div class="group-h">${tx('Rekorde')}</div>${grp(bests)}` : '');
}

/* ---------- Töne & Konfetti ---------- */
let actx = null;
const buzz = p => { try { if (opt.sfx && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(p); } catch {} };
const DRAMA = new Set(['lock', 'tick', 'safe', 'win']);   // Spannungs-Sounds – eigener Schalter
function sound(type) {
  if (!opt.sfx || opt.muted) return;
  if (DRAMA.has(type) && !opt.drama) { if (type === 'safe' || type === 'win') type = 'ok'; else return; }
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    // [Frequenz, Start, Dauer, Lautstärke, Wellenform]
    const S = {
      ok: [[523, 0, .22], [659, .1, .22], [784, .2, .3]],
      miss: [[300, 0, .25, .08, 'sawtooth'], [200, .16, .35, .08, 'sawtooth']],
      joker: [[880, 0, .2], [1175, .07, .25]],
      lock: [[196, 0, .5, .14, 'sine'], [247, .02, .5, .08, 'sine']],                          // Antwort eingeloggt: tiefer, ruhiger Ton
      tick: [[110, 0, .09, .18, 'sine']],                                                       // Herzschlag in den letzten Sekunden
      safe: [[523, 0, .18], [659, .09, .18], [784, .18, .18], [1047, .27, .5, .18]],           // Sicherheitsstufe erreicht
      win: [[523, 0, .2], [659, .12, .2], [784, .24, .2], [1047, .36, .3], [784, .58, .2], [1047, .7, .8, .2]],
    }[type] || [];
    const vol = .35 + .65 * opt.vol / 100;
    for (const [fq, t, dur = .25, gain = .16, wave = 'triangle'] of S) {
      const o = actx.createOscillator(), g = actx.createGain(), at = actx.currentTime + t;
      o.type = wave; o.frequency.value = fq;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain * vol, at + .015); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(actx.destination); o.start(at); o.stop(at + dur + .03);
    }
  } catch {}
}
function confetti(n = 90) {
  if (!opt.sfx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#fde68a', '#f5b301', '#d4a017', '#ffffff', '#7dd3fc'];
  box.innerHTML = Array.from({ length: n }, () => `<i style="left:${Math.random() * 100}%;background:${colors[rnd(colors.length)]};animation-duration:${1.8 + Math.random() * 1.6}s;animation-delay:${Math.random() * .4}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join('');
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4200);
}

/* ---------- Anzeige ---------- */
function show(id) {
  for (const s of ['home', 'game', 'end']) $('#' + s).classList.toggle('hidden', s !== id);
  $('#btnQuit').classList.toggle('hidden', id !== 'game');
  $('#dailyHdr').classList.toggle('hidden', id !== 'home');
  window.scrollTo(0, 0);
}
// Tägliche Challenge – Knopf in der Kopfzeile (wie in Needle Drop): offen → spielen, gespielt → ✓ Ergebnis
function renderDailyHdr() {
  const d = today(), res = LS.get('daily.' + d), st = dailyStreak(), b = $('#dailyHdr');
  b.innerHTML = `<span class="dh-ic"><svg class="ic"><use href="#i-cal"/></svg></span>
    <span class="dh-t"><span class="dh-name">${tx('Tägliche Challenge')}</span> #${dayNo(d)}</span>` + (res
    ? `<span class="dh-st done"><svg class="ic"><use href="#i-check"/></svg><span class="dh-x">${MEDAL(res.final)} ${res.final}/15</span></span>`
    : `<span class="dh-st">${st ? `<span class="dh-x">🔥${st}</span>` : ''}<span class="dh-go">${tx('Spielen')}</span><i class="dh-dot"></i></span>`);
  b.classList.toggle('done', !!res);
  b.title = res ? tx('Heute: {s}', { s: `${stageName(res.final)} (${res.final}/15)` }) : tx('Jeden Tag neue 15 Fragen – für alle gleich') + (st ? ' · 🔥 ' + tx('Serie: {n} Tage', { n: st }) : '');
  b.setAttribute('aria-label', tx('Tägliche Challenge') + ' #' + dayNo(d) + ' – ' + b.title);
}
function renderThemes() {
  const box = $('#setPool');
  const groups = [['all', 'intl', 'de'], ['d70', 'd80', 'd90', 'd00', 'd10'], ['pop', 'rock', 'hiphop', 'dance', 'rnb']];
  const GL = ['Sprache', 'Jahrzehnt', 'Genre'];
  box.innerHTML = groups.map((g, gi) => `<div class="chip-row"><span class="chip-l">${tx(GL[gi])}</span><div class="chips">${g.filter(p => p in POOL_NAMES && (SONGS.length === 0 || poolOf(p).length > 0)).map(p => {
    const n = SONGS.length ? poolOf(p).length : 0;
    return `<button data-v="${p}" class="${opt.pool === p ? 'on' : ''}" ${SONGS.length && n < THEME_MIN ? 'disabled' : ''}>${tx(POOL_NAMES[p])}${n ? `<small>${fmtN(n)}</small>` : ''}</button>`;
  }).join('')}</div></div>`).filter(x => x.includes('data-v')).join('');
}
function renderHome() {
  const segOn = (id, v) => $$(`#${id} button`).forEach(b => b.classList.toggle('on', b.dataset.v === v));
  renderThemes(); $('#setTimer').checked = opt.timer === 'on'; segOn('setDiff', opt.diff);
  $('#timerInfo').textContent = tx(TIMER_INFO[opt.timer]);
  $('#diffInfo').textContent = tx(DIFF_INFO[opt.diff]);
  renderDailyHdr();
  const best = LS.get(bestKey(), 0);
  $('#bestPill').textContent = best ? `🏆 ${tx('Rekord: {s}', { s: stageName(best) })}` : tx('Noch kein Rekord');
  renderLadder($('#homeLadder'), best, false);
  if (SONGS.length) {
    renderThemes();
  }
}
let toastT = 0;
function toast(msg, ms = 3500) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms); }

/* ---------- Einstellungen ---------- */
function renderSettings() {
  $('#setAuto').checked = !!opt.auto;
  $('#setSfx').checked = !!opt.sfx;
  $('#setDrama').checked = !!opt.drama;
  $('#setDrama').disabled = !opt.sfx;
  $('#subHelp').textContent = [opt.auto ? 'Autoplay an' : 'Autoplay aus', opt.sfx ? (opt.drama ? '' : 'Spannungs-Sounds aus') : 'Töne aus'].filter(Boolean).map(s => tx(s)).join(' · ');
  $('#langSel').innerHTML = langOptions();
  const st = Sync.view('gr.stats', LS.get('stats', null)); // alle verbundenen Geräte zusammen
  $('#subStats').textContent = st?.games ? tx(st.games === 1 ? '{n} Spiel' : '{n} Spiele', { n: st.games }) + ' · ' + tx('Höchste Stufe') + ': ' + stageName(st.best) : tx('Noch keine Spiele');
  const open = pastDays().filter(d => !LS.get('daily.' + d)).length;
  $('#subArchive').textContent = pastDays().length ? (open ? tx('{n} nachspielbar', { n: open }) : tx('Die letzten 30 Tage')) : tx('Ab morgen gibt es hier frühere Tage');
  $('#subAch').textContent = tx('{a} von {b}', { a: Object.keys(LS.get('ach', {})).length, b: ACH.length });
  $('#appVersion').innerHTML = `Gold Record · ${tx('Version')} ${APP_VERSION} · ${APP_DATE}<span>${tx('Neuerungen ansehen')} ›</span>`;
  applyVol();
}
function renderProfile() {
  const p = Profile.get(), s = Sync.status();
  // Abgleich zwischen Geräten (Code wird in der Jukebox angelegt) – wie in Needle Drop
  $('#syncTitle').textContent = s.connected ? tx('Auf allen Geräten verbunden') : tx('Auf allen Geräten spielen');
  $('#syncSub').textContent = s.connected ? tx('Code {c} · ändern in der Jukebox', { c: s.code }) : tx('Rekorde, Serie und Profil mit einem Code mitnehmen');
  $('#syncIc').style.background = s.connected ? 'linear-gradient(135deg,#10b981,#0ea5e9)' : 'linear-gradient(135deg,#ff4f86,#fbbf24)';
  $('#profEmoji').textContent = p.emoji;
  if (document.activeElement !== $('#profName')) $('#profName').value = p.name;
}
function goPage(p, back = false) {
  const page = $(`#sheetSettings .page[data-page="${p}"]`) || $('#sheetSettings .page[data-page="main"]');
  $$('#sheetSettings .page').forEach(x => x.classList.toggle('active', x === page));
  page.classList.toggle('back', back);
  $('#navTitle').textContent = page.dataset.title;
  $('#navBack').classList.toggle('invisible', page.dataset.page === 'main');
  $('#sheetSettings .sheet-body').scrollTop = 0;
  if (page.dataset.page === 'changes') renderChanges();
  if (page.dataset.page === 'stats') renderStats();
  if (page.dataset.page === 'archive') renderArchive();
  if (page.dataset.page === 'ach') renderAch();
}
/* Neuerungen: CHANGELOG.md („## 1.0.0 – 07.11.2026“ + Spiegelstriche) */
let changesCache = null;
async function renderChanges() {
  const box = $('#changesList');
  if (!changesCache) {
    box.innerHTML = '<div class="cell muted"><span class="loader"></span></div>';
    try {
      const r = await fetch('CHANGELOG.md?v=' + APP_VERSION);
      if (!r.ok) throw new Error();
      changesCache = [];
      let cur = null;
      for (const line of (await r.text()).split(/\r?\n/)) {
        const hd = line.match(/^##\s+(\S+)(?:\s+[–-]\s+(.+))?$/);
        if (hd) { cur = { ver: hd[1], date: hd[2] || '', items: [] }; changesCache.push(cur); continue; }
        const li = line.match(/^\s*[-*]\s+(.*)$/);
        if (li && cur) cur.items.push(li[1]);
      }
    } catch { box.innerHTML = `<div class="cell muted">${tx('Die Neuerungen konnten nicht geladen werden.')}</div>`; return; }
  }
  const fmt = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  box.innerHTML = changesCache.map(v => `<div class="chg"><div class="chg-h"><b>${esc(v.ver)}</b>${v.ver === APP_VERSION ? `<span class="chg-now">${tx('aktuell')}</span>` : ''}<span class="chg-d">${esc(v.date)}</span></div>
    <ul>${v.items.map(i => `<li>${fmt(i)}</li>`).join('')}</ul></div>`).join('');
}

/* ---------- Ereignisse ---------- */
const segPick = (id, fn) => { $('#' + id).onclick = e => { const b = e.target.closest('button'); if (b) { fn(b.dataset.v); renderHome(); } }; };
segPick('setPool', v => { opt.pool = v; LS.set('pool', v); });
$('#setTimer').onchange = e => { opt.timer = e.target.checked ? 'on' : 'off'; LS.set('timer', opt.timer); renderHome(); };
segPick('setDiff', v => { opt.diff = v; LS.set('diff', v); });
$('#startBtn').onclick = () => startGame(false);
$('#dailyHdr').onclick = () => { if (G && !G.ended) return; LS.get('daily.' + today()) ? showDaily() : startGame(true); };
$('#againBtn').onclick = () => startGame(false);
$('#answers').addEventListener('click', e => { const b = e.target.closest('.ans'); if (b && !b.disabled) choose(+b.dataset.k); });
$('#qBox').addEventListener('click', e => {
  if (!G?.q?.song) return;
  if (e.target.closest('#btnReplay')) play(G.q.song, true);      // Nochmal hören: die ganzen 30 s von vorn
  else if (e.target.closest('.qdisc')) toggle(G.q.song);
});
$('#jokers').addEventListener('click', e => { const b = e.target.closest('[data-jk]'); if (b && !b.disabled) useJoker(b.dataset.jk); });
$('#btnWalk').onclick = () => { if (G && !G.locked && G.level && confirm(tx('Aussteigen und {s} behalten?', { s: tx(STAGES[G.level - 1]) }))) endGame('walk'); };
$('#shareBtn').onclick = () => shareResult();
$('#endList').addEventListener('click', e => {
  const el = e.target.closest('[data-play]'); if (!el) return;
  const id = +el.dataset.play;
  playingId === id && !player.paused ? stop() : play(SONGS.find(s => s.id === id) || { id }, true);
});
const goHome = () => { stop(); stopTimer(); G = null; renderHome(); show('home'); };
function leave() {
  if (G && !G.ended && G.level > 0 && !$('#game').classList.contains('hidden') && !confirm(tx('Spiel beenden? Deine Stufe geht verloren.'))) return;
  goHome();
}
$('#homeBtn').onclick = goHome;
$('#btnQuit').onclick = leave;
$('#logoBtn').onclick = leave;

const sheet = $('#sheetSettings');
$('#btnSettings').onclick = () => { renderSettings(); renderProfile(); goPage('main'); sheet.showModal(); };
sheet.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) goPage(g.dataset.go); });
sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('[data-close]')) sheet.close(); });
sheet.addEventListener('close', () => { if (!$('#home').classList.contains('hidden')) renderHome(); });
$('#navBack').onclick = () => goPage('main', true);
$('#archiveList').addEventListener('click', e => {
  const b = e.target.closest('[data-day]'); if (!b || (G && !G.ended)) return;
  sheet.close();
  startGame(true, b.dataset.day);
});
$('#profEmoji').onclick = () => { $('#profEmoji').textContent = Profile.nextEmoji(); };
$('#profName').oninput = () => Profile.set({ name: $('#profName').value });
$('#profName').onkeydown = e => { if (e.key === 'Enter') $('#profName').blur(); };
$('#setAuto').onchange = e => { opt.auto = e.target.checked; LS.set('auto', opt.auto); renderSettings(); };
$('#setSfx').onchange = e => { opt.sfx = e.target.checked; LS.set('sfx', opt.sfx); renderSettings(); sound('ok'); };
$('#setDrama').onchange = e => { opt.drama = e.target.checked; LS.set('drama', opt.drama); renderSettings(); sound('safe'); };
$('#vol').oninput = e => { opt.vol = +e.target.value; opt.muted = false; LS.set('vol', opt.vol); applyVol(); };
$('#volMute').onclick = () => { opt.muted = !opt.muted; applyVol(); };
$('#langSel').onchange = e => setLang(e.target.value);
$('#btnResetAll').onclick = () => {
  if (!confirm(tx('Alles löschen, was Gold Record auf diesem Gerät gespeichert hat?'))) return;
  try { Object.keys(localStorage).filter(k => k.startsWith('gr.')).forEach(k => localStorage.removeItem(k)); } catch {}
  Sync.leave(); // vom persönlichen Code trennen, sonst käme beim nächsten Abgleich alles zurück
  location.reload();
};
self.liveLang = () => {
  renderHome();
  if (sheet.open) { renderSettings(); goPage($('#sheetSettings .page.active')?.dataset.page || 'main'); }
  if (G && !$('#game').classList.contains('hidden')) {
    renderLadder(); renderWalk();
    if (!G.locked) renderQuestion();
  }
};
document.addEventListener('keydown', e => {
  if ($('#game').classList.contains('hidden') || sheet.open || e.target.matches?.('input,select,textarea')) return;
  const n = '1234'.indexOf(e.key) + 1 || 'abcd'.indexOf(e.key.toLowerCase()) + 1;
  if (n && e.key.length === 1) { e.preventDefault(); choose(n - 1); }
  else if (e.code === 'Space') { e.preventDefault(); if (G?.q?.song) toggle(G.q.song); }
  else if (e.key === 'Enter' && G?.locked && !e.target.closest?.('button')) { e.preventDefault(); ($('#btnNext') || $('#btnEnd'))?.click(); }
  else if (e.key === 'm' || e.key === 'M') { opt.muted = !opt.muted; applyVol(); }
});

/* ---------- Start ---------- */
applyVol(); renderHome();
loadData().then(renderHome).catch(() => {});

// Neue Spielstände von anderen Geräten (js/sync.js, Code in der Jukebox): Startseite und offene Einstellungen neu zeichnen
addEventListener('jukebox-sync', () => { if (!G) renderHome(); if (document.querySelector('dialog[open]')) renderSettings(); });

// Neue Spielstände von anderen Geräten (js/sync.js, Code in der Jukebox): Startseite, Kopfzeile und offene Einstellungen neu zeichnen
addEventListener('jukebox-sync', () => {
  if (!G || G.ended) renderHome();
  if (sheet.open) { renderSettings(); renderProfile(); goPage($('#sheetSettings .page.active')?.dataset.page || 'main'); }
});
