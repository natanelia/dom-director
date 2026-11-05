# Repository and publication status

The project is in the owner-created **private** repository [natanelia/dom-director](https://github.com/natanelia/dom-director). This is a source repository, not a public website or published npm package. Do not change repository visibility, enable a public deployment, or publish a package without the owner's explicit approval.

## Work on this repository

```sh
git clone git@github.com:natanelia/dom-director.git
cd dom-director
python3 -m pip install -r requirements-dev.txt
python3 tools/check_design.py
python3 -m unittest discover -s tests -v
node --test demo/tests/model.test.cjs
```

The implementation roadmap is in [docs/16-roadmap.md](docs/16-roadmap.md). The flagship fixture demo and its browser tests are described in [demo/README.md](demo/README.md). The reusable SDK remains unimplemented.

Use a feature branch and a reviewed pull request for subsequent implementation work. Keep the repository private. Do not add deployment credentials, release tokens, or telemetry as part of routine development.

## Run the demo

The complete, self-contained [demo/index.html](demo/index.html) is checked in with its prepared placeholder narration. From the repository root:

```sh
python3 -m http.server 8080 --directory demo
```

Open `http://localhost:8080` in a browser. No npm installation, remote API, account, or production backend is required for the demo. To rebuild after editing source, run `python3 demo/build.py`. To regenerate the placeholder voice, install eSpeak and FFmpeg, run `python3 demo/generate_audio.py`, then rebuild. The synthetic voice is not production narration.

## Import and validation

The initial source import used two bounded, repository-scoped Actions jobs. One generated the bundled demo assets; the other verified the transferred sources, restored the byte-identical original 112-requirement manifest, and formatted the JSON fixtures for reading. Both used normal non-forced pushes and passed their checks. Both temporary workflows have been removed.

The remaining [validation workflow](.github/workflows/design-checks.yml) has read-only repository permissions and runs the design checks, 79 design tests, 10 demo-model tests, and 14 Chromium fixture tests on pushes and pull requests. It does not publish, deploy, change repository visibility, or write back to the repository. See [validation evidence](docs/validation-report.md) and the actual [Actions runs](https://github.com/natanelia/dom-director/actions).

## Historical create-only helper

`tools/publish-github.sh` is retained with its tests for creating a *different, new* personal repository from a local project copy. **Do not run it against this existing repository.** It deliberately refuses existing repositories and remotes; it does not update or overwrite them.

The helper requires an explicitly selected visibility, an authenticated GitHub CLI, Git, Python, and configured Git author details. Never share a token in a chat or issue. The helper does not authenticate, change permissions, or force-push. The original ZIP and optional Git bundle are historical local deliverables, not evidence of a package release.

## Release boundary

The root `package.json` has `private: true` to prevent accidental npm publication; that is separate from GitHub repository privacy. Design validation and fixture tests are not reusable-runtime, performance, or accessibility certification. Create release credentials and publication workflows only after a separate release decision.
