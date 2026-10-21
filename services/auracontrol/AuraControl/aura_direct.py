"""Anmeldung über AuraDirect (zentrale Benutzerverwaltung der Aura-Suite) für AuraControl.

AuraControl schickt Benutzername, Passwort (und bei eingerichteter 2FA den Code) an AuraDirect (POST /api/auth/validate, Kopfzeile X-Service-Key);
dort wird geprüft, ob die Person für "auracontrol" freigeschaltet ist. Gleiches Verfahren wie bei AuraChat, AuraPlan, AuraTicket, AuraMail und AuraCall.
Passwörter werden hier nie gespeichert oder protokolliert. Der lokale Benutzer "admin" bleibt immer als Notzugang erhalten.

Einstellungen liegen in directory.json im Datenordner (nur für den Besitzer lesbar). Ersatzweise aus der Umgebung: AURADIRECT_URL, AURADIRECT_SERVICE_KEY.
"epoch" ist eine Zufallskennung: Sie ändert sich bei jeder Änderung der Einstellungen. Damit enden alle Anmeldungen über AuraDirect sofort
(z. B. wenn die Anbindung abgeschaltet wird). Nur Standardbibliothek."""
import json
import os
import re
import secrets
import urllib.error
import urllib.request

PRODUCT = "auracontrol"
URL_RE = re.compile(r"^https?://[A-Za-z0-9.\-_:\[\]]+(/[^\s]*)?$")


def _clean(x, n):
    return re.sub(r"\s+", " ", re.sub(r"[\u0000-\u001f\u007f]", " ", str("" if x is None else x))).strip()[:n]


def _default_opener(url, data, headers, timeout):
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(100001)
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read(100001)
        except Exception:
            return e.code, b""


class Directory:
    def __init__(self, data_dir, env_url="", env_key="", opener=None, timeout=6):
        self.path = os.path.join(data_dir, "directory.json")
        self.env_url, self.env_key = (env_url or "").strip(), (env_key or "").strip()
        self.opener = opener or _default_opener
        self.timeout = timeout
        os.makedirs(data_dir, exist_ok=True)
        self._cfg = self._load()

    # ---- Einstellungen ----
    def _load(self):
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                d = json.load(f)
            if isinstance(d, dict):
                return {"enabled": d.get("enabled") is True, "url": d.get("url") if isinstance(d.get("url"), str) else "",
                        "key": d.get("key") if isinstance(d.get("key"), str) else "", "epoch": d.get("epoch") if isinstance(d.get("epoch"), str) and d.get("epoch") else secrets.token_hex(8)}
        except (OSError, ValueError):
            pass
        # Noch nichts gespeichert: aus der Umgebung übernehmen (eingeschaltet, wenn beides gesetzt ist)
        return {"enabled": bool(self.env_url and self.env_key), "url": self.env_url, "key": self.env_key, "epoch": secrets.token_hex(8)}

    def _save(self):
        tmp = self.path + ".tmp"
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(self._cfg, f)
        os.replace(tmp, self.path)

    def enabled(self):
        c = self._cfg
        return bool(c["enabled"] and c["url"] and c["key"])

    def epoch(self):
        return self._cfg["epoch"]

    def public(self):
        c = self._cfg
        return {"enabled": c["enabled"], "url": c["url"], "hasKey": bool(c["key"]), "active": self.enabled()}

    def update(self, enabled, url, key=None):
        """key=None: bisherigen Dienst-Schlüssel behalten. Gibt (ok, Meldung) zurück."""
        url = (url or "").strip().rstrip("/")
        if url and not URL_RE.match(url):
            return False, "Die Adresse ist ungültig. Beispiel: http://10.0.55.160:4000"
        new_key = self._cfg["key"] if key is None or key == "" else _clean(key, 200)
        if enabled and not (url and new_key):
            return False, "Zum Einschalten braucht es die Adresse von AuraDirect und den Dienst-Schlüssel."
        self._cfg = {"enabled": bool(enabled), "url": url, "key": new_key, "epoch": secrets.token_hex(8)}   # neue Kennung: bestehende Anmeldungen über AuraDirect enden
        self._save()
        return True, "Gespeichert." + (" Anmeldung über AuraDirect ist eingeschaltet." if self.enabled() else " Anmeldung über AuraDirect ist ausgeschaltet.")

    # ---- Prüfen ----
    def validate(self, username, password, code=None, url=None, key=None):
        """{kind: valid, role, name} | {kind: requires2fa} | {kind: noaccess} | {kind: invalid} | {kind: problem, message}"""
        base = (url if url is not None else self._cfg["url"]).rstrip("/")
        body = {"username": str(username or "")[:200], "password": str(password or "")[:500], "product": PRODUCT}
        if code is not None and str(code).strip():
            body["twofaCode"] = str(code).strip()[:40]
        try:
            status, raw = self.opener(base + "/api/auth/validate", json.dumps(body).encode("utf-8"),
                                      {"Content-Type": "application/json", "X-Service-Key": key if key is not None else self._cfg["key"]}, self.timeout)
        except Exception as e:
            return {"kind": "problem", "message": "AuraDirect ist nicht erreichbar (%s)." % _clean(e, 120)}
        if status == 401:
            return {"kind": "problem", "message": "Der Dienst-Schlüssel wird von AuraDirect nicht akzeptiert."}
        if status == 402:
            return {"kind": "problem", "message": "AuraDirect meldet, dass es nicht lizenziert ist."}
        if status == 429:
            return {"kind": "problem", "message": "AuraDirect meldet zu viele Anfragen. Bitte kurz warten."}
        if not 200 <= status < 300:
            return {"kind": "problem", "message": "AuraDirect antwortete mit Status %d." % status}
        try:
            if len(raw or b"") > 100000:
                raise ValueError()
            data = json.loads((raw or b"").decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError()
        except Exception:
            return {"kind": "problem", "message": "AuraDirect hat eine unverständliche Antwort geschickt."}
        if data.get("valid") is True:
            name = data.get("name") or ("%s %s" % (data.get("firstname") or "", data.get("lastname") or ""))
            return {"kind": "valid", "role": _clean(data.get("role"), 30), "name": _clean(name, 80)}
        if data.get("requires2fa") is True:
            return {"kind": "requires2fa"}
        if data.get("error") == "Kein Zugriff auf dieses Produkt.":
            return {"kind": "noaccess"}
        return {"kind": "invalid"}

    def test(self, url=None, key=None):
        r = self.validate("auracontrol-verbindungstest", "kein-echtes-passwort", url=url, key=key)
        if r["kind"] == "problem":
            return False, r["message"]
        return True, "Verbindung in Ordnung: AuraDirect antwortet, der Dienst-Schlüssel wird akzeptiert."
