# AuraCall – Aura am Telefon

AuraCall verbindet **Asterisk** (eine Telefonanlage) mit **AuraChat**: Ruft jemand Ihre Nummer an, nimmt Aura ab, begrüsst, hört zu, antwortet und verabschiedet sich. Aura kann auch **selbst anrufen** (zum Beispiel für eine Rückfrage). Verwaltet wird alles im Browser.

* Läuft **ohne fremde Pakete** (nur Node.js): kleine Angriffsfläche, nichts aus dem Internet nachgeladen.
* Sprache, Gehör und Antworten kommen aus **Ihrem** AuraChat. Es verlassen keine Gespräche Ihren Server (ausser zu Ihrem SIP-Anbieter, über den das Telefonat selbst läuft).
* Aura sagt **immer**, dass sie eine KI ist.

## Wie es zusammenhängt

```
 Anrufer ──► SIP-Anbieter ──► Asterisk ──(Ton, nur lokal)──► AuraCall ──► AuraChat
  (Handy)    (Ihre Nummer)    Telefonanlage   AudioSocket     Gespräch     Hören · Antworten · Sprechen
                                  ▲   Steuerung (AMI, nur lokal)  │
                                  └────────────────────────────────┘
```

| Teil | Aufgabe | Erreichbar von |
|---|---|---|
| Asterisk | Nimmt Anrufe vom Anbieter an, wählt Nummern | SIP (5060) nur vom Anbieter, Ton (RTP 10000–10100/UDP) |
| AuraCall | Führt das Gespräch, Verwaltung im Browser | Verwaltung auf Port 8110 |
| AMI (5038) und AudioSocket (9092) | Verbindung Asterisk ⇄ AuraCall | **nur 127.0.0.1** |

## Voraussetzungen

1. **AuraChat** mit den Premium-Funktionen **„Externe API“** und **„Telefonie“** (Lizenz-Tab). Ohne sie verweigert AuraChat Spracherkennung und Sprachausgabe für AuraCall.
2. In AuraChat: **Sprachausgabe über Piper (Wyoming)** und eine **Spracherkennung** (z. B. Speaches) eingerichtet. Das Telefon braucht WAV-Ton; Piper liefert ihn.
3. Ein **SIP-Anbieter** mit einer Rufnummer (Zugangsdaten: Server, Benutzername, Passwort).
4. Ein Server mit Docker (derselbe wie für AuraChat genügt). Auf dem Server dürfen **Port 5060 (UDP)** und **8110** nicht belegt sein.

## Installation

```bash
unzip AuraCall.zip && cd auracall
./setup.sh                       # erzeugt .env (zufälliges Steuerungs-Passwort) und die Ordner
docker compose build && docker compose up -d
docker compose logs auracall | grep "Erster Start"   # Anfangspasswort
```

Dann im Browser **http://SERVER:8110** öffnen, mit Benutzer `admin` und dem Anfangspasswort anmelden und ein **eigenes Passwort** wählen (Pflicht). Das Anfangspasswort ist zufällig (es gibt kein „admin/admin“) und steht auch in `data/INITIAL-ADMIN-PASSWORT.txt` (wird nach dem Ändern gelöscht).

Beim Bauen wird Asterisk aus dem Quellcode erstellt (**erster Bau 10 bis 20 Minuten**) und geprüft, ob alle nötigen Module vorhanden sind; sonst bricht der Bau mit einer klaren Meldung ab.

## Einrichtung in der Verwaltung (Checkliste auf der Übersicht)

