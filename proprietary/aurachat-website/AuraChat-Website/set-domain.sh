#!/bin/bash
# Ändert die Adresse der Website an allen Stellen für Google (Canonical, Social-Vorschau, strukturierte Daten, Sitemap, robots.txt).
# Aufruf im Ordner der Website:   bash set-domain.sh https://meine-adresse.ch
# Nur die Adresse, ohne Pfad und ohne Schrägstrich am Ende. Die Dateien werden an Ort und Stelle geändert (Änderung an index.html wirkt sofort,
# weil der Ordner html/ eingebunden ist).
set -euo pipefail
NEW="${1:-}"
if ! [[ "$NEW" =~ ^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?$ ]]; then
    echo "Bitte genau eine Adresse angeben, mit https:// und ohne Pfad und ohne Schrägstrich am Ende, z.B.: bash set-domain.sh https://aurachat.example.ch" >&2
    exit 1
fi
DIR="$(cd "$(dirname "$0")" && pwd)/html"
OLD="$(grep -o '<link rel="canonical" href="[^"]*"' "$DIR/index.html" | head -1 | sed 's/.*href="//; s/\/\?"$//')"
if [ -z "$OLD" ]; then echo "Die bisherige Adresse (canonical) wurde in $DIR/index.html nicht gefunden." >&2; exit 1; fi
if [ "$OLD" = "$NEW" ]; then echo "Die Adresse ist schon $NEW - nichts zu ändern."; exit 0; fi
# ERST alles prüfen, DANN ändern: fehlt eine Datei, bleibt alles unverändert (kein halber Zustand mit gemischten Adressen)
for f in index.html robots.txt sitemap.xml; do
    [ -f "$DIR/$f" ] || { echo "Datei fehlt: $DIR/$f - es wurde nichts geändert." >&2; exit 1; }
done
for f in index.html robots.txt sitemap.xml; do
    sed -i "s|$OLD|$NEW|g" "$DIR/$f"
done
echo "Adresse geändert: $OLD -> $NEW"
echo "In index.html, robots.txt und sitemap.xml. Danach die Sitemap in der Google Search Console neu einreichen: $NEW/sitemap.xml"
