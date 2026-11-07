/* Gold Record – Spielablauf und Anzeige
   Quiz-Leiter mit 15 Stufen: Jede richtige Antwort bringt eine Stufe höher, von der Kassette bis zum Diamanten.
   Gold (Stufe 5) und Platin (Stufe 10) sind sicher: Bei einem Fehler fällt man auf die letzte erreichte Sicherheitsstufe.
   Aussteigen geht jederzeit vor dem Antworten – dann bleibt die erreichte Stufe. */
const APP_VERSION = '1.3.0', APP_DATE = '07.11.2026'; // bei jedem Update erhöhen + CHANGELOG.md ergänzen
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// Die 15 Stufen (Index 0 = Frage 1). safe = Sicherheitsstufe
const STAGES = ['Demo-Tape', 'Kassette', 'Mixtape', 'Single', 'Gold', 'Radio-Hit', 'Top 40', 'Top 10', 'Nummer 1', 'Platin',
  'Doppel-Platin', 'Welttournee', 'Stadion', 'Hall of Fame', 'Diamant'];
const SAFE = [5, 10];             // nach so vielen richtigen Antworten ist man sicher
const MEDAL = n => n >= 15 ? '💎' : n >= 10 ? '💿' : n >= 5 ? '📀' : n >= 1 ? '📼' : '🎵';
const POOL_NAMES = { all: 'Alle', intl: 'International', de: 'Deutsch' };
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
const opt = { pool: LS.get('pool', 'all'), diff: LS.get('diff', 'normal'), timer: LS.get('timer', 'on'), auto: LS.get('auto', true), sfx: LS.get('sfx', true), vol: LS.get('vol', 80), muted: false };
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
let SONGS = [], STREAMS = [], FAME = new Map();
async function loadData() {
  if (SONGS.length) return;
  const [a, b] = await Promise.all([
    fetch('data/songs.json?v=' + APP_VERSION).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    fetch('data/billions.json?v=' + APP_VERSION).then(r => r.ok ? r.json() : { tracks: [] }).catch(() => ({ tracks: [] })),
  ]);
  SONGS = a.songs;
  // Bekanntheit 0 (größter Hit) … 1 (am wenigsten bekannt) nach Deezer-Rang
  [...SONGS].sort((x, y) => (y.r || 0) - (x.r || 0)).forEach((s, i, all) => FAME.set(s.id, i / all.length));
  STREAMS = b.tracks.filter(t => t.streams).sort((x, y) => y.streams - x.streams);
}
const poolOf = p => SONGS.filter(s => p === 'all' || (p === 'de' ? s.de : !s.de));

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
  streams: { q: 'Welcher Song hat bei Spotify die meisten Streams?' },
};
const hOf = i => { const D = DIFF[cfg().diff]; return lerp(D.h0, D.h1, i / 14); };
function famePool(i) {
  const D = DIFF[cfg().diff];
  const all = poolOf(cfg().pool).sort((a, b) => (b.r || 0) - (a.r || 0) || a.id - b.id);
  return all.slice(0, Math.max(60, Math.round(all.length * lerp(D.f0, D.f1, i / 14))));
}
// Ähnlichste Kandidaten zuerst – bei leichten Fragen überdeckt Zufall die Ähnlichkeit
function similar(subj, cands, h, extra = () => 0) {
  return cands.map(s => ({ s, d: Math.abs(s.y - subj.y) + (s.de !== subj.de ? 8 : 0) + extra(s) + R() * lerp(60, 4, h) }))
    .sort((a, b) => a.d - b.d).map(x => x.s);
}
const kinds = () => Object.keys(TYPES).filter(t => t !== 'streams' || (STREAMS.length >= 40 && cfg().pool !== 'de'));
function pickTypes() {
  // abwechslungsreich: jeder Typ kommt 2–3-mal vor, nicht zweimal hintereinander
  const ks = kinds();
  const out = [];
  for (let i = 0; i < 15; i++) {
    let c = shuffle(ks.filter(k => k !== out[i - 1] && out.filter(x => x === k).length < 3));
    // zum Einstieg lieber Hören und Interpret
    if (i < 2) c = c.filter(k => k === 'listen' || k === 'artist').concat(c);
    out.push(c[0] || ks[rnd(ks.length)]);
  }
  return out;
}

