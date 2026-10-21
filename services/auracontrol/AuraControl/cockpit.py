"""Cockpit in AuraControl: Gesundheit des Servers (Docker-Container, Arbeitsspeicher, Prozessor, Speicherplatz, Schwachstellen, Updates).

AuraControl schaut NICHT selbst auf Docker (es ist von aussen erreichbar). Es fragt den kleinen Cockpit-Dienst (cockpit_agent.py, eigener Container), der nur liest,
und bewertet die Werte hier mit Ampel-Schwellen. Das Passwort für den Dienst legt dieser beim ersten Start selbst in /shared/token ab; AuraControl sieht den Ordner
nur lesend. Die Bewertung entspricht der früheren im AuraChat-Server (Texte und Schwellen unverändert)."""
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request

from cockpit_agent import js_round, parse_date_ms

GB = 1024 * 1024 * 1024
LIMITS = {'ramWarn': 85, 'ramCrit': 95, 'swapWarn': 50, 'diskWarn': 80, 'diskCrit': 90, 'diskFreeCritBytes': 5 * GB, 'cpuWarn': 90, 'loadPerCoreWarn': 1.5,
          'containerMemWarn': 90, 'buildCacheWarnBytes': 10 * GB, 'scanMaxAgeDays': 7, 'hostCheckMaxAgeDays': 3}
HISTORY_MAX = 240            # Punkte
HISTORY_MIN_GAP_MS = 25000   # höchstens alle 25 Sekunden ein Punkt (egal wie oft jemand aktualisiert)
RANK = {'ok': 0, 'info': 0, 'warn': 1, 'crit': 2}


class CockpitError(Exception):
    def __init__(self, message, hint=''):
        super().__init__(message)
        self.message, self.hint = message, hint or ''


# ---------- Zahlen und Texte (deutsche Schreibweise wie bisher: 37,5) ----------
def js_num_str(n):
    if isinstance(n, bool):
        return 'true' if n else 'false'
    if isinstance(n, float):
        if n != n:
            return 'NaN'
        if n == int(n) and abs(n) < 1e21:
            return str(int(n))
        return repr(n)
    return str(n)


def num(n):
    return js_num_str(n).replace('.', ',', 1)


def gb(b):
    return num(js_round(b / GB) if b / GB >= 10 else js_round(b / GB * 10) / 10)


def age_days(iso, now_ms):
    ms = parse_date_ms(iso) if iso else None
    return (now_ms - ms) / 86400000 if ms is not None else None


