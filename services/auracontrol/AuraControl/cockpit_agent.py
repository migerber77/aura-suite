"""AuraControl Cockpit-Agent (Python-Fassung des früheren AuraChat-Cockpit-Agenten).

Ein kleiner, eigener Dienst, der als EINZIGER auf Docker schaut und den Zustand des Servers einsammelt: Docker-Container, Arbeitsspeicher, Prozessor, Speicherplatz,
Schwachstellen-Berichte und offene Updates. AuraControl (von aussen erreichbar) bekommt NIE Zugriff auf Docker, sondern fragt nur diesen Agenten.

Sicherheit:
 - Nur LESEN. Es werden ausschliesslich fest eingebaute GET-Abfragen an Docker gestellt (siehe ERLAUBT). Nicht dabei: Einzelheiten eines Containers (dort stehen die
   Umgebungsvariablen mit Geheimnissen), Protokolle, Dateizugriff, Starten/Stoppen.
 - Jede Abfrage an den Agenten braucht ein Passwort (Token), das er beim ersten Start selbst erzeugt und in /shared/token ablegt; nur AuraControl und der Scanner
   bekommen dieses Verzeichnis zu sehen.
 - Der Agent hat keinen Port nach aussen und liegt in einem eigenen, internen Docker-Netz.
Nur Standardbibliothek."""
import http.client
import http.server
import hmac
import json
import math
import os
import re
import secrets
import socket
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))


def _env_int(name, default):
    try:
        v = int(float(os.environ.get(name, '')))
        return v if v else default
    except (TypeError, ValueError):
        return default


CONFIG = {
    'port': _env_int('COCKPIT_PORT', 3600),
    'socket': os.environ.get('DOCKER_SOCKET') or '/var/run/docker.sock',
    'procDir': os.environ.get('COCKPIT_PROC') or '/proc',
    'tokenFile': os.environ.get('COCKPIT_TOKEN_FILE') or '/shared/token',
    'reportsDir': os.environ.get('COCKPIT_REPORTS') or '/reports',
    'hostCheckFile': os.environ.get('COCKPIT_HOSTCHECK') or '/hostcheck/host-status.json',
    'diskPath': os.environ.get('COCKPIT_DISK_PATH') or '/',
    'scanScript': os.environ.get('COCKPIT_SCAN_SCRIPT') or os.path.join(HERE, 'cockpit', 'scan.sh'),
    'snapshotCacheMs': 4000,
    'dfCacheMs': 120000,
    'dockerTimeoutMs': 5000,
    'statsTimeoutMs': 6000,
    'statsConcurrency': 6,
    'maxReportBytes': 40 * 1024 * 1024,
    'maxReportFiles': 100,
}


# ---------- kleine Helfer, die sich wie JavaScript verhalten (gleiche Rundung und Zahlenform wie im Original) ----------
def js_round(x):
    """Math.round: .5 rundet nach oben (Python rundet 2,5 auf 2)."""
    return math.floor(x + 0.5)


def tidy(x):
    """Ganzzahlige Kommazahlen als ganze Zahl (JSON: 37 statt 37.0, wie im JavaScript-Original)."""
    if isinstance(x, float) and math.isfinite(x) and x == int(x) and abs(x) < 1e15:
        return int(x)
    return x


def round1(n):
    return tidy(js_round(n * 10) / 10)


def is_num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def to_number(x):
    """Number(x) für die Fälle, die in Docker- und Trivy-Daten vorkommen; sonst NaN."""
    if x is None:
        return 0
    if isinstance(x, bool):
        return 1 if x else 0
    if isinstance(x, (int, float)):
        return x
    if isinstance(x, str):
        t = x.strip()
        if t == '':
            return 0
        try:
            return float(t)
        except ValueError:
            return float('nan')
    return float('nan')


def js_str(x):
    """String(x or '') für Text aus fremden Berichten."""
    return str(x) if x else ''


