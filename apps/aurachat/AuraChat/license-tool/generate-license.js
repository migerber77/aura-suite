#!/usr/bin/env node
/**
 * AuraChat Lizenz-Generator
 * -------------------------
 * Erzeugt einen signierten Lizenzschlüssel für AuraChat-Premium-Features.
 * Läuft NUR lokal bei dir - ist NICHT Teil des Docker-Containers und wird
 * nicht deployed. Braucht denselben LICENSE_SECRET wie dein Server (siehe .env).
 *
 * Nutzung:
 *   node generate-license.js --customer "Firma XY" --features ssl,chat_bg --secret DEIN_LICENSE_SECRET
 *   node generate-license.js --customer "Firma XY" --all --secret DEIN_LICENSE_SECRET   (alle aktuellen Features)
 *
 * Optional:
 *   --expires 2027-12-31        (Ablaufdatum, ohne Angabe = unbegrenzt gültig)
 *   --max-users 10              (max. Gesamtzahl Benutzerkonten, ohne Angabe = unbegrenzt)
 *   --max-admins 2              (max. Anzahl Administrator-Konten, ohne Angabe = unbegrenzt)
 *   --secret ...                (falls nicht als LICENSE_SECRET Umgebungsvariable gesetzt)
 *
 * Verfügbare Features aktuell: ssl, chat_bg, tts_stt, api_access, avatar, integrations, image_gen, coding_model, study_report, dual_model, email, academy, rebrand
 * (weitere können später einfach als zusätzlicher Wert bei --features übergeben werden,
 *  ohne dass Server-Code geändert werden muss, solange die jeweilige Stelle im Server
 *  mit requireLicenseFeature('feature_name') danach fragt)
 */

const fs = require('fs');
const crypto = require('crypto');

function parseArgs() {
    const args = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            const key = argv[i].slice(2);
            const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
            args[key] = value;
            if (value !== true) i++;
        }
    }
    return args;
}

const args = parseArgs();
const secret = args.secret || process.env.LICENSE_SECRET;

if (!secret) {
    console.error('❌ Fehler: --secret angeben oder LICENSE_SECRET als Umgebungsvariable setzen.');
    process.exit(1);
}
if (!args.customer) {
    console.error('❌ Fehler: --customer ist erforderlich, z.B. --customer "Firma XY"');
    process.exit(1);
}

const ALL_CURRENT_FEATURES = ['ssl', 'chat_bg', 'tts_stt', 'api_access', 'avatar', 'integrations', 'image_gen', 'coding_model', 'study_report', 'dual_model', 'email', 'academy', 'rebrand'];

const features = args.all
    ? ALL_CURRENT_FEATURES
    : String(args.features || '')
        .split(',')
        .map(f => f.trim())
        .filter(Boolean);

if (features.length === 0) {
    console.error('❌ Fehler: --features ist erforderlich, z.B. --features ssl,chat_bg (oder --all für alle aktuellen Features)');
    process.exit(1);
}

let expiresAt = null;
if (args.expires) {
    const d = new Date(args.expires);
    if (isNaN(d.getTime())) {
        console.error('❌ Fehler: --expires ist kein gültiges Datum (Format: JJJJ-MM-TT)');
        process.exit(1);
    }
    expiresAt = d.toISOString();
}

function parsePositiveIntOrNull(value, flagName) {
    if (value === undefined) return null; // nicht angegeben = unbegrenzt
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0) {
        console.error(`❌ Fehler: ${flagName} muss eine positive Zahl sein.`);
        process.exit(1);
    }
    return n;
}

const maxUsers = parsePositiveIntOrNull(args['max-users'], '--max-users');
const maxAdmins = parsePositiveIntOrNull(args['max-admins'], '--max-admins');

const payload = {
    customer: args.customer,
    features,
    issuedAt: new Date().toISOString(),
    expiresAt,
    maxUsers,
    maxAdmins
};

const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
const licenseKey = `${payloadB64}.${signature}`;

console.log('\n✅ Lizenzschlüssel erzeugt');
console.log('───────────────────────────');
console.log('Kunde:      ', args.customer);
console.log('Features:   ', features.join(', '));
console.log('Gültig bis: ', expiresAt || 'unbegrenzt');
console.log('Max. Nutzer:', maxUsers === null ? 'unbegrenzt' : maxUsers);
console.log('Max. Admins:', maxAdmins === null ? 'unbegrenzt' : maxAdmins);
console.log('───────────────────────────\n');
console.log(licenseKey);
console.log('\nDiesen kompletten String kann der Kunde im Admin Panel -> Lizenz als');
console.log('Seriennummer einfügen ODER als .lic-Datei hochladen (unten gespeichert).\n');

const filename = `${String(args.customer).replace(/[^a-z0-9]/gi, '_')}.lic`;
fs.writeFileSync(filename, licenseKey);
console.log(`📄 Auch gespeichert als: ${filename}`);
