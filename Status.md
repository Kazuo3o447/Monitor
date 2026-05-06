# GEMA M365 Lizenz-Monitor - Status

## Stand

Datum: 2026-05-04

Der Single-File-Prototyp wurde als Grundlage uebernommen und in eine erste Azure-Static-Web-App-Struktur ueberfuehrt. Die App entwickelt sich nun vom reinen Monitor in Richtung Lizenzmanagement.

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
- Eigene Pakete koennen mit Name, SKU, Gesamtbestand, Verbrauch, Warnschwellwert und Blockierungsstatus hinzugefuegt werden.
- Eigene Pakete werden lokal im Key `licenseMonitor.customPackages.v1` gespeichert und im Dashboard sowie in den Schwellwerten angezeigt.
- Eigene Pakete koennen wieder geloescht werden; zugehoerige Schwellwerte werden dabei entfernt.
- Syntaxpruefung erfolgreich: `node --check src/app.js`.
- Lokaler Static-Server laeuft fuer die aktuelle Pruefung unter `http://127.0.0.1:5173/`.

## Bewusst unveraendert

- Tailwind CSS wird weiterhin per CDN geladen.
- Lucide Icons werden weiterhin per CDN geladen.
- Chart.js wird weiterhin per CDN geladen.
- Alle Datenquellen sind weiterhin Mock-Daten in `src/app.js`.
- Login und Backend-Aufrufe sind weiterhin simuliert.
- Eigene Pakete sind aktuell nur lokal im jeweiligen Browser gespeichert.
- Es gibt noch keine Azure Function und noch keine Azure-Storage-Anbindung.

## Naechste Schritte

- App im Browser pruefen.
- Azure-Functions-API fuer Paket-CRUD und Settings anlegen.
- Azure Storage Tabelle oder Blob fuer eigene Pakete und Settings provisionieren.
- Git-Repository initialisieren oder Remote verbinden.
- Azure Static Web App Deployment-Workflow vorbereiten.
- Mock-Funktionen durch echte API-Endpunkte ersetzbar machen.
- Backend/API-Vertrag konkretisieren.

## Offene Punkte

- Gewuenschter GitHub-Repository-Name.
- Azure Static Web App Name und Resource Group.
- Authentifizierungsvariante.
- Quelle der echten Lizenzdaten.
- Exakte Azure-Storage-Variante: Table Storage oder Blob Storage.
- Zielsystem fuer produktive Persistenz von eigenen Paketen, Schwellwerten und Auto-Approver-Status.