function makeQuestion(i, type) {
  const h = hOf(i), pool = famePool(i);
  const free = pool.filter(s => !G.used.has(s.id));
  const subj = free[rnd(free.length)] || pool[rnd(pool.length)];
  const Q = { type, i, h, fame: FAME.get(subj.id) ?? .5 };
  // Schwierigkeit fürs Publikum/Telefon: Frage-Nummer zählt mit, damit auch „Leicht“ nach oben etwas unsicherer wird
  Q.hp = Math.max(h, i / 14 * .6);
  if (type === 'listen' || type === 'artist' || type === 'cover') {
    Q.song = subj;
    const key = type === 'listen' ? s => s.t.toLowerCase() : type === 'artist' ? s => s.a.toLowerCase() : s => s.c;
    const seen = new Set([key(subj)]);
    // beim Cover: gleicher Interpret macht es schwer (Cover sehen sich oft ähnlich)
    const extra = type === 'cover' ? s => (s.a === subj.a ? -6 * h : 0) : type === 'listen' ? s => (s.a === subj.a ? -4 * h : 0) : () => 0;
    const wrong = [];
    for (const s of similar(subj, SONGS.filter(s => s.id !== subj.id && s.c), h, extra)) {
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
  } else if (type === 'oldest') {
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
    const minY = Math.min(...pick.map(s => s.y));
    Q.answers = shuffle(pick).map(s => ({ s, ok: s.y === minY }));
    Q.fame = pick.reduce((n, s) => n + (FAME.get(s.id) ?? .5), 0) / 4;
  } else if (type === 'streams') {
    // eng beieinander liegende Plätze der Milliarden-Liste = ähnlich viele Streams
    const w = Math.round(lerp(STREAMS.length, 24, h));
    const start = rnd(Math.max(1, STREAMS.length - w));
    const picks = [];
    for (const t of shuffle(STREAMS.slice(start, start + w))) {
      if (!picks.some(p => p.artist === t.artist || p.streams === t.streams)) picks.push(t);
      if (picks.length === 4) break;
    }
    const top = Math.max(...picks.map(t => t.streams));
    Q.answers = shuffle(picks).map(t => ({ st: t, ok: t.streams === top }));
    Q.fame = lerp(.2, .7, h);
  }
  if (Q.song) G.used.add(Q.song.id);
  return Q;
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
  playingId = s.id; limit = full ? 31 : SNIPPET; renderPlaying();
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
function stop() { playingId = null; player.pause(); renderPlaying(); }
function toggle(s) { playingId === s.id && !player.paused ? stop() : play(s, limit > SNIPPET && G?.q?.song === s); }
player.addEventListener('timeupdate', () => { if (player.currentTime >= limit) stop(); });
player.addEventListener('ended', () => { playingId = null; renderPlaying(); });
player.addEventListener('playing', renderPlaying);
player.addEventListener('pause', renderPlaying);
function renderPlaying() {
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
async function startGame(daily = false) {
  try { await loadData(); } catch { return toast(tx('Die Songliste konnte nicht geladen werden.')); }
  const day = today();
  if (daily && LS.get('daily.' + day)) { renderHome(); return toast(tx('Die heutige Challenge hast du schon gespielt – morgen gibt es neue Fragen.')); }
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
  else if (Q.type === 'oldest') body = `<img class="ans-th" src="${cover(a.s, 120)}" alt=""><span class="ans-2"><b>${esc(a.s.t)}</b><small>${esc(a.s.a)}</small></span>`;
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
  } else subj = `<div class="q-only">${tx(T.q)}</div>`;
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
  return Q.type === 'year' ? `${L}: ${a.y}` : Q.type === 'artist' ? `${L}: ${a.s.a}` : Q.type === 'cover' ? L : Q.type === 'streams' ? `${L}: ${a.st.title}` : `${L}: ${a.s.t}`;
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
  $('#timebar').classList.toggle('hidden', !t);
  if (!t) { G.tTotal = 0; return; }
  G.tEnd = 0; G.tTotal = t * 1000;
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
    timerRaf = requestAnimationFrame(step);
  };
  timerRaf = requestAnimationFrame(step);
}
function stopTimer() { cancelAnimationFrame(timerRaf); clearTimeout(timerFallback); }
function drawTimer(k, left) {
  const tb = $('#timebar');
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
  if (k != null) btns[k].classList.add('locked');
  // Spannung: eingeloggte Antwort leuchtet kurz orange, dann die Auflösung
  await sleep(k == null ? 300 : 1300);
  if (!G) return;
  const ok = k != null && Q.answers[k].ok;
  const right = Q.answers.findIndex(a => a.ok);
  btns[right].classList.add('right');
  if (k != null && !ok) btns[k].classList.add('wrong');   // bleibt orange (wie im Fernsehen) und bekommt ein ✗
  // Hörfrage: jetzt Titel und Cover zeigen; bei Jahr/Ältester/Streams die Zahlen dazuschreiben
  renderReveal();
  sound(ok ? 'ok' : 'miss');
  G.log.push({ Q, k, ok });
  if (ok) {
    G.level++;
    renderLadder();
    if (G.level === 15) { confetti(220); await sleep(1400); return endGame('win'); }
    if (SAFE.includes(G.level)) { confetti(120); toast(`◆ ${tx('{s} ist sicher!', { s: tx(STAGES[G.level - 1]) })}`, 2200); }
    $('#after').innerHTML = `<div class="verdict good">${tx('Richtig!')}</div>
      <button class="big" id="btnNext">${tx('Weiter zu Frage {n}', { n: G.level + 1 })}<small>${tx(STAGES[G.level])}</small></button>
      <button class="ghost" id="btnWalk2"><svg class="ic"><use href="#i-exit"/></svg>${tx('Aussteigen mit {s}', { s: tx(STAGES[G.level - 1]) })}</button>`;
    $('#btnNext').onclick = () => nextQuestion();
    $('#btnWalk2').onclick = () => endGame('walk');
    $('#btnNext').focus({ preventScroll: true });
  } else {
    if (navigator.vibrate) navigator.vibrate(120);
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
    const tag = Q.type === 'oldest' ? a.s.y : Q.type === 'streams' ? tx('{n} Mrd.', { n: (a.st.streams / 1e9).toLocaleString(LOC(), { maximumFractionDigits: 2, minimumFractionDigits: 2 }) }) : '';
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
    const sub = Q.type === 'year' ? `${Q.song.t} · ${r.y}` : Q.type === 'artist' ? `${Q.song.t} · ${Q.song.a}`
      : Q.type === 'streams' ? `${r.st.title} · ${r.st.artist}` : `${r.s.t} · ${r.s.a}${Q.type === 'oldest' ? ' · ' + r.s.y : ''}`;
    return { t: Q.type, sub, img: Q.song ? cover(Q.song, 120) : r.s ? cover(r.s, 120) : '', ok, i: Q.i };
  });
  const res = { final, how, level: G.level, row: shareRow(), items, done: true };
  if (G.daily) {
    LS.set('daily.' + G.day, res);
    const dl = LS.get('dailyLog', {}); dl[G.day] = final; LS.set('dailyLog', dl);
  }
  recordStats(G);
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
  $('#endNext').classList.toggle('hidden', !o.daily);
  if (o.daily) $('#endNext').textContent = tx('Die nächste Challenge gibt es morgen.');
  $('#endList').innerHTML = (res.items || []).map(it => `<div class="cell">${it.img ? `<img class="pl-cover" src="${it.img}" alt="">` : '<span class="pl-cover">🎵</span>'}
      <span class="grow">${tx(TYPES[it.t].q)}<span class="sub">${esc(it.sub)}</span></span><span class="trail ${it.ok ? 'ok' : 'zero'}">${it.ok ? '✓' : '✗'} ${it.i + 1}</span></div>`).join('');
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
function showDaily() {
  const d = today(), res = LS.get('daily.' + d);
  if (res) renderEnd(res, { daily: true, day: d, best: 0, label: tx('Tägliche Challenge') + ' #' + dayNo(d) });
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
async function shareResult(text = shareText()) {
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast(tx('Ergebnis kopiert')); }
  } catch { /* abgebrochen */ }
}

