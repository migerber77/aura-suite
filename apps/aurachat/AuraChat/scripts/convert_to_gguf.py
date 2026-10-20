"""
Wandelt den zusammengeführten Trainings-Checkpoint (HuggingFace-Format) in eine GGUF-Datei
um - das Format, das Ollama/llama.cpp direkt laden können. Läuft im selben Container wie
train.py (siehe dort für den Gesamt-Kontext).
"""

import os
import json
import subprocess
import shutil
from datetime import datetime, timezone

WORK_DIR = "/app/data/academy-work"
CHECKPOINT_DIR = os.path.join(WORK_DIR, "checkpoint")
MODELS_DIR = "/app/models"
OUTPUT_PATH = os.path.join(MODELS_DIR, "Aura-AI-05b.gguf")


def convert():
    if not os.path.exists(os.path.join(CHECKPOINT_DIR, "config.json")):
        print("Kein Checkpoint zum Konvertieren gefunden - Training zuerst ausführen.")
        return {"success": False, "error": "no_checkpoint"}

    os.makedirs(MODELS_DIR, exist_ok=True)
    tmp_output = os.path.join(WORK_DIR, "Aura-AI-05b.tmp.gguf")

    cmd = [
        "python3", "/app/llama.cpp/convert_hf_to_gguf.py",
        CHECKPOINT_DIR,
        "--outfile", tmp_output,
        "--outtype", "f16",
    ]
    print(f"Starte GGUF-Konvertierung: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print("GGUF-Konvertierung fehlgeschlagen:")
        print(result.stdout)
        print(result.stderr)
        return {"success": False, "error": (result.stderr[-2000:] if result.stderr else "Unbekannter Fehler")}

    if os.path.exists(OUTPUT_PATH):
        backup_path = os.path.join(MODELS_DIR, "Aura-AI-05b.previous.gguf")
        shutil.move(OUTPUT_PATH, backup_path)

    shutil.move(tmp_output, OUTPUT_PATH)
    size_mb = round(os.path.getsize(OUTPUT_PATH) / (1024 * 1024))
    print(f"GGUF-Datei geschrieben: {OUTPUT_PATH} ({size_mb} MB)")
    return {"success": True, "path": OUTPUT_PATH, "sizeMb": size_mb, "convertedAt": datetime.now(timezone.utc).isoformat()}


if __name__ == "__main__":
    result = convert()
    print("RESULT_JSON:" + json.dumps(result))
