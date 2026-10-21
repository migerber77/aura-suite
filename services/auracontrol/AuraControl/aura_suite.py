"""Lizenz, Testphase, Gratis-Stufe, anonyme Rückmeldung beim Lizenzserver und Aura-Suite-Version für AuraControl.

Suite-Lizenz (Business Solo / Advanced): EIN Schlüssel (Produkt "suite") wird hier eingetragen. AuraControl holt beim Abgleich mit dem Lizenzserver
neuere Fassungen derselben Lizenz (z. B. mehr Mitarbeiter) und gibt den Schlüssel an AuraChat, AuraPlan, AuraTicket, AuraMail und AuraCall weiter
(GET /api/license/suite-key, Zugang mit sync_token(LICENSE_SECRET)).

Einheitlich mit allen Aura-Produkten:
  * 14 Tage Testphase (alles erlaubt), danach eine gültige Lizenz oder die Gratis-Stufe (höchstens 1 aktives Konto: der Admin), sonst gesperrt.
  * Alle 12 Stunden meldet sich die Installation ANONYM beim Lizenzserver: zufällige Kennung, Produkt, Version, Suite-Version, Zustand, Zahl der Konten und
    ein etwaiger Lizenzschlüssel. Keine Namen, keine Inhalte. Die Rückmeldung ist nicht abschaltbar (ein leerer LICENSE_CHECKIN_HOST ergibt den Standard-Lizenzserver).
  * Aus der Antwort wird nur die Aura-Suite-Version übernommen (streng geprüft); sie erscheint unter "Über Aura-Suite".
Nur Standardbibliothek. Alle Zustände liegen als kleine Dateien im Datenordner."""
import base64
import hashlib
import hmac
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

PRODUCT_KEY = "control"          # Name beim Lizenzserver (Check-in)
LICENSE_PRODUCT = "auracontrol"  # Produktname in Lizenzschlüsseln
SUITE_PRODUCT = "suite"          # Suite-Lizenz: EIN Schlüssel für alle Produkte (Business Solo / Advanced), wird hier eingetragen und an die Produkte verteilt
SYNC_LABEL = b"aura-suite-license-sync"   # Zugangsschlüssel der Produkte zum Abholen: HMAC(LICENSE_SECRET, SYNC_LABEL), braucht keine eigene Einstellung
SYNC_PRODUCTS = {"chat": "AuraChat", "plan": "AuraPlan", "ticket": "AuraTicket", "mail": "AuraMail", "call": "AuraCall"}
TRIAL_DAYS = 14
DAY = 86400
CHECKIN_PORT = 8451
DEFAULT_CHECKIN_HOST = "auralic.gerber-backoffice-solutions.com"
SUITE_VERSION_RE = re.compile(r"^\d{1,4}\.\d{1,4}(\.\d{1,4})?$")
HOST_RE = re.compile(r"^[A-Za-z0-9.-]{1,253}$")
STATES = ("trial", "free", "licensed", "expired")


def build_checkin_base_url(raw):
    """Nur der Rechnername zählt, der Port ist fest. Leer oder ungültig = Standard-Lizenzserver (nicht abschaltbar)."""
    host = str("" if raw is None else raw).strip()
    host = re.sub(r"^https?://", "", host, flags=re.I).split("/")[0].split(":")[0]
    if not HOST_RE.match(host):
        host = DEFAULT_CHECKIN_HOST
    return "http://%s:%d" % (host, CHECKIN_PORT)


