"""Anmeldung für AuraControl: Passwort-Hash, Sitzungen mit Signatur, Sperre nach Fehlversuchen.

Ersetzt die frühere Anmeldung, bei der ein FESTER Cookie-Wert ("authenticated") und ein Klartext-Passwort im Code standen: Damit konnte jeder, der den Port
erreichte, das Cookie selbst setzen und das System neu starten oder herunterfahren. Jetzt:
  * Passwort als PBKDF2-Hash in einer Datei (nur für den Besitzer lesbar), Vergleich in konstanter Zeit
  * Sitzung = signiertes, befristetes Token (HMAC-SHA256); eine Passwortänderung macht alle bisherigen Sitzungen ungültig
  * Sperre nach Fehlversuchen je Adresse
Nur Standardbibliothek."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import string
import threading
import time

PBKDF2_ITER = 200000
MIN_LEN = 10
SESSION_TTL = 12 * 3600
_DENY = ("aura2026", "password", "passwort", "12345678", "administrator", "qwertz", "qwerty")


def _b64(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _b64d(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_password(password, iterations=PBKDF2_ITER):
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "pbkdf2_sha256$%d$%s$%s" % (iterations, _b64(salt), _b64(dk))


def verify_password(password, stored):
    try:
        algo, it, salt, dk = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        it = int(it)
        if not (1000 <= it <= 5000000):
            return False
        calc = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), _b64d(salt), it)
        return hmac.compare_digest(calc, _b64d(dk))
    except Exception:
        return False


def password_problem(password, username="admin"):
    """None, wenn das Passwort ausreicht, sonst ein verständlicher Hinweis."""
    if not isinstance(password, str) or len(password) < MIN_LEN:
        return "Das Passwort muss mindestens %d Zeichen lang sein." % MIN_LEN
    if len(password) > 200:
        return "Das Passwort ist zu lang (höchstens 200 Zeichen)."
    low = password.lower()
    if username and username.lower() in low:
        return "Das Passwort darf den Benutzernamen nicht enthalten."
    if len(set(password)) < 4:
        return "Das Passwort ist zu einfach (zu wenige verschiedene Zeichen)."
    if any(d in low for d in _DENY):
        return "Das Passwort ist zu bekannt. Bitte ein anderes wählen."
    return None


def random_password(n=16):
    alphabet = string.ascii_letters + string.digits
    while True:
        p = "".join(secrets.choice(alphabet) for _ in range(n))
        if any(c.islower() for c in p) and any(c.isupper() for c in p) and any(c.isdigit() for c in p):
            return p


class AdminStore:
    """Das eine Administrator-Konto. Der Hash liegt in admin.json im Datenordner."""

    def __init__(self, data_dir, env_password="", username="admin", log=None, iterations=PBKDF2_ITER):
        self.dir, self.username, self.iterations = data_dir, username, iterations
        self.file = os.path.join(data_dir, "admin.json")
        self.log = log or (lambda m: None)
        self.data = None
        self._lock = threading.Lock()
        os.makedirs(data_dir, exist_ok=True)
        self._ensure(env_password or "")

    def _save(self):
        tmp = self.file + ".tmp"
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(self.data, f)
        os.replace(tmp, self.file)

    def _ensure(self, env_password):
        try:
            with open(self.file, "r", encoding="utf-8") as f:
                d = json.load(f)
            if isinstance(d, dict) and d.get("username") == self.username and isinstance(d.get("passwordHash"), str) and isinstance(d.get("pv"), str):
                self.data = d
                return
        except (OSError, ValueError):
            pass
        generated = False
        pw = env_password
        if not pw or password_problem(pw, self.username):
            if pw:
                self.log("AuraControl: ADMIN_PASSWORD ist zu schwach (%s). Es wird ein zufälliges Anfangspasswort erzeugt." % password_problem(pw, self.username))
            pw, generated = random_password(), True
        self.data = {"username": self.username, "passwordHash": hash_password(pw, self.iterations), "pv": secrets.token_hex(8), "mustChange": generated}
        self._save()
        if generated:
            self.log("AuraControl: Anfangspasswort für '%s': %s   (nur dieses eine Mal im Protokoll; bitte nach der ersten Anmeldung ändern)" % (self.username, pw))

    def verify(self, username, password):
        """Prüft Benutzername und Passwort. Rechnet immer gleich lang (kein Hinweis, ob der Benutzername stimmt)."""
        ok_user = hmac.compare_digest(str(username or "").encode(), self.username.encode())
        ok_pw = verify_password(str(password or ""), self.data["passwordHash"])
        return bool(ok_user and ok_pw)

    def pv(self):
        return self.data["pv"]

    def must_change(self):
        return bool(self.data.get("mustChange"))

    def change(self, current, new):
        """(ok, Meldung). Eine Änderung macht alle bisherigen Sitzungen ungültig (neue pv)."""
        with self._lock:
            if not verify_password(str(current or ""), self.data["passwordHash"]):
                return False, "Das aktuelle Passwort ist falsch."
            problem = password_problem(new, self.username)
            if problem:
                return False, problem
            if verify_password(new, self.data["passwordHash"]):
                return False, "Das neue Passwort muss sich vom bisherigen unterscheiden."
            self.data = {"username": self.username, "passwordHash": hash_password(new, self.iterations), "pv": secrets.token_hex(8), "mustChange": False}
            self._save()
            return True, "Das Passwort wurde geändert. Alle anderen Anmeldungen wurden abgemeldet."


def load_or_create_secret(data_dir):
    """Geheimer Schlüssel für die Sitzungen (32 Zufallsbytes), nur für den Besitzer lesbar."""
    path = os.path.join(data_dir, "session.key")
    os.makedirs(data_dir, exist_ok=True)
    try:
        with open(path, "r", encoding="utf-8") as f:
            v = f.read().strip()
        if len(v) == 64 and all(c in "0123456789abcdef" for c in v):
            return bytes.fromhex(v)
    except OSError:
        pass
    v = secrets.token_hex(32)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(v + "\n")
    return bytes.fromhex(v)


class SessionSigner:
    def __init__(self, secret, now=None):
        self.secret = secret
        self.now = now or time.time

    def issue(self, username, pv, ttl=SESSION_TTL):
        payload = _b64(json.dumps({"u": username, "pv": pv, "exp": int(self.now()) + int(ttl), "n": secrets.token_hex(6)}, separators=(",", ":")).encode())
        sig = _b64(hmac.new(self.secret, ("v1." + payload).encode(), hashlib.sha256).digest())
        return "v1.%s.%s" % (payload, sig)

    def verify(self, token, expected_pv):
        """Benutzername oder None (falsche Signatur, abgelaufen, anderes Passwort, kaputtes Format)."""
        try:
            if not isinstance(token, str) or len(token) > 600:
                return None
            v, payload, sig = token.split(".")
            if v != "v1":
                return None
            calc = _b64(hmac.new(self.secret, ("v1." + payload).encode(), hashlib.sha256).digest())
            if not hmac.compare_digest(calc.encode(), sig.encode()):
                return None
            d = json.loads(_b64d(payload).decode("utf-8"))
            if not (isinstance(d, dict) and isinstance(d.get("u"), str) and isinstance(d.get("pv"), str) and isinstance(d.get("exp"), int) and not isinstance(d.get("exp"), bool)):
                return None
            if d["exp"] < int(self.now()) or not hmac.compare_digest(d["pv"].encode(), str(expected_pv).encode()):
                return None
            return d["u"]
        except Exception:
            return None


class LoginLimiter:
    """Sperrt eine Adresse nach zu vielen Fehlversuchen für eine Weile."""

    def __init__(self, max_fail=5, window=600, lock=300, now=None, max_entries=10000):
        self.max_fail, self.window, self.lock, self.now, self.max_entries = max_fail, window, lock, now or time.time, max_entries
        self.state = {}
        self._lock = threading.Lock()

    def _clean(self):
        t = self.now()
        for k in [k for k, v in self.state.items() if v["until"] < t and t - v["first"] > self.window]:
            del self.state[k]
        if len(self.state) > self.max_entries:
            for k in list(self.state)[: len(self.state) - self.max_entries]:
                del self.state[k]

    def blocked(self, key):
        """Verbleibende Sekunden der Sperre (0 = nicht gesperrt)."""
        with self._lock:
            v = self.state.get(key)
            return max(0, int(round(v["until"] - self.now()))) if v and v["until"] > self.now() else 0

    def fail(self, key):
        with self._lock:
            self._clean()
            t = self.now()
            v = self.state.get(key)
            if not v or t - v["first"] > self.window:
                v = {"n": 0, "first": t, "until": 0}
            v["n"] += 1
            if v["n"] >= self.max_fail:
                v["until"] = t + self.lock
                v["n"] = 0
                v["first"] = t
            self.state[key] = v

    def success(self, key):
        with self._lock:
            self.state.pop(key, None)
