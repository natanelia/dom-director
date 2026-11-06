#!/usr/bin/env bash
# CI-only media build tooling from the runner's configured distribution repositories.
set -euo pipefail
if ! command -v ffmpeg >/dev/null 2>&1; then
  sudo timeout --kill-after=15s 180s apt-get \
    -o Acquire::Retries=2 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 update
  sudo timeout --kill-after=15s 240s apt-get \
    -o Acquire::Retries=2 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 \
    install -y --no-install-recommends ffmpeg
fi
ffmpeg -version
