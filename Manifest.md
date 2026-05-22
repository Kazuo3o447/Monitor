# GEMA M365 Lizenz-Monitor - Manifest

## Zweck

Dieses Repository ist aktuell kein fertiges Azure-SWA-Produkt, sondern ein lokal lauffaehiger Monitor fuer Microsoft-365-Lizenzbestaende mit einer kleinen Node-basierten Begleit-API.

Die Anwendung kombiniert drei Dinge:

- read-only Abruf von Lizenzbestaenden aus Microsoft Graph
- lokale Pflege von Aliasnamen, Schwellwerten und eigenen Paketen
- eine einfache Weboberflaeche fuer Dashboard, Historie und Einstellungen

Das Manifest beschreibt den tatsaechlichen Stand des Projekts und das naechste realistische Zielbild. Es ersetzt bewusst aeltere Planungsannahmen, die den aktuellen Code nicht mehr korrekt abbilden.

## Aktueller Projektstatus

Der aktuelle Stand ist:

- statisches Frontend ohne Build-Schritt
- lokaler Node-Server als Entwicklungsserver
- lokale JSON-Persistenz in `data/local-config.json`
- read-only Graph-Anbindung fuer `subscribedSkus`
- simulierte Benutzeranmeldung im Frontend
- keine produktive Cloud-Infrastruktur im Repository

Das Projekt ist damit heute primaer eine lokal betreibbare Entwicklungs- und Fachkonzeptbasis, nicht bereits eine ausgerollte Zielplattform.

## Was die Anwendung heute kann

- Lizenzbestaende ueber `GET /api/licenses` aus Microsoft Graph abrufen
- Lizenzkarten nach Auslastung darstellen
- kritische Pools ueber Schwellwerte hervorheben
- Snapshot-Zeitstempel des letzten Abrufs anzeigen
- lokale Aliasnamen fuer SKU-Anzeigenamen pflegen
- eigene Pakete lokal anlegen, bearbeiten und loeschen
- Schwellwerte lokal speichern
- Historie im Frontend darstellen und exportieren
- ohne Build-Pipeline lokal gestartet werden

## Was die Anwendung heute ausdruecklich noch nicht ist

- keine echte Azure Function App
- keine produktive Azure Static Web App im Repository
- kein mandantenfaehiger Mehrbenutzerbetrieb
- kein echter Entra-Benutzerlogin im Frontend
- keine serverseitige Historienpersistenz
- kein produktives Secret-Handling

## Architektur heute

```text
Browser
  -> index.html
  -> src/app.js
  -> src/styles.css

Lokaler Node-Server
  -> scripts/static-server.js
  -> GET  /api/licenses
  -> GET  /api/config
  -> POST /api/config

Lokale Daten
  -> data/local-config.json

Externe Quelle
  -> Microsoft Graph /subscribedSkus
  -> Authentifizierung per Entra Client Credentials
```

## Architekturentscheidung heute

Die zentrale Architekturentscheidung ist aktuell:

- Microsoft Graph liefert nur read-only Lizenzdaten.
- Alle editierbaren UI-Daten bleiben lokal und werden getrennt davon gespeichert.

Dadurch bleibt die Graph-Integration klein, nachvollziehbar und risikoarm. Der lokale Server kapselt die beiden Verantwortlichkeiten bereits sauber:

- Lizenzabruf aus Graph
- Konfigurationspersistenz fuer die UI

## Zielbild naechste Ausbaustufe

Die naechste sinnvolle Ausbaustufe ist nicht sofort ein vollstaendiger Plattformumbau, sondern die kontrollierte Ueberfuehrung des lokalen Servers in cloudfaehige Backend-Bausteine.

```text
Browser
  -> Static Frontend Hosting

Backend API
  -> GET  /api/licenses
  -> GET  /api/config
  -> POST /api/config

Persistenz
  -> Azure Storage oder vergleichbarer kleiner Konfigurationsspeicher

Externe Quelle
  -> Microsoft Graph /subscribedSkus
```

Wichtig ist dabei:

