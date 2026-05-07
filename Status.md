# GEMA M365 Lizenz-Monitor - Status

## Stand

Datum: 2026-05-07

Der Single-File-Prototyp wurde als Grundlage uebernommen und in eine erste Azure-Static-Web-App-Struktur ueberfuehrt. Die App nutzt jetzt eine kleine lokale API fuer Konfiguration und den read-only Abruf von Microsoft-365-Lizenzdaten ueber Microsoft Graph.

## Erledigt

- `MVPindex.html` analysiert.
- Neue Root-App `index.html` angelegt.
- Inline-CSS nach `src/styles.css` ausgelagert.
- Inline-JavaScript nach `src/app.js` ausgelagert.
- `MVPindex.html` unveraendert als Referenz behalten.
- `assets/` als Platzhalter fuer spaetere statische Dateien angelegt.
- `package.json` mit lokalem Dev-Skript angelegt.
- `scripts/static-server.js` fuer lokale Static-Server-Pruefung angelegt.
- `staticwebapp.config.json` fuer Azure Static Web Apps vorbereitet.
- `.gitignore` fuer lokale Artefakte und Secrets angelegt.
- `Manifest.md` als Projekt- und Architekturplan angelegt.
- `Status.md` als laufende Dokumentation angelegt.
- Lokale Static-Server-Pruefung erfolgreich: `index.html`, `src/app.js` und `src/styles.css` liefern HTTP 200.
- Persistenzstrategie fuer eigene Pakete abgestimmt: lokal `localStorage`, spaeter Azure Functions plus Azure Storage.
- `docs/PersistenceStrategy.md` mit Entscheidung, Datenmodell, API-Zielbild und Migrationspfad ergaenzt.
- Einstellungen um Pflege eigener Pakete erweitert.
- Eigene Pakete koennen mit Name, SKU, Gesamtbestand, Verbrauch, Warnschwellwert und Blockierungsstatus hinzugefuegt und bearbeitet werden.
- Lokaler Konfigurationsadapter von `localStorage` auf `data/local-config.json` umgestellt.
- `scripts/static-server.js` bietet jetzt `GET/POST /api/config` fuer Aliasnamen, eigene Pakete und Schwellwerte.
- `scripts/static-server.js` bietet `GET /api/licenses` fuer read-only Graph-Abruf auf `subscribedSkus`.
- `.env` wird beim lokalen Serverstart eingelesen; benoetigt werden `M365_TENANT_ID`, `M365_CLIENT_ID` und `M365_CLIENT_SECRET_VALUE`.
- `env.info.md` dokumentiert die benoetigten `.env`-Werte, Application Permissions und den verwendeten Entra-Client-Credentials-Flow.
- Eigene Pakete koennen wieder geloescht werden; zugehoerige Schwellwerte und Aliaszuordnungen werden dabei entfernt.
- Dashboard zeigt Trends, Snapshot-Zeitstempel und sortiert nach Auslastung.
- Lizenzanzeigenamen koennen lokal per Alias gepflegt werden.
- Zuweisungshistorie bietet Suche, Datumsspanne, Statusfilter, Pagination und Export; Paketnamen beruecksichtigen Aliasnamen.
- Detailmodal zeigt zusatzlich die letzten Vorgaenge zum gewaehlten Lizenzpaket.
- Syntaxpruefung erfolgreich: `node --check src/app.js`.
- Lokaler Static-Server laeuft fuer die aktuelle Pruefung unter `http://127.0.0.1:5173/`.
- `data/local-config.json` als Default-Datei ins Repository aufgenommen.

## Bewusst unveraendert

- Tailwind CSS wird weiterhin per CDN geladen.
- Lucide Icons werden weiterhin per CDN geladen.
- Chart.js wird weiterhin per CDN geladen.
- Login bleibt weiterhin simuliert.
- Historie bleibt derzeit ohne echte Backend-Datenquelle.
- Es gibt noch keine Azure Function und noch keine Azure-Storage-Anbindung.
- Die lokale API schreibt nur in die Arbeitskopie und ist nicht fuer Mehrbenutzerbetrieb gedacht.

## Naechste Schritte

- App im Browser pruefen.
- API-Vertrag fuer Azure Functions aus dem lokalen `/api/config`-Modell ableiten.
- Azure-Functions-API fuer Konfiguration und Lizenzabruf anlegen.
- Azure Storage Tabelle oder Blob fuer eigene Pakete, Aliasnamen und Schwellwerte provisionieren.
- Azure Static Web App Deployment-Workflow vorbereiten.
- Historie mit echter Datenquelle oder bewusstem Platzhalterkonzept hinterlegen.
- Fehlerbilder fuer Graph-Authentifizierung und Berechtigungen dokumentieren.

## Offene Punkte

- Azure Static Web App Name und Resource Group.
- Authentifizierungsvariante.
- Finale Quelle der Historie.
- Exakte Azure-Storage-Variante: Table Storage oder Blob Storage.
- Zielsystem fuer produktive Persistenz von eigenen Paketen, Aliasnamen und Schwellwerten.
- Welche Graph-Application-Permissions freigegeben werden.
