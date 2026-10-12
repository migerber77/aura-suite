# Node 24 (aktive Langzeitversion) auf Debian 13 "trixie" (aktuelle stabile Debian-Version; Debian 14 ist noch in Entwicklung, ohne Sicherheits-Support).
# Zurück auf Debian 12 zum Ausprobieren: docker compose build --build-arg NODE_IMAGE=node:24-bookworm-slim
ARG NODE_IMAGE=node:24-trixie-slim
FROM ${NODE_IMAGE}
# Sicherheits-Updates der Debian-Pakete einspielen (alles, was seit dem Basis-Image korrigiert wurde). Gilt, solange dieser Schritt nicht aus dem
# Zwischenspeicher kommt: regelmässig mit "docker compose build --pull --no-cache" bauen.
RUN set -eux; \
    for i in 1 2 3; do \
        apt-get update && break; \
        echo "apt-get update fehlgeschlagen (Versuch $i von 3), warte 15 Sekunden ..."; \
        sleep 15; \
    done; \
    apt-get upgrade -y --no-install-recommends; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev
# Prüft gleich beim Bauen, dass JEDE Abhängigkeit unter dieser Node-Version lädt (auch die nativen Module wie sqlite3 und bcrypt). Sonst bricht der Bau
# mit dem Namen des Moduls ab, statt dass der Fehler erst im Betrieb auffällt.
RUN node -e 'const d = Object.keys(require("./package.json").dependencies); for (const m of d) { try { require(m); } catch (e) { console.error("Modul " + m + " laesst sich unter Node " + process.version + " nicht laden: " + e.message); process.exit(1); } } console.log("Alle " + d.length + " Module laden unter Node " + process.version)'

COPY server.js ./
COPY html ./html

# Zur Laufzeit werden npm und Yarn nicht gebraucht (Start: "node server.js"). Sie samt ihren Bibliotheken (tar, glob, minimatch ...) aus dem
# fertigen Image zu entfernen verkleinert die Angriffsfläche und die Zahl der Schwachstellen-Meldungen ohne Nutzen.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

EXPOSE 4000

CMD ["node", "server.js"]
