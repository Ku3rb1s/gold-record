// Gold Record – Besonderheiten für scripts/check-lang.js (das Skript selbst ist gemeinsam für alle Spiele)
module.exports = {
  ignore: ['Gold Record', 'M', 'A', 'D', '50:50', 'de', 'intl', 'ach', 'phone', 'extra', 'newest', 'decade', 'C', 'safe', 'win'],
  tables: ['POOL_NAMES', 'TIMER_NAMES', 'TIMER_INFO', 'DIFF_NAMES', 'DIFF_INFO'],
  arrays: ['STAGES', 'PHONE_LINES'],                             // Stufen-Namen, Telefonjoker-Sätze
  patterns: [/\bq: '((?:\\.|[^'\\])*)'/g],                       // Fragetexte (TYPES … q: '…')
  add: ['Autoplay an', 'Autoplay aus', 'Töne aus', 'Spannungs-Sounds aus', 'Sprache', 'Jahrzehnt', 'Genre',
    'Gold', 'Single', 'Top 40', 'Top 10', 'Demo-Tape', 'Mixtape', 'Hall of Fame', 'Radio-Hit'],
};
