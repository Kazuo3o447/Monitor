# Copilot Instructions

## Projektzweck
Dieses Repository entwickelt einen read-only Lizenz-Monitor fuer Microsoft 365 zu einem erweiterten Lizenz-Management-System mit Fokus auf Transparenz, Monitoring und spaeterer Mehrquellen-Integration. Die aktuelle Basis bleibt in Phase 0 funktional unveraendert und wird nur strukturell vorbereitet.

## Architekturueberblick
- Frontend: In Phase 0 unveraendertes Vanilla-Frontend unter apps/web; spaeter Vite + React + TypeScript.
- API: Lokaler Node-Server unter apps/api mit den bestehenden Endpoints.
- Persistenz: Aktuell data/local-config.json; spaeter Azure Table Storage, lokal ueber Azurite.
- Externe Quellen: Microsoft Graph read-only; weitere Connectoren spaeter.

## Harte Leitplanken
- Microsoft Graph bleibt read-only.
- Keine Graph-Schreibrechte und keine Graph-Schreibcalls.
- Kein Docker fuer lokale Persistenz.
- Schreibzugriffe nur auf eigene Speicher (lokal oder Azure Storage), niemals in Graph.
- Keine direkten Storage-Keys im Frontend.

## Code-Stil
- TypeScript wird ab Phase 1 fuer neue Kernimplementierungen eingefuehrt.
- Einheitliches Linting und Formatting wird phasenweise vereinheitlicht.
- UI-Texte sind deutschsprachig.
- Code-Symbole, Typen und APIs sind englischsprachig.

## Domaenenvokabular
- Sku
- SkuPartNumber
- ConsumedUnits
- PrepaidUnits
- Alias
- CustomPackage
- Threshold
- Snapshot
- Reclaim-Kandidat
- Lifecycle

## Don'ts
- Keine localStorage-Persistenz fuer fachliche Daten.
- Keine Annahme eines echten User-Logins waehrend der Bauphase.
- Keine Graph-Schreibcalls.
- Kein Docker als lokale Pflichtvoraussetzung.