/* ---------- Statistik ---------- */
function recordStats(g) {
  const st = LS.get('stats', { games: 0, right: 0, asked: 0, best: 0, wins: 0, jokers: 0, types: {} });
  st.games++; st.best = Math.max(st.best, g.final); st.jokers += g.usedJokers || 0;
  if (g.how === 'win') st.wins++;
  for (const l of g.log) {
    st.asked++; if (l.ok) st.right++;
    const t = (st.types[l.Q.type] ??= [0, 0]); t[1]++; if (l.ok) t[0]++;
  }
  LS.set('stats', st);
}
function renderStats() {
  const st = LS.get('stats', null);
  if (!st?.games) { $('#statsBox').innerHTML = `<div class="group-f" style="margin-top:14px">${tx('Noch keine Spiele')}</div>`; return; }
  const pc = (a, b) => b ? Math.round(a / b * 100) + ' %' : '–';
  const rows = [
    [tx('Spiele'), fmtN(st.games)],
    [tx('Höchste Stufe'), stageName(st.best)],
    [tx('Diamant geholt'), fmtN(st.wins)],
    [tx('Richtige Antworten'), `${fmtN(st.right)} / ${fmtN(st.asked)} (${pc(st.right, st.asked)})`],
    [tx('Joker eingesetzt'), fmtN(st.jokers)],
  ];
  const types = Object.keys(TYPES).filter(t => st.types[t]).map(t => [tx(TYPES[t].q), pc(...st.types[t])]);
  const bests = [];
  for (const p in POOL_NAMES) for (const d in DIFF) { const v = LS.get(bestKey(p, d), 0); if (v) bests.push([tx(POOL_NAMES[p]) + ' · ' + tx(DIFF_NAMES[d]), stageName(v)]); }
  const dl = LS.get('dailyLog', {});
  if (Object.keys(dl).length) rows.push([tx('Tägliche Challenge'), tx('{n} gespielt', { n: Object.keys(dl).length }) + ' · ' + tx('Serie: {n} Tage', { n: dailyStreak() })]);
  const grp = r => `<div class="group">${r.map(([k, v]) => `<div class="cell"><span class="grow">${k}</span><b>${v}</b></div>`).join('')}</div>`;
  $('#statsBox').innerHTML = `<div style="margin-top:14px">${grp(rows)}</div>`
    + (types.length ? `<div class="group-h">${tx('Trefferquote je Frage')}</div>${grp(types)}` : '')
    + (bests.length ? `<div class="group-h">${tx('Rekorde')}</div>${grp(bests)}` : '');
}

