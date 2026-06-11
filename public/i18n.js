// German-only string table for the dynamic JS strings. Static UI text lives
// directly in index.html. getLang/bcp47/scribeLang stay exported because the
// API payloads and speech recognition read them.
const STRINGS = {
  // Fehler
  "err.nofile": "Erst ein PDF oder eine PowerPoint-Datei hinzufügen oder eine Gliederung einfügen.",
  "err.notfile": "Nutze eine PDF- oder PowerPoint-Datei (.pptx), oder füge eine Gliederung ein.",
  "err.toobig": "Datei zu groß. Unter 20 MB bleiben.",
  "err.toomany": "Mehr als {max} Folien werden nicht unterstützt. Teile den Vortrag auf oder exportiere weniger Folien.",
  "err.notext": "Konnte keinen Text aus dieser Datei lesen (evtl. eingescannte Bilder). Füge stattdessen deine Gliederung ein.",
  "err.generate": "Karten konnten nicht erstellt werden. Versuch es nochmal.",
  "err.mic": "Mikrofon blockiert. Zugriff erlauben und erneut versuchen, oder Punkte per Tippen abhaken.",
  // Generierung
  "gen.button": "Karten erstellen",
  "gen.reading": "⟳ Folien werden gelesen…",
  "gen.writing": "⟳ Karten werden geschrieben… ({a}/{b})",
  "gen.writing0": "⟳ Karten werden geschrieben…",
  "gen.canceled": "Abgebrochen. Es wurde nichts gespeichert.",
  // Bühne
  "stage.hint": "Tippe einen Punkt zum Abhaken. Wische für die nächste Karte.",
  "qa.thinking": "⟳ Denkt nach…",
  // Live-Coach (nur Warnungen; WAS zu sagen ist, zeigt das HUD)
  "coach.silence": "Weiter geht's. Lies den Text oben laut vor.",
  "coach.slower": "Etwas langsamer, du hetzt.",
  "coach.faster": "Etwas mehr Tempo.",
  "coach.focus": "Zurück zum Thema unten.",
};

export function getLang() { return 'de'; }
export function t(key, vars) {
  let s = STRINGS[key] != null ? STRINGS[key] : key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
export function bcp47() { return 'de-DE'; }
export function scribeLang() { return 'deu'; }
