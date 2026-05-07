# Persistenzstrategie

## Entscheidung

Fuer die aktuelle Datenmenge wird keine eigene Docker-Datenbank aufgebaut. Eigene Lizenzpakete, Aliasnamen, Schwellwerte und kleine Settings werden spaeter ueber Azure Functions in Azure Storage persistiert. Lokal nutzt die App bis dahin `data/local-config.json` als Entwicklungsadapter.

Die aktuelle App unterstuetzt bereits das Anlegen, Bearbeiten und Loeschen eigener Pakete sowie die Pflege von Aliasnamen und Schwellwerten. Der produktive API-Vertrag muss diese Operationen deshalb 1:1 abbilden.

## Warum Azure Storage

- Die erwartete Datenmenge ist sehr klein, aktuell hoechstens wenige eigene Pakete.
- Azure Static Web Apps koennen ihre Deploy-Dateien nicht als produktive Schreibablage nutzen.
- Docker plus eigene Datenbank erzeugt fuer diese Groesse zu viel Betriebsaufwand: Compute, Volume, Backup, Updates und Security.
- Azure SQL ist technisch sauber, aber fuer wenige Konfigurationsdatensaetze vorerst groesser als noetig.
- Azure Storage ist guenstig, managed und reicht fuer Paketlisten und Settings aus.

## Zielarchitektur

```text
Browser
  -> Azure Static Web Apps
     -> /api/*
        -> Azure Functions
           -> Azure Storage
```

Die Browser-App soll keine Storage-Keys kennen. Alle Schreibzugriffe laufen ueber `/api`, damit Validierung, Authentifizierung und spaetere Audit-Logs zentral bleiben.

## Aktueller Adapter

Lokal werden alle editierbaren UI-Einstellungen in dieser Datei gespeichert:

```text
data/local-config.json
```

Der Zugriff erfolgt ueber den lokalen Static-Server:

```text
GET  /api/config
POST /api/config
```

Der lokale Adapter ist nur fuer Entwicklung und Demos gedacht. Er ist nicht mandantenfaehig und teilt Daten nicht zwischen Umgebungen oder Entwicklern.

Das JSON-Dokument hat aktuell diese Form:

```json
{
  "licenseAliases": {
    "SPE_E5": "Microsoft 365 E5"
  },
  "customPackages": [
    {
      "id": 1770000000000,
      "name": "Adobe Creative Cloud",
      "sku": "ADOBE_CC",
      "total": 5,
      "used": 2,
      "blocked": false,
      "trend": 0,
      "source": "manual",
      "createdAt": "2026-05-04T10:00:00.000Z",
      "updatedAt": "2026-05-04T10:00:00.000Z"
    }
  ],
  "thresholds": {
    "1770000000000": 80
  }
}
```

## Datenmodell Eigene Pakete

```json
{
  "id": 1770000000000,
  "name": "Adobe Creative Cloud",
  "sku": "ADOBE_CC",
  "total": 5,
  "used": 2,
  "blocked": false,
  "trend": 0,
  "source": "manual",
  "createdAt": "2026-05-04T10:00:00.000Z",
  "updatedAt": "2026-05-04T10:00:00.000Z"
}
```

## Geplante API

```text
GET    /api/licenses
GET    /api/config
POST   /api/config
```

`GET /api/licenses` liest bereits live aus Microsoft Graph und bleibt read-only. `GET/POST /api/config` kapseln die wenigen editierbaren UI-Daten. In Azure Functions kann diese Trennung beibehalten werden: read-only fuer Graph, Schreibzugriffe nur fuer lokale Konfiguration.

Nicht zugelassen sind aktuell andere Schreibzugriffe unter `/api/*`; der lokale Server antwortet hier bewusst mit `405 read_only_api`.

## Migrationspfad

1. JSON-Vertrag von `data/local-config.json` beibehalten.
2. Azure Function Endpunkte fuer `GET/POST /api/config` mit identischem JSON-Vertrag bauen.
3. Azure Storage Tabelle oder Blob fuer `config` anbinden.
4. Read-only Graph-Abruf aus `GET /api/licenses` in Azure Functions oder eine dedizierte Backend-API uebernehmen.
5. Optional spaeter Historie und weitere Audit-Daten als getrenntes Modell ergaenzen.
6. Optional spaeter auf Azure SQL/PostgreSQL migrieren, falls relationale Historie, Rollenmodell oder Auditpflichten deutlich wachsen.
