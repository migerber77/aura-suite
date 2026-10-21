'use strict';
/* App Store von AuraChat: Katalog (Apaleo, IKEA SmartHome, Sonos, Nuki), Aktivierung und Zustand.
 *
 * Eine App steckt in drei Zuständen:
 *   - nicht aktiviert:           ihre Befehle und Funktionen gibt es NICHT (kein "Schalte Licht Büro ein", kein Ausweisen mit Buchungsnummer)
 *   - aktiviert, nicht eingerichtet: aktiviert, aber ohne Zugang/Geräte: es gibt nichts auszuführen
 *   - aktiv:                    aktiviert UND eingerichtet: Befehle und Funktionen sind verfügbar
 * Das Einrichten (Hub koppeln, Lautsprecher eintragen, mit Apaleo verbinden) passiert in der App selbst und ist erst nach dem Aktivieren sichtbar.
 *
 * Bestehende Installationen verlieren nichts: Gibt es für eine App noch keinen Eintrag, wird beim ersten Lesen geprüft, ob sie schon benutzt wird
 * (Apaleo verbunden oder Housekeeping-Meldungen an, Hub gekoppelt, Lautsprecher oder Türschloss eingetragen). Wenn ja, gilt sie als aktiviert; sonst als nicht aktiviert.
 *
 * Verwendung:  const { createAppStore, registerAppStoreRoutes } = require('./apps');  */

const APPS = Object.freeze([
  Object.freeze({
    id: 'apaleo', name: 'Apaleo', category: 'Hotel', feature: null, icon: '🏨',
    description: 'Hotel-Verwaltungssystem (PMS): AuraChat arbeitet mit euren Reservierungen und Häusern.',
    unlocks: Object.freeze(['Gäste weisen sich im Gast-Modus mit Buchungsnummer und Nachnamen aus', 'Gäste fragen zu ihrer eigenen Reservierung: „Welche Zimmernummer habe ich?“', 'Mitarbeitende fragen „Wer reist heute an?“ und, wenn erlaubt, Check-in, Check-out und Zimmer zuweisen', 'Housekeeping-Abfragen und -Meldungen']),
  }),
  Object.freeze({
    id: 'ikea', name: 'IKEA SmartHome', category: 'Smart Home', feature: 'integrations', icon: '🏠',
    description: 'Lampen, Steckdosen und Storen über den IKEA-DIRIGERA-Hub steuern.',
    unlocks: Object.freeze(['„Schalte Licht Büro ein“, „Wohnzimmerlampe aus“', '„Wohnzimmerlampe auf 40 %“', '„Storen Wohnzimmer runter“']),
  }),
  Object.freeze({
    id: 'sonos', name: 'Sonos', category: 'Musik & Durchsagen', feature: 'integrations', icon: '🔊',
    description: 'Sonos-Lautsprecher steuern und Durchsagen machen.',
    unlocks: Object.freeze(['„Wohnzimmer pausieren“, „Wohnzimmer weiter“, „nächster Titel“', '„Wohnzimmer auf 30 %“', '„Spiele Jazz auf Wohnzimmer“ (Sonos-Favoriten)', 'Durchsagen auf einem Lautsprecher']),
  }),
  Object.freeze({
    id: 'nuki', name: 'Nuki', category: 'Türschlösser', feature: 'integrations', icon: '🔒',
    description: 'Nuki-Türschlösser über die lokale Bridge auf- und zuschliessen (kein Cloud-Umweg).',
    unlocks: Object.freeze(['„Haustür aufschliessen“, „Haustür öffnen“', '„Haustür verriegeln“, „Haustür abschliessen“']),
  }),
]);
const IDS = APPS.map(a => a.id);
const KEY = (id) => `app_${id}_enabled`;

class AppStoreError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code || ''; } }

/** deps: getConfig(key) -> Promise<string|null>, setConfig(key, value) -> Promise,
 *        configured: { apaleo, ikea, sonos, nuki }: je () => Promise<boolean>   (ist die App eingerichtet?)
 *        legacy: optional je () => Promise<boolean>   (wurde sie schon benutzt? Standard: wie configured)
 *        features(): Promise<string[]>   (Funktionen der Lizenz, z. B. ['integrations']) */
