#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
(
  cd pattern-plugin
  bash build.sh
  node test/core.test.js
  node test/sandbox.test.js
  node test/ui.test.js
)
(
  cd veer-plugin
  bash build.sh
  node test/core.test.js
  node test/sandbox.test.js
  node test/ui.test.js
  node test/ui-smoke.test.js
)
(
  cd pattern-backend
  node test/backend.test.js
  node test/site.test.js
)
