#!/bin/bash
# AuraControl Cockpit - Host-Prüfung einrichten (einmalig, auf dem SERVER, nicht im Container):
#     sudo bash install-hostcheck.sh
# Legt das Skript nach /usr/local/bin/aura-hostcheck und richtet einen täglichen Systemdienst (Timer) ein. Danach erscheinen im
# Cockpit offene Updates und "Neustart nötig". Wieder entfernen: siehe ../README.md.
set -e
[ "$(id -u)" = "0" ] || { echo "Bitte mit sudo ausführen:  sudo bash $0"; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="${AURA_INSTALL_ROOT:-}"            # nur zum Ausprobieren: alles unter diesen Ordner schreiben
BIN="$ROOT/usr/local/bin"
UNITDIR="$ROOT/etc/systemd/system"
DATA="$ROOT/var/lib/aura-cockpit"

mkdir -p "$BIN" "$UNITDIR" "$DATA"
install -m 755 "$HERE/aura-hostcheck.sh" "$BIN/aura-hostcheck"
chmod 755 "$DATA"

cat > "$UNITDIR/aura-hostcheck.service" <<'UNIT'
[Unit]
Description=AuraControl Cockpit - Host-Prüfung (offene Updates, Neustart nötig)
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/aura-hostcheck
Nice=10
IOSchedulingClass=idle
UNIT

cat > "$UNITDIR/aura-hostcheck.timer" <<'UNIT'
[Unit]
Description=AuraControl Cockpit - Host-Prüfung täglich

[Timer]
OnBootSec=5min
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=15min
Persistent=true

[Install]
WantedBy=timers.target
UNIT

if [ "${AURA_INSTALL_NO_SYSTEMD:-0}" != "1" ]; then
    systemctl daemon-reload
    systemctl enable --now aura-hostcheck.timer
    systemctl start aura-hostcheck.service || echo "Hinweis: Der erste Durchlauf ist fehlgeschlagen. Ansehen mit: journalctl -u aura-hostcheck"
fi
echo "Fertig. Ergebnis: $DATA/host-status.json  (erscheint im Cockpit unter 'Updates des Servers')"
