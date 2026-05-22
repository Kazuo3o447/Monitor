# 0005 Multi-source connector pattern

## Status
Accepted

## Kontext
Neben Microsoft 365 sollen spaeter weitere Quellen wie Adobe UMA, GitHub Enterprise und Atlassian Cloud eingebunden werden.

## Entscheidung
Es wird ein Connector-Interface eingefuehrt, das pro Quelle konsistente Leseoperationen bereitstellt.

## Konsequenzen
- Erweiterbarkeit ohne harte Kopplung an Einzelquellen.
- Einheitliche Fehlerbehandlung und Normalisierung.
- Schrittweise Aktivierung neuer Quellen pro Phase.

## Alternativen
- Quellenspezifische Sonderlogik im Core: verworfen wegen Wartungsrisiko.
- Einmalige Big-Bang-Integration aller Quellen: verworfen wegen Risiko.
