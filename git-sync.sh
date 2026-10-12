#!/bin/bash
cd /docker/aura-suite

# 1. Prüfen, ob lokale Änderungen vorliegen und ggf. Build & Push ausführen
if [[ -n $(git status --porcelain) ]]; then
    echo "Änderungen im Quellcode erkannt. Starte Build & Push..."
    ./build-and-push.sh
fi

# 2. Normaler Git-Sync (Änderungen hinzufügen, committen und pushen)
git add -A
if ! git diff-index --quiet HEAD --; then
    git commit -m "Auto-sync: $(date +'%Y-%m-%d %H:%M:%S')"
    git push origin main
fi
