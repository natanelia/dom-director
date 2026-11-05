#!/usr/bin/env bash
# CI-only dependency installation. Keep test failures distinct from slow mirrors.
set -euo pipefail
browser="${BROWSER_ENGINE:-chromium}"
case "$browser" in chromium|firefox|webkit) ;; *) echo 'Unknown test browser' >&2; exit 2 ;; esac
python3 -m pip install --disable-pip-version-check --timeout 30 --retries 2 -r demo/requirements-browser.txt
if [[ "${GITHUB_ACTIONS:-}" == 'true' ]]; then
  # Some hosted runner regions download at ~40 KB/s from the Azure Ubuntu mirror.
  # Select the official Ubuntu archive instead; package signature checks stay on.
  sudo python3 - <<'PY'
from pathlib import Path
for name in ['/etc/apt/apt-mirrors.txt', '/etc/apt/sources.list.d/ubuntu.sources', '/etc/apt/sources.list']:
    path = Path(name)
    if path.is_file():
        source = path.read_text()
        updated = source.replace('http://azure.archive.ubuntu.com/ubuntu', 'https://archive.ubuntu.com/ubuntu')
        if updated != source:
            path.write_text(updated)
Path('/etc/apt/apt.conf.d/99-director-ci-timeouts').write_text('Acquire::Retries "2";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\n')
PY
fi
# This bounds infrastructure setup only, not test execution or assertions.
timeout 480 python3 -m playwright install --with-deps "$browser"
if [[ "${GITHUB_ACTIONS:-}" == 'true' && "$browser" == 'firefox' ]]; then
  # Real audio tests need a working output device on the headless Linux runner.
  # Use a user-owned null sink, not fake media clocks or disabled autoplay policy.
  timeout 180 sudo apt-get install --yes --no-install-recommends pulseaudio
  pulseaudio --start --exit-idle-time=-1
  pactl load-module module-null-sink sink_name=director_test_output
  pactl set-default-sink director_test_output
  pactl list short sinks
fi
