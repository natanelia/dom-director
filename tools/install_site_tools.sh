#!/usr/bin/env bash
# CI-only media build tooling; preserve the runner's regional mirror and signature checks.
set -euo pipefail
if ! command -v ffmpeg >/dev/null 2>&1; then
  # Do not replace the runner's configured regional sources with a global mirror.
  # archive.ubuntu.com can be unreachable from a healthy hosted runner region.
  sudo timeout --kill-after=15s 180s apt-get \
    -o Acquire::Retries=2 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 update
  sudo timeout --kill-after=15s 240s apt-get \
    -o Acquire::Retries=2 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 \
    install -y --no-install-recommends ffmpeg
fi
ffmpeg -version
