# Cockpit: Gesundheit des Servers

In AuraControl gibt es neben **📊 Hardware** die Ansicht **🖥️ Cockpit** (Adresse `…:8000/#cockpit`). Sie zeigt auf einen Blick:

- **Ampel** 🟢🟠🔴 mit Hinweisen im Klartext (z. B. „Container searxng meldet sich als unhealthy“)
- **Prozessor, Arbeitsspeicher, Speicherplatz** mit kleinem Verlauf der letzten Stunden
- **Docker-Container** mit Zustand, Prozessor und Speicher, dazu was Docker an Platz belegt (und wie viel davon Zwischenspeicher vom Bauen ist, der sich aufräumen lässt)
- **Schwachstellen** in den Docker-Images (optional)
- **Offene Updates des Servers** und „Neustart nötig“ (optional)

Die Ansicht aktualisiert sich alle 10 Sekunden, solange sie offen ist. Sie ist nur für angemeldete Personen. Das Cockpit war früher ein Reiter im Admin Panel von AuraChat und ist
nach AuraControl umgezogen (dort gehört die Gesundheit des Servers hin: AuraControl zeigt ohnehin Hardware, Strom und Speicher).

## Einspielen

```bash
cd /docker/aura          # euer Ordner mit der Compose-Datei
sudo docker compose build auracontrol
sudo docker compose up -d
```

Der neue Dienst `control-cockpit` startet mit und legt sein Passwort beim ersten Start selbst an. Es ist nichts einzutragen. Läuft er nicht, zeigt die Ansicht
„⚠️ Cockpit nicht erreichbar“ mit dem Hinweis dazu. **Umzug von AuraChat:** In der Compose-Datei von AuraChat gibt es den Dienst `cockpit` (und `trivy`) nicht mehr; falls
sie bei euch noch laufen: `sudo docker compose up -d --remove-orphans` im AuraChat-Ordner. Alte Scan-Berichte brauchen nichts mitzunehmen, der Scanner erzeugt sie neu.

## Wie es gebaut ist (Sicherheit)

- Nur der kleine Dienst `control-cockpit` (`cockpit_agent.py`, nur Standardbibliothek von Python) sieht Docker, **nur lesend** und mit **sechs festen Abfragen**
  (`/info`, `/version`, `/containers/json?all=1`, `/containers/<id>/stats?stream=false`, `/system/df`, `/images/json`). Nicht dabei: Einzelheiten eines Containers (dort stehen
  Umgebungsvariablen mit Geheimnissen), Protokolle, Dateizugriff, Starten und Stoppen.
- AuraControl (von aussen erreichbar) bekommt **keinen** Zugriff auf Docker. Es fragt nur den Cockpit-Dienst und bewertet die Werte (`cockpit.py`).
- Der Cockpit-Dienst hat **keinen Port nach aussen** und liegt in einem eigenen **internen Docker-Netz** (`aura-cockpit`), das nur AuraControl und der Scanner erreichen.
  Jede Abfrage braucht ein Passwort (48 Zeichen), das er selbst erzeugt (`/shared/token`).
- Er läuft schreibgeschützt (`read_only`), ohne Sonderrechte (`cap_drop: ALL`, `no-new-privileges`) und mit höchstens 256 MB. Als Benutzer root ist er nur, um den Docker-Socket
  lesen zu dürfen (Besitzer root, Modus 660).
- Hinweis: Wer den Docker-Socket einbindet, auch nur lesend gemountet, gibt diesem Dienst mehr Möglichkeiten, als ein normaler Container hat. Deshalb ist der Dienst klein,
  nicht von aussen erreichbar und ganz abschaltbar (siehe unten).

## Schwachstellen-Scan der Images (optional)

```bash
sudo docker compose --profile scan up -d
```

Startet den Scanner **Trivy** (`control-trivy`). Er prüft einmal täglich alle Docker-Images dieses Servers. Beim ersten Lauf lädt er seine Datenbank herunter (Internet nötig),
und der Scan grosser Images dauert einige Minuten und braucht bis zu 3 GB Arbeitsspeicher. Ergebnisse erscheinen im Cockpit. Anderer Abstand: in der `.env`
`SCAN_INTERVAL_HOURS=12` setzen.

Wieder ausschalten: `sudo docker compose stop control-trivy && sudo docker compose rm -f control-trivy`

Gescannt werden die **Bestandteile der Images** (Programmpakete). Das ist nicht dasselbe wie ein Test der laufenden Anwendung, und ein Fund bedeutet nicht automatisch, dass er
sich ausnutzen lässt. Kritische Funde mit „Korrektur verfügbar“ lohnen den Blick: neu bauen mit `sudo docker compose build --pull` holt oft schon die Korrektur.

## Updates des Servers und „Neustart nötig“ (optional)

Ein Container kann nicht in das Betriebssystem des Servers schauen. Dafür gibt es ein kleines Skript, das **auf dem Server** läuft:

```bash
sudo bash cockpit/host/install-hostcheck.sh
```

Es legt einen täglichen Systemdienst an (nachts, mit Zufallsverzögerung), der nur **nachschaut** (`apt list --upgradable`, Datei `/var/run/reboot-required`) und das Ergebnis nach
`/var/lib/aura-cockpit/host-status.json` schreibt. Es wird **nichts installiert oder verändert**. Das Cockpit zeigt dann „N Sicherheits-Updates offen“ und „Neustart nötig“.

Wieder entfernen:

```bash
sudo systemctl disable --now aura-hostcheck.timer
sudo rm /etc/systemd/system/aura-hostcheck.service /etc/systemd/system/aura-hostcheck.timer /usr/local/bin/aura-hostcheck
sudo rm -r /var/lib/aura-cockpit
sudo systemctl daemon-reload
```

## Schwellen der Ampel

| Bereich | Warnung 🟠 | Kritisch 🔴 |
|---|---|---|
| Arbeitsspeicher | ab 85 % | ab 95 % |
| Speicherplatz | ab 80 % | ab 90 % oder weniger als 5 GB frei |
| Prozessor | ab 90 % oder Last über 1,5 je Kern | – |
| Container | pausiert, beendet (Code 0), über 90 % des eigenen Speicher-Limits | „unhealthy“, startet ständig neu, mit Fehler beendet |
| Zwischenspeicher vom Bauen | ab 10 GB aufräumbar (`docker builder prune -f`) | – |
| Schwachstellen | hohe vorhanden; Scan älter als 7 Tage | kritische vorhanden |
| Updates des Servers | Sicherheits-Updates offen, Neustart nötig, Prüfung älter als 3 Tage | – |

Bei „Speicherplatz“ zählt das Dateisystem, auf dem Docker liegt (bei euch `/`). Ist `/var/lib/docker` auf einer eigenen Platte, wird diese gemessen, nicht der Rest des Servers.

## Cockpit ganz abschalten

Die Blöcke `control-cockpit:` und `control-trivy:` in der Compose-Datei löschen sowie bei `auracontrol` die Zeilen `cockpit_shared:/shared:ro`, `COCKPIT_URL` und das Netz `cockpit`,
dann `sudo docker compose up -d --remove-orphans`. Die Ansicht zeigt dann „Cockpit nicht erreichbar“ mit dem Hinweis dazu.
