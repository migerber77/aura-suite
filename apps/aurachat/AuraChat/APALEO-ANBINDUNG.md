# AuraChat × Apaleo: Anbindung per OAuth 2.0 (Zertifizierung)

Stand der Punkte aus der Mail von Apaleo (Technical Partnerships) und wie sie umgesetzt sind.

| Punkt von Apaleo | Stand |
|---|---|
| OAuth 2.0 Code Grant Flow statt manueller Zugangsdaten | **umgesetzt** (siehe unten). Im Admin Panel gibt es nur noch „Mit Apaleo verbinden“. |
| Berechtigungen auf das Minimum reduzieren | **Entscheidung nötig** (Schreibrechte, siehe unten). Die Rechte werden bei der Registrierung der Store-App in Apaleo festgelegt, nicht in AuraChat. |
| Hausauswahl mit Filterung in API und Webhooks | **umgesetzt**: Hausauswahl im Admin Panel, jede Abfrage mit `propertyId`, Prüfung des Hauses vor jeder Änderung. **Webhooks verwendet AuraChat nicht** (es gibt nichts zu filtern). |
| Store-Eintrag ausfüllen | **offen, von Ihnen** (Texte, Logo, Preise im Apaleo Store). |

## 1. Wie die Verbindung funktioniert

AuraChat läuft selbst gehostet bei jedem Kunden. Apaleo verlangt für Store-Apps eine vorab eingetragene Redirect URI und das geheime `client_secret` beim Tauschen und Erneuern der Token. Das Geheimnis darf nicht in jede Installation. Deshalb gibt es einen **Vermittler beim Hersteller** (im Lizenzserver AuraLic, Datei `apaleo-connect.js`):

