"""
Aura-Academy Trainingsskript - läuft im selben Container wie das Node-Backend, wird von
dort per child_process einmal nachts angestoßen (siehe server.js, Abschnitt "AURA-ACADEMY").

WICHTIGER HINWEIS: Dies ist ein bewusst schlanker, EXPERIMENTELLER LoRA-Feintuning-Lauf auf
Basis der in AuraChat gesammelten "Gedächtnis"-Fakten. Es trainiert KEIN Modell von Grund
auf (unrealistisch mit heutiger Hardware), sondern feintunt ein bereits fertig
vortrainiertes, kleines offenes Modell (0.5B Parameter) inkrementell weiter. Auf reiner
CPU ist das langsam - realistisch mehrere Stunden pro Nachtlauf, abhängig von der
Datenmenge und der Hardware der NAS. Ergebnis ist ein Nebenprojekt, kein Ersatz für das
Haupt-Chat-Modell.
"""

import os
import json
import sqlite3
import time
from datetime import datetime, timezone

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer, DataCollatorForLanguageModeling
from peft import LoraConfig, get_peft_model
from datasets import Dataset

DB_PATH = os.environ.get("AURACHAT_DB_PATH", "/app/data/aurachat.db")
BASE_MODEL = os.environ.get("ACADEMY_BASE_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")
WORK_DIR = "/app/data/academy-work"
CHECKPOINT_DIR = os.path.join(WORK_DIR, "checkpoint")
STATE_FILE = os.path.join(WORK_DIR, "state.json")


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    return {"iterations": 0, "lastRun": None, "lastFactCursor": 0}


def save_state(state):
    os.makedirs(WORK_DIR, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)


def fetch_new_facts(since_id):
    """Liest neue, seit dem letzten Lauf hinzugekommene Gedächtnis-Fakten DIREKT aus der
    SQLite-Datenbank (gleicher Container/gleiche Datei wie das Node-Backend)."""
    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, fact FROM user_memories WHERE id > ? ORDER BY id ASC LIMIT 500", (since_id,))
        rows = cur.fetchall()
    finally:
        conn.close()
    facts = [r[1] for r in rows]
    last_id = rows[-1][0] if rows else since_id
    return facts, last_id


def fetch_emotional_profiles():
    """Liest die aktuellen Gefühls-Profile (ein Zustand pro Person, kein Ereignis-Log wie
    bei den Fakten oben) - fliesst bei jedem Lauf erneut mit ein, damit der gelernte
    Umgangston nicht veraltet, auch wenn sich seit dem letzten Lauf sonst nichts geändert hat."""
    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        cur.execute("SELECT summary FROM emotional_profiles")
        rows = cur.fetchall()
    finally:
        conn.close()
    return [r[0] for r in rows]


def build_dataset(facts, tokenizer, emotional_summaries=None):
    """Formt die Fakten in einfache Trainingsbeispiele. Bewusst simpel gehalten - die
    "richtige" Formatierung für dieses Szenario ist offen, hier ein pragmatischer Ansatz:
    jedes Faktum als kurzer, in sich abgeschlossener Kontext-Satz. Gefühls-Profile fliessen
    im selben Format mit ein, damit der gelernte Umgangston nicht nur im Prompt zur Laufzeit
    steht, sondern auch ins Nebenprojekt-Modell einsickert."""
    texts = [f"Bekannter Fakt über eine Person, mit der Aura chattet: {fact}" for fact in facts]
    for summary in (emotional_summaries or []):
        texts.append(f"Aura pflegt mit einer Person folgenden Umgangston: {summary}")
    if not texts:
        return None
    enc = tokenizer(texts, truncation=True, padding=True, max_length=128)
    return Dataset.from_dict(enc)


def run_training():
    state = load_state()
    print(f"[{datetime.now(timezone.utc).isoformat()}] Academy-Lauf startet. Bisherige Iterationen: {state['iterations']}")

    if not os.path.exists(DB_PATH):
        print(f"Datenbank nicht gefunden unter {DB_PATH} - überspringe.")
        return {"success": False, "error": "db_not_found"}

    facts, last_id = fetch_new_facts(state["lastFactCursor"])

    if not facts:
        print("Keine neuen Fakten seit dem letzten Lauf - überspringe Training.")
        state["lastRun"] = datetime.now(timezone.utc).isoformat()
        save_state(state)
        return {"success": True, "skipped": True, "reason": "no_new_data"}

    print(f"{len(facts)} neue Fakten gefunden. Lade Basis-Modell ({BASE_MODEL} oder letzter Checkpoint)...")

    model_source = CHECKPOINT_DIR if os.path.exists(os.path.join(CHECKPOINT_DIR, "config.json")) else BASE_MODEL
    tokenizer = AutoTokenizer.from_pretrained(model_source)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(model_source, dtype=torch.float32)

    lora_config = LoraConfig(
        r=8, lora_alpha=16, lora_dropout=0.05,
        target_modules=["q_proj", "v_proj"],
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)

    dataset = build_dataset(facts, tokenizer, fetch_emotional_profiles())
    if dataset is None:
        print("Kein verwertbares Trainingsmaterial - überspringe.")
        return {"success": True, "skipped": True, "reason": "empty_dataset"}

    data_collator = DataCollatorForLanguageModeling(tokenizer, mlm=False)

    training_args = TrainingArguments(
        output_dir=os.path.join(WORK_DIR, "trainer_tmp"),
        num_train_epochs=3,
        per_device_train_batch_size=2,
        learning_rate=2e-4,
        logging_steps=5,
        save_strategy="no",
        report_to=[],
    )

    trainer = Trainer(model=model, args=training_args, train_dataset=dataset, data_collator=data_collator)

    start = time.time()
    trainer.train()
    duration = time.time() - start
    print(f"Training abgeschlossen in {duration:.0f}s.")

    print("Füge LoRA-Gewichte zusammen und speichere Checkpoint...")
    merged_model = model.merge_and_unload()
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    merged_model.save_pretrained(CHECKPOINT_DIR)
    tokenizer.save_pretrained(CHECKPOINT_DIR)

    state["iterations"] += 1
    state["lastRun"] = datetime.now(timezone.utc).isoformat()
    state["lastFactCursor"] = last_id
    state["lastFactsCount"] = len(facts)
    state["lastDurationSeconds"] = round(duration)
    save_state(state)

    return {"success": True, "skipped": False, "factsUsed": len(facts), "iterations": state["iterations"]}


if __name__ == "__main__":
    result = run_training()
    print("RESULT_JSON:" + json.dumps(result))
