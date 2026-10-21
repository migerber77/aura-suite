"""AuraControl: Server-Übersicht (Hardware, Speicher, Strom) mit Anmeldung, Lizenz und Aura-Suite-Anbindung."""
import asyncio
from datetime import datetime, timedelta
import json
import os
import random
import re
import shutil
import subprocess
from fastapi import FastAPI, Form, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import psutil

from aura_auth import AdminStore, LoginLimiter, SESSION_TTL, SessionSigner, load_or_create_secret
from aura_privacy import PrivacyStore
from aura_suite import SuiteState, sync_token
from aura_direct import Directory
import hmac
from cockpit import Cockpit

VERSION = "4.0.0"
app = FastAPI(title="AuraControl", version=VERSION)

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

# --- Konfiguration (alles Zustandsbehaftete liegt im Datenordner, damit es einen Neustart des Containers überlebt) ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("AURACONTROL_DATA", os.path.join(BASE_DIR, "data"))
COOKIE = "aura_session"
TRUST_PROXY = os.environ.get("TRUST_PROXY", "").lower() in ("1", "true", "yes")
_suite_env = os.environ.get("AURA_SUITE_VERSION", "").strip()

store = AdminStore(DATA_DIR, env_password=os.environ.get("ADMIN_PASSWORD", ""), log=lambda m: print(m, flush=True))
signer = SessionSigner(load_or_create_secret(DATA_DIR))
limiter = LoginLimiter()
privacy = PrivacyStore(DATA_DIR)
# Anmeldung über AuraDirect (zentrale Benutzer): Einstellungen im Admin Panel -> Sicherheit, ersatzweise AURADIRECT_URL / AURADIRECT_SERVICE_KEY
directory = Directory(DATA_DIR, env_url=os.environ.get("AURADIRECT_URL", ""), env_key=os.environ.get("AURADIRECT_SERVICE_KEY", ""))
DIRECT_PREFIX = "direct:"          # Anmeldungen über AuraDirect: Benutzername mit diesem Vorsatz (kann nie mit dem lokalen "admin" verwechselt werden)
DIRECT_TTL = 8 * 3600              # Anmeldung über AuraDirect: 8 Stunden (danach neu bei AuraDirect prüfen)
cockpit_svc = Cockpit(log=lambda m: print(m, flush=True))   # Gesundheit des Servers: fragt den kleinen Cockpit-Dienst (cockpit_agent.py), AuraControl selbst sieht Docker nie


def user_count():
  return 1  # AuraControl kennt genau ein Konto: den Administrator


suite = SuiteState(
    DATA_DIR,
    secret=os.environ.get("LICENSE_SECRET", ""),
    version=VERSION,
    suite_installed=_suite_env,
    host=os.environ.get("LICENSE_CHECKIN_HOST"),
    user_count=user_count,
)

# --- Einstellungen (Anpassungen des Produkts) ---
DEFAULT_SETTINGS = {
    "server_name": "aura-srv-01",
    "server_model": "HPE ProLiant ML350 Gen9",
    "host_address": "10.0.55.160",
    "os_name": "Red Hat Enterprise Linux 10",
}
SETTING_LABELS = {
    "server_name": "Servername",
    "server_model": "Modell",
    "host_address": "Adresse des Servers",
    "os_name": "Betriebssystem",
}


def clean_setting(value):
  if not isinstance(value, str):
    return None
  v = re.sub(r"\s+", " ", re.sub(r"[\u0000-\u001f\u007f<>]+", " ", value)).strip()
  return v if 1 <= len(v) <= 60 else None


def load_settings():
  out = dict(DEFAULT_SETTINGS)
  try:
    with open(os.path.join(DATA_DIR, "settings.json"), "r", encoding="utf-8") as f:
      raw = json.load(f)
    if isinstance(raw, dict):
      for k in DEFAULT_SETTINGS:
        v = clean_setting(raw.get(k))
        if v:
          out[k] = v
  except (OSError, ValueError):
    pass
  return out


def save_settings(values):
  tmp = os.path.join(DATA_DIR, "settings.json.tmp")
  fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
  with os.fdopen(fd, "w", encoding="utf-8") as f:
    json.dump(values, f)
  os.replace(tmp, os.path.join(DATA_DIR, "settings.json"))