_DATE_RX = re.compile(r'^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$', re.I)


def parse_date_ms(s):
    """Date.parse für ISO-Zeiten (Millisekunden seit 1970) oder None. Ohne Zeitzone gilt UTC."""
    if not isinstance(s, str):
        return None
    m = _DATE_RX.match(s.strip())
    if not m:
        return None
    y, mo, d, hh, mi, ss, frac, tz = m.groups()
    try:
        dt = datetime(int(y), int(mo), int(d), int(hh or 0), int(mi or 0), int(ss or 0), tzinfo=timezone.utc)
    except ValueError:
        return None
    ms = int(dt.timestamp()) * 1000 + (int((frac + '000')[:3]) if frac else 0)
    if tz and tz.upper() != 'Z':
        sign = 1 if tz[0] == '+' else -1
        digits = tz[1:].replace(':', '')
        ms -= sign * (int(digits[:2]) * 60 + int(digits[2:4])) * 60000
    return ms


def iso_from_ms(ms):
    """toISOString: 2026-10-20T12:34:56.789Z"""
    ms = int(math.floor(ms))
    secs, milli = divmod(ms, 1000)
    return datetime.fromtimestamp(secs, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S') + '.%03dZ' % milli


# ---------- Docker (nur lesend, nur fest eingebaute Abfragen) ----------
ERLAUBT = [
    re.compile(r'/info'),
    re.compile(r'/version'),
    re.compile(r'/containers/json\?all=1'),
    re.compile(r'/containers/[0-9a-f]{12,64}/stats\?stream=false'),
    re.compile(r'/system/df'),
    re.compile(r'/images/json'),
]


def is_allowed_docker_path(p):
    return isinstance(p, str) and any(rx.fullmatch(p) for rx in ERLAUBT)


class _UnixConnection(http.client.HTTPConnection):
    def __init__(self, path, timeout):
        super().__init__('docker', timeout=timeout)
        self._path = path

    def connect(self):
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(self.timeout)
        s.connect(self._path)
        self.sock = s


def docker_get(api_path, timeout_ms=None):
    if timeout_ms is None:
        timeout_ms = CONFIG['dockerTimeoutMs']
    if not is_allowed_docker_path(api_path):
        raise RuntimeError('Diese Docker-Abfrage ist nicht erlaubt.')
    conn = _UnixConnection(CONFIG['socket'], timeout_ms / 1000.0)
    try:
        try:
            conn.request('GET', api_path, headers={'Host': 'docker'})
            resp = conn.getresponse()
            body = resp.read(30 * 1024 * 1024 + 1)
        except (FileNotFoundError, ConnectionRefusedError):
            raise RuntimeError('Der Docker-Zugang (Socket) fehlt oder ist nicht erreichbar')
        except (socket.timeout, TimeoutError):
            raise RuntimeError('Docker antwortet nicht (Zeitlimit)')
        if len(body) > 30 * 1024 * 1024:
            raise RuntimeError('Docker-Antwort zu gross')
        if resp.status >= 400:
            raise RuntimeError('Docker meldet Status %d' % resp.status)
        try:
            return json.loads(body.decode('utf-8'))
        except ValueError:
            raise RuntimeError('Die Antwort von Docker ist nicht lesbar')
    finally:
        conn.close()


# ---------- Auswertung (reine Funktionen, einzeln testbar) ----------
def parse_meminfo(text):
    kb = {}
    for line in str(text or '').split('\n'):
        m = re.match(r'^(\w+):\s+(\d+)', line, re.A)
        if m:
            kb[m.group(1)] = int(m.group(2)) * 1024
    total = kb.get('MemTotal', 0)
    available = kb['MemAvailable'] if 'MemAvailable' in kb else kb.get('MemFree', 0) + kb.get('Buffers', 0) + kb.get('Cached', 0)
    used = max(0, total - available)
    swap_total = kb.get('SwapTotal', 0)
    swap_used = max(0, swap_total - kb.get('SwapFree', 0))
    return {'totalBytes': total, 'availableBytes': available, 'usedBytes': used, 'percent': round1(used / total * 100) if total else 0,
            'swapTotalBytes': swap_total, 'swapUsedBytes': swap_used}


def parse_loadavg(text):
    parts = str(text or '').strip().split()[:3]
    out = []
    for p in parts:
        v = to_number(p)
        if not is_num(v):
            return None
        out.append(tidy(float(v)) if isinstance(v, float) else v)
    return out if len(out) == 3 else None


def parse_uptime(text):
    first = (str(text or '').split() or [''])[0]
    try:
        n = float(first)
    except ValueError:
        return None
    return js_round(n) if math.isfinite(n) else None


def parse_cpu_stat(text):
    line = next((l for l in str(text or '').split('\n') if re.match(r'^cpu\s', l)), None)
    if line is None:
        return None
    f = []
    for p in line.strip().split()[1:]:
        v = to_number(p)
        if not is_num(v):
            return None
        f.append(v)
    if len(f) < 4:
        return None
    idle = f[3] + (f[4] if len(f) > 4 else 0)
    total = sum(f[:8])
    return {'idle': idle, 'total': total}


def cpu_percent_between(prev, cur):
    if not prev or not cur:
        return None
    d_total = cur['total'] - prev['total']
    d_idle = cur['idle'] - prev['idle']
    if d_total <= 0:
        return None
    return min(100, max(0, round1((1 - d_idle / d_total) * 100)))


def container_cpu_percent(stats):
    try:
        cpu, pre = stats['cpu_stats'], stats['precpu_stats']
        d_cpu = cpu['cpu_usage']['total_usage'] - (pre['cpu_usage']['total_usage'] if pre.get('cpu_usage') else 0)
        d_sys = (cpu.get('system_cpu_usage') or 0) - (pre.get('system_cpu_usage') or 0)
        n = cpu.get('online_cpus') or (len(cpu['cpu_usage']['percpu_usage']) if cpu['cpu_usage'].get('percpu_usage') else 1) or 1
        if not (d_sys > 0) or d_cpu < 0:
            return None
        return round1(d_cpu / d_sys * n * 100)
    except (KeyError, TypeError, AttributeError):
        return None


def container_memory(stats):
    try:
        m = stats.get('memory_stats')
        if not m or not is_num(m.get('usage')):
            return {'usedBytes': None, 'limitBytes': None}
        s = m.get('stats') or {}
        if s.get('inactive_file') is not None:
            cache = s['inactive_file']
        elif s.get('total_inactive_file') is not None:
            cache = s['total_inactive_file']
        else:
            cache = s.get('cache') or 0
        return {'usedBytes': max(0, m['usage'] - cache), 'limitBytes': m['limit'] if is_num(m.get('limit')) else None}
    except (KeyError, TypeError, AttributeError):
        return {'usedBytes': None, 'limitBytes': None}


def health_from_status(status):
    s = str(status or '').lower()
    if '(unhealthy)' in s:
        return 'unhealthy'
    if '(healthy)' in s:
        return 'healthy'
    if 'health: starting' in s:
        return 'starting'
    return 'none'


def normalize_container(c):
    labels = c.get('Labels') or {}
    names = c.get('Names')
    first = names[0] if isinstance(names, list) and names and names[0] else str(c.get('Id') or '')[:12]
    name = re.sub(r'^/', '', str(first))
    created = c.get('Created')
    return {
        'id': str(c.get('Id') or '')[:12], 'fullId': str(c.get('Id') or ''), 'name': name, 'image': str(c.get('Image') or ''),
        'state': str(c.get('State') or ''), 'status': str(c.get('Status') or ''), 'health': health_from_status(c.get('Status')),
        'project': labels.get('com.docker.compose.project') or '', 'service': labels.get('com.docker.compose.service') or '',
        'createdAt': iso_from_ms(created * 1000) if is_num(created) else None,
    }


def _sum(arr, f):
    if not isinstance(arr, list):
        return 0
    total = 0
    for x in arr:
        try:
            v = to_number(f(x))
        except (AttributeError, TypeError, KeyError):
            v = 0
        if isinstance(v, float) and not math.isfinite(v):
            v = 0
        total += max(0, v or 0)
    return tidy(total)


def summarize_df(df):
    cache = df.get('BuildCache') if isinstance(df.get('BuildCache'), list) else []
    layers = to_number(df.get('LayersSize'))
    layers = 0 if (isinstance(layers, float) and not math.isfinite(layers)) else layers
    return {
        'imagesBytes': max(0, layers or _sum(df.get('Images'), lambda i: i.get('Size'))),
        'containersBytes': _sum(df.get('Containers'), lambda c: c.get('SizeRw')),
        'volumesBytes': _sum(df.get('Volumes'), lambda v: (v.get('UsageData') or {}).get('Size') if v.get('UsageData') else None),
        'buildCacheBytes': _sum(cache, lambda b: b.get('Size')),
        'buildCacheReclaimableBytes': _sum([b for b in cache if b.get('InUse') is False], lambda b: b.get('Size')),
    }


SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']


def summarize_trivy_report(j, fallback_name, fallback_time):
    counts = {s: 0 for s in SEVERITIES}
    all_ = []
    results = j.get('Results') if isinstance(j, dict) and isinstance(j.get('Results'), list) else []
    for r in results:
        vulns = r.get('Vulnerabilities') if isinstance(r.get('Vulnerabilities'), list) else []
        for v in vulns:
            sev = str(v.get('Severity')).upper()
            sev = sev if sev in SEVERITIES else 'UNKNOWN'
            counts[sev] += 1
            all_.append({'id': js_str(v.get('VulnerabilityID')), 'pkg': js_str(v.get('PkgName')), 'installed': js_str(v.get('InstalledVersion')),
                         'fixed': js_str(v.get('FixedVersion')), 'severity': sev, 'title': js_str(v.get('Title'))[:110]})
    all_.sort(key=lambda v: (SEVERITIES.index(v['severity']), 0 if v['fixed'] else 1))
    when = (j.get('CreatedAt') or j.get('createdAt')) if isinstance(j, dict) else None
    ms = parse_date_ms(when) if when else None
    name = js_str(j.get('ArtifactName')) if isinstance(j, dict) else ''
    return {'image': name or fallback_name, 'scannedAt': iso_from_ms(ms) if ms is not None else fallback_time, 'counts': counts,
            'fixable': len([v for v in all_ if v['fixed']]), 'critFixable': len([v for v in all_ if v['fixed'] and v['severity'] == 'CRITICAL']),
            'highFixable': len([v for v in all_ if v['fixed'] and v['severity'] == 'HIGH']), 'top': all_[:5]}


def read_vuln_reports(directory):
    try:
        files = [f for f in sorted(os.listdir(directory)) if f.endswith('.json') and not f.startswith('.')][:CONFIG['maxReportFiles']]
    except OSError:
        return {'configured': False, 'images': [], 'totals': None, 'oldestScan': None}
    images = []
    for f in files:
        try:
            full = os.path.join(directory, f)
            st = os.stat(full)
            if not os.path.isfile(full) or st.st_size > CONFIG['maxReportBytes']:
                continue
            with open(full, 'r', encoding='utf-8') as fh:
                data = json.load(fh)
            images.append(summarize_trivy_report(data, re.sub(r'\.json$', '', f), iso_from_ms(st.st_mtime * 1000)))
        except (OSError, ValueError, AttributeError, TypeError):
            continue   # kaputte Datei: überspringen
    if not images:
        return {'configured': len(files) > 0, 'images': [], 'totals': None, 'oldestScan': None}
    totals = {s: 0 for s in SEVERITIES}
    totals.update({'fixable': 0, 'critFixable': 0, 'highFixable': 0})
    for i in images:
        for s in SEVERITIES:
            totals[s] += i['counts'][s]
        totals['fixable'] += i['fixable']
        totals['critFixable'] += i['critFixable']
        totals['highFixable'] += i['highFixable']
    images.sort(key=lambda i: (-i['counts']['CRITICAL'], -i['counts']['HIGH'], i['image'].casefold(), i['image']))
    return {'configured': True, 'images': images, 'totals': totals, 'oldestScan': sorted(i['scannedAt'] for i in images)[0]}


def read_host_updates(file):
    try:
        with open(file, 'r', encoding='utf-8') as fh:
            j = json.load(fh)
        if j is None:
            raise TypeError('leer')   # wie im Original (null hat keine Eigenschaften): nicht eingerichtet
        if not isinstance(j, dict):
            j = {}                    # Liste, Zahl, Text: im Original gibt es dann einfach keine Werte

        def n(x):
            v = to_number(x)
            return tidy(v) if is_num(v) else 0
        ms = parse_date_ms(j.get('updatedAt')) if j.get('updatedAt') else None
        pk = j.get('securityPackages') if isinstance(j.get('securityPackages'), list) else []
        return {'configured': True, 'checkedAt': iso_from_ms(ms) if ms is not None else None, 'upgradable': n(j.get('upgradable')),
                'securityUpgradable': n(j.get('securityUpgradable')), 'rebootRequired': j.get('rebootRequired') is True,
                'packages': [{'name': js_str(p.get('name'))[:80], 'version': js_str(p.get('version'))[:60]} for p in pk[:10]],
                'os': js_str(j.get('os'))[:80], 'kernel': js_str(j.get('kernel'))[:60]}
    except (OSError, ValueError, AttributeError, TypeError):
        return {'configured': False}


# ---------- Einsammeln ----------
_last_cpu = {'sample': None}
_cache = {'snapshot': None, 'snapshotAt': 0, 'df': None, 'dfAt': 0, 'images': None, 'imagesAt': 0}
_lock = threading.Lock()


def now_ms():
    return time.time() * 1000


def read_proc(name):
    try:
        with open(os.path.join(CONFIG['procDir'], name), 'r', encoding='utf-8') as fh:
            return fh.read()
    except OSError:
        return ''


def sample_cpu_percent():
    cur = parse_cpu_stat(read_proc('stat'))
    if not cur or not cur['total']:
        return None
    cur = dict(cur, at=now_ms())
    prev = _last_cpu['sample']
    if not prev or cur['at'] - prev['at'] < 1000 or cur['at'] - prev['at'] > 120000:   # keine brauchbare frühere Messung: kurz zweimal messen
        time.sleep(0.4)
        second = dict(parse_cpu_stat(read_proc('stat')) or {}, at=now_ms())
        _last_cpu['sample'] = second
        return cpu_percent_between(cur, second) if second.get('total') else None
    _last_cpu['sample'] = cur
    return cpu_percent_between(prev, cur)


def disk_info():
    try:
        s = os.statvfs(CONFIG['diskPath'])
        total = s.f_blocks * s.f_frsize
        free = s.f_bavail * s.f_frsize
        used = (s.f_blocks - s.f_bfree) * s.f_frsize
        return {'path': CONFIG['diskPath'], 'totalBytes': total, 'usedBytes': used, 'freeBytes': free, 'percent': round1(used / (used + free) * 100) if used + free else 0}
    except OSError:
        return None


def collect_docker():
    result = {'available': False, 'error': None, 'version': None, 'containersTotal': 0, 'containersRunning': 0, 'imagesCount': 0, 'rootDir': None, 'usage': None, 'containers': [], 'host': None}
    try:
        with ThreadPoolExecutor(max_workers=2) as ex:
            f_info, f_list = ex.submit(docker_get, '/info'), ex.submit(docker_get, '/containers/json?all=1')
            info, lst = f_info.result(), f_list.result()
        result['available'] = True
        result['version'] = info.get('ServerVersion')
        result['rootDir'] = info.get('DockerRootDir')
        result['imagesCount'] = info.get('Images') or 0
        result['host'] = {'name': info.get('Name'), 'os': info.get('OperatingSystem'), 'kernel': info.get('KernelVersion'), 'cpuCount': info.get('NCPU'), 'memTotalBytes': info.get('MemTotal')}
        containers = [normalize_container(c) for c in (lst if isinstance(lst, list) else [])]
        result['containersTotal'] = len(containers)
        result['containersRunning'] = len([c for c in containers if c['state'] == 'running'])
        running = [c for c in containers if c['state'] == 'running']

        def stats_of(c):
            try:
                return docker_get('/containers/%s/stats?stream=false' % c['fullId'], CONFIG['statsTimeoutMs'])
            except Exception:
                return None
        with ThreadPoolExecutor(max_workers=max(1, CONFIG['statsConcurrency'])) as ex:
            stats = list(ex.map(stats_of, running))
        for c, s in zip(running, stats):
            if s:
                c['cpuPercent'] = container_cpu_percent(s)
                m = container_memory(s)
                c['memoryBytes'], c['memoryLimitBytes'] = m['usedBytes'], m['limitBytes']
        for c in containers:
            if 'cpuPercent' not in c:
                c['cpuPercent'] = c['memoryBytes'] = c['memoryLimitBytes'] = None
            c.pop('fullId', None)
        containers.sort(key=lambda c: (c['state'] == 'running', c['name'].casefold(), c['name']))
        result['containers'] = containers
        if _cache['df'] is None or now_ms() - _cache['dfAt'] > CONFIG['dfCacheMs']:
            try:
                _cache['df'] = summarize_df(docker_get('/system/df', 20000))
                _cache['dfAt'] = now_ms()
            except Exception:
                pass   # alte Werte behalten
        result['usage'] = _cache['df']
    except Exception as err:
        result['error'] = str(err)
    return result


def build_snapshot():
    with ThreadPoolExecutor(max_workers=2) as ex:
        f_docker, f_cpu = ex.submit(collect_docker), ex.submit(sample_cpu_percent)
        docker, cpu_percent = f_docker.result(), f_cpu.result()
    mem = parse_meminfo(read_proc('meminfo'))
    load = parse_loadavg(read_proc('loadavg'))
    dh = docker['host'] or {}
    return {
        'generatedAt': iso_from_ms(now_ms()),
        'host': {'hostname': dh.get('name') or socket.gethostname(), 'os': dh.get('os'), 'kernel': dh.get('kernel'), 'uptimeSeconds': parse_uptime(read_proc('uptime')),
                 'cpuCount': dh.get('cpuCount') or os.cpu_count(), 'load': load, 'cpuPercent': cpu_percent, 'memory': mem, 'disk': disk_info()},
        'docker': {k: docker[k] for k in ('available', 'error', 'version', 'containersTotal', 'containersRunning', 'imagesCount', 'rootDir', 'usage', 'containers')},
        'vulnerabilities': read_vuln_reports(CONFIG['reportsDir']),
        'hostUpdates': read_host_updates(CONFIG['hostCheckFile']),
    }


def get_snapshot():
    with _lock:   # nur eine Messung gleichzeitig; wer wartet, bekommt das frische Ergebnis
        if _cache['snapshot'] is not None and now_ms() - _cache['snapshotAt'] < CONFIG['snapshotCacheMs']:
            return _cache['snapshot']
        snap = build_snapshot()
        _cache['snapshot'], _cache['snapshotAt'] = snap, now_ms()
        return snap


def image_list():
    if _cache['images'] is None or now_ms() - _cache['imagesAt'] > 60000:
        arr = docker_get('/images/json')
        names = set()
        for i in (arr if isinstance(arr, list) else []):
            for t in (i.get('RepoTags') or []):
                if t and t != '<none>:<none>' and re.fullmatch(r'[\w.\-:/@]+', t, re.A):
                    names.add(t)
        _cache['images'], _cache['imagesAt'] = sorted(names), now_ms()
    return _cache['images']


def reset_cache():
    _cache.update({'snapshot': None, 'snapshotAt': 0, 'df': None, 'dfAt': 0, 'images': None, 'imagesAt': 0})
    _last_cpu['sample'] = None


# ---------- Passwort (Token) ----------
def ensure_token():
    try:
        with open(CONFIG['tokenFile'], 'r', encoding='utf-8') as fh:
            t = fh.read().strip()
        if re.fullmatch(r'[0-9a-f]{32,}', t, re.I):
            return t
    except OSError:
        pass   # noch keiner da
    token = secrets.token_hex(24)
    os.makedirs(os.path.dirname(CONFIG['tokenFile']), exist_ok=True)
    fd = os.open(CONFIG['tokenFile'], os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        fh.write(token)
    return token


def token_ok(header, token):
    m = re.fullmatch(r'Bearer (\S+)', str(header or ''))
    if not m:
        return False
    a, b = m.group(1).encode('utf-8'), token.encode('utf-8')
    return len(a) == len(b) and hmac.compare_digest(a, b)


# ---------- HTTP ----------
def make_handler(token):
    class Handler(http.server.BaseHTTPRequestHandler):
        server_version = 'AuraCockpit'
        protocol_version = 'HTTP/1.1'

        def log_message(self, *a):
            pass

        def _send(self, code, body, ctype='application/json'):
            raw = (body if isinstance(body, str) else json.dumps(body)).encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', ctype + '; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def _handle(self):
            try:
                path = self.path.split('?')[0]
                if path == '/health':
                    return self._send(200, {'ok': True})
                if self.command != 'GET':
                    return self._send(405, {'error': 'Nur GET.'})
                if not token_ok(self.headers.get('Authorization'), token):
                    return self._send(401, {'error': 'Zugang verweigert.'})
                if path == '/snapshot':
                    return self._send(200, get_snapshot())
                if path == '/images.txt':
                    return self._send(200, '\n'.join(image_list()) + '\n', 'text/plain')
                if path == '/scan.sh':
                    with open(CONFIG['scanScript'], 'r', encoding='utf-8') as fh:
                        return self._send(200, fh.read(), 'text/plain')
                self._send(404, {'error': 'Unbekannter Pfad.'})
            except Exception as err:
                try:
                    self._send(500, {'error': str(err)})
                except Exception:
                    pass
        do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = do_HEAD = do_OPTIONS = _handle
    return Handler


def create_server(token, port=None, host='0.0.0.0'):
    return http.server.ThreadingHTTPServer((host, CONFIG['port'] if port is None else port), make_handler(token))


def main():
    try:
        token = ensure_token()
    except OSError as err:   # ohne Passwort wird NICHT gestartet (sonst läge der Dienst ungeschützt offen)
        print('Cockpit-Agent: Das Zugangs-Passwort konnte nicht abgelegt werden (%s). Der Dienst startet nicht ohne Passwort. Ist der Ordner %s eingebunden und beschreibbar?' % (err, os.path.dirname(CONFIG['tokenFile'])), file=sys.stderr, flush=True)
        sys.exit(1)
    srv = create_server(token)
    print('Cockpit-Agent läuft auf Port %d (Docker: %s)' % (CONFIG['port'], CONFIG['socket']), flush=True)
    srv.serve_forever()


if __name__ == '__main__':
    main()
