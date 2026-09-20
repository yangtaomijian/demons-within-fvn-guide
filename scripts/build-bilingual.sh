#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
quarto render
(cd site-en && quarto render)
python3 - "$root" <<'PY'
from pathlib import Path
import shutil
import sys
root = Path(sys.argv[1])
source = root / 'site-en/_site'
target = root / '_site/en'
if target.exists():
    shutil.rmtree(target)
shutil.copytree(source, target)
target_assets = target / 'assets'
target_assets.mkdir(parents=True, exist_ok=True)
for name in ('favicon.svg', 'favicon-32x32.png', 'apple-touch-icon.png'):
    shutil.copy2(root / 'assets' / name, target_assets / name)
print('Bilingual output: _site/ and _site/en/')
PY
python3 "$root/scripts/finalize-publication.py"