# --- Anmeldung ---
def _client_ip(request):
  if TRUST_PROXY:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
      return fwd.split(",")[0].strip()[:64]
  return request.client.host if request.client else "?"


def _is_https(request):
  return request.url.scheme == "https" or (TRUST_PROXY and request.headers.get("x-forwarded-proto", "") == "https")


def _user(request):
  """Angemeldete Person: der lokale Administrator ("admin") oder eine Person aus AuraDirect ("direct:<name>")."""
  token = request.cookies.get(COOKIE)
  u = signer.verify(token, store.pv())
  if u and u == store.username:
    return u
  if directory.enabled():
    u = signer.verify(token, directory.epoch())   # ändert sich die Anbindung (z. B. ausgeschaltet), enden diese Anmeldungen
    if u and u.startswith(DIRECT_PREFIX):
      return u
  return None


def _is_local_admin(user):
  return bool(user) and user == store.username


def _require_local_admin(request):
  """Nur der lokale Administrator (Notzugang) darf das eigene Passwort und die Anbindung an AuraDirect ändern."""
  user = _require_user(request)
  if not _is_local_admin(user):
    raise HTTPException(status_code=403, detail="Nur für den lokalen Administrator (admin)")
  return user


def _require_user(request):
  user = _user(request)
  if not user:
    raise HTTPException(status_code=401, detail="Nicht autorisiert")
  return user


def _require_csrf(request):
  # Eine eigene Kopfzeile kann eine fremde Seite nicht setzen (ohne Erlaubnis dieser Seite): Schutz gegen untergeschobene Anfragen
  if request.headers.get("x-aura-request") != "1":
    raise HTTPException(status_code=403, detail="Ungültige Anfrage")


@app.middleware("http")
async def security_headers(request: Request, call_next):
  resp = await call_next(request)
  resp.headers["X-Content-Type-Options"] = "nosniff"
  resp.headers["Referrer-Policy"] = "no-referrer"
  resp.headers["X-Frame-Options"] = "DENY"
  if not request.url.path.startswith("/static"):
    resp.headers["Cache-Control"] = "no-store"
  return resp


@app.on_event("startup")
async def start_suite():
  suite.start()  # anonyme Rückmeldung beim Lizenzserver (siehe aura_suite.py)
  if os.environ.get("COCKPIT_SAMPLER", "1") != "0":
    cockpit_svc.start_sampler()  # jede Minute eine Messung für den Verlauf im Cockpit (erste nach 30 Sekunden)


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, error: str = None, success: str = None):
  if _user(request):
    return RedirectResponse(url="/", status_code=303)
  cfg = load_settings()
  return templates.TemplateResponse(request, "login.html", {"error": error, "success": success, "server_model": cfg["server_model"], "os_name": cfg["os_name"], "direct": directory.enabled()})


def _login_page(request, cfg, error=None, status=200, username="", need_code=False):
  return templates.TemplateResponse(request, "login.html", {"error": error, "server_model": cfg["server_model"], "os_name": cfg["os_name"], "direct": directory.enabled(),
                                                            "username": username, "need_code": need_code}, status_code=status)


def _signed_in(request, username, pv, ttl=SESSION_TTL):
  resp = RedirectResponse(url="/", status_code=303)
  resp.set_cookie(key=COOKIE, value=signer.issue(username, pv, ttl), httponly=True, samesite="lax", secure=_is_https(request), max_age=ttl, path="/")
  return resp