1. **Einstellungen → AuraChat:** Adresse (z. B. `http://127.0.0.1:8091`, wenn AuraChat auf demselben Server läuft) und den **API-Schlüssel** eintragen (in AuraChat im Admin Panel im Bereich der externen API: *Erzeugen*). Mit **„Speichern und testen“** werden Sprachausgabe, Spracherkennung und Antworten einzeln geprüft; bei Problemen steht dort genau, welcher Weg und warum.
2. **Leitung:** Server, Benutzername und Passwort Ihres Anbieters, Landesvorwahl, ggf. eigene Rufnummer. Mit **„Speichern und anwenden“** schreibt AuraCall die Konfiguration, und Asterisk lädt sie. Der Zustand der Anmeldung beim Anbieter erscheint auf der Übersicht (*Registered* = in Ordnung).
3. **Aura:** Firmenname, Begrüssung (leer = Standardtext), und im Feld **„Wissen“** Öffnungszeiten, Preise, Frühstück, Anreise, häufige Fragen. Aura sagt nur, was dort steht, und bietet sonst einen Rückruf an.
4. **Testanruf:** Mit dem Handy die Nummer anrufen.

### Hinter einem Router (NAT)

Steht der Server in einem Heimnetz hinter einem Router, brauchen manche Anbieter Hilfe, damit der Ton ankommt:

* In der Leitung **„Öffentliche Adresse des Servers“** (öffentliche IP oder Name) und **„Heimnetz“** (z. B. `192.168.1.0/24`) eintragen.
* Im Router **UDP 10000–10100** zum Server weiterleiten. SIP (5060) muss meist **nicht** weitergeleitet werden, weil sich Asterisk beim Anbieter anmeldet; wenn doch, nur für die Adressen des Anbieters freigeben.

## Ausgehende Anrufe

Standardmässig **aus** (sie kosten Geld). Einschalten unter **Einstellungen → Grenzen**. Es gelten immer:

| Schutz | Standard |
|---|---|
| Nur diese Länder (Vorwahlen) | `+41` |
| Nur zu diesen Zeiten (Ortszeit, Zeitzone einstellbar) | 08:00–20:00 |
| Höchstens pro 24 Stunden / pro Minute | 20 / 3 |
| Gleichzeitige Gespräche | 2 |
| Gesperrt, nicht abschaltbar | Notrufnummern, Mehrwert- und Sondernummern, bekannte Betrugsnummern |

Aura nennt sich auch bei ausgehenden Anrufen **sofort als KI**. Andere Programme (z. B. AuraChat) können einen Anruf auslösen: *Einstellungen → Schlüssel für andere Programme*, dann `POST /api/service/outbound` mit `Authorization: Bearer <Schlüssel>` und `{"number": "...", "purpose": "...", "when": "2026-10-12T14:00:00+02:00"}` (`when` ist optional). Alle Sperren gelten dort genauso.

## Per Chat oder Sprache anrufen lassen (aus AuraChat)

In AuraChat kann ein **Administrator** schreiben oder sagen: *„Ruf 079 123 45 67 an und sag ihr, dass das Zimmer bereit ist.“* (auch: *„… und frag sie, ob …“*, *„… und richte aus, dass …“*). AuraChat zeigt eine **Rückfrage** („Soll Aura jetzt … anrufen? …“), erst nach **„ja“** wird angerufen; „nein“ oder jede andere Nachricht bricht ab, nach 2 Minuten verfällt die Rückfrage. Alle Sperren von AuraCall (erlaubte Länder, Zeiten, Limits, gesperrte Nummern) gelten genauso, der Grund einer Ablehnung erscheint im Chat.

Einrichtung: In AuraCall unter *Einstellungen → Schlüssel für andere Programme* einen Schlüssel erzeugen. In AuraChat im Admin Panel, Reiter **API**, Block **„📞 AuraCall verbinden“**: Adresse (z. B. `http://10.0.55.160:8110`), Schlüssel, Haken bei **„Anrufe per Chat und Sprache erlauben“**, **Speichern**, **Verbindung testen**. Ausgehende Anrufe müssen in AuraCall erlaubt sein (*Einstellungen → Grenzen*), beim Anbieter dürfen sie nicht gesperrt sein, und bei Prepaid braucht es Guthaben.

