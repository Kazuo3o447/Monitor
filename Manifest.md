# GEMA M365 Lizenz-Monitor - Manifest

## Ziel

Aus dem bestehenden Single-File-Prototyp `MVPindex.html` ist eine lauffaehige Azure Static Web App fuer Lizenzmanagement und Monitoring entstanden. Das Frontend und alle vorhandenen MVP-Funktionen werden erhalten und schrittweise in eine produktionsfaehige Struktur ueberfuehrt.

## Leitplanken

- Das bestehende UI und Verhalten bleiben erhalten.
- Keine Funktion aus dem MVP wird entfernt.
- `MVPindex.html` bleibt vorerst als Originalreferenz im Repository.
- Die App bleibt zunaechst statisch lauffaehig und nutzt weiterhin Mock-Daten.
- Backend-Anbindungen werden spaeter hinter die bestehenden `fetchXxx()`-Funktionen gelegt.
- Eigene Pakete werden im Frontend bereits ueber einen lokalen Persistenzadapter gepflegt; produktiv wird dieser Adapter durch Azure Functions mit Azure Storage ersetzt.
- Die Struktur soll direkt nach GitHub gespiegelt und in Azure Static Web Apps gehostet werden koennen.

## Aktuelle Dateistruktur

```text
/
  index.html                 # App-Shell, Markup und CDN-Abhaengigkeiten
  .gitignore                 # Lokale Artefakte und Secrets aus Git ausschliessen
  MVPindex.html              # Urspruenglicher Single-File-Prototyp als Referenz
  Manifest.md                # Projektplan und Architekturleitplanken
  package.json               # Lokales Dev-Skript ohne Build-Abhaengigkeiten
  Status.md                  # Laufender Arbeitsstand
  staticwebapp.config.json   # Azure Static Web Apps Konfiguration
  assets/
    .gitkeep                 # Platzhalter fuer spaetere statische Assets
  docs/
    PersistenceStrategy.md   # Persistenzstrategie und Datenmodell fuer eigene Pakete
  scripts/
    static-server.js         # Kleiner lokaler Static-Server
  src/
    app.js                   # Ausgelagerte MVP-Logik
    styles.css               # Ausgelagerte MVP-Styles
```

## Aktueller Frontend-Umfang

- Simulierter Admin-Login
- Dashboard fuer Lizenzpools, nach Auslastung sortiert
- KPI-Karten fuer Paketanzahl, kritische Pools, freie Plaetze, Logic-App-Status und Auto-Approver
- Kritisches Warnbanner
- Lizenzkarten mit Auslastung, Trend, Schwellwerten und Blockierungsstatus
- Detailmodal inklusive 30-Tage-Aktivitaetsgrafik und letzter Vorgangsuebersicht
- Zuweisungshistorie mit Suche, Datumsfilter, Statusfilter, Sortierung, Pagination und Export
- System-Logs mit Filter, Pause, Auto-Scroll, Clear und Export
- Einstellungen fuer Schwellwerte
- Pflege eigener Lizenzpakete inklusive SKU, Bestand, Verbrauch, Warnschwellwert, Blockierungsstatus und Bearbeitung
- Auto-Approver-Steuerung
- Toast-Meldungen
- Auto-Refresh

## Lokaler Start

```bash
npm run dev
```

Alternativ ohne npm:

```bash
node scripts/static-server.js
```

## Zielarchitektur

```text
Browser
  -> Azure Static Web Apps
       -> index.html, src/app.js, src/styles.css, assets/*
       -> Azure Functions API
            GET  /api/licenses
            POST /api/packages
            DELETE /api/packages/{id}
            GET  /api/history
            GET  /api/logs
            GET  /api/health
            POST /api/settings/thresholds
            POST /api/approver/state
       -> Azure Storage
            Table Storage oder Blob Storage fuer eigene Pakete und kleine Settings
```

## Persistenzstrategie

- Kurzfristig: `localStorage` als Entwicklungsadapter fuer eigene Pakete, Schwellwerte und Auto-Approver-Status.
- Zielbetrieb: Azure Functions kapseln alle Schreibzugriffe und speichern die wenigen Konfigurationsdaten in Azure Storage.
- Keine produktiven Schreibzugriffe in Deployment-Dateien der Static Web App.
- Keine eigene Docker-Datenbank fuer diese Datenmenge; Wartung, Backup und Persistenz waeren unverhaeltnismaessig.
- Azure SQL bleibt eine spaetere Option, falls Historie, Audit, Rollen oder Abfragen relational deutlich komplexer werden.

## Umsetzungsplan

1. Single-File-App in wartbare Static-Web-App-Struktur aufbrechen.
2. MVP-Funktionalitaet unveraendert lokal pruefen.
3. GitHub-Repository initialisieren oder bestehendes Repository anbinden.
4. Azure Static Web App fuer statisches Hosting konfigurieren.
5. API-Vertrag finalisieren und Mock-Funktionen auf echte Endpunkte vorbereiten.
6. Azure Functions fuer Lizenzdaten, Historie, Logs, Health und Settings ergaenzen.
7. Authentifizierung integrieren, voraussichtlich Microsoft Entra ID / Static Web Apps Auth.
8. Persistenz fuer eigene Pakete, Schwellwerte und Auto-Approver-Status ueber Azure Storage einfuehren.
9. Monitoring, Fehlerbehandlung und Deployment-Dokumentation ergaenzen.
