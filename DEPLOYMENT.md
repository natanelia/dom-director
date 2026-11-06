# Public SDK demo deployment

The authorized site is `https://natanelia.github.io/dom-director/`. The SDK-backed Orbit experience is built from `site/`; the original self-contained prototype is preserved under `/prototype/`. The agent consumer is `/agent.html` and is explicitly not a live model provider.

## Build locally

Install FFmpeg as a build tool, then from a source checkout:

```sh
python3 tools/build_runtime.py
GITHUB_SHA=$(git rev-parse HEAD) python3 tools/build_site.py
python3 -m http.server 8080 --directory site-dist
```

`site-dist` must not exist before the build. Remove only your own previous generated output or select another new output path. The builder stages first-party SDK modules, authored pages, canonical script, prepared narration, the original prototype and the license. It never uploads the repository tree, test dependencies, credentials or release keys.

## Acceptance and publication

The deployment workflow tests the staged SDK consumer in Chromium, Firefox and WebKit. The staged verifier exercises a project subpath, checks exact first-party bytes against the source checkout, validates an exact artifact-path allowlist, and tests sustained playback, stable pause, a real mobile/reduced-motion task and the reviewed agent flow. A successful page fetch alone is insufficient.

Only the main-branch deployment job receives Pages and identity-token write permissions. Pull requests can run acceptance but cannot publish. Publication requires all browser acceptance jobs. Repository visibility and initial Pages activation are administrator settings, not changed by application code.

After successful publication, the read-only `Verify public playback` workflow checks the exact deployed revision and bytes without authentication, then repeats real browser interaction against the public URL. Prepared audio is verified against the build manifest, not re-encoded for cross-FFmpeg bit identity. Redirects and unexpected manifest paths are rejected.

To exercise the same verifier locally after building with the expected commit:

```sh
DEPLOYED_SHA=$(git rev-parse HEAD) BROWSER_ENGINE=chromium \
  python3 site-tests/deployed_smoke.py --local-directory site-dist
```

## Rollback and claims

To roll back, review and revert the relevant site/core change on `main`, then let the normal checks rebuild and redeploy. Do not force-push history or disable acceptance checks to get a deployment through. The preserved prototype is a fallback reference, not a substitute for verifying the SDK site.

CI/browser results are synthetic acceptance evidence. Physical Safari/iOS, Android, assistive technology, arbitrary host apps and GitHub Pages security headers require separate assessment. Registry publication is not part of this workflow.