## Der erste echte Test (bitte in dieser Reihenfolge)

Die Anbindung ist mit nachgebauten Gegenstellen sehr gründlich getestet (Gespräch, Unterbrechen, Ausfälle, Sicherheit, Verwaltung). **Mit einer echten Telefonanlage und einem echten Anbieter konnte ich sie nicht ausprobieren.** Deshalb:

1. Übersicht: **Asterisk „verbunden“**? Wenn nicht: `docker compose logs asterisk`.
2. Leitung angewendet und **Registered**? Wenn nicht: `docker compose exec asterisk asterisk -rx "pjsip show registrations"`.
3. Prüfzeilen beim Start ansehen: `docker compose logs asterisk | grep "AURACALL-PRÜFUNG"` (alle fünf Module „geladen“).
4. **Eingehend:** Handy → Ihre Nummer. In `docker compose logs auracall` erscheint „Gespräch … beendet“; unter **Anrufe** steht der Anruf.
5. **Ausgehend** erst danach, mit der eigenen Handynummer.

## Fehlersuche

| Beobachtung | Mögliche Ursache | Was tun |
|---|---|---|
| Anruf kommt nicht an, im Asterisk-Protokoll nichts | Anbieter erreicht den Server nicht, oder Anmeldung fehlgeschlagen | Zustand der Leitung prüfen; Zugangsdaten; ggf. „Weitere Server des Anbieters“ ergänzen |
| Der Anbieter spielt "bitte rufen Sie später an", bei Asterisk kommt kein `INVITE` an (Server hinter Firewall/Router) | Die Firewall vergisst den Weg für eingehende Anrufe (UDP, ca. 60 s Stille) | **Haltesignal** bei der Leitung auf `25` setzen, Öffentliche Adresse eintragen, ggf. in der Firewall die UDP-Wartezeit für Port 5060 erhöhen |
| Anruf wird angenommen, aber **Stille** | Ton (RTP) kommt nicht durch (NAT) | Öffentliche Adresse und Heimnetz eintragen, UDP 10000–10100 weiterleiten |
| Leitung "Rejected", im Protokoll "No response received", aber im Mitschnitt (`tcpdump`) geht **kein Paket** zum Anbieter | Asterisk wurde gestartet, bevor es einen SIP-Transport gab ("UDP+IPv4 is not an available SIP transport") | `docker compose restart asterisk`. Mit der Grundkonfiguration ab dieser Fassung tritt es nicht mehr auf |
| Aura schweigt, Anruf endet gleich | AuraChat-Verbindung (Lizenz, Schlüssel, Piper liefert kein WAV) | *Einstellungen → AuraChat → Speichern und testen* |
| „Ich habe gerade ein technisches Problem“ | Ein Dienst fiel aus (Modell, Spracherkennung) | `docker compose logs auracall` (Zeilen „Dienstfehler“) |
| Antworten dauern lange | Modell zu langsam (sehr grosse Modelle auf schwacher Grafikkarte) | Kleineres Modell für AuraChat; „Denken“ in AuraChat aus lassen; Aura sagt nach 3,5 s „Einen Moment bitte“ |
| Aura wird oft unterbrochen / hört Leitungsgeräusche | Empfindlichkeit | *Einstellungen → Ton → Empfindlichkeit* (laut/leise) |
| Ausgehender Anruf abgelehnt | Eine Schutzregel greift | Die Meldung nennt den Grund (Land, Zeit, Limit, Leitung nicht angemeldet …) |

Nützliche Befehle: `docker compose logs -f asterisk auracall` · `docker compose exec asterisk asterisk -rx "pjsip set logger on"` (SIP-Verkehr anzeigen) · `docker compose exec asterisk asterisk -rx "core show channels"`.

## Sicherheit

