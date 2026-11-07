# Gold Record

Musik-Quiz als Fragenleiter: **15 Fragen** mit steigender Schwierigkeit, jede richtige Antwort bringt eine Stufe höher –
von der Kassette bis zum **Diamanten**. Gold (Stufe 5) und Platin (Stufe 10) sind Sicherheitsstufen, aussteigen geht jederzeit vor einer Frage.
Teil der [Jukebox](https://ku3rb1s.github.io/jukebox/) (gleicher Look wie Musik-Bingo, Needle Drop und Older or Newer).

**Online:** https://ku3rb1s.github.io/gold-record/

Lokal starten: `node server.js` → http://127.0.0.1:8893/

## Wie es funktioniert

- **Songs:** `data/songs.json` aus Older or Newer (über 900 Hits mit geprüftem Originaljahr, Deezer-ID, Cover und Deezer-Rang).
  **Streams:** `data/billions.json` aus Needle Drop (Spotify-Songs mit über einer Milliarde Streams, kworb.net).
- **Fragearten** (`TYPES` in `js/game.js`): Welcher Song läuft? (Hörprobe) · Von wem? · Aus welchem Jahr? · Welcher ist am ältesten? · Meiste Streams? · Welches Cover?
- **Schwierigkeit** steigt mit der Frage-Nummer: `DIFF` (f0/f1) legt fest, aus wie vielen der bekanntesten Songs (Deezer-Rang) gezogen wird;
  `similar()` wählt falsche Antworten anfangs zufällig, später aus derselben Zeit/Sprache bzw. vom selben Interpreten.
  Jahresfragen: Abstand der Jahreszahlen von 8 Jahren runter auf 1. Ältester/Streams: Songs liegen später immer enger beieinander.
- **Joker** (jeder einmal pro Spiel): 50:50, Publikum (Trefferquote hängt von Bekanntheit und Stufe ab), Telefon (Freund nennt eine Antwort mit Sicherheit 1–3),
  Frage tauschen (Ersatzfrage derselben Stufe, beim Start mit gebaut). **Nochmal hören** ist kein Joker: Der Knopf an der Frage spielt immer die ganzen 30 s von vorn.
- **Schwierigkeit** (`DIFF` in `js/game.js`): Leicht/Normal/Schwer verschieben Bekanntheit der Songs und Ähnlichkeit der falschen Antworten – unabhängig von den Jokern.
- **Tägliche Challenge:** alle 15 Fragen (und Ersatzfragen) werden mit einem Zufallsgenerator gebaut, dessen Startwert das Datum ist –
  so bekommen alle am selben Tag dieselben Fragen, ganz ohne Server. Ein Versuch pro Tag (`gr.daily.<Datum>`), Serie über `gr.dailyLog`. Knopf in der Kopfzeile wie in Needle Drop (#1 = 07.11.2026).
- **Zeitlimit:** Frage 6–10 je 45 s, ab 11 je 30 s (abschaltbar). Die Uhr startet, sobald die Hörprobe spielt.
- **Audio:** 30-s-Vorschauen von Deezer (JSONP, kein Login). Der Vorschau-Link läuft ab, darum wird er erst kurz vorher per `/track/{id}` geholt.
- Rekorde und Statistik nur lokal (`gr.*` im Browser-Speicher). Sprache (`mq.lang`) und Profil (`jb.profile`) teilt es mit den anderen Spielen.

## Sprachen

Deutsch, Englisch, Französisch, Spanisch, Norwegisch (`js/i18n.js`, `js/lang/*.js`). Texte im Code auf Deutsch mit `tx()`;
`node scripts/check-lang.js` zeigt, was fehlt.

## Versionen

Änderungen in [CHANGELOG.md](CHANGELOG.md) und in der App unter Einstellungen → Versionsnummer. Bei jedem Update `APP_VERSION`/`APP_DATE`
in `js/game.js` erhöhen, `CHANGELOG.md` ergänzen und `?v=` in `index.html` hochzählen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Markup (Start, Spiel, Ende, Einstellungen) und Icons |
| `css/base.css`, `css/fonts.css`, `fonts/` | gemeinsamer Look aus Musik-Bingo, Schrift Outfit lokal |
| `css/app.css` | Spiel-eigene Teile: Quizbühne, Antwortbalken, Stufenleiter, Joker |
| `js/game.js` | Fragen bauen, Spielablauf, Wiedergabe, Anzeige, Einstellungen |
| `js/deezer.js`, `js/i18n.js`, `js/profile.js`, `js/pwa.js` | wie in Older or Newer |
| `logo.svg` | Logo „Plakette“; `node scripts/render-icons.js` rendert daraus die PNG-Icons (headless Edge), `scripts/logo-options.js` baut die Auswahlseite mit Varianten |