function createAppStore(deps) {
  const { getConfig, setConfig } = deps || {};
  if (typeof getConfig !== 'function' || typeof setConfig !== 'function' || !deps.configured) throw new Error('apps: getConfig, setConfig und configured sind erforderlich.');
  const get = (id) => APPS.find(a => a.id === id) || null;
  const configured = async (id) => { try { return !!(await deps.configured[id]()); } catch (e) { return false; } };
  const legacy = async (id) => { try { return !!(await ((deps.legacy && deps.legacy[id]) || deps.configured[id])()); } catch (e) { return false; } };

  async function isEnabled(id) {
    if (!get(id)) return false;
    let v;
    try { v = await getConfig(KEY(id)); } catch (e) { return false; }   // Lesefehler: im Zweifel ist die App AUS (nie versehentlich offen)
    if (v === 'true') return true;
    if (v === 'false') return false;
    const inUse = await legacy(id);              // noch nie entschieden: Bestand übernehmen, damit nach dem Update nichts verschwindet
    try { await setConfig(KEY(id), inUse ? 'true' : 'false'); } catch (e) { /* beim nächsten Lesen erneut */ }
    return inUse;
  }
  async function isActive(id) { return (await isEnabled(id)) && (await configured(id)); }
  async function status(id, features) {
    const a = get(id); if (!a) return null;
    const enabled = await isEnabled(id), set = await configured(id);   // auch eine ausgeschaltete App meldet, ob ihr Zugang noch da ist (er bleibt erhalten)
    const locked = !!a.feature && !(features || []).includes(a.feature);
    return { id: a.id, name: a.name, category: a.category, icon: a.icon, description: a.description, unlocks: [...a.unlocks], premium: !!a.feature, locked, enabled, configured: set,
             state: !enabled ? 'inactive' : (set ? 'active' : 'needs_setup') };
  }
  async function list() {
    let features = [];
    try { features = (await (deps.features ? deps.features() : [])) || []; } catch (e) { features = []; }
    return Promise.all(APPS.map(a => status(a.id, features)));
  }
  async function activate(id) {
    const a = get(id); if (!a) throw new AppStoreError(404, 'Diese App gibt es nicht.', 'unknown');
    if (a.feature) {
      let features = []; try { features = (await deps.features()) || []; } catch (e) { features = []; }
      if (!features.includes(a.feature)) throw new AppStoreError(402, `${a.name} erfordert eine Premium-Lizenz.`, 'license');
    }
    await setConfig(KEY(id), 'true');
    return status(id, a.feature ? [a.feature] : []);
  }
  async function deactivate(id) {
    const a = get(id); if (!a) throw new AppStoreError(404, 'Diese App gibt es nicht.', 'unknown');
    await setConfig(KEY(id), 'false');   // Zugang, Geräte und Einstellungen bleiben erhalten; nur die Befehle und Funktionen enden
    let features = []; try { features = (await (deps.features ? deps.features() : [])) || []; } catch (e) { features = []; }
    return status(id, features);
  }
  return { isEnabled, isActive, status, list, activate, deactivate, apps: APPS };
}

function registerAppStoreRoutes(app, { requireAdmin, store }) {
  if (!app || typeof requireAdmin !== 'function' || !store) throw new Error('apps: app, requireAdmin und store sind erforderlich.');
  const fail = (res, err) => res.status(err && err.status ? err.status : 500).json({ error: err && err.status ? err.message : 'Der App Store konnte die Anfrage nicht ausführen.', ...(err && err.code ? { code: err.code } : {}) });
  app.get('/api/admin/apps', requireAdmin, async (req, res) => { try { res.set('Cache-Control', 'no-store'); res.json({ apps: await store.list() }); } catch (e) { fail(res, e); } });
  app.post('/api/admin/apps/:id/activate', requireAdmin, async (req, res) => { try { res.json({ success: true, app: await store.activate(String(req.params.id)) }); } catch (e) { fail(res, e); } });
  app.post('/api/admin/apps/:id/deactivate', requireAdmin, async (req, res) => { try { res.json({ success: true, app: await store.deactivate(String(req.params.id)) }); } catch (e) { fail(res, e); } });
}

module.exports = { APPS, IDS, KEY, AppStoreError, createAppStore, registerAppStoreRoutes };