* **Gesperrte Zugänge:** Die Verwaltung verlangt ein Passwort (mind. 10 Zeichen, Pflicht zum Ändern beim ersten Mal); nach 5 Fehlversuchen ist das Konto 15 Minuten gesperrt; zusätzlich wird je Adresse gebremst. Stellen Sie die Verwaltung **nicht offen ins Internet**; besser hinter Ihren Proxy (`TRUST_PROXY=true`, `AURACALL_BIND=127.0.0.1`) oder ins VPN.
* **Missbrauchsschutz für Telefonkosten:** siehe Tabelle bei den ausgehenden Anrufen. Zusätzlich nimmt Asterisk **nur** Anrufe vom Server Ihres Anbieters an (Zuordnung über die Adresse); alle anderen werden abgewiesen.
* **Firewall:** Port 5060 nur für die Adressen Ihres Anbieters freigeben, nicht für alle.
* **Befehlsmodule abgeschaltet:** Asterisk kann keine Systembefehle ausführen (Modul `app_system` u. a. gesperrt), die Steuerung (AMI) hört nur auf 127.0.0.1.
* **Geheimnisse:** Das Leitungs-Passwort und der API-Schlüssel stehen in `data/auracall.db` (nur für Benutzer 1000 lesbar) und werden nie in der Verwaltung angezeigt. Die Geheimnisse der Zwei-Faktor-Anmeldung liegen dort **verschlüsselt**; der Schlüssel dafür ist die Datei `data/secret.key`. **Sichern Sie `data/` samt `secret.key` wie ein Passwort-Verzeichnis.** Ohne diese Datei sind die 2FA-Geheimnisse einer wiederhergestellten Datenbank unlesbar (siehe Notfall unten).

## Lizenz

AuraCall wird wie die anderen Aura-Produkte über den **Lizenzserver (AuraLic)** lizenziert. Dort beim Erzeugen einer Lizenz als Produkt **AuraCall** wählen und den Schlüssel in AuraCall unter **Lizenz** eintragen (oder den Inhalt der `.lic`-Datei einfügen).

* **Probezeit:** 14 Tage ab dem ersten Start, ohne Schlüssel. Danach braucht AuraCall eine gültige Lizenz. (AuraCall zählt als *Anwendung*; die Gratis-Regeln der Dienste AuraDirect/AuraMail gelten hier nicht.)
* **Ohne gültige Lizenz** nimmt Aura **keine Anrufe mehr an** (sie wird sofort aufgelegt und im Anrufprotokoll als „abgewiesen, Lizenz“ vermerkt) und **wählt nicht mehr** (auch keine geplanten Anrufe, auch nicht auf Wunsch von AuraChat). **Laufende Gespräche werden nicht abgebrochen.** In der Verwaltung bleiben nur Anmelden, Passwort, 2FA und die Lizenz-Seite offen. Ein gelbes Band warnt während der Probezeit und 14 Tage vor Ablauf, ein rotes zeigt den gesperrten Zustand.
* **`LICENSE_SECRET`:** muss **derselbe Wert** sein wie auf dem Lizenzserver (und bei AuraChat). Ohne ihn lässt sich kein Schlüssel prüfen, AuraCall läuft dann nur die Probezeit. Bei einer **bestehenden** `.env` die Zeile `LICENSE_SECRET=…` von Hand ergänzen (`setup.sh` ändert eine vorhandene `.env` nicht), dann `docker compose up -d`.
* **Rückmeldung beim Lizenzserver** (wie bei AuraChat): kurz nach dem Start, danach alle 12 Stunden und nach jeder Änderung des Schlüssels, bei Netzproblemen mit Wiederholungen. Gesendet werden **nur** der Lizenzschlüssel (oder leer), eine zufällige Installationskennung, die Programmversion und die Zahl der Konten; der Lizenzserver sieht dabei die Internetadresse dieses Servers. **Nie Anrufe, Rufnummern oder Gespräche.** Standard ist der Lizenzserver des Herstellers (`LICENSE_CHECKIN_HOST`); `LICENSE_CHECKIN_HOST=` (leer) in der `.env` schaltet die Rückmeldung aus. Die Datenschutzerklärung nennt die Rückmeldung automatisch, wenn sie eingeschaltet ist.
* **Hinweis:** Die Rückmeldung läuft wie bei AuraChat unverschlüsselt über HTTP (Port 8451); wer das nicht möchte, lässt sie über den eigenen Reverse Proxy führen oder schaltet sie aus.

