# AuraChat Lizenz-Server (eigenständiges Deployment)

Web-Oberfläche zum Erzeugen von Lizenzschlüsseln für AuraChat-Premium-Features,
mit Kundenverwaltung und optionalem **Reseller-Portal** (eigene Logins für
Wiederverkäufer, die weiss-gelabelt eigene Endkunden betreuen). Komplett
unabhängig vom eigentlichen AuraChat-Deployment - eigene Domain, eigenes
HTTPS, kann sogar auf einer anderen Maschine laufen.

## Voraussetzungen

- Docker + Docker Compose
- Dein eigener Reverse Proxy davor (übernimmt die öffentliche Domain + echtes
  Zertifikat), der auf Port 8451 (reines HTTP) dieses Containers weiterleitet

## Einrichtung

```bash
cp .env.example .env
```

Dann `.env` ausfüllen:

1. **LICENSE_SECRET** - erzeugen mit `openssl rand -hex 32`. **Muss exakt derselbe
   Wert sein wie `LICENSE_SECRET` in der `.env` jeder AuraChat-Instanz**, die
   hier ausgestellte Lizenzen später akzeptieren soll.
2. **LICENSE_SERVER_PASSWORD** - ein starkes, einzigartiges Passwort für den
   Superadmin-Zugang (Login-Name ist immer `admin`, sieht/verwaltet ALLES).
   Dieser Server ist öffentlich erreichbar, also nicht irgendein
   wiederverwendetes Passwort nehmen.
3. **SESSION_SECRET** - erzeugen mit `openssl rand -hex 32`. Ohne diesen Wert
   bleibt niemand (Admin oder Reseller) nach einem Neustart angemeldet.

## Starten

```bash
docker compose up -d --build
```

Läuft danach lokal auf Port **8451** (reines HTTP, bewusst ohne eigenes TLS -
dein Reverse Proxy davor übernimmt die öffentliche Domain mit einem "echten"
Zertifikat, z.B. via Let's Encrypt an seiner eigenen Stelle).
Anmeldung unter `/login` mit Benutzername `admin` + deinem `LICENSE_SERVER_PASSWORD`.

## Nutzung (Superadmin)

- Formular ausfüllen: Kunde, Adresse, Features (Checkboxen), Preise,
  optionales Ablaufdatum, optional einem Reseller zuordnen
- "Lizenz erzeugen" → fertiger Schlüssel zum Kopieren + Download als `.lic`-Datei
- **👥 Kunden**: alle Kunden (eigene + über Reseller), geschätzte Einnahmen,
  Check-in-Status
- **🤝 Reseller**: eigene Wiederverkäufer-Konten anlegen (Name, Login,
  Passwort, Rabatt in %), Passwort zurücksetzen, deaktivieren

Der erzeugte Schlüssel (oder die `.lic`-Datei) wird beim Kunden im AuraChat
Admin Panel unter **Admin Panel → 🔑 Lizenz** eingefügt bzw. hochgeladen.

## Reseller-Portal

Ein Reseller meldet sich mit seinem eigenen Login an und sieht **nur seine
eigenen** Endkunden/Lizenzen - nicht die von anderen Resellern oder eure
eigenen Direktkunden. Beim Lizenz-Erzeugen wird automatisch der eigene
Rabatt als Richtpreis-Referenz angezeigt; was der Reseller seinem Endkunden
tatsächlich in Rechnung stellt (die Preisfelder im Formular), bestimmt er
frei. Reseller können weder Backup/Wiederherstellung noch andere
Reseller-Konten sehen oder verwalten - das bleibt dem Superadmin vorbehalten.

Faire Rabattstaffel als Ausgangspunkt (anpassbar pro Reseller-Konto):

| Stufe | Bedingung | Rabatt |
|---|---|---|
| Starter | keine Mindestabnahme | 20% |
| Partner | ab 10 aktive Endkunden-Lizenzen | 30% |
| Enterprise | ab 25 aktive Endkunden-Lizenzen | 40% |

## Sicherheit

- **Wichtig:** Dieser Container spricht selbst nur reines HTTP (Port 8451) -
  nicht direkt aus dem Internet erreichbar machen! Nur dein eigener Reverse
  Proxy (mit echtem Zertifikat) sollte öffentlich erreichbar sein und intern
  auf Port 8451 weiterleiten.
- Der Superadmin-Login verweigert sich **komplett**, solange
  `LICENSE_SERVER_PASSWORD` nicht gesetzt ist ("fail closed").
- Reseller-Passwörter werden mit bcrypt gehasht gespeichert, nie im Klartext.
- Rate-Limiting gegen Brute-Force-Versuche auf Login-Seite ist eingebaut.
- `LICENSE_SECRET` niemals weitergeben - wer ihn kennt, kann selbst gültige
  Lizenzen für beliebige Features erzeugen. Bei Verdacht auf Kompromittierung:
  Wert ändern (macht alle bisherigen Lizenzen alter Kunden ungültig, die
  brauchen dann neue Schlüssel).

## Backup

Wichtig zu sichern: `./data/licenses.db` (Verlauf, Kunden **und**
Reseller-Konten) und deine `.env` (insbesondere `LICENSE_SECRET` - ohne den
Wert kannst du für bestehende Kunden keine weiteren/neuen Lizenzen mehr im
selben "Vertrauensraum" erzeugen, und bereits ausgestellte alte Lizenzen
bleiben zwar gültig, aber du hast dann keinen Überblick/keine Kontrolle mehr
über neue). Backup/Wiederherstellung ist nur als Superadmin zugänglich.

