#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 - <<'PY'
from pathlib import Path
root = Path('.')
core = (root / 'src/pattern-core.js').read_text(encoding='utf-8')
code = (root / 'src/code-template.js').read_text(encoding='utf-8')
ui = (root / 'src/ui-template.html').read_text(encoding='utf-8')
led = (root / 'src/assets/LEDNIQUE.b64').read_text(encoding='utf-8').strip()
mont = (root / 'src/assets/mont.css').read_text(encoding='utf-8')
for target, placeholder, value in [
    ('code.js', '/*__PATTERN_CORE__*/', core),
]:
    if placeholder not in code:
        raise SystemExit(f'Missing placeholder {placeholder}')
    code = code.replace(placeholder, value)
(root / 'code.js').write_text(code, encoding='utf-8')
for placeholder, value in [
    ('/*__PATTERN_CORE__*/', core),
    ('/*__MONT_CSS__*/', mont),
    ('__LEDNIQUE_B64__', led),
]:
    if placeholder not in ui:
        raise SystemExit(f'Missing placeholder {placeholder}')
    ui = ui.replace(placeholder, value)
(root / 'ui.html').write_text(ui, encoding='utf-8')
print(f'Built code.js ({len(code):,} bytes) and ui.html ({len(ui):,} bytes)')
PY
