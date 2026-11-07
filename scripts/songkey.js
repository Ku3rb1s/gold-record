// Gemeinsamer „Dubletten-Schlüssel“ für Songs: gleiche Songs mit leicht anderer Schreibweise ergeben denselben Schlüssel.
// Ignoriert: Groß/klein, Akzente, Klammer-/Strich-Zusätze (feat., Remastered, Radio Edit …), „The“ am Anfang,
// wanna/want to, gonna/going to, ’n’/and, Satzzeichen und Leerzeichen.
// Wird von scripts/dedupe-check.js benutzt; dieselbe Funktion steht als songKey() in js/game.js.
function songKey(t, a) {
  const n = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const title = n(t).replace(/\s*[([].*?[)\]]/g, '').replace(/\s+[-–—]\s+.*$/, '')
    .replace(/^the\s+/, '').replace(/\bwanna\b/g, 'want to').replace(/\bgonna\b/g, 'going to').replace(/\s+'?n'?\s+/g, ' and ').replace(/&/g, 'and')
    .replace(/[^a-z0-9äöüß]+/g, '');
  const artist = n(a).replace(/\s*(feat\.?|ft\.?|featuring|with|&|,| x ).*$/, '').replace(/^the\s+/, '').replace(/[^a-z0-9äöüß]+/g, '');
  return artist + '|' + title;
}
module.exports = { songKey };
