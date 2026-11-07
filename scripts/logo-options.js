// Logo- und Farbkonzepte für Gold Record → logo-options/index.html (zum Auswählen, mit Vorschau des Spielbildschirms)
// Aufruf: node scripts/logo-options.js              (Übersicht)
//         node scripts/logo-options.js <id> > logo.svg   (ein Konzept als Logo ausgeben)
const fs = require('fs'), path = require('path');

// gold = Gold der Platte [hell, kräftig]; acc = Akzentfarbe des Spiels [hell, kräftig]; bg = Hintergrund; blob = Farbflächen der App
const V = {
  plakette: {
    name: 'Plakette', sub: 'Die goldene Platte im Rahmen – wie die Auszeichnung an der Studiowand. Gold & Nachtblau, edel und klar.',
    bg: ['#13223f', '#080d1a'], gold: ['#fde68a', '#d4a017'], acc: ['#bae6fd', '#38bdf8'], blob: ['#14315e', '#4a3608'],
  },
  leiter: {
    name: 'Hitleiter', sub: '15 Stufen führen hinauf zur goldenen Platte. Gold & Violett – zeigt direkt, worum es geht.',
    bg: ['#24124a', '#0e0820'], gold: ['#fde68a', '#f5b301'], acc: ['#ddd6fe', '#8b5cf6'], blob: ['#3b1f73', '#4a3405'],
  },
  glanz: {
    name: 'Glanz', sub: 'Goldene Platte mit Funkeln, schräg im Licht. Gold & Weinrot, warm und festlich.',
    bg: ['#3a0e1e', '#16060c'], gold: ['#fef3c7', '#e8a90c'], acc: ['#fecdd3', '#f43f5e'], blob: ['#5c1428', '#4d3606'],
  },
  diamant: {
    name: 'Diamant', sub: 'Goldene Platte, das Etikett ein geschliffener Diamant – das höchste Ziel. Gold & Türkis, frisch und modern.',
    bg: ['#0b2a2c', '#061314'], gold: ['#fde68a', '#e0a412'], acc: ['#a5f3fc', '#06b6d4'], blob: ['#0e4447', '#4a3507'],
  },
};

