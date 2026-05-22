# 0001 Persistence with Azure Tables and Azurite

## Status
Accepted

## Kontext
Die Anwendung braucht persistente Konfiguration fuer Alias, Schwellwerte und CustomPackages. SQLite ist in Azure Functions unpassend fuer einen stateless Betrieb und wuerde lokale/prod Divergenz erzeugen.

## Entscheidung
Persistenz wird auf Azure Table Storage standardisiert. Lokal wird Azurite als npm-Package genutzt, ohne Docker.

## Konsequenzen
- Einheitliches Persistenzmodell lokal und produktiv.
- Geringer Betriebsaufwand bei kleiner Datenmenge.
- Repository-Pattern kann ohne Speicherwechsel wachsen.

## Alternativen
- SQLite lokal plus andere Cloud-Persistenz: verworfen wegen Doppelimplementierung.
- Dockerisierte Datenbank: verworfen wegen vermeidbarer Komplexitaet.
- Azure SQL: aktuell ueberdimensioniert fuer den Bedarf.