/* ---------- Töne & Konfetti ---------- */
let actx = null;
function sound(type) {
  if (!opt.sfx || opt.muted) return;
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const notes = type === 'ok' ? [[523, 0], [659, .1], [784, .2]] : type === 'joker' ? [[880, 0], [1175, .07]] : [[300, 0], [200, .16]];
    for (const [f, t] of notes) {
      const o = actx.createOscillator(), g = actx.createGain(), at = actx.currentTime + t;
      o.type = type === 'miss' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(type === 'miss' ? .08 : .16, at + .015); g.gain.exponentialRampToValueAtTime(0.0001, at + .25);
      o.connect(g).connect(actx.destination); o.start(at); o.stop(at + .28);
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
function renderHome() {
  const segOn = (id, v) => $$(`#${id} button`).forEach(b => b.classList.toggle('on', b.dataset.v === v));
  segOn('setPool', opt.pool); segOn('setTimer', opt.timer); segOn('setDiff', opt.diff);
  $('#timerInfo').textContent = tx(TIMER_INFO[opt.timer]);
  $('#diffInfo').textContent = tx(DIFF_INFO[opt.diff]);
  renderDailyHdr();
  const best = LS.get(bestKey(), 0);
  $('#bestPill').textContent = best ? `🏆 ${tx('Rekord: {s}', { s: stageName(best) })}` : tx('Noch kein Rekord');
  renderLadder($('#homeLadder'), best, false);
  if (SONGS.length) {
    $('#nAll').textContent = tx('{n} Songs', { n: SONGS.length });
    $('#nIntl').textContent = tx('{n} Songs', { n: poolOf('intl').length });
    $('#nDe').textContent = tx('{n} Songs', { n: poolOf('de').length });
  }
}
let toastT = 0;
function toast(msg, ms = 3500) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms); }

/* ---------- Einstellungen ---------- */
function renderSettings() {
  $('#setAuto').checked = !!opt.auto;
  $('#setSfx').checked = !!opt.sfx;
  $('#subHelp').textContent = [opt.auto ? 'Autoplay an' : 'Autoplay aus', opt.sfx ? '' : 'Töne aus'].filter(Boolean).map(s => tx(s)).join(' · ');
  $('#langSel').innerHTML = langOptions();
  const st = LS.get('stats', null);
  $('#subStats').textContent = st?.games ? tx(st.games === 1 ? '{n} Spiel' : '{n} Spiele', { n: st.games }) + ' · ' + tx('Höchste Stufe') + ': ' + stageName(st.best) : tx('Noch keine Spiele');
  $('#appVersion').innerHTML = `Gold Record · ${tx('Version')} ${APP_VERSION} · ${APP_DATE}<span>${tx('Neuerungen ansehen')} ›</span>`;
  applyVol();
}
function renderProfile() {
  const p = Profile.get();
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
segPick('setTimer', v => { opt.timer = v; LS.set('timer', v); });
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
$('#profEmoji').onclick = () => { $('#profEmoji').textContent = Profile.nextEmoji(); };
$('#profName').oninput = () => Profile.set({ name: $('#profName').value });
$('#profName').onkeydown = e => { if (e.key === 'Enter') $('#profName').blur(); };
$('#setAuto').onchange = e => { opt.auto = e.target.checked; LS.set('auto', opt.auto); renderSettings(); };
$('#setSfx').onchange = e => { opt.sfx = e.target.checked; LS.set('sfx', opt.sfx); renderSettings(); sound('ok'); };
$('#vol').oninput = e => { opt.vol = +e.target.value; opt.muted = false; LS.set('vol', opt.vol); applyVol(); };
$('#volMute').onclick = () => { opt.muted = !opt.muted; applyVol(); };
$('#langSel').onchange = e => setLang(e.target.value);
$('#btnResetAll').onclick = () => {
  if (!confirm(tx('Alles löschen, was Gold Record auf diesem Gerät gespeichert hat?'))) return;
  try { Object.keys(localStorage).filter(k => k.startsWith('gr.')).forEach(k => localStorage.removeItem(k)); } catch {}
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
