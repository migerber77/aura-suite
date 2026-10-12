# AuraChat Lizenz-Tool

Erzeugt signierte Lizenzschlüssel für die Premium-Features von AuraChat.
Läuft **lokal bei dir**, ist **nicht** Teil des Docker-Containers.

> **Alternative:** Es gibt auch einen Lizenz-Server mit Web-Oberfläche als
> eigenständiges, separates Deployment (eigene Domain, eigenes HTTPS, von
> aussen erreichbar) - siehe das separate Paket "aurachat-license-server".
> Für die schnelle Nutzung übers Terminal bleibt dieses Skript hier trotzdem praktisch.

## Einmalige Einrichtung

Braucht Node.js (auf deinem Desktop, nicht auf dem NAS nötig - kannst es
aber auch dort ausführen, falls Node.js dort verfügbar ist).

## Nutzung

```
node generate-license.js --customer "Firma XY" --features ssl,chat_bg --secret DEIN_LICENSE_SECRET
```

`DEIN_LICENSE_SECRET` muss **exakt** der Wert sein, den du als `LICENSE_SECRET`
in der `.env`-Datei auf dem Server eingetragen hast (siehe `docker-compose.yml`).
Nur so kann der Server die erzeugte Lizenz später als echt erkennen.

### Optionen

| Flag | Pflicht | Beschreibung |
|---|---|---|
| `--customer` | ja | Name des Kunden/der Firma (nur zur Anzeige) |
| `--features` | ja | Kommagetrennt, z.B. `ssl,chat_bg` |
| `--secret` | ja* | Dein LICENSE_SECRET (*oder als Umgebungsvariable setzen) |
| `--expires` | nein | Ablaufdatum `JJJJ-MM-TT`, ohne Angabe = unbegrenzt gültig |

### Aktuell verfügbare Features

- `ssl` – Domain & SSL-Zertifikat-Verwaltung (Admin Panel -> SSL-Zertifikate)
- `chat_bg` – Chat-Hintergrundbild (Design-Einstellungen)
- `tts_stt` – Eigener TTS/STT-Server statt Browser-Sprachfunktionen (Admin Panel -> TTS/STT)
- `api_access` – Externe API für andere Plattformen (Admin Panel -> API)
- `avatar` – Avatar ändern: Galerie-Auswahl & eigener Upload (Menü -> Avatar ändern)
- `integrations` – Smart-Home-Geräte (z.B. IKEA Dirigera) & eigene Anwendungen (Admin Panel -> API)
- `image_gen` – Bildgenerierung mit eigenem Server (Admin Panel -> Modell-Suche & Server)
- `coding_model` – Separates Coding-Modell auf eigenem Server (Admin Panel -> Modell-Suche & Server)
- `dual_model` – Zweitmodell zur Genauigkeitsprüfung, inkl. OpenAI-Cloud-Option (Modell-Suche & Server -> Zweitmodell)
- `email` – E-Mail-Integration pro Konto: IMAP oder Microsoft 365/Exchange (Menü -> E-Mails)
- `academy` – Aura-Academy: experimentelles Nebenmodell-Training, direkt im Backend integriert (Admin Panel -> 🎓 Aura-Academy)
- `rebrand` – Eigenes Logo/Icon statt AuraChat-Branding (Admin Panel -> SSL -> 🎨 Eigenes Branding)

## Nutzer-/Admin-Obergrenzen (--max-users, --max-admins)

Optional, ohne Angabe = unbegrenzt. Beispiel: max. 10 Benutzerkonten insgesamt, davon max. 2 mit Administratorrechten:

```
node generate-license.js --customer "Firma XY" --all --max-users 10 --max-admins 2 --secret DEIN_LICENSE_SECRET
```

Der feste "admin"-Account zählt immer als einer der Administratoren. Ohne Lizenz gilt die
kostenlose Grundausstattung: 3 Benutzer, 1 Administrator.

## Kundenübersicht & Check-in (nur im Lizenz-Server-Projekt)

Preise, Hosting-Art (Self-Hosted/Cloud) und Kontakt-E-Mail werden separat auf der
Lizenz-Server-Weboberfläche gepflegt (nicht Teil des signierten Lizenzschlüssels selbst)
und dort unter "👥 Kunden" mit geschätzten monatlichen Kosten angezeigt.

Jede AuraChat-Installation kann optional (Admin Panel → Lizenz → "Check-in") alle 12h ein
kurzes Signal an den Lizenz-Server senden (nur Lizenzschlüssel, aktuelle Nutzerzahlen,
Version - keine Chat-Inhalte). Der Lizenz-Server zeigt daraufhin an, welche Installationen
in den letzten 48h aktiv waren. **Bitte Kund:innen in eurer eigenen Dokumentation/
Datenschutzerklärung transparent darüber informieren, dass ihre Installation optional
"nach Hause telefoniert".**

### Beispiel: zeitlich begrenzte Test-Lizenz

```
node generate-license.js --customer "Testkunde GmbH" --features ssl,chat_bg --expires 2026-12-31 --secret abc123...
```

## Ausgabe

Das Skript gibt den Lizenzschlüssel in der Konsole aus **und** speichert ihn
zusätzlich als `<Kundenname>.lic`-Datei im aktuellen Ordner. Der Kunde kann
entweder den kompletten String als "Seriennummer" einfügen, oder die `.lic`-
Datei im Admin Panel hochladen - beides führt zum selben Ergebnis.

## Sicherheitshinweis

`LICENSE_SECRET` niemals weitergeben, committen oder öffentlich teilen. Wer
diesen Wert kennt, kann beliebige gültige Lizenzen für jede Kombination aus
Features erzeugen. Bei Verdacht auf Kompromittierung: `LICENSE_SECRET` in der
`.env` auf dem Server ändern (macht alle bisher ausgegebenen Lizenzen
ungültig - Kunden brauchen dann neue Schlüssel).
