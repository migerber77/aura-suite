Aura Suite

Willkommen bei der Aura Suite – der modularen Docker-Lösung für deine Server-Umgebung. Diese Suite fasst alle notwendigen Dienste zentral zusammen und wird direkt über Docker Hub bereitgestellt.

🚀 Schnelle Installation (Quick Start)

Mit dieser Anleitung kannst du die Aura Suite sekundenschnell auf einem frischen Ubuntu Server einrichten. Es ist keine manuelle Erstellung von Konfigurationsdateien erforderlich.

Schritt 1: Projektverzeichnis erstellen & Compose-Vorlage laden

mkdir -p /docker/aura-suite && cd /docker/aura-suite
curl -o docker-compose.yml https://raw.githubusercontent.com/migerber77/aura-suite/main/docker-compose.yml


Schritt 2: Umgebungsvariablen (.env) automatisch generieren

Erstelle die benötigten Secrets und Umgebungsvariablen mit folgendem Befehl:

printf "TZ=Europe/Zurich\nCHAT_SESSION_SECRET=%s\nLICENSE_SECRET=%s\n" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env


Schritt 3: Container von Docker Hub laden und starten

Starte die gesamte Suite im Hintergrund. Docker zieht die benötigten Images automatisch von Docker Hub:

docker compose up -d


Überprüfe den Status der Container:

docker compose ps


🔄 Aktualisierung (Update)

Um die Suite auf den neuesten Stand von Docker Hub zu bringen:

cd /docker/aura-suite
docker compose pull && docker compose up -d


💾 Backup-Empfehlungen

Für den produktiven Betrieb wird eine regelmäßige Sicherung empfohlen:

Docker-Volumes & Konfigurationen: Sichere den gesamten Ordner /docker/aura-suite regelmäßig (z. B. mit BorgBackup oder rsync) auf ein externes Medium.

Vollständiges Host-Backup: Für ein komplettes Bare-Metal-Backup des gesamten Ubuntu-Servers (inklusive System und Docker-Konfiguration) empfiehlt sich ein Image-Backup via Clonezilla auf einen externen USB-Stick.

🛠️ Verwaltung & Befehle

Logs anzeigen: docker compose logs -f

Dienste stoppen: docker compose down