const grad = (id, [a, b], x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const shadow = p => `<filter id="${p}sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000" flood-opacity=".5"/></filter>`;
// goldene Platte: Verlauf + Rillen + Lichtkeile
function record(p, cx, cy, r, label) {
  const g = [.9, .8, .7, .6, .5].map(k => `<circle cx="${cx}" cy="${cy}" r="${r * k}"/>`).join('');
  return `<g filter="url(#${p}sh)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${p}g)"/></g>
    <g fill="none" stroke="#5a3d00" stroke-opacity=".28" stroke-width="2.5">${g}</g>
    <path d="M${cx} ${cy}L${cx - r * .7} ${cy - r * .71}A${r} ${r} 0 0 1 ${cx - r * .2} ${cy - r * .98}Z" fill="#fff" fill-opacity=".35"/>
    <path d="M${cx} ${cy}L${cx + r * .7} ${cy + r * .71}A${r} ${r} 0 0 1 ${cx + r * .2} ${cy + r * .98}Z" fill="#fff" fill-opacity=".22"/>
    ${label}`;
}

function logo(id, p = '') {
  const v = V[id];
  let d = grad(p + 'bg', v.bg, 1, 1) + grad(p + 'a', v.acc) + shadow(p)
    + `<linearGradient id="${p}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${v.gold[0]}"/><stop offset=".55" stop-color="${v.gold[1]}"/><stop offset="1" stop-color="#9a6b00"/></linearGradient>`, b = '';
  if (id === 'plakette') {
    // Rahmen mit Passepartout, Platte, Namensschild
    b = `<g filter="url(#${p}sh)"><rect x="66" y="56" width="380" height="400" rx="26" fill="#0b0f1c" stroke="url(#${p}g)" stroke-width="10"/></g>
      <rect x="92" y="82" width="328" height="348" rx="14" fill="url(#${p}a)" fill-opacity=".14"/>
      ${record(p, 256, 228, 128, `<circle cx="256" cy="228" r="44" fill="url(#${p}a)"/><circle cx="256" cy="228" r="9" fill="#0b0f1c"/>`)}
      <rect x="176" y="384" width="160" height="28" rx="6" fill="url(#${p}g)"/><path d="M200 398h112" stroke="#5a3d00" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>`;
  } else if (id === 'leiter') {
    // aufsteigende Stufen, oben die Platte
    const steps = [0, 1, 2, 3, 4].map(k => { const h = 40 + k * 34, x = 60 + k * 64; return `<rect x="${x}" y="${470 - h}" width="52" height="${h}" rx="10" fill="url(#${p}a)" fill-opacity="${.35 + k * .15}"/>`; }).join('');
    b = `${steps}${record(p, 336, 176, 122, `<circle cx="336" cy="176" r="42" fill="url(#${p}a)"/><circle cx="336" cy="176" r="9" fill="#0e0820"/>`)}
      <path d="M90 330 L170 270 L230 290 L300 240" fill="none" stroke="#fff" stroke-opacity=".0"/>`;
  } else if (id === 'glanz') {
    // schräge Platte mit großem Funkeln
    const star = (x, y, s) => `<path d="M${x} ${y - s}C${x + s * .12} ${y - s * .12} ${x + s * .12} ${y - s * .12} ${x + s} ${y}C${x + s * .12} ${y + s * .12} ${x + s * .12} ${y + s * .12} ${x} ${y + s}C${x - s * .12} ${y + s * .12} ${x - s * .12} ${y + s * .12} ${x - s} ${y}C${x - s * .12} ${y - s * .12} ${x - s * .12} ${y - s * .12} ${x} ${y - s}Z" fill="#fff"/>`;
    b = `<g transform="rotate(-18 256 270)">${record(p, 256, 270, 178, `<circle cx="256" cy="270" r="62" fill="url(#${p}a)"/><circle cx="256" cy="270" r="11" fill="#16060c"/>`)}</g>
      ${star(380, 120, 58)}${star(118, 150, 26)}${star(420, 400, 20)}`;
  } else {
    // Platte mit Diamant als Etikett
    d += grad(p + 'd1', [v.acc[0], v.acc[1]], 1, 1);
    b = `${record(p, 256, 256, 196, '')}
      <circle cx="256" cy="256" r="92" fill="#061314" fill-opacity=".55"/>
      <g stroke="#061314" stroke-width="4" stroke-linejoin="round">
        <path d="M196 226L222 196H290L316 226L256 316Z" fill="url(#${p}d1)"/>
        <path d="M196 226H316M222 196L240 226L256 316L272 226L290 196M240 226L256 196L272 226" fill="none" stroke-opacity=".55"/>
      </g>
      <path d="M222 196H256L240 226H196Z" fill="#fff" fill-opacity=".45"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
<!-- Gold Record – Konzept „${v.name}“ -->
<defs>${d}</defs>
<rect width="512" height="512" fill="url(#${p}bg)"/>
${b}
</svg>
`;
}

const pick = process.argv[2];
if (pick) { process.stdout.write(logo(pick)); return; }

// Vorschau: Spielbildschirm im Konzept (Kopfzeile, Stufen, Frage, 4 Antworten, Joker, Lautstärke)
const mock = (id, v) => `<div class="mock" style="--g1:${v.gold[0]};--g2:${v.gold[1]};--a1:${v.acc[0]};--a2:${v.acc[1]};--b1:${v.blob[0]};--b2:${v.blob[1]}">
  <i class="blob b1"></i><i class="blob b2"></i>
  <div class="hd"><span class="lg">${logo(id, id + 'h')}</span><b>Gold Record</b><span class="pill">Frage 7 / 15</span></div>
  <div class="stage">
    <div class="lad">${Array.from({ length: 15 }, (_, i) => `<i class="${i < 6 ? 'done' : i === 6 ? 'now' : ''} ${i === 4 || i === 9 ? 'safe' : ''} ${i === 14 ? 'top' : ''}"></i>`).join('')}</div>
    <div class="lvl"><span>Stufe: <b>Vinyl</b></span><span class="safe-t">◆ sicher: Gold</span></div>
    <div class="q"><span class="cv"><span class="vin"></span></span><span class="qt"><small>Welcher Song läuft?</small><b>Hör genau hin …</b></span></div>
    <div class="ans4">
      <div class="a"><i>1</i>Billie Jean</div><div class="a"><i>2</i>Beat It</div>
      <div class="a pick"><i>3</i>Thriller</div><div class="a"><i>4</i>Bad</div>
    </div>
    <div class="jok"><span>50:50</span><span>↻ Nochmal</span><span>▮▮▮ Publikum</span></div>
    <div class="vol"><span>🔊</span><i><u></u></i></div>
  </div>
</div>`;
let cards = '';
for (const [id, v] of Object.entries(V)) {
  cards += `<div class="c"><div class="top"><div class="i">${logo(id, id + 'a')}</div><div class="meta"><b>${v.name}</b><p>${v.sub}</p>
    <div class="sw"><i style="background:${v.gold[1]}"></i>Gold <i style="background:${v.acc[1]}"></i>Akzent</div><div class="s">${logo(id, id + 'b')}</div></div></div>${mock(id, v)}</div>`;
}
const out = path.join(__dirname, '..', 'logo-options');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logo-Auswahl</title>
<style>@font-face{font-family:Outfit;font-weight:400 900;src:url(../fonts/outfit-latin.woff2) format('woff2')}
*{box-sizing:border-box}body{margin:0;background:#0b0b0e;color:#f4f4f6;font-family:Outfit,system-ui,sans-serif;padding:24px}
h1{margin:0 0 4px;font-size:26px}h1+p{margin:0 0 20px;color:#a1a1ad}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:22px}
.c{background:#15151a;border:1px solid #26262e;border-radius:28px;padding:20px}
.top{display:flex;gap:18px;align-items:flex-start;margin-bottom:16px}.i{width:150px;height:150px;border-radius:34px;overflow:hidden;flex:none;box-shadow:0 18px 40px -16px #000}
.meta b{font-size:26px;font-weight:900}.meta p{margin:4px 0 10px;color:#a1a1ad;font-size:14px;line-height:1.35}
.sw{display:flex;align-items:center;gap:6px;font-size:13px;color:#d4d4d8;margin-bottom:10px}.sw i{width:16px;height:16px;border-radius:50%;margin-left:6px}.sw i:first-child{margin-left:0}
.s{width:44px;height:44px;border-radius:11px;overflow:hidden}
.mock{position:relative;overflow:hidden;border-radius:22px;padding:12px;background:#0c0c0f;isolation:isolate}
.blob{position:absolute;border-radius:50%;filter:blur(40px);opacity:.75;z-index:-1}.b1{width:260px;height:260px;left:-80px;top:-90px;background:var(--b1)}.b2{width:240px;height:240px;right:-90px;bottom:-80px;background:var(--b2)}
.hd{display:flex;align-items:center;gap:8px;margin-bottom:10px}.lg{width:28px;height:28px;border-radius:8px;overflow:hidden}.hd b{font-weight:900;font-size:17px;flex:1;color:#fff}
.pill{font-size:12px;border:1px solid rgba(255,255,255,.18);border-radius:99px;padding:2px 9px;color:#e4e4e7}
.stage{background:rgba(30,30,38,.55);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:10px;display:grid;gap:8px;backdrop-filter:blur(8px)}
.lad{display:grid;grid-template-columns:repeat(15,1fr);gap:3px}.lad i{height:8px;border-radius:3px;background:rgba(255,255,255,.12)}
.lad i.done{background:var(--a2)}.lad i.now{background:#fff;box-shadow:0 0 8px #fff}.lad i.safe{outline:1.5px solid var(--g2);outline-offset:1px}.lad i.top{background:linear-gradient(var(--g1),var(--g2));opacity:.6}
.lvl{display:flex;justify-content:space-between;font-size:12px;color:#a1a1ad}.lvl b{color:var(--g1)}.safe-t{color:var(--g2)}
.q{display:flex;align-items:center;gap:10px;padding:8px;border-radius:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)}
.cv{width:52px;height:52px;border-radius:12px;flex:none;background:#111;display:grid;place-items:center}.vin{width:42px;height:42px;border-radius:50%;background:radial-gradient(circle,#111 0 9%,var(--a2) 10% 30%,#18181b 31%)}
.qt{display:flex;flex-direction:column}.qt small{color:var(--a1);font-size:12px;font-weight:700}.qt b{font-size:17px}
.ans4{display:grid;grid-template-columns:1fr 1fr;gap:7px}.a{display:flex;align-items:center;gap:8px;padding:10px;border-radius:14px;font-weight:800;font-size:14px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)}
.a i{font-style:normal;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;background:color-mix(in srgb,var(--a2) 35%,transparent);color:var(--a1)}
.a.pick{background:linear-gradient(160deg,color-mix(in srgb,var(--g2) 40%,#18181b),color-mix(in srgb,var(--g2) 14%,#0c0c0f));border-color:var(--g2)}.a.pick i{background:linear-gradient(var(--g1),var(--g2));color:#2a1d00}
.jok{display:flex;gap:6px;justify-content:center}.jok span{font-size:12px;font-weight:700;padding:5px 10px;border-radius:99px;border:1px solid color-mix(in srgb,var(--a2) 55%,transparent);background:color-mix(in srgb,var(--a2) 16%,transparent)}
.vol{display:flex;align-items:center;gap:8px;justify-content:center;font-size:12px}.vol i{width:150px;height:4px;border-radius:4px;background:rgba(255,255,255,.15)}.vol u{display:block;width:70%;height:100%;border-radius:4px;background:var(--a2)}
</style>
<h1>Gold Record – Logo &amp; Farben</h1><p>Vier Konzepte, jeweils mit Spielbildschirm in den passenden Farben.</p><div class="g">${cards}</div>`);
console.log('ok');