- das API-Modell soll moeglichst unveraendert bleiben
- die Trennung zwischen read-only Graph-Daten und editierbarer lokaler Konfiguration soll erhalten bleiben
- Frontend-Code soll nicht direkt von einer konkreten Hosting-Plattform abhaengen

## Hosting- und Plattformannahmen

Azure Static Web Apps bleibt eine plausible Zielplattform, ist aber aktuell nur ein moegliches Deployment-Ziel und nicht der heute implementierte Betriebsmodus.

Fuer die aktuelle Codebasis gilt deshalb:

- lokaler Start ueber `npm run dev`
- lokaler Server in `scripts/static-server.js`
- Cloud-Betrieb spaeter, nicht bereits umgesetzt

## Persistenzmodell

Aktuell werden editierbare Daten in `data/local-config.json` gehalten.

Enthalten sind:

- `licenseAliases`
- `customPackages`
- `thresholds`

Diese Daten sind lokal, dateibasiert und nicht fuer parallelen Mehrbenutzerbetrieb ausgelegt.

Das kuenftige produktive Ziel ist ein kleiner zentraler Speicher fuer genau diese Konfiguration, nicht fuer die eigentlichen Microsoft-365-Lizenzdaten.

## Authentifizierungsmodell

Aktuell existieren zwei klar getrennte Ebenen:

- Frontend-Login: nur simuliert
- Backend-zu-Graph: echter Entra Client-Credentials-Flow

Die fuer den Graph-Zugriff benoetigten Variablen, Rechte und Entra-Schritte sind in `env.info.md` dokumentiert.

## Relevante Dateien im Repository

```text
index.html                  # App-Shell und UI-Struktur
src/app.js                  # Frontend-Logik
src/styles.css              # Styles
scripts/static-server.js    # Lokaler Server und API-Endpunkte
data/local-config.json      # Lokale Konfiguration
env.info.md                 # Graph- und Entra-Dokumentation
docs/PersistenceStrategy.md # Persistenzentscheidung und Zielrichtung
Status.md                   # Laufender Arbeitsstand
MVPindex.html               # Historische Referenz
```

## Leitplanken fuer weitere Entwicklung

- Keine unnoetige Ausweitung der Graph-Berechtigungen.
- Graph bleibt fuer diesen Monitor read-only, solange kein belastbarer Fachfall fuer Schreibzugriffe existiert.
- UI-Konfiguration bleibt logisch getrennt von Microsoft-365-Bestandsdaten.
- Neue Backend-Funktionalitaet soll zuerst ueber den bestehenden lokalen API-Vertrag gedacht werden.
- Ein Cloud-Rollout soll den lokalen Entwicklungsmodus nicht verschlechtern.

## Naechste fachlich sinnvolle Schritte

1. Historie fachlich klaeren: Mock behalten, echte Quelle anbinden oder Feature zunaechst reduzieren.
2. API-Vertrag fuer `config` stabilisieren, damit eine spaetere Cloud-Migration ohne Frontend-Umbau moeglich bleibt.
3. Produktive Secret-Strategie definieren, statt `.env` dauerhaft als Betriebsmodell zu verwenden.
4. Echten Entra-Benutzerlogin nur dann einfuehren, wenn daraus fachlich konkrete Rechte- oder Rollenlogik folgt.

## Nicht mehr gueltige Annahmen aus aelteren Versionen

Folgende Aussagen gelten in dieser Form nicht mehr als Projektbeschreibung:

- dass das Projekt bereits eine produktionsfaehige Azure Static Web App ist
- dass die Backend-Schicht erst spaeter hinter `fetchXxx()` gelegt wird
- dass lokale Persistenz noch ueber `localStorage` laeuft
- dass der aktuelle Umfang noch dem frueheren MVP mit Logs- und Approver-Steuerung entspricht

Dieses Manifest ist damit die massgebliche Beschreibung des aktuellen Projektzuschnitts.

Hinweis ab Phase 0: Das Repository wird schrittweise zu einem erweiterten Lizenz-Management-System ausgebaut. Architekturentscheidungen werden dafuer fortan zentral in `docs/adr/` als ADRs nachgefuehrt.
