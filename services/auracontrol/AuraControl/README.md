# AuraControl

Server-Übersicht (Hardware, Speicher, Strom) mit Neustart und Herunterfahren. Teil der Aura-Suite: gleiches Menü, Lizenz und „Über Aura-Suite“ wie die anderen Produkte.

## Menü (in allen Aura-Produkten gleich)
**⚙️ Einstellungen · 🛠️ Admin Panel ▾ · ℹ️ Über · Abmelden**

- **Einstellungen:** alles, womit man das Produkt anpasst (hier: Servername, Modell, Adresse, Betriebssystem, so wie sie im Kopf stehen).
- **Admin Panel:** 🔑 Lizenz, 🛡️ Sicherheit (Passwort), 🖥️ System (Neustart, Herunterfahren). Andere Produkte haben dort zusätzlich 👥 Benutzer und 🔌 API, immer in dieser Reihenfolge.

## Start
Siehe `docker-compose.yml` (oder die grosse Compose-Datei der Aura-Suite). Die Datei `.env.example` nennt die Werte.

1. `LICENSE_SECRET` eintragen (derselbe Wert wie beim Lizenzserver).
2. `docker compose up -d --build`
3. **Anfangspasswort:** Steht `CONTROL_ADMIN_PASSWORD` nicht in der `.env`, erzeugt AuraControl ein zufälliges und schreibt es **einmal** ins Protokoll (`docker compose logs auracontrol`). Benutzername `admin`. Das Passwort muss beim ersten Mal geändert werden (Admin Panel → Sicherheit, mindestens 10 Zeichen).
4. Der Ordner `data` (im Container `/app/data`) enthält Passwort-Hash, Sitzungsschlüssel, Beginn der Testphase, Lizenz und Einstellungen. **Er muss erhalten bleiben** (Sicherung, kein Löschen beim Neubau).

## Sicherheit
- Anmeldung mit signierten, 12 Stunden gültigen Sitzungen (früher: ein fester Cookie-Wert, mit dem jeder ohne Passwort hineinkam). Eine Passwortänderung beendet alle anderen Sitzungen.
- Nach 5 Fehlversuchen wird eine Adresse 5 Minuten gesperrt. Hinter einem Reverse-Proxy `TRUST_PROXY=1` setzen (dann zählt der Besucher aus `X-Forwarded-For` und `https` wird erkannt).
- Alle Adressen ausser Anmeldung und Abmeldung verlangen eine Anmeldung; ändernde Aktionen zusätzlich die Kopfzeile `X-Aura-Request`.
- Der Container läuft als root (Neustart/Herunterfahren, Zugriff auf `/srv/backup/rear`). Port 8000 daher **nicht** ins Internet stellen, am besten nur hinter AuraProxy mit https.

## Lizenz
14 Tage Testphase, danach ist ein Benutzer (der Administrator) kostenlos. Lizenzen stellt der Lizenzserver (AuraLic) für das Produkt „AuraControl“ aus; Eintragen unter Admin Panel → Lizenz.

Alle 12 Stunden meldet sich AuraControl **anonym** beim Lizenzserver (zufällige Kennung, Produkt, Version, Zustand, Zahl der Konten, ggf. Lizenzschlüssel; keine Namen, keine Inhalte). Das ist nicht abschaltbar. Die dort eingetragene Aura-Suite-Version erscheint unter „Über Aura-Suite“.

## Hinweis zum Test
FastAPI selbst war in der Testumgebung nicht installiert und wurde durch einen Stellvertreter ersetzt. Bitte nach dem Bauen einmal anmelden, Lizenz öffnen und „Über“ öffnen.
