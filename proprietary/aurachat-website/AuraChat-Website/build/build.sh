#!/bin/bash
# Baut index.html und translations.js der Webseite neu aus den Texten in content.js / content_new.js.
#   Ausgangs-HTML: build/base/index.html (Stand vor den Produktabschnitten, mit den Suchmaschinen-Angaben)
#   translations.js: wird in html/ erweitert (der Bau ist wiederholbar, mehrfaches Ausführen ergibt dasselbe)
# Aufruf im Ordner "build":  ./build.sh        (optional:  ./build.sh datasheets  erzeugt zusätzlich die AuraCall-Datenblätter)
set -euo pipefail
cd "$(dirname "$0")"
cp base/index.html ../html/index.html
SITE="$(cd ../html && pwd)" node apply_site.js
if [[ "${1:-}" == "datasheets" ]]; then OUT="$(cd ../html/downloads && pwd)" node make_datasheets.js auracall; fi