## Anmeldung: Zwei-Faktor und AuraDirect

**Zwei-Faktor-Anmeldung (2FA).** Reiter **Sicherheit → Zwei-Faktor-Anmeldung → Einrichten**: den QR-Code mit einer Authenticator-App scannen (Google Authenticator, Microsoft Authenticator, Aegis, 1Password …), den 6-stelligen Code eingeben und die **10 Notfall-Codes** sicher aufbewahren (werden nur einmal angezeigt, jeder gilt einmal). Beim Anmelden kommt nach dem Passwort ein zweites Feld für den Code oder einen Notfall-Code. Ausschalten und neue Notfall-Codes verlangen erneut Passwort **und** Code. Jeder Code gilt nur einmal (ein mitgelesener Code taugt nicht ein zweites Mal); falsche Codes zählen wie falsche Passwörter (5 Fehlversuche, 15 Minuten gesperrt). Unter **Pflicht für alle** lässt sich die 2FA für alle lokalen Konten vorschreiben (wer sie noch nicht hat, richtet sie beim nächsten Aufruf ein).

**Notfall (Handy weg, keine Notfall-Codes mehr).** In der `.env` `AURACALL_RESET_2FA=admin` (oder den Namen des Kontos) eintragen, `docker compose up -d` ausführen: die 2FA dieses Kontos ist aus. **Danach die Zeile wieder leer lassen.** Das Zurücksetzen steht im Änderungsprotokoll. Wer die `.env` des Servers ändern kann, hat ohnehin Zugriff als Betreiber. Fehlt die Datei `data/secret.key`, sind die gespeicherten 2FA-Geheimnisse unlesbar; auch dann hilft dieses Zurücksetzen.

**AuraDirect** (zentrale Benutzerverwaltung, auch mit Active Directory). Reiter **Sicherheit → AuraDirect**: Adresse (z. B. `http://192.168.1.10:4000`) und den **Dienst-Schlüssel** eintragen (steht in AuraDirect oben auf der Benutzerseite), „Anmeldung über AuraDirect erlauben“ ankreuzen, **Speichern und testen**. In AuraDirect muss bei jeder Person **AuraCall** aktiviert sein (einzige Rolle: Administrator:in); dazu AuraDirect auf den neuen Stand bringen. Dann melden sich Personen mit ihrem AuraDirect-Konto an, auch mit dessen 2FA. Wichtig zu wissen:

* Das Konto **`admin` bleibt immer lokal** (Notzugang, funktioniert auch ohne AuraDirect). Ist AuraDirect nicht erreichbar, kommen Personen aus AuraDirect **nicht** hinein (es gibt keinen Umweg über ein lokales Passwort); lokale Konten schon.
* Das Passwort einer Person aus AuraDirect wird **nur zur Prüfung dorthin geschickt und nie gespeichert**. AuraCall legt beim ersten Anmelden ein Konto an (Name, Anmeldezeit).
* Ein **lokales Konto** mit gleichem Namen wird nie übernommen (Meldung, bitte umbenennen).
* Zugriff **entziehen** Sie in AuraDirect (dort entscheidet die Prüfung bei jeder Anmeldung); „Entfernen“ in AuraCall löscht nur das Konto hier und beendet seine Anmeldungen. Bereits angemeldete Personen bleiben bis zum Ende ihrer Sitzung (12 Stunden) angemeldet.
* Die „2FA für alle“-Pflicht gilt für **lokale** Konten; Personen aus AuraDirect nutzen die 2FA von AuraDirect.

