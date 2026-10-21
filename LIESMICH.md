# Aura-Suite Setup

Ein Assistent zum Durchklicken im Terminal: Er installiert die ganze Aura-Suite auf einem Linux-Server.

## Starten

```bash
sudo bash aura-setup.sh
```

Bedienung: Pfeiltasten, **Leertaste** (auswählen), **Tab**, **Enter**. Funktioniert auch über SSH.

## Was das Setup macht

1. **Docker** prüfen und bei Bedarf installieren (offizielle Paketquellen von Docker; RHEL/Rocky/Alma/CentOS, Fedora, Debian, Ubuntu).
2. **Fragen**: Installationsordner (Standard `/srv/aura-suite`), Produkte, Zeitzone, Adresse des Servers, Lizenz-Geheimnis.
3. **Ordner** anlegen (`data/<produkt>`, `proxy/`), die **docker-compose.yml** und die Startkonfiguration von AuraProxy schreiben.
4. **.env** mit allen Schlüsseln und Passwörtern erzeugen (Zufallswerte, nur für root lesbar).
5. **Images holen** und die gewählten Produkte **starten**, prüfen, ob alles läuft.
6. **Zugangsübersicht** anzeigen und in `ZUGANGSDATEN.txt` ablegen (nur für root lesbar, nach dem Notieren löschen).

AuraDirect (Benutzer) und AuraControl (Lizenz, Übersicht) sind immer dabei. AuraControl ist mit AuraDirect schon verbunden.

## Erneut ausführen

Jederzeit möglich, z. B. um Produkte dazuzunehmen oder wegzulassen:

- Vorhandene Schlüssel und Passwörter in der `.env` werden **nie** überschrieben.
- Weitere Werte wie `APALEO_*` bleiben erhalten.
- Vorher wird eine Sicherung angelegt (`.env.sicherung-…`).
- Daten bleiben unberührt.

## Ohne Fragen

```bash
sudo bash aura-setup.sh --yes --products chat,plan,ticket,mail,proxy --license-secret <WERT>
```

Weitere Optionen: `--dir`, `--ip`, `--no-start` (nur Dateien), `--skip-docker-install`, `--help`.

## Voraussetzungen beim Hersteller

Das Setup holt fertige Images von Docker Hub. Diese müssen dort veröffentlicht sein:

- `migerber77/aura-suite:chat`
- `migerber77/aurachat:backend`
- `migerber77/aurachat:searxng`
- `migerber77/aura-suite:plan`, `:ticket`, `:mail`, `:direct`, `:proxy`, `:call`, `:call-asterisk`
- **`migerber77/aura-suite:control`** (neu: AuraControl wurde bisher vor Ort gebaut)
- `migerber77/aura-suite:lic` (nur Profil `vendor`)

Andere Namen lassen sich in der `.env` vorgeben: `CHAT_BACKEND_IMAGE`, `CALL_ASTERISK_IMAGE`, `CONTROL_IMAGE`, `LIC_IMAGE`.

**Lizenz-Geheimnis:** Damit Lizenzen erkannt werden, muss `LICENSE_SECRET` genau dem Wert des Lizenzservers entsprechen. Bleibt das Feld leer, läuft die Suite in der Testphase bzw. im Free Plan. Der Wert kann später in der `.env` nachgetragen werden (danach `docker compose up -d`).
