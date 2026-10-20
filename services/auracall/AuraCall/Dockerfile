# AuraCall - Telefon-Anbindung für AuraChat. Ohne fremde Pakete: nur Node.js (eingebaute Datenbank und Verschlüsselung).
# Basis wie bei den anderen Aura-Produkten: Node 24 auf Debian 13 "trixie". Umschaltbar:  --build-arg NODE_IMAGE=node:24-bookworm-slim
ARG NODE_IMAGE=node:24-trixie-slim
FROM ${NODE_IMAGE}

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json server.js ./
COPY lib ./lib
COPY html ./html

# Paketverwaltung und Corepack werden im fertigen Image nicht gebraucht (und tragen nur Schwachstellen bei)
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Selbsttest beim Bauen: laden sich alle Teile (und gibt es die eingebaute Datenbank)? Sonst bricht der Bau mit dem Namen des Teils ab.
RUN node --disable-warning=ExperimentalWarning -e "for (const m of ['db','web','audio','vad','audiosocket','ami','aura-client','prompt','call-session','asterisk-config','phone','settings','manager','auth','auradirect','privacy','qr','totp','license']) { try { require('./lib/' + m); } catch (e) { console.error('FEHLER: Teil \"' + m + '\" lässt sich nicht laden: ' + e.message); process.exit(1); } } require('./server.js'); console.log('Alle Teile laden.');"

RUN mkdir -p /data /asterisk-conf && chown -R node:node /data /asterisk-conf /app
USER node
ENV NODE_ENV=production DATA_DIR=/data ASTERISK_CONF_DIR=/asterisk-conf AURACALL_PORT=8110
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.AURACALL_PORT||8110)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
