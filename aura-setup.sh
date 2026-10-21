#!/usr/bin/env bash
# =====================================================================================================================
#  Aura-Suite Setup  -  Assistent zum Durchklicken: installiert Docker (falls nötig), legt die Ordner an, erzeugt die .env
#  mit allen Schlüsseln und Passwörtern, holt die Docker-Images und startet die gewählten Produkte.
#
#  Aufruf (als root oder mit sudo):   sudo bash aura-setup.sh
#  Ohne Fragen (Standardwerte):        sudo bash aura-setup.sh --yes [--dir /srv/aura-suite] [--products chat,plan,...]
#                                                                    [--license-secret WERT] [--ip 10.0.55.160] [--no-start]
#  Hilfe:                              bash aura-setup.sh --help
#
#  Erneut ausführen ist sicher: Vorhandene Schlüssel und Passwörter in der .env werden NIE überschrieben (sonst wären
#  verschlüsselte Daten verloren), vorhandene Datenordner bleiben unberührt. So lassen sich Produkte später dazunehmen.
#  Gerber Backoffice Solutions · info@gerber-backoffice-solutions.com
# =====================================================================================================================
set -Eeuo pipefail
umask 077

SETUP_VERSION="1.0.0"
TITLE="Aura-Suite Setup ${SETUP_VERSION}"
DEFAULT_DIR="/srv/aura-suite"
ALL_PRODUCTS="chat plan ticket mail direct proxy call control"     # Reihenfolge der Auswahl
REQUIRED_PRODUCTS="direct control"                                 # zentrale Benutzer (AuraDirect) und Lizenz/Übersicht (AuraControl)

# ---------------------------------------------------------------------------------------------------------------- Optionen
OPT_YES=0; OPT_DIR=""; OPT_PRODUCTS=""; OPT_SECRET=""; OPT_IP=""; OPT_START=1; OPT_SKIP_DOCKER=0
usage() {
  cat <<'USAGE'
Aura-Suite Setup

  sudo bash aura-setup.sh                 Assistent zum Durchklicken
  sudo bash aura-setup.sh --yes           ohne Fragen, mit Standardwerten

Optionen:
  --yes, -y                 keine Fragen stellen (Standardwerte bzw. die folgenden Angaben)
  --dir PFAD                Installationsordner (Standard: /srv/aura-suite)
  --products LISTE          z. B. chat,plan,ticket,mail,direct,proxy,call,control  (zusätzlich: voice, scan, vendor)
                            AuraDirect und AuraControl sind immer dabei.
  --license-secret WERT     Lizenz-Geheimnis (LICENSE_SECRET), wie vom Hersteller erhalten
  --ip ADRESSE              Adresse dieses Servers für die Zugangsübersicht (Standard: automatisch)
  --no-start                nur Ordner und Dateien anlegen, keine Images holen und nichts starten
  --skip-docker-install     Docker nicht installieren, nur prüfen
  --help, -h                diese Hilfe
USAGE
}
while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes) OPT_YES=1 ;;
    --dir) OPT_DIR="${2:-}"; shift ;;
    --products) OPT_PRODUCTS="${2:-}"; shift ;;
    --license-secret) OPT_SECRET="${2:-}"; shift ;;
    --ip) OPT_IP="${2:-}"; shift ;;
    --no-start) OPT_START=0 ;;
    --skip-docker-install) OPT_SKIP_DOCKER=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unbekannte Option: $1 (siehe --help)" >&2; exit 2 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------------------------------------------- Ausgabe
if [[ -t 1 ]]; then C_B=$'\e[1m'; C_G=$'\e[32m'; C_Y=$'\e[33m'; C_R=$'\e[31m'; C_C=$'\e[36m'; C_0=$'\e[0m'; else C_B=""; C_G=""; C_Y=""; C_R=""; C_C=""; C_0=""; fi
say()  { printf '%s\n' "${C_C}==>${C_0} ${C_B}$*${C_0}"; }
ok()   { printf '%s\n' "  ${C_G}✓${C_0} $*"; }
warn() { printf '%s\n' "  ${C_Y}!${C_0} $*"; }
die()  { printf '%s\n' "${C_R}Fehler:${C_0} $*" >&2; exit 1; }
trap 'rc=$?; [[ $rc -ne 0 && $BASH_SUBSHELL -eq 0 ]] && printf "%s\n" "${C_R}Das Setup wurde abgebrochen (Zeile ${LINENO}, Code ${rc}). Es kann gefahrlos erneut gestartet werden.${C_0}" >&2' ERR

