# AuraDirect

Zentrale Benutzerverwaltung für AuraChat und AuraPlan — legt fest, wer worauf Zugriff hat
und mit welcher Rolle, wahlweise mit Anbindung an ein bestehendes Active Directory.

## Einrichtung

```bash
cp .env.example .env
```

`.env` ausfüllen:
- `SESSION_SECRET` — z.B. `openssl rand -hex 32`
- `AURADIRECT_ADMIN_PASSWORD` — Passwort für den Login `admin` im AuraDirect-eigenen Panel
- `AURADIRECT_SERVICE_KEY` — kann leer gelassen werden! Wird beim allerersten Start
  automatisch erzeugt und danach oben auf der Benutzerseite im Admin Panel angezeigt
  (mit Kopieren-Knopf). **Diesen Wert dann in AuraChat und AuraPlan eintragen** (jeweiliges
  Admin Panel, zusammen mit dieser Server-Adresse) — das ist das "Passwort", mit dem sich
  die beiden Produkte bei AuraDirect ausweisen, wenn sie eine Anmeldung prüfen wollen.

```bash
sudo docker compose up -d --build
```

Erreichbar unter `http://<Server-IP>:4000`, Login `admin` + das gesetzte Passwort.

## Active Directory anbinden (optional)

Unter "🔌 Active Directory": Server-URL, Dienstkonto (ein AD-Benutzer mit Leserechten,
kein Admin nötig), Basis-DN (wo nach Benutzern gesucht wird), sowie ein Suchfilter.

Typische Werte für ein klassisches Windows-AD:
- Server-URL: `ldap://euer-dc.firma.local:389` (oder `ldaps://` mit Port 636, falls TLS
  eingerichtet ist)
- Dienstkonto: `CN=svc-auradirect,OU=Service Accounts,DC=firma,DC=local`
- Basis-DN: `OU=Benutzer,DC=firma,DC=local`
- Filter: `(objectClass=user)`
- Attribut für Benutzernamen: `sAMAccountName`

Mit "🔍 Verbindung testen" prüfen, ob Server-URL und Dienstkonto stimmen, bevor ihr
"🔄 Benutzer synchronisieren" nutzt (holt alle passenden AD-Benutzer als Übersicht in
AuraDirect — den Zugriff auf AuraChat/AuraPlan pro Person danach einzeln zuteilen).

**Wichtig:** Synchronisieren holt nur Namen/E-Mail/Benutzername — Passwörter bleiben immer
in eurem AD, AuraDirect prüft sie bei jeder Anmeldung live dort nach, speichert sie nie.

## Eigener LDAP-Verzeichnisdienst

AuraDirect ist selbst auch ein echter LDAP-Server (Port 389, Standard-LDAP-Port) – nicht
nur eine REST-Schnittstelle für AuraChat/AuraPlan. Andere LDAP-fähige Programme (WLAN-
Controller, VPN, GitLab, Proxmox, etc.) können sich direkt gegen AuraDirect authentifizieren.

Anbindungsdaten für ein drittes Programm:
- **Server:** `ldap://<Server-IP>:389`
- **Basis-DN:** `ou=users,dc=auradirect`
- **Bind-DN-Schema pro Person:** `uid=<benutzername>,ou=users,dc=auradirect`
- **Suche:** anonym lesbar (nur unkritische Attribute: `cn`, `uid`, `mail` — nie Passwörter)
- **Anmeldung (Bind):** verlangt Benutzername + Passwort; bei lokalen Konten wird das
  hinterlegte Passwort geprüft, bei per AD synchronisierten Konten live gegen euer
  eigentliches Active Directory weitergereicht — AuraDirect speichert AD-Passwörter nie.

## Ohne Active Directory

Auch ganz ohne AD nutzbar — dann einfach "+ Neuer lokaler Benutzer" verwenden, Passwort wird
sicher bei AuraDirect selbst gespeichert (wie bisher bei AuraChat/AuraPlan üblich).

## AuraCall (Telefon-Anbindung)

Im Formular jeder Person gibt es zusätzlich **AuraCall** (einzige Rolle: Administrator:in, Zugang zur Verwaltung von AuraCall). In AuraCall unter *Sicherheit → AuraDirect* Adresse und Dienst-Schlüssel dieses AuraDirect eintragen. Danach melden sich Personen dort mit ihrem AuraDirect-Konto an, auch mit der zentralen 2FA von AuraDirect. Das Konto `admin` in AuraCall bleibt immer lokal.

## Wie die Anbindung an AuraChat/AuraPlan funktioniert

Beide Produkte fragen bei der Anmeldung **zuerst** bei AuraDirect nach (falls dort im Admin
Panel eine AuraDirect-Adresse eingetragen ist) — schlägt das fehl oder ist AuraDirect nicht
erreichbar, fällt das jeweilige Produkt automatisch auf die eigene, lokale Anmeldung zurück.
Nichts Bestehendes bricht dadurch — AuraDirect ist eine Ergänzung, kein Ersatz, der zuerst
alles umbauen müsste.
