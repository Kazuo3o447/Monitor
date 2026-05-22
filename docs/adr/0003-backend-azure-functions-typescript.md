# 0003 Backend with Azure Functions and TypeScript

## Status
Accepted

## Kontext
Der bestehende Node-Server ist fuer lokale Entwicklung geeignet, soll aber spaeter als Managed Functions in Azure Static Web Apps laufen.

## Entscheidung
Die API wird ab Phase 2 auf Azure Functions (Node 20 + TypeScript) ueberfuehrt. Der bestehende API-Vertrag bleibt dabei stabil.

## Konsequenzen
- Cloud-faehiges Backend mit geringem Operations-Aufwand.
- Lokaler Betrieb weiter moeglich ueber Functions Core Tools.
- Bessere Integrationsfaehigkeit fuer geplante Erweiterungen.

## Alternativen
- Bestehenden Node-Server dauerhaft behalten: verworfen wegen Deployment-Ziel.
- Containerisiertes API-Hosting: aktuell nicht notwendig.