1. Der Kunden-Admin klickt in AuraChat auf **„Mit Apaleo verbinden“**. AuraChat erzeugt eine Geheimzahl (bleibt verschlüsselt in der Installation) und schickt den Browser zum Vermittler; nur die Prüfsumme (SHA-256) der Geheimzahl geht mit.
2. Der Vermittler zeigt eine **Bestätigungsseite** („Die Zugangsdaten gehen an: https://chat.kunde.ch“) und leitet erst nach Klick zu `identity.apaleo.com/connect/authorize` weiter (`response_type=code`, `scope=offline_access openid profile`, `state`).
3. Der Kunde meldet sich bei Apaleo an und **wählt dort die Häuser** (feingranularer Client). Apaleo leitet zur Redirect URI des Vermittlers zurück.
4. Der Vermittler tauscht den Code (`/connect/token`, `grant_type=authorization_code`) und leitet den Browser mit einer **einmaligen Übergabe-Kennung** zur Installation zurück (`/api/apaleo/return`).
5. Die Installation holt die Token **serverseitig** beim Vermittler ab (nur mit der Geheimzahl; einmalig; 2 Minuten gültig) und speichert sie **verschlüsselt** (AES-256-GCM, Schlüssel aus `SESSION_SECRET`).
6. Das Erneuern (`grant_type=refresh_token`) läuft über den Vermittler, der `client_id` und `client_secret` hinzufügt. Wird die Verbindung von Apaleo beendet (Antwort „no longer eligible“, `invalid_grant`), trennt AuraChat sie und zeigt „Bitte neu verbinden“ **ohne** Benutzer- oder Kontodaten.

Der Vermittler **speichert keine Token** (nur Minuten im Speicher), gibt keinen `id_token` und keine Fehlertexte von Apaleo weiter, begrenzt Anfragen je Adresse und nimmt als Rückkehr-Adresse nur genau den Pfad `/api/apaleo/return` an (kein offener Weiterleiter).

**Aus dem Apaleo Store:** Landing page ist `https://<Vermittler>/apaleo/landing`. Dort gibt der Kunde die Adresse seiner AuraChat ein; es geht weiter zu `<seine Adresse>/api/apaleo/connect-start` (Anmeldung als Admin nötig) und dann wie oben. Die Erfolgsseite („Sie sind mit Apaleo verbunden“) zeigt die freigegebenen Häuser.

## Erreichbarkeit des Vermittlers (https)

Der Vermittler (AuraLic) muss aus dem Internet **per https** erreichbar sein, unter der Adresse, die in AuraChat als `APALEO_CONNECT_URL` gilt (Standard: `https://auralic.gerber-backoffice-solutions.com`, ohne Port). Das ist doppelt nötig: Apaleo verlangt für die Redirect URI https, und der Browser des Kunden geht zuerst zum Vermittler.
AuraLic selbst spricht nur http (Port 3001 im Container, 8451 auf dem Host). Ohne einen https-Eingang davor zeigt der Browser **ERR_SSL_PROTOCOL_ERROR**; AuraChat meldet dasselbe jetzt schon vor der Weiterleitung („antwortet nicht per https“).

**Variante A: AuraProxy / Caddy.** Eintrag für `auralic.gerber-backoffice-solutions.com` mit Ziel `http://<Adresse des NAS>:8451`; Caddy holt das Zertifikat selbst (Let's Encrypt). Als Caddyfile:

    auralic.gerber-backoffice-solutions.com {
        reverse_proxy <Adresse des NAS>:8451
    }

Voraussetzung: Der Name zeigt per DNS auf den Server, und die Ports 80 und 443 aus dem Internet erreichen diesen Caddy (Portweiterleitung am Router).

**Variante B: Reverse-Proxy des Synology-NAS.** Systemsteuerung → Anmeldeportal → Erweitert → Reverse-Proxy: Quelle HTTPS, Hostname `auralic.gerber-backoffice-solutions.com`, Port 443; Ziel HTTP, `localhost`, Port 8451. Das Zertifikat (Let's Encrypt) unter Systemsteuerung → Sicherheit → Zertifikat dem Eintrag zuweisen. (Die Bezeichnungen hängen von der DSM-Version ab.)

**Prüfen** (von einem Rechner im Internet bzw. im Heimnetz):

    curl -I https://auralic.gerber-backoffice-solutions.com/apaleo/landing    # 200 = eingerichtet, 503 = läuft, aber APALEO_* fehlen noch
    curl -I http://<Adresse des NAS>:8451/apaleo/landing                      # ohne https-Eingang: 200 oder 503 heisst, AuraLic ist auf dem neuen Stand

**Im Heimnetz:** Ruft AuraChat die öffentliche Adresse von innen auf, braucht der Router „NAT-Loopback“, oder der Name muss im internen DNS direkt auf das NAS zeigen. Sonst kommt die Verbindung nicht zustande, obwohl sie von außen funktioniert.

**Meldungen in AuraChat** (Admin Panel → API → Apaleo → „Mit Apaleo verbinden“ oder „Verbindung testen“):

| Meldung | Ursache |
|---|---|
| antwortet nicht per https | Port spricht nur http, oder es gibt kein Zertifikat (Browser: ERR_SSL_PROTOCOL_ERROR) |
| Zertifikat … nicht gültig | abgelaufen, selbst signiert oder falscher Name |
| nimmt niemand Verbindungen an | Dienst läuft nicht, Port nicht freigegeben, falsche Adresse |
| nicht gefunden (DNS) | der Name zeigt nirgendwohin |
| bricht die Verbindung ab | https auf einem Port, der nur http spricht, oder falsche Portweiterleitung |
| keine Antwort (Zeitlimit) | Firewall oder Portweiterleitung |
| noch nicht eingerichtet | in AuraLic fehlen `APALEO_CLIENT_ID`, `APALEO_CLIENT_SECRET` oder `APALEO_REDIRECT_URI` |
| noch nicht auf dem neuen Stand | altes AuraLic ohne Vermittler (404): `AuraLic.zip` einspielen |
| leitet weiter | davor liegt eine Anmeldeseite oder eine Weiterleitung |
| nicht der Apaleo-Vermittler | die Adresse gehört zu einem anderen Dienst |

## 2. Einrichtung in Apaleo (einmalig, beim Hersteller)

1. Apaleo → Apps → **My store apps** → *Add a new store app*.
2. **Client access: Fine-grained client** (empfohlen, nicht änderbar).
3. **Redirect URI:** `https://<Vermittler>/apaleo/callback` (muss https sein und genau der Wert `APALEO_REDIRECT_URI` im Lizenzserver sein).
4. **Personally identifiable information:** Hotelmitarbeitende fragen nach Gästen (Name, Reservierung), Gäste prüfen sich mit Nummer und Nachname. Dafür ist **„Retrieve“** nötig. Diese Wahl ist nicht änderbar; Apaleo empfiehlt die restriktivste mögliche.
5. **Permissions:** siehe Tabelle unten.
6. `client_id` und `client_secret` in die `.env` des Lizenzservers (`APALEO_CLIENT_ID`, `APALEO_CLIENT_SECRET`, `APALEO_REDIRECT_URI`).

## 3. Aufrufe und benötigte Berechtigungen

Alle Aufrufe gehen an `https://api.apaleo.com`. Die genaue Berechtigung je Aufruf steht im Swagger der Core API (https://api.apaleo.com/swagger). **Bitte dort gegenprüfen**, bevor die App registriert wird; bei den mit * markierten Namen stammen sie aus dem Code von AuraChat.

| Funktion in AuraChat | Aufruf | Art | Berechtigung |
|---|---|---|---|
| Häuser (Auswahl, Zeitzone, Namen) | `GET /inventory/v1/properties` | lesen | im Swagger prüfen |
| Anreisen, Abreisen, Im Haus, Suche | `GET /booking/v1/reservations?propertyId=…` | lesen | im Swagger prüfen (Reservierungen lesen) |
| Eine Reservierung (Gäste „Mein Aufenthalt“, vor Änderungen) | `GET /booking/v1/reservations/{id}` | lesen | wie oben |
| Verfügbarkeit | `GET /availability/v1/unit-groups?propertyId=…` | lesen | im Swagger prüfen (Verfügbarkeit lesen) |
| Housekeeping-Abfragen, Zimmerliste | `GET /inventory/v1/units?propertyId=…`, `GET /inventory/v1/units/{id}` | lesen | `units.read`* |
| *(optional)* Check-in, Check-out | `PUT /booking/v1/reservation-actions/{id}/checkin`, `…/checkout` | schreiben | `reservations.manage`* |
| *(optional)* Zimmer zuweisen | `PUT /booking/v1/reservation-actions/{id}/assign-unit[/{unitId}]` | schreiben | `reservations.manage`* (oder `reservations.assign-unit`*) |
| *(optional)* Zimmer als schmutzig melden | `PATCH /inventory/v1/units/{id}` (nur `condition: Dirty`) | schreiben | `units.manage`* |

**Entscheidung nötig (Punkt 2 von Apaleo):** Die Schreibfunktionen sind in AuraChat standardmäßig **aus** und brauchen im Chat eine Bestätigung. Bei einem feingranularen Client gelten die Rechte aber **für jeden Kunden gleich**, und jeder verbindende Apaleo-Benutzer braucht eine Rolle mit allen diesen Rechten (je mehr Rechte, desto weniger Benutzer können verbinden). Zwei saubere Wege:
- **A (minimal, für die Zertifizierung am einfachsten):** Store-App nur mit **Leserechten**. Schreibfunktionen entfallen in dieser App.
- **B:** zweite Store-App „AuraChat (mit Änderungen)“ mit den Schreibrechten, für Kunden, die Check-in/-out aus dem Chat wollen.
Technisch lässt sich jede Variante abbilden; bitte vorher mit Apaleo klären, welche sie für die Zertifizierung bevorzugen.

## 4. Häuser: Auswahl und Filter

- Apaleo liefert die Häuser, die der Kunde **bei der Freigabe** gewählt hat. Im Admin Panel (API → Apaleo) wählt der Admin daraus die Häuser, mit denen AuraChat arbeitet (zunächst alle).
- Jede Listenabfrage trägt die `propertyId`. Eine Reservierung, die nach Kennung gelesen wird, wird **nach dem Lesen** gegen die gewählten Häuser geprüft (Gäste-Prüfung, Suche nach Nummer, Ausführung einer Änderung).
- **Mehrere Häuser:** Abfragen („Wer reist heute an?“) zeigen alle gewählten Häuser mit Überschrift, oder nur das in der Frage genannte (Kürzel oder Name). **Aktionen** (Check-in/-out, Zimmer zuweisen, Zimmer melden) brauchen bei mehreren Häusern das genannte Haus, sonst fragt AuraChat nach.
- Entzieht der Kunde in Apaleo ein Haus („Apps → Verbundene Apps“), gilt das sofort (403); AuraChat meldet „nicht mehr freigegeben“.

## 5. Beim Kunden

- Kein Eintragen von Client-ID, Secret oder Haus mehr. **Bestehende Installationen müssen einmal neu verbinden** („Mit Apaleo verbinden“); die alten Zugangsdaten werden dabei gelöscht.
- `APALEO_CONNECT_URL` (Standard: Vermittler des Herstellers) und `APALEO_RETURN_BASE` (nur hinter Proxy, öffentliche Adresse der AuraChat) stehen in `.env.example`.
- Die Token sind mit `SESSION_SECRET` verschlüsselt. **Ändert sich `SESSION_SECRET`, sind sie unlesbar** und es muss neu verbunden werden.

## 6. Test vor dem Zertifizierungsgespräch

1. Entwickler-Account bei Apaleo, Store-App registrieren (Abschnitt 2) mit Testhäusern.
2. Vermittler per https erreichbar machen (z. B. über AuraProxy); `APALEO_*` im Lizenzserver setzen.
3. In AuraChat: **Mit Apaleo verbinden** → Bestätigungsseite → Apaleo → Erfolgsseite. Häuser auswählen, **Verbindung testen**.
4. Prüfen: „Wer reist heute an?“ (mehrere Häuser), Haus nennen, Trennen in AuraChat und in Apaleo, Neu verbinden, Rechte des Benutzers in Apaleo ändern (Erneuerung muss „neu verbinden“ melden).
5. Erst danach den Termin buchen: https://meetings-eu1.hubspot.com/vitaliy-porsnev/certification
