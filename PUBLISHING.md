# Repository and publication status

The project is being imported into the owner-created **private** repository `natanelia/dom-director`. This is a source repository, not a public website or published npm package. Do not change repository visibility, enable a public deployment, or publish a package without the owner’s explicit approval.

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

## Generated demo assets

The repository import includes the complete demo source. A bounded, one-time GitHub Actions job may generate the local eSpeak placeholder narration, update its measured cue timings, and build the self-contained HTML. It writes only `demo/assets/narration.mp3`, `demo/assets/cues.json`, and `demo/index.html`, after validation, using the repository-scoped Actions token and a normal non-forced push. It does not deploy a website or change repository visibility. Inspect the actual Actions run before claiming it succeeded.

Once generated, the checked-in `demo/index.html` is the ready-to-open demo. To regenerate locally, install eSpeak and FFmpeg, run `python3 demo/generate_audio.py`, then `python3 demo/build.py`. The voice is a synthetic placeholder, not a production or live-AI voice.

## Historical create-only helper

`tools/publish-github.sh` is retained with its tests for creating a *different, new* personal repository from a local project copy. **Do not run it against this existing repository.** It deliberately refuses existing repositories and remotes; it does not update or overwrite them.

The helper requires an explicitly selected visibility, an authenticated GitHub CLI, Git, Python, and configured Git author details. Never share a token in a chat or issue. The helper does not authenticate, change permissions, or force-push. The original source ZIP and optional Git bundle remain historical local deliverables, not evidence of a package release.

## Release boundary

The root `package.json` has `private: true` to prevent accidental npm publication; that is separate from GitHub repository privacy. CI checks are evidence only for the commands that actually ran. Design validation is not reusable-runtime, performance, or accessibility certification. Create release credentials and publication workflows only after a separate release decision.
