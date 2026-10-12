#!/bin/bash
# AuraCall - Start von Asterisk: Grundkonfiguration bereitstellen, Passwort für die Steuerung einsetzen, dann starten.
set -euo pipefail
ETC="${ASTERISK_ETC:-/etc/asterisk}"
SRC="${AURACALL_ETC_SRC:-/opt/auracall-etc}"

# Das Passwort für die Steuerung (AMI) kommt aus der Umgebung. Es darf nur sichere Zeichen enthalten (so kann es keine Zeile in die Konfiguration einschleusen).
if [[ -z "${AMI_SECRET:-}" ]]; then echo "FEHLER: AMI_SECRET ist nicht gesetzt. Bitte ./setup.sh ausführen oder die .env prüfen." >&2; exit 1; fi
if [[ ! "${AMI_SECRET}" =~ ^[A-Za-z0-9_-]{16,128}$ ]]; then echo "FEHLER: AMI_SECRET darf nur Buchstaben, Ziffern, _ und - enthalten (16 bis 128 Zeichen)." >&2; exit 1; fi

mkdir -p "$ETC/auracall"
# Unsere Grundkonfiguration gehört dem Programm und wird bei jedem Start neu gesetzt (Änderungen gehören in die Dateien *_custom.conf bzw. in die Verwaltung von AuraCall)
for f in pjsip.conf extensions.conf manager.conf rtp.conf modules.conf logger.conf http.conf; do
  if [[ -f "$SRC/$f" ]]; then cp -f "$SRC/$f" "$ETC/$f"; fi
done
sed -i "s/__AMI_SECRET__/${AMI_SECRET}/" "$ETC/manager.conf"
chmod 0640 "$ETC/manager.conf" 2>/dev/null || true
for f in pjsip_custom.conf extensions_custom.conf; do [[ -f "$ETC/$f" ]] || : > "$ETC/$f"; done

# Nur Konfiguration erzeugen (für Tests)
if [[ "${AURACALL_RENDER_ONLY:-}" == "1" ]]; then exit 0; fi

# Kurz nach dem Start prüfen und ins Protokoll schreiben, ob alles Nötige geladen ist
( sleep 12
  for m in res_pjsip res_audiosocket app_audiosocket app_userevent func_md5; do
    if asterisk -rx "module show like $m" 2>/dev/null | grep -q "$m"; then echo "AURACALL-PRÜFUNG: Modul $m geladen"; else echo "AURACALL-PRÜFUNG: WARNUNG - Modul $m NICHT geladen"; fi
  done ) &

exec asterisk -f -vvv
