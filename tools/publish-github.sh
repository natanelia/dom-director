#!/usr/bin/env bash
# Explicit, user-run creation of a NEW personal GitHub repository.
# Does not install tools, collect tokens, modify auth scopes, or overwrite a repo.
set -euo pipefail

die() { printf '%s\n' "$*" >&2; exit 1; }
[[ $# -eq 2 ]] || die 'Usage: bash tools/publish-github.sh OWNER/REPO --public|--private'
repo=$1
visibility=$2
[[ "$repo" =~ ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$ ]] || die 'Expected OWNER/REPO.'
[[ "$visibility" == '--public' || "$visibility" == '--private' ]] || die 'Choose --public or --private explicitly.'
for tool in git gh python3; do command -v "$tool" >/dev/null || die "Missing prerequisite: $tool"; done
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
cd "$root"
[[ -f schemas/tour.schema.json && -f docs/requirements.json && -f AGENTS.md ]] || die 'Not a DOM Director project root.'
# Pin this helper to GitHub.com; do not inherit a different enterprise hostname.
export GH_HOST=github.com
export GH_PROMPT_DISABLED=1
gh auth status --hostname github.com >/dev/null 2>&1 || die 'Authenticate GitHub CLI first; this helper will not request or change credentials.'
login=$(gh api user --jq .login)
owner=${repo%%/*}
[[ "$(printf '%s' "$owner" | tr '[:upper:]' '[:lower:]')" == "$(printf '%s' "$login" | tr '[:upper:]' '[:lower:]')" ]] || die 'This helper only creates a repository under the authenticated personal account.'
if gh repo view "$repo" --json name >/dev/null 2>&1; then
  die 'Repository already exists. This create-only helper refuses to overwrite or push to it.'
fi
if git rev-parse --show-toplevel >/dev/null 2>&1; then
  gitroot=$(git rev-parse --show-toplevel)
  [[ "$(cd "$gitroot" && pwd -P)" == "$root" ]] || die 'Project is nested in a different Git repository; refusing to stage it.'
  [[ -z "$(git remote)" ]] || die 'Existing Git remote detected. Inspect it and publish manually.'
  [[ "$(git branch --show-current)" == 'main' ]] || die 'Use the reviewed main branch before publishing.'
  [[ -z "$(git status --porcelain)" ]] || die 'Commit or review local changes before publishing.'
  git rev-parse --verify HEAD >/dev/null 2>&1 || die 'Existing local repository has no commit; initialize it manually.'
else
  git config user.name >/dev/null || die 'Configure your Git author name first.'
  git config user.email >/dev/null || die 'Configure your Git author email first.'
fi
python3 tools/check_design.py
python3 -m unittest discover -s tests -v
if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  git init -b main
  git add -- .
  git commit -m 'docs: establish DOM Director design foundation'
fi
printf 'Creating %s with explicit visibility %s and pushing reviewed main.\n' "$repo" "$visibility"
# A race/name collision fails at GitHub creation; never retry against an existing repo.
gh repo create "$repo" "$visibility" --source=. --remote=origin --push \
  --description 'Design-first, agent-friendly cinematic walkthroughs over real DOM: scripts, narration, captions, guidance, and safe playback.'
printf 'Created and pushed %s. Inspect the repository and its CI run before making release claims.\n' "$repo"
