#!/bin/bash
# AuraCall - Ersteinrichtung: erzeugt die Datei .env mit einem zufälligen Passwort für die Steuerung von Asterisk und legt die Ordner an.
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f .env ]] && grep -Eq '^AMI_SECRET=[A-Za-z0-9_-]{16,}' .env; then
  echo "Die Datei .env mit AMI_SECRET gibt es schon - sie bleibt unverändert."
else
  if command -v openssl >/dev/null 2>&1; then secret="$(openssl rand -hex 24)"; else secret="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"; fi
  [[ ${#secret} -ge 32 ]] || { echo "FEHLER: Es konnte kein Zufallswert erzeugt werden." >&2; exit 1; }
  if [[ -f .env ]]; then grep -v '^AMI_SECRET=' .env > .env.tmp || true; else cp .env.example .env.tmp; grep -v '^AMI_SECRET=' .env.tmp > .env.tmp2 && mv .env.tmp2 .env.tmp; fi
  { echo "AMI_SECRET=${secret}"; cat .env.tmp; } > .env; rm -f .env.tmp
  chmod 600 .env; echo "Die Datei .env wurde angelegt (nur für Sie lesbar)."
fi

mkdir -p data asterisk-conf
# Beide Container laufen mit der Benutzerkennung 1000; die gemeinsamen Ordner müssen ihr gehören
if [[ "$(id -u)" == "0" ]]; then chown 1000:1000 data asterisk-conf; chmod 750 data asterisk-conf
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then sudo chown 1000:1000 data asterisk-conf; sudo chmod 750 data asterisk-conf
else echo "HINWEIS: Bitte einmal ausführen:  sudo chown 1000:1000 data asterisk-conf && sudo chmod 750 data asterisk-conf"; fi

echo
echo "Nächste Schritte:"
echo "  1. docker compose build && docker compose up -d"
echo "  2. Anfangspasswort ansehen:  docker compose logs auracall | grep 'Erster Start'"
echo "  3. Im Browser öffnen:  http://<Server-Adresse>:8110   (Benutzer: admin)"
echo "  4. Der Einrichtungs-Checkliste auf der Übersicht folgen."
