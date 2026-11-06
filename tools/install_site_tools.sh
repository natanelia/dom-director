#!/usr/bin/env bash
# CI-only media build tooling; signature verification and bounded setup stay enabled.
set -euo pipefail
if ! command -v ffmpeg >/dev/null 2>&1; then
  if [[ "${GITHUB_ACTIONS:-}" == 'true' ]]; then
    # Media setup runs before the browser helper. Apply its existing mirror fix here,
    # too, instead of repeatedly timing out on the slow regional Azure mirror.
    sudo python3 - <<'PY'
from pathlib import Path
for name in ['/etc/apt/apt-mirrors.txt', '/etc/apt/sources.list.d/ubuntu.sources', '/etc/apt/sources.list']:
    path = Path(name)
    if path.is_file():
        source = path.read_text()
        updated = source.replace('http://azure.archive.ubuntu.com/ubuntu', 'https://archive.ubuntu.com/ubuntu')
        if updated != source:
            path.write_text(updated)
PY
  fi
  sudo timeout --kill-after=15s 180s apt-get \
    -o Acquire::Retries=2 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 update
  sudo timeout --kill-after=15s 240s apt-get \
    -o Acquire::Retries=2 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 \
    install -y --no-install-recommends ffmpeg
fi
ffmpeg -version