def parse_suite_info(raw):
    """Aura-Suite-Angaben vom Lizenzserver: streng geprüft (Version, Datum, kurzer Hinweis ohne Sonderzeichen) oder None."""
    if not isinstance(raw, dict):
        return None
    version = raw.get("version")
    version = version.strip() if isinstance(version, str) else ""
    if not SUITE_VERSION_RE.match(version):
        return None
    date = None
    d = raw.get("date")
    if isinstance(d, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", d):
        try:
            if datetime.strptime(d, "%Y-%m-%d").strftime("%Y-%m-%d") == d:
                date = d
        except ValueError:
            date = None
    note = raw.get("note")
    note = re.sub(r"\s+", " ", re.sub(r"[\u0000-\u001f\u007f<>]+", " ", note)).strip()[:120] if isinstance(note, str) else ""
    return {"version": version, "date": date, "note": note}


def version_older(a, b):
    """True, wenn a älter ist als b. Ungültige Angaben sind nie 'älter' (keine falschen Update-Hinweise)."""
    if not (isinstance(a, str) and isinstance(b, str) and SUITE_VERSION_RE.match(a) and SUITE_VERSION_RE.match(b)):
        return False
    x, y = [int(p) for p in a.split(".")], [int(p) for p in b.split(".")]
    n = max(len(x), len(y))
    x += [0] * (n - len(x))
    y += [0] * (n - len(y))
    return x < y


def _b64d(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def verify_license_key(key, secret, now=None):
    """Prüft einen Schlüssel (HMAC-SHA256, gleiches Format wie alle Aura-Produkte). Gibt {valid, payload?, error?} zurück."""
    now = time.time() if now is None else now
    if not isinstance(key, str) or len(key) > 4000 or "." not in key:
        return {"valid": False, "error": "Ungültiges Lizenzformat."}
    parts = key.strip().split(".")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return {"valid": False, "error": "Ungültiges Lizenzformat."}
    if not secret:
        return {"valid": False, "error": "Das Lizenzsystem ist nicht eingerichtet (LICENSE_SECRET fehlt in der .env)."}
    expected = base64.urlsafe_b64encode(hmac.new(secret.encode(), parts[0].encode(), hashlib.sha256).digest()).decode().rstrip("=")
    if not hmac.compare_digest(expected.encode(), parts[1].encode()):
        return {"valid": False, "error": "Die Lizenzsignatur ist ungültig (falscher Schlüssel oder LICENSE_SECRET stimmt nicht mit dem Lizenzserver überein)."}
    try:
        payload = json.loads(_b64d(parts[0]).decode("utf-8"))
    except Exception:
        return {"valid": False, "error": "Die Lizenzdaten sind beschädigt."}
    if not isinstance(payload, dict):
        return {"valid": False, "error": "Die Lizenzdaten sind beschädigt."}
    if payload.get("product") not in (LICENSE_PRODUCT, SUITE_PRODUCT):
        return {"valid": False, "error": "Diese Lizenz ist nicht für AuraControl ausgestellt."}
    exp = payload.get("expiresAt")
    if exp:
        try:
            t = datetime.fromisoformat(str(exp).replace("Z", "+00:00"))
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            t = t.timestamp()
        except Exception:
            return {"valid": False, "error": "Die Lizenzdaten sind beschädigt."}
        if t < now:
            return {"valid": False, "error": "Die Lizenz ist abgelaufen.", "payload": payload}
    return {"valid": True, "payload": payload}


def sync_token(secret):
    """Zugangsschlüssel, mit dem die Produkte die Suite-Lizenz bei AuraControl abholen (aus LICENSE_SECRET abgeleitet, das alle Produkte ohnehin kennen)."""
    if not secret:
        return ""
    return base64.urlsafe_b64encode(hmac.new(secret.encode(), SYNC_LABEL, hashlib.sha256).digest()).decode().rstrip("=")


def _issued(payload):
    try:
        t = datetime.fromisoformat(str(payload.get("issuedAt")).replace("Z", "+00:00"))
        return (t if t.tzinfo else t.replace(tzinfo=timezone.utc)).timestamp()
    except Exception:
        return 0.0


def _short(v, n=120):
    return str(v)[:n] if isinstance(v, (str, int, float)) else None


def _default_opener(url, data, headers, timeout):
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(65536)
    except urllib.error.HTTPError as e:  # Antwort mit Fehlerstatus: kein Ausnahmefall
        try:
            return e.code, e.read(65536)
        except Exception:
            return e.code, b""


class SuiteState:
    def __init__(self, data_dir, secret="", version="", suite_installed="", host=None, user_count=None, now=None,
                 opener=None, timer_factory=None, first_delay=30, every=12 * 3600, retry_delays=(300, 1800, 7200), timeout=10):
        self.dir = data_dir
        self.secret = secret or ""
        self.version = str(version or "")
        self.suite_installed = suite_installed if isinstance(suite_installed, str) and SUITE_VERSION_RE.match(suite_installed.strip()) else ""
        self.suite_installed = self.suite_installed.strip()
        self.checkin_url = build_checkin_base_url(host)
        self.user_count = user_count or (lambda: 1)
        self.now = now or time.time
        self.opener = opener or _default_opener
        self.timer_factory = timer_factory or self._thread_timer
        self.first_delay, self.every, self.retry_delays, self.timeout = first_delay, every, tuple(retry_delays), timeout
        self.last_checkin = None
        self._suite = None
        self._timer = None
        self._stopped = False
        self._lock = threading.Lock()
        self.deliveries = {}       # Produkt -> Zeitpunkt, zu dem es die Suite-Lizenz zuletzt abgeholt hat (nur Anzeige, nur im Speicher)
        self.last_update = None    # zuletzt vom Lizenzserver übernommene neuere Fassung
        os.makedirs(self.dir, exist_ok=True)
        self._load_suite()

    # ---- kleine Dateien (atomar geschrieben, nur für den Besitzer lesbar) ----
    def _path(self, name):
        return os.path.join(self.dir, name)

    def _read(self, name):
        try:
            with open(self._path(name), "r", encoding="utf-8") as f:
                return f.read().strip()
        except OSError:
            return ""

    def _write(self, name, text):
        tmp = self._path(name) + ".tmp"
        try:
            fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(text)
            os.replace(tmp, self._path(name))
            return True
        except OSError:
            return False

    def _remove(self, name):
        try:
            os.remove(self._path(name))
        except OSError:
            pass

    # ---- Installation ----
    def installation_id(self):
        v = self._read("installation-id")
        if re.match(r"^[0-9a-f-]{36}$", v):
            return v
        v = str(uuid.uuid4())
        self._write("installation-id", v + "\n")
        return v

    def install_date(self):
        """Beginn der Testphase: beim ersten Aufruf festgehalten (bleibt über Neustarts gleich)."""
        try:
            t = float(self._read("install-date"))
            if t > 0 and t == t and t != float("inf"):
                return t
        except ValueError:
            pass
        t = float(self.now())
        self._write("install-date", repr(t) + "\n")
        return t

    # ---- Lizenz ----
    def stored_key(self):
        return self._read("license.key")

    def set_key(self, key):
        k = re.sub(r"\s+", "", key) if isinstance(key, str) else ""
        k = k[:4000]
        if not k:
            return {"ok": False, "error": "Bitte einen Lizenzschlüssel eintragen."}
        r = verify_license_key(k, self.secret, self.now())
        if not r["valid"]:
            return {"ok": False, "error": r["error"]}
        self._write("license.key", k + "\n")
        return {"ok": True, "customer": _short((r["payload"] or {}).get("customer")), "expiresAt": r["payload"].get("expiresAt") or None}

    def remove_key(self):
        self._remove("license.key")

    # ---- Suite-Lizenz: Verteilung an die Produkte ----
    def suite_payload(self):
        """Payload der gespeicherten Suite-Lizenz, wenn sie gültig ist, sonst None."""
        key = self.stored_key()
        if not key:
            return None
        r = verify_license_key(key, self.secret, self.now())
        p = r.get("payload") if r.get("valid") else None
        return p if isinstance(p, dict) and p.get("product") == SUITE_PRODUCT else None

    def suite_key(self):
        return self.stored_key() if self.suite_payload() else None

    def note_delivery(self, product):
        if product in SYNC_PRODUCTS:
            self.deliveries[product] = datetime.fromtimestamp(self.now(), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def suite_summary(self):
        p = self.suite_payload()
        if not p:
            return None
        users = p.get("users") if isinstance(p.get("users"), int) else p.get("maxUsers")
        return {"plan": {"solo": "Business Solo", "advanced": "Business Advanced"}.get(p.get("plan"), "Aura-Suite"), "users": users,
                "deliveries": [{"product": k, "name": v, "at": self.deliveries.get(k)} for k, v in SYNC_PRODUCTS.items()], "lastUpdate": self.last_update}

    def _take_newer(self, key):
        """Neuere Fassung der Suite-Lizenz vom Lizenzserver übernehmen: nur gültig, nur dieselbe Lizenz (licenseId), nur wirklich neuer."""
        if not isinstance(key, str) or len(key) > 4000:
            return False
        cur = self.suite_payload()
        r = verify_license_key(key, self.secret, self.now())
        p = r.get("payload") if r.get("valid") else None
        if not (cur and isinstance(p, dict) and p.get("product") == SUITE_PRODUCT and p.get("licenseId") and p.get("licenseId") == cur.get("licenseId")):
            return False
        if _issued(p) <= _issued(cur) or key == self.stored_key():
            return False
        self._write("license.key", key + "\n")
        self.last_update = {"at": datetime.fromtimestamp(self.now(), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "users": p.get("users")}
        return True

    def license_info(self):
        now = float(self.now())
        key = self.stored_key()
        r = verify_license_key(key, self.secret, now) if key else None
        p = (r or {}).get("payload") if r else None
        out = {"state": "expired", "valid": False, "customer": _short((p or {}).get("customer")) if p else None, "expiresAt": (p or {}).get("expiresAt") if p else None,
               "daysLeft": None, "expiresSoon": False, "trialDaysRemaining": 0, "keyError": (r["error"] if r and not r["valid"] else None), "hasKey": bool(key), "message": ""}
        if r and r["valid"]:
            out["state"], out["valid"] = "licensed", True
            if p.get("expiresAt"):
                try:
                    t = datetime.fromisoformat(str(p["expiresAt"]).replace("Z", "+00:00"))
                    t = (t if t.tzinfo else t.replace(tzinfo=timezone.utc)).timestamp()
                    out["daysLeft"] = max(0, int(-(-(t - now) // DAY)))
                    out["expiresSoon"] = out["daysLeft"] <= 14
                except Exception:
                    pass
            return out
        left = TRIAL_DAYS - max(0.0, now - self.install_date()) / DAY   # max(): das Datum wird evtl. einen Wimpernschlag NACH "now" angelegt (sonst: 15 statt 14 Tage)
        if left > 0:
            out["state"], out["valid"], out["trialDaysRemaining"] = "trial", True, int(-(-left // 1))
            return out
        try:
            n = self.user_count()
        except Exception:
            n = None
        if isinstance(n, int) and not isinstance(n, bool) and n <= 1:  # Gratis-Stufe: 1 Benutzer (der Admin); unbekannte Zahl = gesperrt
            out["state"], out["valid"] = "free", True
            return out
        out["message"] = ("Keine gültige Lizenz: " + out["keyError"]) if out["keyError"] else "Die Testphase ist abgelaufen. Kostenlos ist ein Benutzer (der Admin); für mehr wird eine Lizenz benötigt."
        return out

    def allows(self):
        return bool(self.license_info()["valid"])

    # ---- Aura-Suite-Version (Anzeige) ----
    def _load_suite(self):
        try:
            self._suite = parse_suite_info(json.loads(self._read("suite-latest.json") or "null"))
        except ValueError:
            self._suite = None

    def suite(self):
        return self._suite

    def _set_suite(self, info):
        self._suite = info
        if info:
            self._write("suite-latest.json", json.dumps(info))
        else:
            self._remove("suite-latest.json")

    def version_info(self):
        s = self._suite
        return {"product": "AuraControl", "installed": self.version, "suiteInstalled": self.suite_installed or None, "suite": s,
                "updateAvailable": bool(s and self.suite_installed and version_older(self.suite_installed, s["version"]))}

    # ---- Rückmeldung beim Lizenzserver ----
    def checkin_status(self):
        return {"enabled": True, "host": self.checkin_url.replace("http://", "").rsplit(":", 1)[0], "lastResult": self.last_checkin}

    def build_payload(self):
        try:
            n = self.user_count()
        except Exception:
            n = None
        n = n if isinstance(n, int) and not isinstance(n, bool) and 0 <= n <= 1000000 else None
        st = self.license_info()["state"]
        return {"licenseKey": self.stored_key() or None, "installationId": self.installation_id(), "product": PRODUCT_KEY, "state": st if st in STATES else None,
                "suiteInstalled": self.suite_installed or None, "totalUsers": n, "totalAdmins": n, "version": self.version}

    def ping(self):
        stamp = lambda: datetime.fromtimestamp(self.now(), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        try:
            body = json.dumps(self.build_payload()).encode("utf-8")
            status, raw = self.opener(self.checkin_url + "/api/checkin", body, {"Content-Type": "application/json"}, self.timeout)
            try:
                data = json.loads((raw or b"").decode("utf-8", "replace") or "null")
            except ValueError:
                data = None
            ok = 200 <= status < 300
            # Nur eine echte Antwort ({ok: true, ...}) ändert die Anzeige; eine Anmeldeseite im Hotel-WLAN (200, anderer Inhalt) lässt sie unberührt.
            if ok and isinstance(data, dict) and data.get("ok") is True:
                self._set_suite(parse_suite_info(data.get("suite")))
                lic = data.get("license")
                if isinstance(lic, dict):
                    self._take_newer(lic.get("key"))   # z. B. mehr Mitarbeiter: neue Fassung übernehmen, die Produkte holen sie dann hier ab
            self.last_checkin = {"success": ok, "status": status, "retryable": (not ok) and status >= 500, "at": stamp()}
        except Exception:
            self.last_checkin = {"success": False, "status": 0, "retryable": True, "at": stamp()}
        return self.last_checkin

    # ---- Zeitplan: kurz nach dem Start, danach alle 12 Stunden, bei Störungen mit Wiederholungen ----
    @staticmethod
    def _thread_timer(interval, fn):
        t = threading.Timer(interval, fn)
        t.daemon = True
        return t

    def _schedule(self, seconds, attempt):
        with self._lock:
            if self._stopped:
                return
            self._timer = self.timer_factory(seconds, lambda: self._run(attempt))
            self._timer.start()

    def _run(self, attempt=0):
        if self._stopped:
            return
        r = self.ping()
        if r and not r["success"] and r["retryable"] and attempt < len(self.retry_delays):
            self._schedule(self.retry_delays[attempt], attempt + 1)
        else:
            self._schedule(self.every, 0)

    def start(self):
        with self._lock:
            self._stopped = False
            if self._timer:
                self._timer.cancel()
        self._schedule(self.first_delay, 0)

    def stop(self):
        with self._lock:
            self._stopped = True
            if self._timer:
                self._timer.cancel()
            self._timer = None
