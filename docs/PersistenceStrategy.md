# Persistenzstrategie

## Entscheidung

Fuer die aktuelle Datenmenge wird keine eigene Docker-Datenbank aufgebaut. Eigene Lizenzpakete, Schwellwerte und kleine Settings werden spaeter ueber Azure Functions in Azure Storage persistiert. Lokal nutzt die App bis dahin `localStorage` als Entwicklungsadapter.

Die aktuelle App unterstuetzt bereits das Anlegen, Bearbeiten und Loeschen eigener Pakete. Der produktive API-Vertrag muss diese Operationen deshalb 1:1 abbilden.

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

In `src/app.js` werden eigene Pakete unter diesem Key gespeichert:

```text
licenseMonitor.customPackages.v1
```

Schwellwerte bleiben im bestehenden Key:

```text
licenseThresholds
```

Der lokale Adapter ist nur fuer Entwicklung und Demos gedacht. Er ist nicht mandantenfaehig und teilt Daten nicht zwischen Browsern.

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
POST   /api/packages
PATCH  /api/packages/{id}
DELETE /api/packages/{id}
POST   /api/settings/thresholds
POST   /api/approver/state
```

`GET /api/licenses` soll Microsoft-365-Lizenzdaten und manuell gepflegte Pakete bereits zusammengefuehrt liefern. Das Frontend muss spaeter nur den aktuellen lokalen Adapter gegen echte `fetch()`-Aufrufe tauschen.

## Migrationspfad

1. Aktuelle `localStorage`-Datenstruktur beibehalten.
2. Azure Function Endpunkte mit identischem JSON-Vertrag bauen.
3. Azure Storage Tabelle oder Blob fuer `customPackages` und `settings` anbinden.
4. `fetchLicenses()`, `createCustomPackage()`, `updateCustomPackage()`, `removeCustomPackage()` und `saveThresholds()` in `src/app.js` auf `/api` umstellen.
5. Optional spaeter auf Azure SQL/PostgreSQL migrieren, falls relationale Historie, Rollenmodell oder Auditpflichten deutlich wachsen.
