# Microsoft Graph und Entra Authentifizierung

## Zweck

Diese Datei beschreibt die fuer den lokalen Lizenzabruf benoetigten `.env`-Werte, die minimal noetigen Microsoft-Graph-Berechtigungen und die dazu passende Microsoft-Entra-Authentifizierung.

Der aktuelle lokale Server in `scripts/static-server.js` verwendet den OAuth-2.0-Client-Credentials-Flow gegen Microsoft Entra ID und ruft anschliessend `GET https://graph.microsoft.com/v1.0/subscribedSkus` auf.

## Aktuell verwendete `.env`-Variablen

```dotenv
M365_TENANT_ID=<Tenant-ID oder Tenant-Domaene>
M365_CLIENT_ID=<Application-Client-ID>
M365_CLIENT_SECRET_VALUE=<Client-Secret-Wert>
M365_CLIENT_SECRET_ID=<Client-Secret-ID aus Entra, optional dokumentarisch>
M365_GRAPH_SCOPE=https://graph.microsoft.com/.default
```

## Bedeutung der Variablen

- `M365_TENANT_ID`: Ziel-Tenant fuer Tokenanforderung an `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`.
- `M365_CLIENT_ID`: Application (client) ID der App Registration in Microsoft Entra ID.
- `M365_CLIENT_SECRET_VALUE`: Geheimer Wert des in der App Registration erzeugten Client Secrets.
- `M365_CLIENT_SECRET_ID`: Interne ID des Secrets. Diese Variable wird vom aktuellen Node-Server nicht aktiv verwendet, ist aber fuer Verwaltung und Rotation nuetzlich.
- `M365_GRAPH_SCOPE`: Muss fuer den aktuellen App-only-Abruf auf `https://graph.microsoft.com/.default` stehen.

## Benoetigte Microsoft Graph Rechte

Fuer den aktuell implementierten Endpoint `GET /api/licenses` wird in Graph ausschliesslich dieser Aufruf verwendet:

```http
GET https://graph.microsoft.com/v1.0/subscribedSkus?$select=skuId,skuPartNumber,consumedUnits,capabilityStatus,prepaidUnits
```

Laut Microsoft Graph ist dafuer als Least-Privilege-Option bei Application Permissions noetig:

- `LicenseAssignment.Read.All`

Moegliche, aber weiter gehende Alternativen sind:

- `Organization.Read.All`
- `Directory.Read.All`
- `Directory.ReadWrite.All`
- `Organization.ReadWrite.All`

Empfehlung fuer dieses Repository:

- Nur `LicenseAssignment.Read.All` als Application Permission vergeben.
- Keine Schreibrechte fuer Graph eintragen, solange der Code ausschliesslich read-only auf `subscribedSkus` zugreift.

## Benoetigte Microsoft Entra Konfiguration

### 1. App Registration anlegen

- Microsoft Entra Admin Center oeffnen.
- Unter `App registrations` eine neue App registrieren.
- Als unterstuetzten Kontotyp in der Regel `Accounts in this organizational directory only` waehlen.

### 2. Client Secret oder Zertifikat hinterlegen

Fuer den aktuellen Code ist ein Client Secret hinterlegt.

- Unter `Certificates & secrets` ein neues Secret erzeugen.
- Den Secret-Wert sofort kopieren und in `M365_CLIENT_SECRET_VALUE` ablegen.
- Die angezeigte Secret-ID optional in `M365_CLIENT_SECRET_ID` dokumentieren.

Fuer produktive Nutzung ist ein Zertifikat der bessere Weg als ein Secret.

### 3. API Permissions setzen

- `Microsoft Graph` auswaehlen.
- `Application permissions` verwenden, nicht `Delegated permissions`.
- `LicenseAssignment.Read.All` hinzufuegen.
- Danach `Grant admin consent` fuer den Tenant ausfuehren.

### 4. Admin Consent bestaetigen

Der Client-Credentials-Flow arbeitet ohne Benutzerkontext. Deshalb braucht die App einen Tenant-weiten Admin-Consent fuer die Application Permission.

Ohne Admin-Consent kann zwar eine Tokenanforderung erfolgen, der Graph-Aufruf scheitert aber mit Autorisierungsfehlern.

## Authentifizierungsfluss

Der aktuelle Server authentifiziert sich als Anwendung, nicht als Benutzer.

### Ablauf

1. `scripts/static-server.js` laedt `.env`.
2. Der Server sendet eine Tokenanforderung an:
   `https://login.microsoftonline.com/{M365_TENANT_ID}/oauth2/v2.0/token`
3. Die Anfrage verwendet:
   - `grant_type=client_credentials`
   - `client_id={M365_CLIENT_ID}`
   - `client_secret={M365_CLIENT_SECRET_VALUE}`
   - `scope=https://graph.microsoft.com/.default`
4. Microsoft Entra ID liefert ein App-only Bearer Token.
5. Mit diesem Token wird `GET /subscribedSkus` gegen Microsoft Graph ausgefuehrt.

## Warum Application Permissions und keine Delegated Permissions

- Der lokale Server laeuft als Backend-Dienst.
- Es gibt aktuell keinen echten Benutzer-Login im Frontend.
- Der Code verwendet explizit den Client-Credentials-Flow.
- Deshalb passt `Application permissions` technisch zum aktuellen Design.

Delegated Permissions waeren nur sinnvoll, wenn spaeter ein echter Benutzerkontext mit Entra-Login, Redirect-Flow und Benutzer-Token eingefuehrt wird.

## Typische Fehlerbilder

- `missing_configuration`:
  Mindestens eine der Variablen `M365_TENANT_ID`, `M365_CLIENT_ID` oder `M365_CLIENT_SECRET_VALUE` fehlt oder enthaelt noch Platzhalter.
- `Token request failed (401|400)`:
  Tenant-ID, Client-ID oder Secret stimmt nicht, ist abgelaufen oder falsch kodiert.
- `Graph request failed (403)`:
  Meist fehlt `LicenseAssignment.Read.All` oder der Admin-Consent wurde nicht erteilt.
- `Graph request failed (401)`:
  Das Access Token ist ungueltig oder konnte nicht korrekt beschafft werden.

## Sicherheitsnotizen

- Die aktuelle `.env` enthaelt ein echtes Secret und sollte nur bewusst in ein Remote-Repository gepusht werden.
- Wenn das Zielrepository oeffentlich oder fuer Dritte zugreifbar ist, sollte das Secret unmittelbar danach in Entra rotiert werden.
- Fuer produktive Umgebungen sollte das Secret nicht im Repository liegen, sondern ueber Deployment- oder Secret-Management bereitgestellt werden.

## Abgrenzung zur Frontend-Authentifizierung

- Die Dokumentation hier beschreibt die Server-zu-Server-Authentifizierung des lokalen Node-Servers.
- Der sichtbare Login in der Weboberflaeche ist weiterhin nur simuliert.
- Eine spaetere echte Benutzeranmeldung wuerde separat ueber Microsoft Entra ID, OpenID Connect und einen Frontend- oder BFF-Flow dokumentiert werden.