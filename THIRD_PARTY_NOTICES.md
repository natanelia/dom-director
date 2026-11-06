# License and asset inventory

This inventory describes what the candidate packages and allowlisted public site contain. It is not a legal opinion or a claim that all future integrations have the same licensing terms.

## Distributed candidate code and assets

| Material | Origin and distribution |
|---|---|
| DOM Director core, React adapter, schemas, authored examples and site source | Repository-authored material under the root [MIT license](LICENSE); each candidate package contains the same license bytes. Clean-consumer checks verify license inclusion and source identity. |
| React | A host-provided peer of the optional adapter, not a bundled copy in the core or public Orbit site. See the installed React package's own license. |
| Orbit interface, synthetic route illustration, script and narration text | Authored synthetic demo material in this repository. No user map data, customer recording, external stock photograph or copied song is used. |
| Prepared narration MP3 | Generated locally from the authored text by [the audio-generation script](demo/generate_audio.py), using an ordinary synthetic `en-us` eSpeak voice and FFmpeg encoding. It is not a cloned person or live AI service. The site builder splits that committed audio into scene files. |
| Fonts | System font stacks only. No font files are bundled or redistributed. |

The core package declares no runtime dependency. The React package declares the core and React as peers. The public site builder copies only first-party modules, authored page/assets, the original prototype and `LICENSE.txt`; it does not upload test dependencies or a repository checkout.

## Build and test tools, not shipped runtime code

Python JSON Schema validation, Playwright and its downloaded test browsers, React test fixtures, TypeScript, esbuild, axe-core, eSpeak, FFmpeg and GitHub Actions are development or CI tooling. Their versions and sources are specified in repository requirement/manifests/workflows, and each retains its upstream license. Installing these tools does not copy their binaries or source into the candidate SDK or site allowlist.

The accessibility workflow installs exact test-only axe-core 4.10.3 with installation scripts disabled. React test versions are pinned in the integration workflow. FFmpeg/eSpeak are local or runner tools, not runtime imports. Hosting/build-service usage and downstream bundling can introduce additional obligations; inspect the actual final distribution rather than treating this inventory as a blanket exemption.

Before registry publication, re-run package archive checks, inspect dependency and asset changes, verify the final license files, and update this inventory for anything newly bundled. Package-name ownership and publication authorization remain unconfirmed until that release decision.
