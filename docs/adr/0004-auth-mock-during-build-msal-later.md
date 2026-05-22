# 0004 Auth mock during build, MSAL later

## Status
Accepted

## Kontext
Waerend der Ausbauphase wird zunaechst kein produktiver Benutzerlogin benoetigt. Gleichzeitig soll spaeter echter Entra-Login ohne Rework integrierbar sein.

## Entscheidung
Es wird ein Mock-Auth-Provider mit stabilem Interface verwendet. MSAL.js wird spaeter als zweite Implementierung desselben Interfaces angedockt.

## Konsequenzen
- Kein Throwaway-Code in der Auth-Schicht.
- Schnellere Umsetzung in fruehen Phasen.
- Klarer Migrationspfad zu echtem Login.

## Alternativen
- Sofortige MSAL-Integration: verworfen fuer fruehe Projektphasen.
- Keine Auth-Abstraktion: verworfen wegen spaeterem Umbauaufwand.
