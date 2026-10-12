#!/bin/bash
set -e  # Bricht das Skript bei einem Fehler sofort ab

echo "=== 1. Baue alle Docker-Images mit den korrekten Dockerfile-Pfaden ==="
docker build -t migerber77/aura-suite:chat -f apps/aurachat/AuraChat/Dockerfile apps/aurachat/AuraChat
docker build -t migerber77/aura-suite:plan -f apps/auraplan/AuraPlan/Dockerfile apps/auraplan/AuraPlan
docker build -t migerber77/aura-suite:ticket -f apps/auraticket/AuraTicket/Dockerfile apps/auraticket/AuraTicket
docker build -t migerber77/aura-suite:mail -f services/auramail/AuraMail/Dockerfile services/auramail/AuraMail
docker build -t migerber77/aura-suite:direct -f services/auradirect/AuraDirect/Dockerfile services/auradirect/AuraDirect
docker build -t migerber77/aura-suite:proxy -f services/auraproxy/AuraProxy/Dockerfile services/auraproxy/AuraProxy
docker build -t migerber77/aura-suite:call -f services/auracall/AuraCall/Dockerfile services/auracall/AuraCall

echo "=== 2. Lade alle Images zu Docker Hub hoch ==="
docker push migerber77/aura-suite:chat
docker push migerber77/aura-suite:plan
docker push migerber77/aura-suite:ticket
docker push migerber77/aura-suite:mail
docker push migerber77/aura-suite:direct
docker push migerber77/aura-suite:proxy
docker push migerber77/aura-suite:call

echo "=== Alle Container erfolgreich gebaut und zu Docker Hub gepusht! ==="
