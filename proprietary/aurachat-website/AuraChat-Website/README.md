# AuraChat-Website

Eigenständige Werbe-/Produktseite für AuraChat. Reine statische Seite (HTML/CSS,
keine externen Laufzeit-Abhängigkeiten wie Tailwind-CDN oder ein Build-Schritt),
ausgeliefert über nginx in einem eigenen, schlanken Docker-Container.

## Einrichtung

```bash
cd AuraChat-Website
sudo docker compose up -d --build
```

Danach erreichbar unter `http://<Server-IP>:8098`. Port bei Bedarf in
`docker-compose.yml` anpassen.

## Eigene Domain / HTTPS

Dieses Projekt bringt bewusst kein eigenes Caddy/SSL mit (genau wie der
Lizenz-Server) - setzt euren bereits vorhandenen Reverse Proxy davor, der intern
auf Port 8098 dieser Maschine zeigt.

## Inhalte anpassen

- `html/index.html` - Texte, Struktur
- `html/style.css` - Farben, Abstände, Layout (Markenfarben ganz oben unter `:root` in
  `style.css` definiert - dort zentral änderbar)
- `html/images/` - Logos und Fotos. `logo.png` (Kopfzeile/Fusszeile),
  `academy-logo.png` (Aura-Academy-Abschnitt), `aura-hero.jpeg` (Titelbild),
  `favicon.png`

Nach jeder Änderung an den Dateien reicht ein einfacher Neustart, kein Rebuild
nötig, solange nur `html/` verändert wurde:

```bash
sudo docker compose restart
```

Nur bei Änderungen an `Dockerfile` oder `nginx.conf` ist ein `--build` nötig.

## Produkte auf der Seite und wie die Texte entstehen

Die Seite zeigt AuraChat und die Produkte AuraPlan, AuraDirect, AuraMail, AuraTicket, AuraProxy und AuraCall (Abschnitt `#produkte` mit einer
Übersicht, darunter je ein Abschnitt). Texte stehen in fünf Sprachen (Deutsch, Englisch, Französisch, Italienisch, Spanisch) in
`html/translations.js`. Wer einen Text ändern oder ein Produkt ergänzen will, ändert **nicht** die erzeugten Dateien, sondern die Quelle:

- `build/content.js` – Texte der Produkte AuraMail, AuraTicket, AuraProxy und gemeinsame Texte
- `build/content_new.js` – AuraCall und alle neueren Texte (Hotel/Apaleo, Telefon, Bildschirmformat, Gedächtnis, Cockpit)
- `build/base/index.html` – Ausgangs-HTML (mit den Suchmaschinen-Angaben)

Neu bauen (Node.js genügt):

```bash
cd build && ./build.sh                # index.html und translations.js neu erzeugen
cd build && ./build.sh datasheets     # zusätzlich die AuraCall-Datenblätter (docx, 5 Sprachen) neu erzeugen
```

Der Bau ist wiederholbar (mehrfaches Ausführen ergibt dasselbe). Danach `docker compose restart`.

**Was auf der Seite über ein Produkt steht, muss das Produkt können.** Neue Aussagen nur schreiben, wenn der Code sie hergibt.

Download-Dateien: Datenblätter (`*.docx`) und Schnellstart-Pakete (`*-quickstart.zip`) liegen in `html/downloads/`. AuraCall hat kein
Schnellstart-Paket (es wird auf Anfrage bereitgestellt); stattdessen führt eine Karte zum Kontaktbereich.