# ---------------------------------------------------------------------------------------------------------------- Dialoge
# whiptail (Pfeiltasten, Leertaste, Enter), sonst einfache Fragen im Terminal. Mit --yes werden keine Fragen gestellt.
INTERACTIVE=1; [[ $OPT_YES -eq 1 ]] && INTERACTIVE=0
[[ $INTERACTIVE -eq 1 && ! -t 0 ]] && { exec </dev/tty 2>/dev/null || INTERACTIVE=0; }   # auch bei "curl ... | sudo bash"
HAVE_WT=0
ui_init() { command -v whiptail >/dev/null 2>&1 && HAVE_WT=1 || HAVE_WT=0; }
H=20; W=76
ui_msg() {   # Titel, Text
  if [[ $INTERACTIVE -eq 0 ]]; then printf '%b\n' "$2" | sed 's/^/  /'; return 0; fi
  if [[ $HAVE_WT -eq 1 ]]; then whiptail --title "$1" --msgbox "$2" $H $W; else printf '\n%s\n%b\n' "${C_B}$1${C_0}" "$2"; read -r -p "Weiter mit Enter … " _; fi
}
ui_yesno() { # Titel, Text, Vorgabe (yes/no)  -> 0 = ja
  if [[ $INTERACTIVE -eq 0 ]]; then [[ "${3:-yes}" == yes ]]; return; fi
  if [[ $HAVE_WT -eq 1 ]]; then if [[ "${3:-yes}" == no ]]; then whiptail --title "$1" --defaultno --yes-button "Ja" --no-button "Nein" --yesno "$2" $H $W; else whiptail --title "$1" --yes-button "Ja" --no-button "Nein" --yesno "$2" $H $W; fi; return; fi
  local a d="J/n"; [[ "${3:-yes}" == no ]] && d="j/N"; printf '\n%s\n%b\n' "${C_B}$1${C_0}" "$2"; read -r -p "[$d] " a
  a="${a:-$([[ "${3:-yes}" == no ]] && echo n || echo j)}"; [[ "$a" =~ ^[JjYy] ]]
}
ui_input() { # Titel, Text, Vorgabe  -> Ausgabe
  if [[ $INTERACTIVE -eq 0 ]]; then printf '%s' "$3"; return 0; fi
  if [[ $HAVE_WT -eq 1 ]]; then whiptail --title "$1" --inputbox "$2" $H $W "$3" 3>&1 1>&2 2>&3; return; fi
  local a; printf '\n%s\n%b\n' "${C_B}$1${C_0}" "$2" >&2; read -r -p "[$3] " a; printf '%s' "${a:-$3}"
}
ui_checklist() { # Titel, Text, dann Tripel (Kennung, Beschreibung, on/off)  -> Ausgabe: Kennungen mit Leerzeichen
  local title="$1" text="$2"; shift 2
  if [[ $INTERACTIVE -eq 0 ]]; then local out=""; while [[ $# -gt 0 ]]; do [[ "$3" == on ]] && out+="$1 "; shift 3; done; printf '%s' "$out"; return 0; fi
  if [[ $HAVE_WT -eq 1 ]]; then whiptail --title "$title" --separate-output --checklist "$text" $H $W 11 "$@" 3>&1 1>&2 2>&3 | tr '\n' ' '; return "${PIPESTATUS[0]}"; fi
  local out="" a; printf '\n%s\n%b\n' "${C_B}$title${C_0}" "$text" >&2
  while [[ $# -gt 0 ]]; do read -r -p "  $2 [$([[ "$3" == on ]] && echo J/n || echo j/N)] " a </dev/tty; a="${a:-$([[ "$3" == on ]] && echo j || echo n)}"; [[ "$a" =~ ^[JjYy] ]] && out+="$1 "; shift 3; done
  printf '%s' "$out"
}
abort_if_cancel() { [[ $1 -eq 0 ]] || { echo; warn "Abgebrochen. Es wurde nichts verändert, was nicht schon da war."; exit 1; }; }

# ---------------------------------------------------------------------------------------------------------------- Hilfen
gen_hex() { od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'; }                       # Zufallswert in Hex (n Bytes)
gen_pw()  { local p; while :; do p="$(head -c 600 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-18)"; [[ ${#p} -eq 18 && "$p" =~ [A-Z] && "$p" =~ [a-z] && "$p" =~ [0-9] && ! "${p,,}" =~ admin ]] && break; done; printf '%s' "$p"; }   # 18 Zeichen, gross/klein/Ziffer
has() { [[ " $PRODUCTS " == *" $1 "* ]]; }
detect_ip() { local ip=""; ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')" || true; [[ -z "$ip" ]] && ip="$(hostname -I 2>/dev/null | awk '{print $1}')"; printf '%s' "${ip:-127.0.0.1}"; }
detect_tz() { local tz=""; tz="$(timedatectl show -p Timezone --value 2>/dev/null || true)"; [[ -z "$tz" && -L /etc/localtime ]] && tz="$(readlink /etc/localtime | sed 's|.*/zoneinfo/||')"; printf '%s' "${tz:-Europe/Zurich}"; }
os_id() { ( . /etc/os-release 2>/dev/null; printf '%s %s' "${ID:-unbekannt}" "${ID_LIKE:-}" ); }

# ---------------------------------------------------------------------------------------------------------------- Docker
install_whiptail() {
  [[ $INTERACTIVE -eq 1 ]] || return 0
  command -v whiptail >/dev/null 2>&1 && return 0
  if command -v apt-get >/dev/null 2>&1; then apt-get install -y -qq whiptail >/dev/null 2>&1 || true
  elif command -v dnf >/dev/null 2>&1; then dnf -y -q install newt >/dev/null 2>&1 || true
  elif command -v yum >/dev/null 2>&1; then yum -y -q install newt >/dev/null 2>&1 || true; fi
}
docker_ok()  { command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; }
compose_ok() { docker compose version >/dev/null 2>&1; }
install_docker() {
  local ids; ids="$(os_id)"
  say "Docker wird installiert ($ids)"
  case " $ids " in
    *" ubuntu "*|*" debian "*)
      local dist; dist="$( . /etc/os-release; [[ "$ID" == ubuntu || "$ID" == debian ]] && echo "$ID" || { [[ " $ID_LIKE " == *" ubuntu "* ]] && echo ubuntu || echo debian; } )"
      local code; code="$( . /etc/os-release; echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}" )"
      apt-get update -qq
      apt-get install -y -qq ca-certificates curl gnupg >/dev/null
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL "https://download.docker.com/linux/${dist}/gpg" -o /etc/apt/keyrings/docker.asc
      chmod a+r /etc/apt/keyrings/docker.asc
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${dist} ${code} stable" > /etc/apt/sources.list.d/docker.list
      apt-get update -qq
      apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin ;;
    *" fedora "*|*" rhel "*|*" centos "*|*" rocky "*|*" almalinux "*)
      local repo="rhel"; [[ " $ids " == *" fedora "* && " $ids " != *" rhel "* ]] && repo="fedora"; [[ " $ids " == *" centos "* && " $ids " != *" rhel "* ]] && repo="centos"
      dnf -y install dnf-plugins-core >/dev/null 2>&1 || true
      dnf config-manager --add-repo "https://download.docker.com/linux/${repo}/docker-ce.repo" 2>/dev/null \
        || dnf config-manager addrepo --from-repofile="https://download.docker.com/linux/${repo}/docker-ce.repo"
      dnf -y install --allowerasing docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin ;;
    *)
      ui_yesno "Docker installieren" "Dieses System ($ids) kennt das Setup nicht direkt.\n\nSoll das offizielle Installationsskript von Docker (get.docker.com) verwendet werden?" no \
        || die "Bitte Docker Engine und das Compose-Plugin selbst installieren und das Setup danach erneut starten."
      curl -fsSL https://get.docker.com | sh ;;
  esac
  systemctl enable --now docker >/dev/null 2>&1 || service docker start || true
  docker_ok && compose_ok || die "Docker wurde installiert, läuft aber nicht. Bitte 'systemctl status docker' prüfen."
  ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null) und $(docker compose version --short 2>/dev/null | sed 's/^/Compose /') laufen"
}

# ---------------------------------------------------------------------------------------------------------------- Dateien
# Die Compose-Datei der Suite (alle Produkte; welche laufen, bestimmt COMPOSE_PROFILES in der .env)
write_compose() {
  cat > "$1" <<'AURA_COMPOSE_EOF'
# Aura-Suite: erzeugt vom Aura-Suite-Setup (aura-setup.sh). Welche Produkte laufen, steht in der .env unter COMPOSE_PROFILES.
# Produkte später dazunehmen oder weglassen: aura-setup.sh erneut ausführen (die Schlüssel in der .env bleiben erhalten).
# Befehle im Installationsordner:  docker compose ps   ·   docker compose logs -f <dienst>   ·   docker compose pull && docker compose up -d   (Update)

x-env: &env
  TZ: ${TZ:-Europe/Zurich}
  AURA_SUITE_VERSION: ${AURA_SUITE_VERSION:-}        # optional: erscheint in allen Anwendungen unter "Über Aura-Suite"
  LICENSE_CHECKIN_HOST: ${LICENSE_CHECKIN_HOST:-}      # anonyme Rückmeldung an den Lizenzserver (nicht abschaltbar; leer = Standard des Herstellers, nur für einen EIGENEN Lizenzserver ändern)
  LICENSE_SYNC_URL: ${LICENSE_SYNC_URL:-}              # Suite-Lizenz automatisch von AuraControl holen (leer = AuraControl auf diesem Rechner, Port 8000; "-" schaltet ab)

services:
  # ---------------------------------------------------------------- AuraChat (Oberfläche + Server + Suche; https übernimmt der AuraProxy)
  chat:
    profiles: ["chat"]
    image: migerber77/aura-suite:chat                 # nginx mit der Oberfläche (innen Port 80)
    restart: unless-stopped
    ports:
      - "8091:80"
    environment: *env
    depends_on:
      - chat-backend
    networks:
      chat:
        aliases: [aurachat]

  chat-backend:
    profiles: ["chat"]
    image: ${CHAT_BACKEND_IMAGE:-migerber77/aurachat:backend}   # Node-Server (innen Port 3000), nginx erwartet ihn unter dem Namen "backend". MUSS aus dem neuen AuraChat.zip neu gebaut sein (Apaleo-OAuth, Kamera, Haltezeit)
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"   # AuraControl auf diesem Rechner: Suite-Lizenz abholen
    environment:
      <<: *env
      NODE_ENV: production
      SESSION_SECRET: ${CHAT_SESSION_SECRET:?CHAT_SESSION_SECRET fehlt}
      DISPOSITION_ENCRYPTION_KEY: ${CHAT_DISPOSITION_KEY:?CHAT_DISPOSITION_KEY fehlt}
      LICENSE_SECRET: ${LICENSE_SECRET:?LICENSE_SECRET fehlt}
      OLLAMA_TIMEOUT_MINUTES: ${OLLAMA_TIMEOUT_MINUTES:-20}
      OLLAMA_MAX_TOKENS: ${OLLAMA_MAX_TOKENS:-2048}
      APALEO_CONNECT_URL: ${APALEO_CONNECT_URL:-}     # Apaleo: Verbinden per Knopf über den Vermittler (leer = Standard des Herstellers)
      APALEO_RETURN_BASE: ${APALEO_RETURN_BASE:-}     # nur hinter einem Proxy: öffentliche Adresse von AuraChat
    volumes:
      - ./data/chat:/app/data
      - chat_models:/app/models
      - chat_hf_cache:/root/.cache/huggingface
    networks:
      chat:
        aliases: [backend]

  searxng:
    profiles: ["chat"]
    image: migerber77/aurachat:searxng
    restart: unless-stopped
    environment: *env
    networks: [chat]

  tts-stt:
    image: ghcr.io/speaches-ai/speaches:latest-cpu
    profiles: ["voice"]
    restart: unless-stopped
    ports:
      - "8096:8000"
    environment:
      <<: *env
      WHISPER__COMPUTE_TYPE: int8
      WHISPER__INFERENCE_DEVICE: cpu
      PRELOAD_MODELS: '["Systran/faster-whisper-small","speaches-ai/piper-de_DE-kerstin-low"]'
    volumes:
      - tts_stt_cache:/home/ubuntu/.cache/huggingface/hub
    networks: [chat]

  piper:
    image: rhasspy/wyoming-piper:latest
    profiles: ["voice"]
    restart: unless-stopped
    command: ${PIPER_ARGS:---voice de_DE-kerstin-low}
    environment: *env
    volumes:
      - piper_data:/data
    networks: [chat]

  # ---------------------------------------------------------------- AuraPlan
  plan:
    profiles: ["plan"]
    image: migerber77/aura-suite:plan
    restart: unless-stopped
    ports:
      - "3002:3002"                                   # innen Port 3002 (vorher 3002:3000: dort hört AuraPlan nicht)
    extra_hosts:
      - "host.docker.internal:host-gateway"   # AuraControl auf diesem Rechner: Suite-Lizenz abholen
    environment:
      <<: *env
      SESSION_SECRET: ${PLAN_SESSION_SECRET:?PLAN_SESSION_SECRET fehlt}
      LICENSE_SECRET: ${LICENSE_SECRET:?LICENSE_SECRET fehlt}
    volumes:
      - ./data/plan:/app/data

  # ---------------------------------------------------------------- AuraTicket
  ticket:
    profiles: ["ticket"]
    image: migerber77/aura-suite:ticket
    restart: unless-stopped
    ports:
      - "3400:3000"
    extra_hosts:
      - "host.docker.internal:host-gateway"   # AuraControl auf diesem Rechner: Suite-Lizenz abholen
    environment:
      <<: *env
      SESSION_SECRET: ${TICKET_SESSION_SECRET:?TICKET_SESSION_SECRET fehlt}
      LICENSE_SECRET: ${LICENSE_SECRET:?LICENSE_SECRET fehlt}
    volumes:
      - ./data/ticket:/app/data

  # ---------------------------------------------------------------- AuraMail
  mail:
    profiles: ["mail"]
    image: migerber77/aura-suite:mail
    restart: unless-stopped
    ports:
      - "2525:2525"                                   # interner Mailserver-Empfang (nur im Modus "internal")
      - "3300:3000"                                   # Web-Oberfläche
    extra_hosts:
      - "host.docker.internal:host-gateway"   # AuraControl auf diesem Rechner: Suite-Lizenz abholen
    environment:
      <<: *env
      SESSION_SECRET: ${MAIL_SESSION_SECRET:?MAIL_SESSION_SECRET fehlt}
      CREDENTIAL_ENCRYPTION_KEY: ${MAIL_ENCRYPTION_KEY:?MAIL_ENCRYPTION_KEY fehlt}
      LICENSE_SECRET: ${LICENSE_SECRET:?LICENSE_SECRET fehlt}
      INTERNAL_SMTP_PORT: "2525"
    volumes:
      - ./data/mail:/app/data

  # ---------------------------------------------------------------- AuraDirect
  direct:
    profiles: ["direct"]
    image: migerber77/aura-suite:direct
    restart: unless-stopped
    ports:
      - "389:389"                                     # LDAP-Verzeichnisdienst
      - "4000:4000"
    environment:
      <<: *env
      SESSION_SECRET: ${DIRECT_SESSION_SECRET:?DIRECT_SESSION_SECRET fehlt}
      AURADIRECT_ADMIN_PASSWORD: ${DIRECT_ADMIN_PASSWORD:?DIRECT_ADMIN_PASSWORD fehlt}
      AURADIRECT_SERVICE_KEY: ${DIRECT_SERVICE_KEY:?DIRECT_SERVICE_KEY fehlt}
      LICENSE_SECRET: ${LICENSE_SECRET:?LICENSE_SECRET fehlt}
    volumes:
      - ./data/direct:/app/data

  # ---------------------------------------------------------------- AuraProxy (Web-Oberfläche + eigener Caddy als Eingang für alle Dienste)
  proxy:
    profiles: ["proxy"]
    image: migerber77/aura-suite:proxy
    restart: unless-stopped
    ports:
      - "3500:3000"                                   # wie bisher; besser nur lokal: "127.0.0.1:3500:3000" (die Oberfläche steuert den Caddy)
    environment:
      <<: *env
      SESSION_SECRET: ${PROXY_SESSION_SECRET:?PROXY_SESSION_SECRET fehlt}
      LICENSE_SECRET: ${LICENSE_SECRET:?LICENSE_SECRET fehlt}
      CADDY_ADMIN_URL: http://caddy:2019              # "caddy" = proxy-caddy im Netz "edge"
      EXTRA_PORTS: "8090,8092,8093,8094,8095,8097,8099"   # muss genau zu den Ports von proxy-caddy passen
    volumes:
      - ./data/proxy:/app/data
      - proxy_caddy_data:/caddy-data                  # Zertifikate und die eigene Zertifizierungsstelle (CA): lesen, und beim Zurückspielen eines Backups schreiben
      - ./data/proxy-custom-certs:/app/custom-certs   # eigene, hochgeladene Zertifikate pro Domain
    depends_on:
      - proxy-caddy
    networks: [edge]

  proxy-caddy:
    profiles: ["proxy"]
    image: caddy:2-alpine
    restart: unless-stopped
    command: caddy run --config /etc/caddy/init.json
    environment: *env
    ports:
      - "80:80"
      - "443:443"
      - "8090:8090"
      - "8092:8092"
      - "8093:8093"
      - "8094:8094"
      - "8095:8095"
      - "8097:8097"
      - "8099:8099"
    extra_hosts:
      - "host.docker.internal:host-gateway"           # AuraProxy leitet an die veröffentlichten Ports dieses Rechners weiter
    volumes:
      - proxy_caddy_data:/data
      - proxy_caddy_config:/config
      - ./proxy/caddy-init.json:/etc/caddy/init.json:ro   # Datei aus dem Ordner von AuraProxy hierher kopieren
    networks:
      edge:
        aliases: [caddy]

  # ---------------------------------------------------------------- AuraCall (Telefon): braucht das Host-Netzwerk (SIP und Ton)
  call-asterisk:
    profiles: ["call"]
    image: ${CALL_ASTERISK_IMAGE:-migerber77/aura-suite:call-asterisk}   # aus dem Asterisk-Dockerfile von AuraCall.zip bauen und unter diesem Namen veröffentlichen
    restart: unless-stopped
    network_mode: host
    environment:
      <<: *env
      AMI_SECRET: ${CALL_AMI_SECRET:?CALL_AMI_SECRET fehlt (openssl rand -hex 24)}
    volumes:
      - ./data/call-asterisk-conf:/etc/asterisk/auracall:ro   # hier legt AuraCall die Leitung und den Dialplan ab
      - call_asterisk_lib:/var/lib/asterisk
      - call_asterisk_log:/var/log/asterisk
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]

  call:
    profiles: ["call"]
    image: migerber77/aura-suite:call
    restart: unless-stopped
    network_mode: host                                # Verwaltung auf Port 8110 dieses Rechners (CALL_PORT)
    depends_on: [call-asterisk]
    environment:
      <<: *env
      AMI_SECRET: ${CALL_AMI_SECRET:?CALL_AMI_SECRET fehlt (openssl rand -hex 24)}
      AURACALL_PORT: ${CALL_PORT:-8110}
      AURACALL_BIND: ${CALL_BIND:-0.0.0.0}
      TRUST_PROXY: ${CALL_TRUST_PROXY:-false}
      ADMIN_PASSWORD: ${CALL_ADMIN_PASSWORD:-}
      AURACALL_RESET_2FA: ${CALL_RESET_2FA:-}
      LICENSE_SECRET: ${LICENSE_SECRET:?LICENSE_SECRET fehlt}
      LICENSE_CHECKIN_HOST: ${LICENSE_CHECKIN_HOST-auralic.gerber-backoffice-solutions.com}
    volumes:
      - ./data/call:/data
      - ./data/call-asterisk-conf:/asterisk-conf
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    read_only: true
    tmpfs: ["/tmp"]

  # ---------------------------------------------------------------- AuraControl (alle bisherigen Angaben bleiben; neu: Datenordner und Umgebung für Lizenz und Anmeldung)
  auracontrol:
    profiles: ["control"]
    image: ${CONTROL_IMAGE:-migerber77/aura-suite:control}   # AuraControl (der Cockpit-Dienst unten startet dasselbe Image)
    container_name: auracontrol
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      <<: *env
      LICENSE_SECRET: ${LICENSE_SECRET:?LICENSE_SECRET fehlt}
      COCKPIT_URL: http://control-cockpit:3600           # Cockpit (Ansicht "Cockpit"): Adresse des Cockpit-Dienstes, das Passwort legt der Dienst selbst an
      ADMIN_PASSWORD: ${CONTROL_ADMIN_PASSWORD:-}      # optional: Anfangspasswort (mind. 10 Zeichen). Leer = zufälliges Passwort, einmal im Protokoll: docker compose logs auracontrol
      AURADIRECT_URL: ${CONTROL_AURADIRECT_URL:-http://direct:4000}   # Anmeldung mit AuraDirect-Konten (Freigabe "AuraControl" in AuraDirect); Vorgabe beim ersten Start, danach im Admin Panel -> Sicherheit
      AURADIRECT_SERVICE_KEY: ${DIRECT_SERVICE_KEY:-}                # derselbe Dienst-Schlüssel wie bei AuraDirect
    volumes:
      - /srv/backup/rear:/srv/backup/rear
      - ./data/control:/app/data                         # Passwort, Sitzungsschlüssel, Testphase, Lizenz, Einstellungen (sonst geht alles beim Neubau verloren)
      - cockpit_shared:/shared:ro                        # Passwort für den Cockpit-Dienst (nur lesen)
    user: "0:0"   # Lässt den Container als Root laufen
    networks:
      - default
      - cockpit

  # ---------------------------------------------------------------- Cockpit (Ansicht "Cockpit" in AuraControl): Gesundheit des Servers
  # Der Cockpit-Dienst ist ein EIGENER kleiner Container (selbes Image wie AuraControl, Befehl "python cockpit_agent.py"), der als Einziger auf Docker schaut,
  # und zwar nur lesend und nur mit ein paar festen Abfragen (keine Umgebungsvariablen anderer Container, keine Protokolle, keine Dateien). AuraControl
  # (von aussen erreichbar) bekommt KEINEN Zugriff auf Docker. Er hat keinen Port nach aussen, liegt in einem eigenen internen Netz und erzeugt sein
  # Zugangs-Passwort beim ersten Start selbst. Wer den Docker-Socket einbindet (auch nur lesend), gibt diesem Dienst mehr Möglichkeiten als ein normaler
  # Container hat: deshalb ist er klein, nicht von aussen erreichbar und ganz abschaltbar (Block hier löschen, in auracontrol "cockpit_shared" und COCKPIT_URL streichen).
  control-cockpit:
    profiles: ["control"]
    image: ${CONTROL_IMAGE:-migerber77/aura-suite:control}
    container_name: control-cockpit
    command: ["python", "cockpit_agent.py"]
    restart: unless-stopped
    depends_on:
      - auracontrol
    user: "0:0"                      # nötig, um den Docker-Socket (Besitzer root, Modus 660) zu lesen; sonst ohne Sonderrechte (cap_drop ALL)
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    mem_limit: 256m
    environment:
      PYTHONDONTWRITEBYTECODE: "1"
    tmpfs:
      - /tmp
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:3600/health', timeout=4).status == 200 else 1)"]
      interval: 30s
      timeout: 5s
      retries: 3
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro   # nur dieser Dienst, nur lesende Abfragen
      - cockpit_shared:/shared                          # hier legt er sein Passwort ab
      - cockpit_reports:/reports:ro                     # Berichte des Schwachstellen-Scanners
      - /var/lib/aura-cockpit:/hostcheck:ro             # Ergebnis der Host-Prüfung (siehe cockpit/README.md, optional)
    networks:
      - cockpit

  # Schwachstellen-Scanner "Trivy" (OPTIONAL, startet nur mit:  docker compose --profile scan up -d ). Prüft einmal täglich alle Docker-Images dieses Servers
  # und legt die Berichte für das Cockpit ab. Beim ersten Lauf lädt er seine Datenbank herunter (Internet nötig). Das Skript holt er sich vom Cockpit-Dienst.
  control-trivy:
    image: aquasec/trivy:latest
    container_name: control-trivy
    profiles: ["scan"]
    restart: unless-stopped
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        until wget -q -O /tmp/scan.sh --header "Authorization: Bearer $$(cat /shared/token 2>/dev/null)" http://control-cockpit:3600/scan.sh; do
          echo "Warte auf den Cockpit-Dienst ..."; sleep 5
        done
        exec sh /tmp/scan.sh
    environment:
      SCAN_INTERVAL_HOURS: ${SCAN_INTERVAL_HOURS:-24}
    mem_limit: 3g
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - trivy_cache:/root/.cache/trivy
      - cockpit_reports:/reports
      - cockpit_shared:/shared:ro
    networks:
      - default      # Internet für die Datenbank
      - cockpit

  # ---------------------------------------------------------------- AuraLic (Lizenzserver + Apaleo-Vermittler): nur beim Hersteller, Profil "vendor"
  lic:
    image: ${LIC_IMAGE:-migerber77/aura-suite:lic}
    profiles: ["vendor"]
    restart: unless-stopped
    environment:
      <<: *env
      LICENSE_SECRET: ${LICENSE_SECRET:?LICENSE_SECRET fehlt}
      # Nur für das Profil "vendor". Leer = der Lizenzserver blockiert ALLE Anmeldungen ("LICENSE_SERVER_PASSWORD fehlt"). Kein ":?", sonst würde Compose die Werte auch ohne dieses Profil verlangen.
      # In der .env gilt LIC_ADMIN_PASSWORD; der Name aus einer bisherigen AuraLic-.env (LICENSE_SERVER_PASSWORD) wird ersatzweise erkannt.
      LICENSE_SERVER_PASSWORD: ${LIC_ADMIN_PASSWORD:-${LICENSE_SERVER_PASSWORD:-}}
      SESSION_SECRET: ${LIC_SESSION_SECRET:-${SESSION_SECRET:-}}                   # ebenso: LIC_SESSION_SECRET, ersatzweise SESSION_SECRET
      APALEO_CLIENT_ID: ${APALEO_CLIENT_ID:-}           # Apaleo-Vermittler: leer = aus
      APALEO_CLIENT_SECRET: ${APALEO_CLIENT_SECRET:-}
      APALEO_REDIRECT_URI: ${APALEO_REDIRECT_URI:-}      # https://<diese Adresse>/apaleo/callback, so in Apaleo eingetragen
      APALEO_SCOPES: ${APALEO_SCOPES:-}                  # optional: beim Anmelden angefragte Rechte (leer = offline_access openid profile)
    ports:
      - "8451:3001"
    volumes:
      - ./data/lic:/app/data

networks:
  chat:
  edge:
  # internes Netz nur für AuraControl, Cockpit-Dienst und Scanner (kein Zugang nach aussen)
  cockpit:
    name: aura-cockpit
    internal: true

volumes:
  chat_models:
  chat_hf_cache:
  tts_stt_cache:
  piper_data:
  proxy_caddy_data:
  proxy_caddy_config:
  call_asterisk_lib:
  call_asterisk_log:
  cockpit_shared:
  cockpit_reports:
  trivy_cache:
AURA_COMPOSE_EOF
}
# Startkonfiguration des Caddy von AuraProxy (AuraProxy trägt die Domains danach selbst ein)
write_caddy_init() {
  cat > "$1" <<'AURA_CADDY_EOF'
{
  "admin": {
    "listen": "0.0.0.0:2019",
    "origins": ["http://auraproxy-admin"]
  },
  "apps": {
    "http": {
      "servers": {
        "port_80": { "listen": [":80"], "routes": [] }
      }
    }
  }
}
AURA_CADDY_EOF
  chmod 644 "$1"
}

# ---------------------------------------------------------------------------------------------------------------- .env
declare -A ENVV=()                      # Werte aus einer vorhandenen .env (werden nie überschrieben)
load_env() {
  local f="$1" line k v
  [[ -f "$f" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# || ! "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && continue
    k="${line%%=*}"; v="${line#*=}"; ENVV["$k"]="$v"
  done < "$f"
}
val() {   # Schlüssel, neuer Wert -> vorhandener Wert hat Vorrang
  if [[ -n "${ENVV[$1]+x}" && -n "${ENVV[$1]}" ]]; then printf '%s' "${ENVV[$1]}"; else printf '%s' "$2"; fi
}
WRITTEN=" "
line() { WRITTEN+="$1 "; printf '%s=%s\n' "$1" "$(val "$1" "$2")"; }

write_env() {
  local f="$1" tmp="$1.neu"
  {
    echo "# Aura-Suite: Einstellungen und Schlüssel. Erzeugt vom Aura-Suite-Setup ${SETUP_VERSION} am $(date '+%d.%m.%Y %H:%M')."
    echo "# NIE weitergeben und nie ins Repository legen. Werte NICHT ändern, wenn die Suite schon Daten hat (verschlüsselte Daten wären sonst unlesbar)."
    echo "# Ein erneuter Lauf des Setups behält alle Werte hier."
    echo
    echo "COMPOSE_PROJECT_NAME=aura-suite"
    echo "# Welche Produkte laufen (Profile der docker-compose.yml). Ändern: Setup erneut ausführen."
    printf 'COMPOSE_PROFILES=%s\n' "$PROFILES"; WRITTEN+="COMPOSE_PROFILES COMPOSE_PROJECT_NAME "
    line TZ "$TZ_VALUE"
    echo "# Version der Aura-Suite (optional). Die angezeigte Version kommt vom Lizenzserver."
    line AURA_SUITE_VERSION ""
    echo
    echo "# ---- Lizenz: EIN Wert für alle Produkte, derselbe wie beim Lizenzserver (AuraLic) des Herstellers"
    line LICENSE_SECRET "$LICENSE_VALUE"
    echo "# Die Suite-Lizenz wird nur in AuraControl eingetragen; die Produkte holen sie dort ab (leer = AuraControl auf diesem Server)."
    line LICENSE_SYNC_URL ""
    echo
    echo "# ---- AuraChat"
    line CHAT_SESSION_SECRET "$(gen_hex 32)"
    line CHAT_DISPOSITION_KEY "$(gen_hex 32)"
    echo "# ---- AuraPlan / AuraTicket / AuraMail"
    line PLAN_SESSION_SECRET "$(gen_hex 32)"
    line TICKET_SESSION_SECRET "$(gen_hex 32)"
    line MAIL_SESSION_SECRET "$(gen_hex 32)"
    line MAIL_ENCRYPTION_KEY "$(gen_hex 32)"
    echo "# ---- AuraDirect (zentrale Benutzerverwaltung)"
    line DIRECT_SESSION_SECRET "$(gen_hex 32)"
    line DIRECT_ADMIN_PASSWORD "$(gen_pw)"
    line DIRECT_SERVICE_KEY "$(gen_hex 32)"
    echo "# ---- AuraProxy"
    line PROXY_SESSION_SECRET "$(gen_hex 32)"
    echo "# ---- AuraCall"
    line CALL_AMI_SECRET "$(gen_hex 24)"
    line CALL_ADMIN_PASSWORD "$(gen_pw)"
    echo "# ---- AuraControl (Anfangspasswort von admin; Anmeldung auch mit AuraDirect-Konten)"
    line CONTROL_ADMIN_PASSWORD "$(gen_pw)"
    echo "# ---- AuraLic (nur beim Hersteller, Profil vendor)"
    line LIC_ADMIN_PASSWORD "$(gen_pw)"
    line LIC_SESSION_SECRET "$(gen_hex 32)"
    # Weitere Werte aus einer früheren .env (z. B. APALEO_*, eigene Image-Namen) bleiben erhalten
    local k extra=0
    for k in "${!ENVV[@]}"; do
      [[ "$WRITTEN" == *" $k "* ]] && continue
      [[ $extra -eq 0 ]] && { echo; echo "# ---- Übernommen aus der bisherigen .env"; extra=1; }
      printf '%s=%s\n' "$k" "${ENVV[$k]}"
    done
  } > "$tmp"
  chmod 600 "$tmp"
  [[ -f "$f" ]] && cp -p "$f" "$f.sicherung-$(date +%Y%m%d-%H%M%S)"
  mv "$tmp" "$f"
}

# ---------------------------------------------------------------------------------------------------------------- Ports
declare -A PORTS=( [chat]="8091" [plan]="3002" [ticket]="3400" [mail]="3300 2525" [direct]="4000 389" [proxy]="80 443 3500 8090 8092 8093 8094 8095 8097 8099"
                   [call]="8110" [control]="8000" [voice]="8096" [vendor]="8451" )
busy_ports() {   # belegte Ports der gewählten Produkte, die NICHT schon zu dieser Suite gehören
  local p prof out="" mine
  command -v ss >/dev/null 2>&1 || return 0
  mine="$(docker ps --filter "label=com.docker.compose.project=aura-suite" --format '{{.Ports}}' 2>/dev/null || true)"
  for prof in $PROFILES_SPACE; do
    for p in ${PORTS[$prof]:-}; do
      if ss -ltnH "( sport = :$p )" 2>/dev/null | grep -q . && [[ "$mine" != *":$p->"* ]]; then out+="$p ($prof) "; fi
    done
  done
  printf '%s' "$out"
}

# ---------------------------------------------------------------------------------------------------------------- Ablauf
[[ $EUID -eq 0 ]] || die "Bitte als root starten:  sudo bash $0"
install_whiptail; ui_init

ui_msg "$TITLE" "Willkommen!\n\nDieser Assistent installiert die Aura-Suite auf diesem Server:\n\n  • Docker installieren (falls nötig)\n  • Ordner anlegen und die Einstellungen (.env) mit allen Schlüsseln und Passwörtern erzeugen\n  • die Docker-Images holen und die gewählten Produkte starten\n\nBedienung: Pfeiltasten, Leertaste (auswählen), Tab, Enter.\nAbbrechen ist jederzeit möglich; ein erneuter Start ist sicher."

# 1) Docker
if ! docker_ok || ! compose_ok; then
  if [[ $OPT_SKIP_DOCKER -eq 1 || $OPT_START -eq 0 ]]; then
    warn "Docker oder Docker Compose fehlt bzw. läuft nicht (wird wegen --skip-docker-install/--no-start nicht installiert)."
  else
    ui_yesno "Docker fehlt" "Docker Engine oder das Compose-Plugin fehlt bzw. läuft nicht.\n\nSoll das Setup Docker jetzt aus den offiziellen Paketquellen von Docker installieren?" yes \
      || die "Ohne Docker geht es nicht. Bitte Docker installieren und das Setup erneut starten."
    install_docker
  fi
else
  ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null) und Compose $(docker compose version --short 2>/dev/null) sind bereit"
fi

# 2) Ordner
DIR="${OPT_DIR:-$DEFAULT_DIR}"
DIR="$(ui_input "Installationsordner" "Wohin soll die Aura-Suite? Hier liegen später die Einstellungen (.env), die docker-compose.yml und alle Daten (Ordner data/)." "$DIR")" || abort_if_cancel 1
[[ "$DIR" == /* ]] || die "Bitte einen absoluten Pfad angeben (beginnt mit /)."
DIR="${DIR%/}"
load_env "$DIR/.env"
[[ -f "$DIR/.env" ]] && ok "Vorhandene Installation in $DIR gefunden: alle Schlüssel und Passwörter werden übernommen"

# 3) Produkte
prev=" ${ENVV[COMPOSE_PROFILES]:-} "; prev="${prev//,/ }"
st() { if [[ -n "$OPT_PRODUCTS" ]]; then [[ ",$OPT_PRODUCTS," == *",$1,"* ]] && echo on || echo off; elif [[ "$prev" != "  " ]]; then [[ "$prev" == *" $1 "* ]] && echo on || echo off; else echo "$2"; fi; }
SEL="$(ui_checklist "Produkte" "Welche Produkte sollen laufen? (Leertaste = an/aus)\nAuraDirect und AuraControl sind immer dabei: Benutzer und Lizenz werden dort zentral verwaltet." \
  chat    "AuraChat - KI-Assistent mit Avatar"                  "$(st chat on)" \
  voice   "  + Sprache (Spracherkennung/Stimme, gross)"         "$(st voice off)" \
  plan    "AuraPlan - Zeiterfassung, Schicht- und Ferienplan"   "$(st plan on)" \
  ticket  "AuraTicket - Ticketsystem"                           "$(st ticket on)" \
  mail    "AuraMail - E-Mail (Business)"                        "$(st mail on)" \
  call    "AuraCall - KI-Telefonie (Business)"                  "$(st call off)" \
  proxy   "AuraProxy - Eingang mit SSL auf Port 80/443"         "$(st proxy on)" \
  scan    "  + Schwachstellen-Scan der Images (Cockpit)"        "$(st scan off)" \
  vendor  "AuraLic - Lizenzserver (nur beim Hersteller)"        "$(st vendor off)")" || abort_if_cancel $?
PROFILES_SPACE=""
for p in $ALL_PRODUCTS voice scan vendor; do
  if [[ " $SEL $REQUIRED_PRODUCTS " == *" $p "* ]]; then PROFILES_SPACE+="$p "; fi
done
[[ " $PROFILES_SPACE " == *" voice "* && " $PROFILES_SPACE " != *" chat "* ]] && { warn "Sprache braucht AuraChat: Sprache wird weggelassen."; PROFILES_SPACE="${PROFILES_SPACE/voice /}"; }
PROFILES_SPACE="${PROFILES_SPACE% }"; PROFILES="${PROFILES_SPACE// /,}"; PRODUCTS="$PROFILES_SPACE"

# 4) Zeitzone, Adresse, Lizenz-Geheimnis
TZ_VALUE="$(val TZ "$(detect_tz)")"
TZ_VALUE="$(ui_input "Zeitzone" "Zeitzone der Suite (für Zeiterfassung, Termine, Protokolle):" "$TZ_VALUE")" || abort_if_cancel 1
IP="${OPT_IP:-$(detect_ip)}"
IP="$(ui_input "Adresse dieses Servers" "Unter welcher Adresse erreichen die Benutzer diesen Server im Netzwerk? (nur für die Zugangsübersicht am Schluss)" "$IP")" || abort_if_cancel 1
LICENSE_VALUE="$(val LICENSE_SECRET "$OPT_SECRET")"
if [[ -z "$LICENSE_VALUE" ]]; then
  LICENSE_VALUE="$(ui_input "Lizenz-Geheimnis" "Das Lizenz-Geheimnis (LICENSE_SECRET) erhalten Sie von Gerber Backoffice Solutions. Es muss genau zum Lizenzserver passen, sonst werden Lizenzen nicht erkannt.\n\nLeer lassen = vorerst ein zufälliger Wert: Die Suite läuft dann in der Testphase bzw. im Free Plan; das Geheimnis kann später in der .env nachgetragen werden." "")" || abort_if_cancel 1
  if [[ -z "$LICENSE_VALUE" ]]; then LICENSE_VALUE="$(gen_hex 32)"; LICENSE_RANDOM=1; fi
fi

# 5) Zusammenfassung
NAMES=""; for p in $PRODUCTS; do case $p in chat) NAMES+="AuraChat, ";; voice) NAMES+="Sprache, ";; plan) NAMES+="AuraPlan, ";; ticket) NAMES+="AuraTicket, ";; mail) NAMES+="AuraMail, ";; direct) NAMES+="AuraDirect, ";; proxy) NAMES+="AuraProxy, ";; call) NAMES+="AuraCall, ";; control) NAMES+="AuraControl, ";; scan) NAMES+="Schwachstellen-Scan, ";; vendor) NAMES+="AuraLic, ";; esac; done
SUMMARY="Ordner:      $DIR\nProdukte:    ${NAMES%, }\nZeitzone:    $TZ_VALUE\nAdresse:     $IP\nLizenz:      $([[ "${LICENSE_RANDOM:-0}" == 1 ]] && echo 'zufälliges Geheimnis (Testphase/Free Plan)' || echo 'Geheimnis eingetragen')\n"
[[ $OPT_START -eq 1 ]] && SUMMARY+="\nDanach werden die Docker-Images geholt (einige GB, je nach Auswahl) und die Produkte gestartet." || SUMMARY+="\n(--no-start: es werden nur Ordner und Dateien angelegt)"
ui_yesno "Bereit zur Installation" "$SUMMARY\n\nJetzt installieren?" yes || abort_if_cancel 1

# 6) Ordner und Dateien
say "Ordner und Dateien anlegen in $DIR"
umask 022   # Datenordner wie bei einer Installation von Hand (lesbar für die Container); nur .env und Zugangsdaten sind privat
mkdir -p "$DIR"/data/{chat,plan,ticket,mail,direct,proxy,proxy-custom-certs,call,call-asterisk-conf,lic,control} "$DIR/proxy" /srv/backup/rear /var/lib/aura-cockpit
umask 077
chmod 750 "$DIR"
chown -R 1000:1000 "$DIR/data/call" "$DIR/data/call-asterisk-conf"        # AuraCall läuft nicht als root
[[ -f "$DIR/proxy/caddy-init.json" ]] || write_caddy_init "$DIR/proxy/caddy-init.json"
umask 022; write_compose "$DIR/docker-compose.yml.neu"; umask 077
if [[ -f "$DIR/docker-compose.yml" ]] && ! cmp -s "$DIR/docker-compose.yml" "$DIR/docker-compose.yml.neu"; then cp -p "$DIR/docker-compose.yml" "$DIR/docker-compose.yml.sicherung-$(date +%Y%m%d-%H%M%S)"; fi
mv "$DIR/docker-compose.yml.neu" "$DIR/docker-compose.yml"
write_env "$DIR/.env"
ok "docker-compose.yml, .env (nur für root lesbar) und Datenordner sind bereit"
load_env "$DIR/.env"   # erzeugte Werte für die Zugangsübersicht

cd "$DIR"
if command -v docker >/dev/null 2>&1 && compose_ok; then
  docker compose config -q || die "Die erzeugte docker-compose.yml ist ungültig (docker compose config)."
  ok "Prüfung der Compose-Datei bestanden"
fi

# 7) Images holen und starten
if [[ $OPT_START -eq 1 ]]; then
  busy="$(busy_ports)"
  if [[ -n "$busy" ]]; then
    ui_yesno "Ports belegt" "Diese Ports sind auf dem Server schon von anderen Programmen belegt:\n\n  $busy\n\nDie betroffenen Produkte können so nicht starten. Trotzdem fortfahren?" no || die "Bitte die Ports freigeben (oder die Produkte abwählen) und das Setup erneut starten."
  fi
  say "Docker-Images holen (das kann einige Minuten dauern)"
  docker compose pull --ignore-pull-failures || warn "Nicht alle Images konnten geholt werden (Details oben)."
  say "Produkte starten"
  docker compose up -d --remove-orphans
  say "Warten, bis alle Dienste laufen"
  for i in $(seq 1 30); do
    bad="$(docker compose ps --format '{{.Service}} {{.State}}' 2>/dev/null | awk '$2!="running"{print $1}' | tr '\n' ' ')"
    [[ -z "$bad" ]] && break; sleep 4
  done
  if [[ -n "${bad:-}" ]]; then warn "Noch nicht bereit: $bad  (Details: cd $DIR && docker compose logs <dienst>)"; else ok "Alle Dienste laufen"; fi
fi

# 8) Zugangsübersicht
ACC="$DIR/ZUGANGSDATEN.txt"
{
  echo "Aura-Suite: Zugangsdaten  (erzeugt am $(date '+%d.%m.%Y %H:%M'), nur für root lesbar - sicher aufbewahren und danach löschen)"
  echo "======================================================================================================================="
  has control && printf '%-12s %-32s %s\n' "AuraControl" "http://$IP:8000" "Benutzer admin · Passwort ${ENVV[CONTROL_ADMIN_PASSWORD]}  (hier die Suite-Lizenz eintragen)"
  has direct  && printf '%-12s %-32s %s\n' "AuraDirect"  "http://$IP:4000" "Benutzer admin · Passwort ${ENVV[DIRECT_ADMIN_PASSWORD]}  (hier alle Benutzer anlegen)"
  has chat    && printf '%-12s %-32s %s\n' "AuraChat"    "http://$IP:8091" "Anmeldung mit AuraDirect-Konto; Notzugang admin (beim ersten Start)"
  has plan    && printf '%-12s %-32s %s\n' "AuraPlan"    "http://$IP:3002" "Anmeldung mit AuraDirect-Konto; Notzugang admin / admin (sofort ändern)"
  has ticket  && printf '%-12s %-32s %s\n' "AuraTicket"  "http://$IP:3400" "Anmeldung mit AuraDirect-Konto; Notzugang admin / admin (sofort ändern)"
  has mail    && printf '%-12s %-32s %s\n' "AuraMail"    "http://$IP:3300" "Anmeldung mit AuraDirect-Konto; Notzugang admin / admin (sofort ändern)"
  has call    && printf '%-12s %-32s %s\n' "AuraCall"    "http://$IP:8110" "Benutzer admin · Passwort ${ENVV[CALL_ADMIN_PASSWORD]}"
  has proxy   && printf '%-12s %-32s %s\n' "AuraProxy"   "http://$IP:3500" "Anmeldung mit AuraDirect-Konto; Domains und SSL für alle Produkte"
  has vendor  && printf '%-12s %-32s %s\n' "AuraLic"     "http://$IP:8451" "Benutzer admin · Passwort ${ENVV[LIC_ADMIN_PASSWORD]}"
  echo
  echo "AuraDirect in den Produkten verbinden (jeweils Admin Panel → AuraDirect):"
  echo "  Adresse:          http://$IP:4000"
  echo "  Dienst-Schlüssel: ${ENVV[DIRECT_SERVICE_KEY]}"
  echo "  (AuraControl ist schon verbunden. In AuraDirect pro Person die Produkte freischalten, z. B. AuraControl.)"
  echo
  echo "Nächste Schritte:"
  echo "  1. AuraDirect öffnen und die Benutzer anlegen."
  echo "  2. AuraControl öffnen, Passwort von admin ändern und die Suite-Lizenz eintragen (wird an alle Produkte verteilt)."
  echo "  3. In AuraProxy die Domains einrichten (SSL)."
  [[ "${LICENSE_RANDOM:-0}" == 1 ]] && echo "  ! LICENSE_SECRET ist ein Zufallswert: Für Lizenzen den Wert vom Hersteller in $DIR/.env eintragen, dann: cd $DIR && docker compose up -d"
  echo
  echo "Befehle (im Ordner $DIR):  docker compose ps  ·  docker compose logs -f <dienst>  ·  Update: docker compose pull && docker compose up -d"
  echo "Produkte dazunehmen/weglassen: Setup erneut ausführen (Schlüssel und Daten bleiben erhalten)."
} > "$ACC"
chmod 600 "$ACC"

if [[ $INTERACTIVE -eq 1 && $HAVE_WT -eq 1 ]]; then whiptail --title "Fertig" --scrolltext --msgbox "$(cat "$ACC")" 28 110 || true; fi
echo; cat "$ACC"; echo
ok "Die Zugangsdaten stehen auch in $ACC (nur für root lesbar)."