def _is_num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def evaluate(snap, now_ms=None):
    """Bewertet einen Zustand des Cockpit-Dienstes: {'level': 'ok'|'warn'|'crit', 'items': [{level, area, text}, ...]} (schlimmste zuerst)."""
    if now_ms is None:
        now_ms = time.time() * 1000
    L, items = LIMITS, []

    def add(level, area, text):
        items.append({'level': level, 'area': area, 'text': text})
    host = snap.get('host') or {}
    docker = snap.get('docker') or {}

    # Arbeitsspeicher, Prozessor, Speicherplatz
    mem = host.get('memory')
    if mem and mem.get('totalBytes'):
        txt = 'Arbeitsspeicher zu %s %% belegt (%s von %s GB).' % (num(mem['percent']), gb(mem['usedBytes']), gb(mem['totalBytes']))
        add('crit' if mem['percent'] >= L['ramCrit'] else 'warn' if mem['percent'] >= L['ramWarn'] else 'ok', 'ram', txt)
        if (mem.get('swapTotalBytes') or 0) > 0 and mem['swapUsedBytes'] / mem['swapTotalBytes'] * 100 >= L['swapWarn']:
            add('warn', 'ram', 'Der Auslagerungsspeicher (Swap) ist zu %d %% belegt: der Arbeitsspeicher ist knapp.' % js_round(mem['swapUsedBytes'] / mem['swapTotalBytes'] * 100))
    cpu = host.get('cpuPercent')
    if _is_num(cpu) and cpu >= L['cpuWarn']:
        add('warn', 'cpu', 'Der Prozessor ist zu %s %% ausgelastet.' % num(cpu))
    load = host.get('load')
    if isinstance(load, list) and host.get('cpuCount') and load and load[0] / host['cpuCount'] >= L['loadPerCoreWarn']:
        add('warn', 'cpu', 'Die Systemlast ist hoch (%s bei %s Prozessorkernen).' % (num(load[0]), num(host['cpuCount'])))
    disk = host.get('disk')
    if disk:
        txt = 'Speicherplatz zu %s %% belegt (%s GB frei).' % (num(disk['percent']), gb(disk['freeBytes']))
        add('crit' if disk['percent'] >= L['diskCrit'] or disk['freeBytes'] < L['diskFreeCritBytes'] else 'warn' if disk['percent'] >= L['diskWarn'] else 'ok', 'disk', txt)
    else:
        add('info', 'disk', 'Der Speicherplatz des Servers konnte nicht gelesen werden.')

    # Docker
    if not docker.get('available'):
        add('crit', 'docker', 'Docker lässt sich nicht abfragen: %s.' % (docker.get('error') or 'unbekannter Grund'))
    else:
        problems = 0
        for c in docker.get('containers') or []:
            name, state, health = c.get('name'), c.get('state'), c.get('health')
            if state == 'running' and health == 'unhealthy':
                add('crit', 'docker', 'Container „%s“ meldet sich als „unhealthy“ (Gesundheitsprüfung schlägt fehl).' % name)
                problems += 1
            elif state == 'restarting':
                add('crit', 'docker', 'Container „%s“ startet ständig neu.' % name)
                problems += 1
            elif state == 'paused':
                add('warn', 'docker', 'Container „%s“ ist angehalten (pausiert).' % name)
                problems += 1
            elif state == 'dead':
                add('crit', 'docker', 'Container „%s“ ist abgestürzt (dead).' % name)
                problems += 1
            elif state != 'running':
                m = re.search(r'Exited \((\d+)\)', str(c.get('status')))
                code = m.group(1) if m else None
                if code is not None and code != '0':
                    add('crit', 'docker', 'Container „%s“ ist mit einem Fehler beendet worden (Code %s).' % (name, code))
                else:
                    add('warn', 'docker', 'Container „%s“ läuft nicht (%s).' % (name, 'beendet' if state == 'exited' else state))
                problems += 1
            elif health == 'starting':
                add('info', 'docker', 'Container „%s“ startet noch (Gesundheitsprüfung läuft).' % name)
            hm = host.get('memory')
            if state == 'running' and c.get('memoryBytes') and c.get('memoryLimitBytes') and hm and c['memoryLimitBytes'] < hm['totalBytes'] and c['memoryBytes'] / c['memoryLimitBytes'] * 100 >= L['containerMemWarn']:
                add('warn', 'docker', 'Container „%s“ nutzt %d %% seines Speicher-Limits.' % (name, js_round(c['memoryBytes'] / c['memoryLimitBytes'] * 100)))
                problems += 1
        if not problems:
            add('ok', 'docker', 'Alle %s von %s Container laufen.' % (js_num_str(docker.get('containersRunning')), js_num_str(docker.get('containersTotal'))))
        u = docker.get('usage')
        if u and u['buildCacheReclaimableBytes'] >= L['buildCacheWarnBytes']:
            add('warn', 'disk', '%s GB Zwischenspeicher vom Bauen sind aufräumbar (docker builder prune -f).' % gb(u['buildCacheReclaimableBytes']))

    # Schwachstellen in den Images
    v = snap.get('vulnerabilities')
    if not v or not v.get('configured'):
        add('info', 'vuln', 'Der Schwachstellen-Scan der Images ist nicht eingerichtet (Aktivieren: docker compose --profile scan up -d).')
    elif not v.get('images'):
        add('info', 'vuln', 'Es gibt noch keinen lesbaren Scan-Bericht (der erste Scan kann einige Minuten dauern).')
    else:
        t = v['totals']
        # Entscheidend ist, was sich BEHEBEN lässt (Aktualisieren/Neu bauen): kritische mit Korrektur = rot; kritische ohne Korrektur oder
        # hohe mit Korrektur = Warnung. Zahlen ohne Korrektur sind eine Info, kein Alarm. (Ältere Agenten ohne diese Zahlen: alles zählt.)
        has_fix = 'critFixable' in t
        crit_fix = t['critFixable'] if has_fix else t['CRITICAL']
        high_fix = t['highFixable'] if has_fix else t['HIGH']
        split = ' %s kritische und %s hohe davon lassen sich durch Aktualisieren der Images beheben.' % (js_num_str(crit_fix), js_num_str(high_fix)) if has_fix else ''
        if crit_fix > 0:
            add('crit', 'vuln', '%s kritische und %s hohe Schwachstellen in den Images.%s' % (js_num_str(t['CRITICAL']), js_num_str(t['HIGH']), split))
        elif t['CRITICAL'] > 0 or high_fix > 0:
            add('warn', 'vuln', '%s kritische (ohne verfügbare Korrektur) und %s hohe Schwachstellen in den Images.%s' % (js_num_str(t['CRITICAL']), js_num_str(t['HIGH']), split))
        elif t['HIGH'] > 0:
            add('ok', 'vuln', 'Keine behebbaren kritischen oder hohen Schwachstellen. %s hohe haben noch keine Korrektur.' % js_num_str(t['HIGH']))
        else:
            add('ok', 'vuln', 'Keine kritischen oder hohen Schwachstellen in den Images gefunden.')
        age = age_days(v.get('oldestScan'), now_ms)
        if age is not None and age > L['scanMaxAgeDays']:
            add('warn', 'vuln', 'Der letzte Scan ist %d Tage alt.' % int(age // 1))

    # Updates des Servers
    h = snap.get('hostUpdates')
    if not h or not h.get('configured'):
        add('info', 'updates', 'Die Prüfung auf offene Updates des Servers ist nicht eingerichtet (einmalig: sudo bash cockpit/host/install-hostcheck.sh).')
    else:
        fine = True
        if h['securityUpgradable'] > 0:
            add('warn', 'updates', '%s Sicherheits-Updates des Servers sind offen.' % js_num_str(h['securityUpgradable']))
            fine = False
        if h.get('rebootRequired'):
            add('warn', 'updates', 'Der Server braucht einen Neustart (ein Update ist erst danach wirksam).')
            fine = False
        age = age_days(h.get('checkedAt'), now_ms)
        if age is not None and age > L['hostCheckMaxAgeDays']:
            add('warn', 'updates', 'Die Prüfung auf Updates ist %d Tage alt (läuft der Timer noch?).' % int(age // 1))
            fine = False
        if fine:
            add('ok', 'updates', 'Keine Sicherheits-Updates offen (%s sonstige Updates verfügbar).' % js_num_str(h['upgradable']) if h['upgradable'] > 0 else 'Der Server ist auf dem neuesten Stand.')
    level = 'ok'
    for i in items:
        if RANK[i['level']] > RANK[level]:
            level = i['level']
    items.sort(key=lambda i: (-RANK[i['level']], 1 if i['level'] == 'info' else 0))
    return {'level': level, 'items': items}


# ---------- Verlauf (nur im Arbeitsspeicher): Prozessor, Arbeitsspeicher, Speicherplatz in Prozent ----------
class History:
    def __init__(self):
        self._pts, self._lock = [], threading.Lock()

    def record(self, snap, now_ms=None):
        if now_ms is None:
            now_ms = time.time() * 1000
        with self._lock:
            if self._pts and now_ms - self._pts[-1]['t'] < HISTORY_MIN_GAP_MS:
                return False
            h = snap.get('host') or {}
            mem = h.get('memory')
            self._pts.append({'t': now_ms, 'cpu': h['cpuPercent'] if _is_num(h.get('cpuPercent')) else None,
                              'ram': mem['percent'] if mem and mem.get('totalBytes') else None, 'disk': h['disk']['percent'] if h.get('disk') else None})
            while len(self._pts) > HISTORY_MAX:
                self._pts.pop(0)
            return True

    def list(self):
        with self._lock:
            return [dict(p) for p in self._pts]


# ---------- Verbindung zum Cockpit-Dienst ----------
class CockpitClient:
    def __init__(self, url=None, token_file=None, timeout=20):
        self.url = (url or os.environ.get('COCKPIT_URL') or 'http://control-cockpit:3600').rstrip('/')
        self.token_file = token_file or os.environ.get('COCKPIT_TOKEN_FILE') or '/shared/token'
        self.timeout = timeout

    def read_token(self):
        token = ''
        try:
            with open(self.token_file, 'r', encoding='utf-8') as fh:
                token = fh.read().strip()
        except OSError:
            pass   # unten gemeldet
        if not token:
            raise CockpitError('Der Cockpit-Dienst ist noch nicht gestartet (kein Passwort gefunden).', 'Bitte neu bauen und starten: docker compose build && docker compose up -d. Der Dienst legt sein Passwort beim ersten Start selbst an.')
        return token

    def fetch_snapshot(self):
        token = self.read_token()
        req = urllib.request.Request(self.url + '/snapshot', headers={'Authorization': 'Bearer ' + token})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read()
        except urllib.error.HTTPError as err:
            if err.code == 401:
                raise CockpitError('Der Cockpit-Dienst lehnt das Passwort ab.', 'Beide Dienste neu starten: docker compose restart auracontrol control-cockpit')
            raise CockpitError('Der Cockpit-Dienst meldet einen Fehler (Status %d).' % err.code, 'Siehe: docker compose logs control-cockpit')
        except (urllib.error.URLError, OSError, ValueError) as err:
            reason = getattr(err, 'reason', err)
            raise CockpitError('Der Cockpit-Dienst ist nicht erreichbar (%s).' % reason, 'Läuft der Container "control-cockpit"? Prüfen mit: docker compose ps')
        try:
            return json.loads(body.decode('utf-8'))
        except ValueError:
            raise CockpitError('Die Antwort des Cockpit-Dienstes ist nicht lesbar.', 'Siehe: docker compose logs control-cockpit')


class Cockpit:
    """Fasst Verbindung, Bewertung und Verlauf zusammen (eine Instanz in app.py)."""

    def __init__(self, client=None, log=print):
        self.client, self.history, self.log = client or CockpitClient(), History(), log
        self._last_reachable = None

    def payload(self, now_ms=None):
        try:
            snap = self.client.fetch_snapshot()
            self.history.record(snap)
            return {'ok': True, 'snapshot': snap, 'status': evaluate(snap, now_ms), 'history': self.history.list()}
        except CockpitError as err:
            return {'ok': False, 'error': err.message, 'hint': err.hint, 'history': self.history.list()}

    def sample(self):
        """Eine Messung im Hintergrund ablegen. Gemeldet wird nur, wenn sich der Zustand ändert (kein Protokoll-Lärm, wenn der Dienst gar nicht läuft)."""
        try:
            self.history.record(self.client.fetch_snapshot())
            if self._last_reachable is False:
                self.log('Cockpit: Verbindung zum Cockpit-Dienst steht wieder.')
            self._last_reachable = True
        except CockpitError as err:
            if self._last_reachable is not False:
                self.log('Cockpit: ' + err.message)
            self._last_reachable = False

    def start_sampler(self, first_after=30, every=60):
        """Im Hintergrund jede Minute eine Messung, damit der Verlauf auch da ist, wenn gerade niemand hinschaut (erste Messung nach 30 Sekunden)."""
        def loop():
            time.sleep(first_after)
            while True:
                self.sample()
                time.sleep(every)
        t = threading.Thread(target=loop, name='cockpit-sampler', daemon=True)
        t.start()
        return t
