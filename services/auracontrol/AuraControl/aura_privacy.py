"""Datenschutzerklärung mit Bestätigung beim ersten Login für AuraControl (gleiches Verhalten wie in den anderen Aura-Produkten).

Text und Versionsnummer liegen in privacy.json im Datenordner; wer die AKTUELLE Version bestätigt hat, wird dort vermerkt. Ändert ein Admin den Text, steigt die Version
und alle müssen neu bestätigen. Nur Standardbibliothek."""
import json
import os
import threading

MAX_TEXT = 50000

CHECKIN_NOTICE = "\n".join([
    "## Rückmeldung an den Lizenzserver",
    "",
    "Diese Anwendung meldet sich alle 12 Stunden anonym beim Lizenzserver des Herstellers. Übermittelt werden nur: eine zufällige Installationskennung, der Produktname und die Version, der Lizenzzustand (Testphase, kostenlos, lizenziert, abgelaufen), die Zahl der Konten und, falls vorhanden, der Lizenzschlüssel. Es werden keine Namen, keine Inhalte und keine Zugangsdaten übermittelt. Die IP-Adresse wird beim Hersteller nicht gespeichert.",
])

DEFAULT_TEXT = """# Datenschutzerklärung

Diese Anwendung (AuraControl) zeigt Zustand und Verbrauch des Servers an und verwaltet ihn (Neustart, Herunterfahren). Sie speichert folgende Daten:

- Benutzername des Administrators (das Passwort nur als Prüfwert)
- Angaben zum Server, die der Administrator in den Einstellungen einträgt (Servername, Modell, Adresse, Betriebssystem)
- Beginn der Testphase und, falls vorhanden, den Lizenzschlüssel
- Technische Protokolle (z. B. Anmeldungen und ausgelöste Neustarts) für Betrieb und Sicherheit

Die angezeigten Hardware- und Stromwerte werden nur live gelesen und nicht gespeichert. Diese Daten werden ausschliesslich auf dem Server des Betreibers gespeichert und nicht an Dritte weitergegeben. Auskunft, Berichtigung und Löschung erhaltet ihr beim Administrator.

""" + CHECKIN_NOTICE


class PrivacyStore:
    def __init__(self, data_dir, default_text=DEFAULT_TEXT):
        self.dir = data_dir
        self.file = os.path.join(data_dir, "privacy.json")
        self.default_text = default_text
        self._lock = threading.Lock()
        os.makedirs(data_dir, exist_ok=True)

    def _load(self):
        try:
            with open(self.file, "r", encoding="utf-8") as f:
                d = json.load(f)
            if isinstance(d, dict):
                v = d.get("version")
                acc = d.get("accepted") if isinstance(d.get("accepted"), dict) else {}
                return {"text": d.get("text") if isinstance(d.get("text"), str) and d.get("text").strip() else None,
                        "version": v if isinstance(v, int) and not isinstance(v, bool) and v >= 1 else 1,
                        "accepted": {str(k): n for k, n in acc.items() if isinstance(n, int) and not isinstance(n, bool)}}
        except (OSError, ValueError):
            pass
        return {"text": None, "version": 1, "accepted": {}}

    def _save(self, d):
        tmp = self.file + ".tmp"
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(d, f)
        os.replace(tmp, self.file)

    def policy(self, user=None):
        """{text, version, accepted}: accepted ist True/False für Angemeldete, None ohne Sitzung."""
        d = self._load()
        accepted = None if not user else (d["accepted"].get(str(user), 0) >= d["version"])
        return {"text": d["text"] or self.default_text, "version": d["version"], "accepted": accepted}

    def accept(self, user, seen_version=None):
        """(ok, Meldung). Mit seen_version wird geprüft, dass die Person die aktuelle Fassung gesehen hat."""
        with self._lock:
            d = self._load()
            if seen_version is not None:
                try:
                    ok = int(seen_version) == d["version"] and not isinstance(seen_version, bool)
                except (TypeError, ValueError):
                    ok = False
                if not ok:
                    return False, "Die Datenschutzerklärung wurde inzwischen geändert. Bitte die Seite neu laden und die neue Fassung lesen."
            d["accepted"][str(user)] = d["version"]
            self._save(d)
            return True, d["version"]

    def set_text(self, text):
        """(ok, Meldung oder neue Version). Erhöht die Version: alle müssen neu bestätigen."""
        if not isinstance(text, str) or not text.strip():
            return False, "Der Text darf nicht leer sein."
        if len(text) > MAX_TEXT:
            return False, "Der Text ist zu lang (höchstens %d Zeichen)." % MAX_TEXT
        with self._lock:
            d = self._load()
            d["text"] = text
            d["version"] += 1
            self._save(d)
            return True, d["version"]
