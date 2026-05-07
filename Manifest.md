# GEMA M365 Lizenz-Monitor - Manifest

## Ziel

Aus dem bestehenden Single-File-Prototyp `MVPindex.html` ist eine lauffaehige Azure Static Web App fuer Lizenzmanagement und Monitoring entstanden. Das Frontend wird schrittweise in eine produktionsfaehige Struktur ueberfuehrt und bereits mit einer kleinen lokalen API fuer Konfiguration und Live-Lizenzabruf verbunden.

## Leitplanken

- Das bestehende UI wird gezielt weiterentwickelt und wo noetig vereinfacht.
- `MVPindex.html` bleibt vorerst als Originalreferenz im Repository.
- Die App bleibt lokal ohne Build-Schritt lauffaehig.
- Backend-Anbindungen liegen hinter den bestehenden `fetchXxx()`-Funktionen und koennen lokal ueber den Static-Server getestet werden.
- Eigene Pakete, Aliasnamen und Schwellwerte werden aktuell in `data/local-config.json` ueber `/api/config` gepflegt; produktiv wird dieser Adapter spaeter durch Azure Functions mit Azure Storage ersetzt.
- Microsoft-365-Lizenzdaten werden lokal bereits read-only ueber Microsoft Graph abgefragt, sobald gueltige `.env`-Werte vorhanden sind.
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
  env.info.md                # Entra- und Graph-Voraussetzungen fuer den lokalen Lizenzabruf
  staticwebapp.config.json   # Azure Static Web Apps Konfiguration
  assets/
    .gitkeep                 # Platzhalter fuer spaetere statische Assets
  data/
    local-config.json        # Lokale Konfiguration fuer Aliasnamen, eigene Pakete und Schwellwerte
  docs/
    PersistenceStrategy.md   # Persistenzstrategie und Datenmodell fuer eigene Pakete
  scripts/
    static-server.js         # Kleiner lokaler Static-Server mit /api/config und /api/licenses
  src/
    app.js                   # Ausgelagerte MVP-Logik
    styles.css               # Ausgelagerte MVP-Styles
```

## Aktueller Frontend-Umfang

- Simulierter Admin-Login
- Dashboard fuer Lizenzpools, nach Auslastung sortiert
- KPI-Karten fuer Paketanzahl und kritische Pools
- Kritisches Warnbanner
- Lizenzkarten mit Auslastung, Trend, Schwellwerten und Blockierungsstatus
- Snapshot-Zeitstempel fuer den letzten Datenabruf
- Detailmodal inklusive 30-Tage-Aktivitaetsgrafik und letzter Vorgangsuebersicht
- Zuweisungshistorie mit Suche, Datumsfilter, Statusfilter, Sortierung, Pagination und Export
- Einstellungen fuer Aliasnamen und Schwellwerte
- Pflege eigener Lizenzpakete inklusive SKU, Bestand, Verbrauch, Warnschwellwert, Blockierungsstatus und Bearbeitung
- Umbenennen von Lizenzanzeigenamen direkt aus Dashboard, Detailansicht und Einstellungen
- Toast-Meldungen
- Auto-Refresh

## Lokaler Start

```bash
npm run dev
```

Fuer Live-Lizenzdaten muessen die Graph- und Entra-Voraussetzungen aus `env.info.md` erfuellt sein.

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
      GET  /api/config
      POST /api/config
       -> Azure Storage
      Table Storage oder Blob Storage fuer eigene Pakete und kleine Settings
    -> Microsoft Graph
      subscribedSkus fuer read-only Lizenzdaten
```

## Persistenzstrategie

- Kurzfristig: `data/local-config.json` als lokaler Entwicklungsadapter fuer eigene Pakete, Aliasnamen und Schwellwerte.
- Zielbetrieb: Azure Functions kapseln alle Schreibzugriffe und speichern die wenigen Konfigurationsdaten in Azure Storage.
- Live-Lizenzdaten bleiben read-only und kommen aus Microsoft Graph.
- Keine produktiven Schreibzugriffe in Deployment-Dateien der Static Web App.
- Keine eigene Docker-Datenbank fuer diese Datenmenge; Wartung, Backup und Persistenz waeren unverhaeltnismaessig.
- Azure SQL bleibt eine spaetere Option, falls Historie, Audit, Rollen oder Abfragen relational deutlich komplexer werden.

## Umsetzungsplan

1. Single-File-App in wartbare Static-Web-App-Struktur aufbrechen.
2. MVP-Funktionalitaet unveraendert lokal pruefen.
3. GitHub-Repository initialisieren oder bestehendes Repository anbinden.
4. Azure Static Web App fuer statisches Hosting konfigurieren.
5. Lokalen API-Vertrag fuer `GET/POST /api/config` und `GET /api/licenses` stabilisieren.
6. Azure Functions fuer Lizenzdaten und lokale Konfiguration ergaenzen.
7. Authentifizierung integrieren, voraussichtlich Microsoft Entra ID / Static Web Apps Auth.
8. Persistenz fuer eigene Pakete, Aliasnamen und Schwellwerte ueber Azure Storage einfuehren.
9. Historie, Monitoring, Fehlerbehandlung und Deployment-Dokumentation ergaenzen.
