# Node 24 (aktive Langzeitversion). Anderes Basis-Image zum Ausprobieren: docker compose build --build-arg NODE_IMAGE=node:22-alpine
ARG NODE_IMAGE=node:24-alpine
FROM ${NODE_IMAGE}

# Sicherheits-Updates der Alpine-Pakete einspielen
RUN apk upgrade --no-cache

WORKDIR /app

COPY package*.json ./
RUN npm install
# Prüft gleich beim Bauen, dass JEDE Abhängigkeit unter dieser Node-Version lädt (auch die nativen Module wie sqlite3 und bcrypt). Sonst bricht der Bau
# mit dem Namen des Moduls ab, statt dass der Fehler erst im Betrieb auffällt.
RUN node -e 'const d = Object.keys(require("./package.json").dependencies); for (const m of d) { try { require(m); } catch (e) { console.error("Modul " + m + " laesst sich unter Node " + process.version + " nicht laden: " + e.message); process.exit(1); } } console.log("Alle " + d.length + " Module laden unter Node " + process.version)'

COPY server.js ./
COPY html ./html

# Zur Laufzeit werden npm und Yarn nicht gebraucht (Start: "node server.js"). Sie samt ihren Bibliotheken (tar, glob, minimatch ...) aus dem
# fertigen Image zu entfernen verkleinert die Angriffsfläche und die Zahl der Schwachstellen-Meldungen ohne Nutzen.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

EXPOSE 3001

CMD ["node", "server.js"]
