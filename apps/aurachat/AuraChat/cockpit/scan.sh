#!/bin/sh
# AuraChat Cockpit - Schwachstellen-Scan mit Trivy.
# Läuft IM Trivy-Container (wird vom Cockpit-Agenten ausgeliefert, siehe docker-compose.yml). Holt beim Agenten die Liste der
# Docker-Images dieses Servers, prüft jedes mit Trivy und legt je Image einen Bericht (JSON) in /reports ab, den der
# Agent für das Cockpit liest. Danach wartet es und wiederholt alles (Standard: alle 24 Stunden).
#
# Einstellungen (Umgebungsvariablen):
#   SCAN_INTERVAL_HOURS   Abstand zwischen zwei Durchläufen, Standard 24
#   SCAN_ONCE=1           nur einmal durchlaufen und beenden (zum Ausprobieren)
#   COCKPIT_AGENT_URL     Adresse des Agenten, Standard http://cockpit:3600
INTERVAL_H="${SCAN_INTERVAL_HOURS:-24}"
AGENT="${COCKPIT_AGENT_URL:-http://cockpit:3600}"
TOKEN_FILE="${COCKPIT_TOKEN_FILE:-/shared/token}"
REPORTS="${COCKPIT_REPORTS:-/reports}"
LIST="${SCAN_LIST_FILE:-/tmp/aura-images.txt}"

safe_name() { echo "$1" | sed 's/[^A-Za-z0-9._-]/_/g'; }

mkdir -p "$REPORTS"
while true; do
    TOKEN="$(cat "$TOKEN_FILE" 2>/dev/null)"
    if wget -q -O "$LIST" --header "Authorization: Bearer $TOKEN" "$AGENT/images.txt"; then
        echo "Scan beginnt: $(wc -l < "$LIST") Image(s)"
        while IFS= read -r img; do
            [ -z "$img" ] && continue
            safe="$(safe_name "$img")"
            echo "Scan: $img"
            if trivy image --quiet --scanners vuln --format json --timeout 20m --output "$REPORTS/$safe.json.tmp" "$img"; then
                mv -f "$REPORTS/$safe.json.tmp" "$REPORTS/$safe.json"
            else
                echo "Scan fehlgeschlagen: $img (alter Bericht bleibt erhalten)"
                rm -f "$REPORTS/$safe.json.tmp"
            fi
        done < "$LIST"
        # Berichte von Images aufräumen, die es nicht mehr gibt
        for f in "$REPORTS"/*.json; do
            [ -e "$f" ] || continue
            base="$(basename "$f" .json)"
            found=0
            while IFS= read -r img; do
                [ -z "$img" ] && continue
                [ "$(safe_name "$img")" = "$base" ] && found=1
            done < "$LIST"
            [ "$found" = 1 ] || { echo "Entferne Bericht ohne Image: $base"; rm -f "$f"; }
        done
        echo "Scan fertig."
    else
        echo "Der Cockpit-Agent ist nicht erreichbar - es wird später erneut versucht."
    fi
    [ "${SCAN_ONCE:-0}" = "1" ] && exit 0
    sleep $((INTERVAL_H * 3600))
done
