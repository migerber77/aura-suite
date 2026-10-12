#!/bin/bash
# AuraChat Cockpit - Host-Prüfung
# Schreibt, welche Updates auf dem Server offen sind (davon Sicherheits-Updates) und ob ein Neustart nötig ist, in die Datei
#   /var/lib/aura-cockpit/host-status.json
# Das Cockpit liest sie über den Cockpit-Agenten. Läuft täglich (Installation: install-hostcheck.sh), braucht Root-Rechte.
# Es wird nichts installiert oder verändert - nur nachgeschaut.
#
# Zum Ausprobieren einstellbar (Umgebungsvariablen): AURA_HOSTCHECK_DIR, AURA_REBOOT_FLAG, AURA_OS_RELEASE
set -u
OUT_DIR="${AURA_HOSTCHECK_DIR:-/var/lib/aura-cockpit}"
OUT="$OUT_DIR/host-status.json"
REBOOT_FLAG="${AURA_REBOOT_FLAG:-/var/run/reboot-required}"
OS_RELEASE="${AURA_OS_RELEASE:-/etc/os-release}"

mkdir -p "$OUT_DIR" || { echo "Ordner $OUT_DIR kann nicht angelegt werden" >&2; exit 1; }
chmod 755 "$OUT_DIR" 2>/dev/null || true

# Text für JSON sichern: Anführungszeichen und Rückstriche maskieren, Steuerzeichen entfernen
json_escape() { printf '%s' "$1" | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

upgradable=0
security=0
packages=""
listed=0

if command -v apt >/dev/null 2>&1; then
    # Paketlisten auffrischen. Schlägt das fehl (z.B. kein Internet), gelten die zuletzt geladenen Listen.
    apt-get update -qq >/dev/null 2>&1 || true
    while IFS= read -r line; do
        case "$line" in *"[upgradable from:"*) ;; *) continue ;; esac   # nur echte Paketzeilen (die Kopfzeile "Listing..." fällt weg, in jeder Sprache)
        read -r first version _rest <<< "$line"
        name="${first%%/*}"
        suites="${first#*/}"
        upgradable=$((upgradable + 1))
        case "$suites" in
            *-security*)
                security=$((security + 1))
                if [ "$listed" -lt 10 ]; then
                    [ -n "$packages" ] && packages="$packages,"
                    packages="$packages{\"name\":\"$(json_escape "$name")\",\"version\":\"$(json_escape "$version")\"}"
                    listed=$((listed + 1))
                fi
                ;;
        esac
    done < <(LC_ALL=C apt list --upgradable 2>/dev/null)
fi

reboot=false
[ -e "$REBOOT_FLAG" ] && reboot=true

os_name=""
[ -r "$OS_RELEASE" ] && os_name="$(. "$OS_RELEASE" 2>/dev/null; printf '%s' "${PRETTY_NAME:-}")"
kernel="$(uname -r 2>/dev/null || true)"

tmp="$(mktemp "$OUT_DIR/.host-status.XXXXXX")" || exit 1
printf '{"updatedAt":"%s","os":"%s","kernel":"%s","upgradable":%d,"securityUpgradable":%d,"rebootRequired":%s,"securityPackages":[%s]}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(json_escape "$os_name")" "$(json_escape "$kernel")" "$upgradable" "$security" "$reboot" "$packages" > "$tmp"
chmod 644 "$tmp"
mv -f "$tmp" "$OUT"
