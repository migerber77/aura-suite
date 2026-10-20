# AuraCall - Asterisk (Telefonanlage) für Aura, aus dem offiziellen Quellcode gebaut.
# Debian 13 ("trixie") enthält kein Asterisk-Paket mehr, deshalb wird hier die langfristig gepflegte Version 22 (LTS) selbst gebaut.
# Der erste Bau dauert etwa 10 bis 20 Minuten und braucht Internet (Quellcode von downloads.asterisk.org, pjproject von github.com).
# Andere Version:  docker compose build --build-arg ASTERISK_VERSION=22.5.2 asterisk      (Standard: die jeweils aktuelle 22er)
ARG BASE_IMAGE=debian:trixie-slim
FROM ${BASE_IMAGE}
ARG ASTERISK_VERSION=22-current

# Bauwerkzeuge und Bibliotheken (bleiben im Image: sicherer als sie zu entfernen und dabei versehentlich Laufzeit-Bibliotheken mitzulöschen)
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential ca-certificates curl wget bzip2 xz-utils patch pkg-config autoconf automake libtool python3 \
      libedit-dev libjansson-dev libsqlite3-dev libssl-dev libxml2-dev libxslt1-dev uuid-dev libncurses-dev \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/*

# Quellcode holen, bauen, installieren. Ton- und Wartemusik-Pakete werden weggelassen (Aura spielt keine Dateien ab).
RUN set -eux; \
    mkdir -p /usr/src/asterisk && cd /usr/src/asterisk; \
    curl -fsSL --retry 3 -o asterisk.tar.gz "https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-${ASTERISK_VERSION}.tar.gz"; \
    tar -xzf asterisk.tar.gz --strip-components=1; rm asterisk.tar.gz; \
    ./configure --with-jansson-bundled --with-pjproject-bundled; \
    make menuselect.makeopts; \
    menuselect/menuselect --enable res_audiosocket --enable app_audiosocket --enable res_pjsip --enable chan_pjsip --enable app_userevent --enable func_md5 menuselect.makeopts; \
    (menuselect/menuselect --disable-category MENUSELECT_CORE_SOUNDS --disable-category MENUSELECT_MOH --disable-category MENUSELECT_EXTRA_SOUNDS menuselect.makeopts || true); \
    make -j"$(nproc)"; \
    make install; make samples; ldconfig; \
    cd /; rm -rf /usr/src/asterisk

# Selbsttest beim Bauen: Sind alle Module da, die AuraCall braucht? Sonst bricht der Bau MIT KLARER MELDUNG ab (statt dass später jeder Anruf still scheitert).
RUN set -e; missing=""; \
    for m in res_pjsip.so chan_pjsip.so res_pjsip_session.so res_pjsip_outbound_registration.so res_rtp_asterisk.so res_audiosocket.so app_audiosocket.so app_userevent.so pbx_config.so func_md5.so func_callerid.so codec_alaw.so codec_ulaw.so; do \
      found=$(find /usr/lib -path '*asterisk/modules/*' -name "$m" 2>/dev/null | head -1); [ -n "$found" ] || missing="$missing $m"; \
    done; \
    if [ -n "$missing" ]; then echo "FEHLER: In diesem Asterisk fehlen Module:$missing"; echo "AuraCall braucht Asterisk 20 oder neuer mit AudioSocket (app_audiosocket). Andere Version wählen (siehe README, Abschnitt 'Asterisk-Image')."; exit 1; fi; \
    asterisk -V

# Gleiche Benutzerkennung (1000) wie das Programm AuraCall (Benutzer "node"), damit beide die gemeinsame Konfigurationsablage lesen und schreiben können, ohne dass sie für alle lesbar sein muss.
RUN groupadd -g 1000 asterisk && useradd -u 1000 -g asterisk -d /var/lib/asterisk -s /usr/sbin/nologin asterisk \
 && mkdir -p /var/run/asterisk /var/log/asterisk /var/lib/asterisk /var/spool/asterisk /etc/asterisk/auracall /opt/auracall-etc \
 && chown -R asterisk:asterisk /var/run/asterisk /var/log/asterisk /var/lib/asterisk /var/spool/asterisk /etc/asterisk

COPY etc/ /opt/auracall-etc/
COPY entrypoint.sh /usr/local/bin/auracall-asterisk-entrypoint
RUN chmod 0755 /usr/local/bin/auracall-asterisk-entrypoint

USER asterisk
HEALTHCHECK --interval=30s --timeout=8s --start-period=60s --retries=3 CMD asterisk -rx "core waitfullybooted" >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/usr/local/bin/auracall-asterisk-entrypoint"]
