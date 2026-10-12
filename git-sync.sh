#!/bin/bash
cd /docker/aura-suite
git add -A
if ! git diff-index --quiet HEAD --; then
  git commit -m "Auto-sync: $(date +'%Y-%m-%d %H:%M:%S')"
  git push origin main
fi