@app.post("/login")
async def login_action(request: Request, username: str = Form(...), password: str = Form(...), twofa_code: str = Form(None)):
  ip = _client_ip(request)
  cfg = load_settings()
  wait = limiter.blocked(ip)
  if wait:
    return _login_page(request, cfg, "Zu viele Fehlversuche. Bitte in %d Minute(n) erneut versuchen." % ((wait + 59) // 60), 429)
  name = (username or "").strip()[:200]
  # 1) Lokaler Administrator ("admin"): immer nur lokal geprüft (Notzugang, auch wenn AuraDirect nicht erreichbar ist)
  if name == store.username:
    if store.verify(name, password):
      limiter.success(ip)
      return _signed_in(request, store.username, store.pv())
    limiter.fail(ip)
    return _login_page(request, cfg, "Ungültiger Benutzername oder Passwort", username=name)
  # 2) Alle anderen: über AuraDirect (Freigabe für "AuraControl" nötig)
  if directory.enabled():
    r = directory.validate(name, password, twofa_code)
    if r["kind"] == "valid":
      limiter.success(ip)
      print("AuraControl: Anmeldung über AuraDirect: %s" % name, flush=True)
      return _signed_in(request, DIRECT_PREFIX + name, directory.epoch(), DIRECT_TTL)
    if r["kind"] == "requires2fa":
      if twofa_code:
        limiter.fail(ip)
      return _login_page(request, cfg, "Der Bestätigungscode ist falsch." if twofa_code else "Bitte Passwort und den 6-stelligen Code aus der Authenticator-App eingeben.", username=name, need_code=True)
    if r["kind"] == "noaccess":
      return _login_page(request, cfg, "Kein Zugriff auf AuraControl. Die Freigabe erteilt die Administration in AuraDirect.", username=name)
    if r["kind"] == "problem":
      print("AuraControl: AuraDirect: %s" % r["message"], flush=True)
      return _login_page(request, cfg, r["message"] + " Der lokale Benutzer \"admin\" funktioniert weiterhin.", 502, username=name)
  limiter.fail(ip)
  return _login_page(request, cfg, "Ungültiger Benutzername oder Passwort", username=name)


@app.get("/logout")
async def logout():
  resp = RedirectResponse(url="/login", status_code=303)
  resp.delete_cookie(key=COOKIE)
  return resp


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
  if not _user(request):
    return RedirectResponse(url="/login", status_code=303)
  cfg = load_settings()
  user = _user(request)
  local = _is_local_admin(user)
  return templates.TemplateResponse(request, "index.html", {**cfg, "must_change": local and store.must_change(), "version": VERSION, "local_admin": local,
                                                            "user_label": user if local else user[len(DIRECT_PREFIX):] + " (AuraDirect)"})


@app.post("/api/admin/change-password")
async def change_password(request: Request, current_password: str = Form(...), new_password: str = Form(...)):
  _require_local_admin(request)
  _require_csrf(request)
  ok, message = store.change(current_password, new_password)
  if not ok:
    return {"status": "error", "message": message}
  resp = JSONResponse({"status": "success", "message": message})
  # Die Sitzung dieser Person bleibt gültig: neues Token mit dem neuen Passwort-Kennzeichen
  resp.set_cookie(key=COOKIE, value=signer.issue(store.username, store.pv()), httponly=True, samesite="lax", secure=_is_https(request), max_age=SESSION_TTL, path="/")
  return resp


# --- Anmeldung über AuraDirect: Einstellungen (ändern nur der lokale Administrator) ---
@app.get("/api/admin/auradirect")
async def get_auradirect(request: Request):
  user = _require_user(request)
  return {**directory.public(), "canEdit": _is_local_admin(user)}


@app.post("/api/admin/auradirect")
async def save_auradirect(request: Request):
  _require_local_admin(request)
  _require_csrf(request)
  try:
    body = await request.json()
  except Exception:
    body = None
  body = body if isinstance(body, dict) else {}
  ok, message = directory.update(body.get("enabled") is True, body.get("url") if isinstance(body.get("url"), str) else "", body.get("key") if isinstance(body.get("key"), str) else None)
  if not ok:
    return JSONResponse({"status": "error", "message": message}, status_code=400)
  return {"status": "success", "message": message, **directory.public()}


@app.post("/api/admin/auradirect/test")
async def test_auradirect(request: Request):
  _require_local_admin(request)
  _require_csrf(request)
  try:
    body = await request.json()
  except Exception:
    body = None
  body = body if isinstance(body, dict) else {}
  url = body.get("url") if isinstance(body.get("url"), str) and body.get("url").strip() else None
  key = body.get("key") if isinstance(body.get("key"), str) and body.get("key").strip() else None
  ok, message = directory.test(url=url.strip().rstrip("/") if url else None, key=key)
  return JSONResponse({"status": "success" if ok else "error", "message": message}, status_code=200 if ok else 502)


@app.get("/api/version")
async def get_version(request: Request):
  _require_user(request)
  return suite.version_info()


@app.get("/api/license")
async def get_license(request: Request):
  _require_user(request)
  return {**suite.license_info(), "checkin": suite.checkin_status(), "suite": suite.suite_summary()}


# Die Produkte (AuraChat, AuraPlan, AuraTicket, AuraMail, AuraCall) holen hier die Suite-Lizenz ab. Kein Benutzerkonto: Zugang mit einem Schlüssel,
# der aus LICENSE_SECRET abgeleitet ist (alle Produkte kennen ihn). Ohne Suite-Lizenz: {"key": null} (ein Produkt entfernt dann eine früher von hier übernommene Lizenz).
@app.get("/api/license/suite-key")
async def get_suite_key(request: Request):
  expected = sync_token(os.environ.get("LICENSE_SECRET", ""))
  auth = request.headers.get("authorization", "")
  given = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
  if not expected or not given or not hmac.compare_digest(given.encode(), expected.encode()):
    return JSONResponse({"error": "Nicht autorisiert"}, status_code=401)
  suite.note_delivery(str(request.headers.get("x-aura-product", ""))[:20])
  return {"key": suite.suite_key()}


@app.post("/api/license/sync")
async def sync_license(request: Request):
  _require_user(request)
  _require_csrf(request)
  before = suite.stored_key()
  r = suite.ping()   # Rückmeldung beim Lizenzserver; eine neuere Fassung der Suite-Lizenz wird dabei übernommen
  info = suite.license_info()
  if not r or not r.get("success"):
    return JSONResponse({"status": "error", "message": "Der Lizenzserver war nicht erreichbar. Bitte später erneut versuchen."}, status_code=502)
  changed = suite.stored_key() != before
  return {"status": "success", "message": "Neue Fassung der Lizenz übernommen. Die Produkte holen sie innert 15 Minuten ab." if changed else "Abgeglichen: die Lizenz ist aktuell.", "state": info["state"]}


@app.post("/api/license")
async def set_license(request: Request):
  _require_user(request)
  _require_csrf(request)
  try:
    body = await request.json()
  except Exception:
    body = None
  key = body.get("key") if isinstance(body, dict) else None
  previous = suite.stored_key()
  r = suite.set_key(key)
  if not r["ok"]:
    return JSONResponse({"status": "error", "message": r["error"]}, status_code=400)
  # Online beim Lizenzserver (AuraLic) prüfen: kennt er den Schlüssel nicht (gelöscht, nie ausgestellt), wird er nicht übernommen.
  # Ist der Lizenzserver nicht erreichbar, gilt die Prüfung der Signatur; der Abgleich folgt automatisch später.
  res = suite.ping() or {}
  if res.get("status") in (401, 404):
    if previous:
      suite._write("license.key", previous + "\n")
    else:
      suite.remove_key()
    return JSONResponse({"status": "error", "message": "Der Lizenzserver kennt diesen Schlüssel nicht (gelöscht oder nicht von ihm ausgestellt). Die Lizenz wurde nicht übernommen."}, status_code=400)
  online = "vom Lizenzserver bestätigt" if res.get("success") else "der Lizenzserver war nicht erreichbar, die Bestätigung folgt beim nächsten Abgleich"
  return {"status": "success", "message": f"Die Lizenz wurde gespeichert ({online}). Die Produkte holen sie innert 15 Minuten ab.", "customer": r["customer"], "expiresAt": r["expiresAt"]}


@app.delete("/api/license")
async def remove_license(request: Request):
  _require_user(request)
  _require_csrf(request)
  suite.remove_key()
  return {"status": "success", "message": "Die Lizenz wurde entfernt."}


@app.get("/api/settings")
async def get_settings(request: Request):
  _require_user(request)
  return load_settings()


@app.post("/api/settings")
async def post_settings(request: Request):
  _require_user(request)
  _require_csrf(request)
  try:
    body = await request.json()
  except Exception:
    body = None
  if not isinstance(body, dict):
    return JSONResponse({"status": "error", "message": "Ungültige Eingabe."}, status_code=400)
  new = {}
  for k in DEFAULT_SETTINGS:
    v = clean_setting(body.get(k))
    if not v:
      return JSONResponse({"status": "error", "message": "%s: bitte 1 bis 60 Zeichen eingeben." % SETTING_LABELS[k]}, status_code=400)
    new[k] = v
  save_settings(new)
  return {"status": "success", "message": "Die Einstellungen wurden gespeichert.", "settings": new}


# --- Datenschutzerklärung mit Bestätigung beim ersten Login ---
@app.get("/api/privacy-policy")
async def get_privacy(request: Request):
  return privacy.policy(_user(request))


@app.post("/api/privacy-policy/accept")
async def accept_privacy(request: Request):
  user = _require_user(request)
  _require_csrf(request)
  try:
    body = await request.json()
  except Exception:
    body = None
  seen = body.get("version") if isinstance(body, dict) else None
  ok, result = privacy.accept(user, seen)
  if not ok:
    return JSONResponse({"error": result}, status_code=409)
  return {"success": True, "version": result}


@app.post("/api/admin/privacy-policy")
async def save_privacy(request: Request):
  _require_user(request)
  _require_csrf(request)
  try:
    body = await request.json()
  except Exception:
    body = None
  ok, result = privacy.set_text(body.get("text") if isinstance(body, dict) else None)
  if not ok:
    return JSONResponse({"error": result}, status_code=400)
  return {"success": True, "version": result}


@app.post("/api/system/reboot")
async def reboot_system(request: Request):
  _require_user(request)
  _require_csrf(request)
  try:
    print("AuraControl: Neustart ausgelöst", flush=True)
    subprocess.Popen(["reboot"])
    return {"status": "success", "message": "System wird neu gestartet..."}
  except Exception as e:
    return {"status": "error", "message": str(e)}


@app.post("/api/system/shutdown")
async def shutdown_system(request: Request):
  _require_user(request)
  _require_csrf(request)
  try:
    print("AuraControl: Herunterfahren ausgelöst", flush=True)
    subprocess.Popen(["poweroff"])
    return {"status": "success", "message": "System wird heruntergefahren..."}
  except Exception as e:
    return {"status": "error", "message": str(e)}


# --- Cockpit: Gesundheit des Servers (Docker-Container, Speicher, Prozessor, Schwachstellen, Updates); nur für Angemeldete ---
@app.get("/api/cockpit")
async def get_cockpit(request: Request):
  _require_user(request)
  return await asyncio.to_thread(cockpit_svc.payload)  # blockierende Abfrage des Cockpit-Dienstes nicht im Ereignisschleifen-Thread


@app.get("/api/system/hardware")
async def get_hardware_info(request: Request):
  _require_user(request)
  cfg = load_settings()
  cpu_info = {
      "cores": psutil.cpu_count(logical=True),
      "usage": psutil.cpu_percent(interval=0.1),
  }
  ram = psutil.virtual_memory()
  ram_info = {
      "total": round(ram.total / (1024**3), 2),
      "used": round(ram.used / (1024**3), 2),
      "percent": ram.percent,
  }

  current_watts = round(95 + (cpu_info["usage"] * 1.25), 1)

  raid_status = "Smart Array RAID 10 - Optimal"
  try:
    res = subprocess.run(
        ["ssacli", "ctrl", "all", "show", "status"],
        capture_output=True,
        text=True,
    )
    if res.returncode == 0 and res.stdout.strip():
      raid_status = res.stdout.strip().split("\n")[0]
  except Exception:
    pass

  fans = [
      {"name": "System Fan 1 (Front)", "speed": "42% (Normal)", "status": "OK"},
      {"name": "System Fan 2 (Middle)", "speed": "42% (Normal)", "status": "OK"},
      {"name": "System Fan 3 (Rear)", "speed": "44% (Normal)", "status": "OK"},
      {"name": "PCI Fan 4", "speed": "38% (Normal)", "status": "OK"},
  ]

  processors = [
      {
          "socket": "Processor 1",
          "model": "Intel(R) Xeon(R) CPU E5-2620 v4 @ 2.10GHz",
          "cores": "8 Cores / 16 Threads",
          "status": "OK",
      },
      {
          "socket": "Processor 2",
          "model": "Intel(R) Xeon(R) CPU E5-2620 v4 @ 2.10GHz",
          "cores": "8 Cores / 16 Threads",
          "status": "OK",
      },
  ]

  memory_modules = [
      {
          "slot": "Proc 1 DIMM 1",
          "size": "16 GB",
          "type": "DDR4 ECC Registered",
          "speed": "2400 MHz",
          "status": "OK",
      },
      {
          "slot": "Proc 1 DIMM 2",
          "size": "16 GB",
          "type": "DDR4 ECC Registered",
          "speed": "2400 MHz",
          "status": "OK",
      },
  ]

  network_interfaces = [
      {
          "interface": "eth0 (Embedded 1Gb 4-port 331i)",
          "ip": cfg["host_address"],
          "status": "Up / Active",
      },
      {"interface": "eth1", "ip": "Nicht verbunden", "status": "Down"},
      {"interface": "eth2", "ip": "Nicht verbunden", "status": "Down"},
      {"interface": "eth3", "ip": "Nicht verbunden", "status": "Down"},
  ]

  device_inventory = [
      {
          "location": "Embedded",
          "product": "HPE Ethernet 1Gb 4-port 331i Adapter - NIC",
          "part": "N/A",
          "serial": "N/A",
          "status": "OK",
      },
      {
          "location": "Embedded",
          "product": "Smart Array P440ar Controller",
          "part": "749798-001",
          "serial": "PDNLH08H7K1XQ",
          "status": "OK",
      },
      {
          "location": "Embedded",
          "product": "HPE Smart Storage Battery",
          "part": "875241-821",
          "serial": "6WQXL0DB2C507W",
          "status": "OK",
      },
      {
          "location": "PCI-E Slot 3",
          "product": "NVIDIA Quadro P2000",
          "part": "N/A",
          "serial": "N/A",
          "status": "Aktiv",
      },
      {
          "location": "PCI-E Slot 6",
          "product": "GP107 Board [88.07.55.00.04]",
          "part": "N/A",
          "serial": "N/A",
          "status": "Aktiv",
      },
      {
          "location": "PCI-E Slot 8",
          "product": "NVIDIA Quadro P2000",
          "part": "N/A",
          "serial": "N/A",
          "status": "Aktiv",
      },
  ]

  drives = [
      {
          "slot": "Drive 1 (Bay 1)",
          "model": "HPE 256GB SAS SSD",
          "health": "OK (100% Lebensdauer)",
          "temp": "34 °C",
          "reads": "1.42 TB",
          "writes": "1.18 TB",
      },
      {
          "slot": "Drive 2 (Bay 2)",
          "model": "HPE 256GB SAS SSD",
          "health": "OK (99% Lebensdauer)",
          "temp": "35 °C",
          "reads": "1.39 TB",
          "writes": "1.15 TB",
      },
  ]

  bios_version = "P92 v3.30 (09/21/2023)"
  try:
    if os.path.exists("/sys/class/dmi/id/bios_version"):
      with open("/sys/class/dmi/id/bios_version", "r") as f:
        bios_version = f.read().strip()
  except Exception:
    pass

  return {
      "server_name": cfg["server_name"],
      "product_name": cfg["server_model"],
      "os": cfg["os_name"],
      "bios_version": bios_version,
      "raid_status": raid_status,
      "cpu": cpu_info,
      "ram": ram_info,
      "power_watts": current_watts,
      "fans": fans,
      "processors": processors,
      "memory_modules": memory_modules,
      "network_interfaces": network_interfaces,
      "device_inventory": device_inventory,
      "drives": drives,
  }


@app.get("/api/system/power-history")
async def get_power_history(request: Request):
  _require_user(request)
  now = datetime.now()
  labels = [(now - timedelta(hours=i)).strftime("%H:00") for i in range(23, -1, -1)]
  data_points = [random.randint(95, 180) for _ in range(24)]
  peak_points = [val + random.randint(20, 60) for val in data_points]
  return {"labels": labels, "consumption": data_points, "peaks": peak_points}


if __name__ == "__main__":
  import uvicorn

  uvicorn.run("app:app", host="0.0.0.0", port=8000)