## Datenschutz und Recht (bitte selbst prüfen)

* **Datenschutzerklärung:** Unter `http://<Server>:8110/datenschutz` (Deutsch, `?lang=en` Englisch) liegt eine fertige Erklärung, **ohne Anmeldung lesbar**, damit Sie darauf verweisen können (zum Beispiel von Ihrer Webseite, indem Sie AuraCall hinter Ihrem Proxy erreichbar machen oder den Text übernehmen). Sie wird aus den Einstellungen gebaut (Aufbewahrungstage, Textspeicherung, AuraDirect, 2FA), damit sie nicht anders sagt, als das Programm tut. **Tragen Sie unter Sicherheit → Datenschutzerklärung Ihre Firma, Adresse und Kontaktangaben ein.** Das ist eine **Vorlage, keine Rechtsberatung**: Bitte prüfen Sie sie und stimmen Sie sie mit Ihrer Rechtsberatung ab. Sie geht davon aus, dass AuraChat bei Ihnen selbst läuft; verwenden Sie dort einen externen KI-Dienst, nennen Sie ihn unter „Ergänzende Angaben“. Ehrlich festgehalten ist darin auch, dass die Telefonverbindung heute nicht zusätzlich verschlüsselt ist.

* Aura sagt zu Beginn jedes Gesprächs, dass sie eine **KI** ist; ein Begrüssungstext ohne diesen Hinweis wird abgelehnt (Offenlegung gegenüber Anrufenden).
* **Es wird kein Ton aufgezeichnet.** Standardmässig wird vom Gespräch **nichts** gespeichert ausser Zeit, Nummer, Dauer und Ausgang. Schalten Sie **„Gespräch als Text speichern“** ein, sagt Aura zu Beginn, dass das Gespräch als Text gespeichert wird; Aufbewahrung einstellbar (Standard 30 Tage).
* Ausgehende Anrufe sind für **Rückfragen und Service** gedacht. Werbeanrufe sind in vielen Ländern stark eingeschränkt; das müssen Sie selbst prüfen. Dies ist keine Rechtsberatung.

## Technisches

**Umgebung (`.env`):** `AMI_SECRET` (von `setup.sh`), `AURACALL_PORT` (8110), `AURACALL_BIND` (0.0.0.0), `TRUST_PROXY` (false), `ADMIN_PASSWORD` (optional). **Ordner:** `data/` (Datenbank), `asterisk-conf/` (von AuraCall erzeugte Dateien, in Asterisk eingebunden). Eigene Zusätze für Asterisk: `pjsip_custom.conf`, `extensions_custom.conf` im Konfigurationsordner von Asterisk.

**Ton:** 8 kHz, 16 Bit (Asterisk AudioSocket). Sprachausgabe wird von AuraChat in WAV geliefert und umgerechnet.

**Asterisk-Image:** Debian 13 enthält kein Asterisk-Paket mehr, deshalb baut der Container **Asterisk 22 (LTS) aus dem offiziellen Quellcode**. Der erste `docker compose build` dauert etwa **10 bis 20 Minuten**, braucht Internet (downloads.asterisk.org, github.com) und ergibt ein grosses Image (einige hundert MB, weil die Bauwerkzeuge drinbleiben). Danach geht es aus dem Zwischenspeicher schnell. Eine feste Version: `docker compose build --build-arg ASTERISK_VERSION=22.5.2 asterisk`. Fehlt am Ende ein nötiges Modul, bricht der Bau mit der Liste der fehlenden Module ab.

**Noch nicht enthalten (mögliche nächste Schritte):** Weiterleiten an einen Menschen („Verbinde mich mit der Rezeption“), Erkennen eines Anrufbeantworters bei ausgehenden Anrufen, Tastenmenü, verschlüsseltes SIP (TLS/SRTP), Anbindung der Hotel-Funktionen (Apaleo) ans Telefon.
