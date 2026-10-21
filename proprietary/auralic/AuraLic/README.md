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

- **Lizenzmodell** wählen:
  - **Business Solo** (1 Benutzer, CHF 19.90 / Monat) oder **Business Advanced** (ab 2 Benutzern,
    CHF 19.90 + CHF 9.90 je weiteren Mitarbeiter / Monat, Feld „Weitere Mitarbeiter“): erzeugt EINEN
    Suite-Schlüssel, der für AuraChat (Vollversion), AuraPlan, AuraTicket, AuraMail, AuraCall und AuraControl
    gilt. Nur die Zahl der Mitarbeiter unterscheidet die Lizenzen; der Preis wird automatisch berechnet.
  - Beim Kunden wird der Schlüssel **einmal in AuraControl** eingetragen. AuraControl verteilt ihn an die
    Produkte (sie holen ihn alle 15 Minuten ab) und übernimmt beim Abgleich mit diesem Server (alle 12 Stunden
    oder per Knopf) eine neuere Fassung.
  - **✏️ Mitarbeiter ändern** (Kundenübersicht oder nach dem Erzeugen): stellt eine neue Fassung derselben
    Lizenz aus (mehr/weniger Mitarbeiter, anderes Ablaufdatum). Beim Kunden ist nichts zu tun.
  - **Einzelprodukt**: das bisherige Formular (ein Produkt, Features, Obergrenzen, eigene Preise),
    z. B. für AuraControl.
  - Der **Free Plan** (1 Benutzer: AuraChat-Grundfunktionen, AuraPlan, AuraTicket) braucht keinen Schlüssel.
  - Die Hardware ist nicht Teil der Lizenz.
- Kunde, Adresse, optionales Ablaufdatum, optional einem Reseller zuordnen
- "Lizenz erzeugen" → fertige Schlüssel zum Kopieren + Download als `.lic`-Datei
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

## Aura-Suite-Version ("Über Aura-Suite")

Auf der Seite **Kunden** gibt es die Karte **Aura-Suite-Version** (nur für den Administrator): Version (z. B. `2.1.0`), Stand (Datum, ohne Eingabe gilt heute) und ein kurzer Hinweis (höchstens 120 Zeichen).

- Die Angaben gehen mit der Antwort des Abgleichs (`/api/checkin`) an jede Installation, die sich meldet (auch unlizenzierte), und erscheinen dort unter **Über Aura-Suite**, spätestens nach 12 Stunden. Zeigt eine Installation eine ältere Version an, steht dort „Update verfügbar“.
- Dieselbe Zahl steuert wie bisher die Markierung „veraltet“ bei den Kunden (verglichen wird mit der **installierten** Version, die die Installation selbst meldet).
- Die Version leer lassen und speichern schaltet die Anzeige ab.
- Erlaubt sind nur Zahlen mit Punkten (`1.00`, `2.1`, `2.1.0`). Alles wird geprüft, bevor es verschickt wird; die Installationen prüfen es noch einmal und zeigen es nur als Text.
- Nur **AuraChat** und **AuraCall** melden sich beim Lizenzserver und bekommen deshalb die „Aktuelle Version“ samt „Update verfügbar“. Die übrigen Produkte (AuraPlan, AuraDirect, AuraMail, AuraTicket, AuraProxy) haben keine Verbindung hierher.
- **Alle** Anwendungen (auch AuraLic selbst) haben den Knopf „ℹ️ Über“ neben „Abmelden“ mit dem Dialog **Über Aura-Suite**: Anwendung, installierte Version und die Aura-Suite-Version, die der Betreiber setzt (Umgebungswert `AURA_SUITE_VERSION`, z. B. in der `.env` der Suite; leer = keine Zeile). Der Dialog ist nur für angemeldete Personen erreichbar.

## Apaleo-Vermittler (Verbinden per Knopf, OAuth 2.0)

Apaleo verlangt für Store-Apps den **Autorisierungscode-Ablauf** (https://apaleo.dev/guides/oauth-connection/auth-code-grant.html). AuraChat läuft selbst gehostet bei jedem
Kunden, das geheime `client_secret` der App darf aber nicht in jede Installation. Deshalb hält dieser Server es und vermittelt:

1. Der Kunde klickt in AuraChat auf **„Mit Apaleo verbinden“**. AuraChat schickt ihn hierher (`/apaleo/connect`), eine Bestätigungsseite zeigt, wohin die Zugangsdaten gehen.
2. Weiter zu Apaleo (Anmeldung und Zustimmung, der Kunde wählt dort seine Häuser). Apaleo kommt zurück auf `/apaleo/callback`.
3. Der Vermittler tauscht den Code gegen Token und leitet den Browser mit einer **einmaligen Übergabe-Kennung** zur Installation zurück. Die Installation holt die Token
   serverseitig ab (`/apaleo/handoff`, nur mit der Geheimzahl, die sie selbst erzeugt hat). Später erneuert sie Token über `/apaleo/refresh`.

**Es werden keine Token gespeichert** (nur wenige Minuten im Speicher). Der Vermittler gibt keinen `id_token` und keine Fehlertexte von Apaleo weiter.

Auf der Seite **Kunden** (nur Hersteller) zeigt der Kasten „Apaleo-Vermittler“, welche der drei Werte gesetzt sind (das Geheimnis wird nie angezeigt), welche Redirect-Adresse bei Apaleo einzutragen ist und wie man die Werte bekommt. Die Werte selbst gehören in die `.env`, nicht in die Oberfläche.

Einrichtung: in Apaleo eine **Store-App (OAuth connect client)** anlegen, **Fine-grained client** wählen, die Berechtigungen (siehe AuraChat, Abschnitt Apaleo) eintragen,
als Redirect URI `https://<diese Adresse>/apaleo/callback` (https!) und die Werte oben in die `.env` übernehmen. Apaleo Store → Landing page: `https://<diese Adresse>/apaleo/landing`.
Dieser Server muss dafür **per https aus dem Internet erreichbar** sein (z. B. über AuraProxy).

## Fehlersuche: „Lizenz-Server ist nicht korrekt konfiguriert (LICENSE_SERVER_PASSWORD fehlt)“

Das Passwort für den Benutzer `admin` ist im Container leer, deshalb blockiert AuraLic aus Sicherheitsgründen alle Anmeldungen.
- **Eigenständiges AuraLic:** `LICENSE_SERVER_PASSWORD` in der `.env` neben der `docker-compose.yml` eintragen.
- **Compose-Datei der Aura-Suite:** In der `.env` heißt der Wert `LIC_ADMIN_PASSWORD` (und `LIC_SESSION_SECRET`); die Namen der eigenständigen Fassung werden ersatzweise erkannt.
- Danach den Container **neu erstellen**: `docker compose up -d --force-recreate lic` (ein einfacher Neustart liest die `.env` nicht neu).
- Prüfen, was im Container ankommt (zeigt nur, ob ein Wert da ist): `docker compose exec lic sh -c 'test -n "$LICENSE_SERVER_PASSWORD" && echo gesetzt || echo LEER'`
- Wurde ein bisheriges AuraLic umgezogen: auch den Ordner `data` (Datenbank, `hub.key`) mitnehmen, und `LICENSE_SECRET` muss derselbe sein wie bei den AuraChat-Installationen.
