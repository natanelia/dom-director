# Package preparation and version policy

Both `@dom-director/core` and `@dom-director/react` are **private `0.1.0-rc.0` implementation candidates**. No npm publication or package-name reservation is claimed. GitHub Pages deployment is separate from registry publication.

## Build and install locally

From the repository root:

```sh
python3 tools/build_runtime.py
python3 tools/build_types.py
python3 tools/check_packages.py
mkdir -p artifacts
npm pack ./packages/core --pack-destination "$PWD/artifacts"
npm pack ./packages/react --pack-destination "$PWD/artifacts"
```

The prepack checks require the repository-owned generated schemas/types and license. Install the resulting tarball paths into a test application. React is a peer dependency, not bundled into the adapter; install a version covered by the [tested matrix](docs/release-candidate.md). Do not replace the tarball commands with `npm install @dom-director/core` in documentation until a real publication exists.

## Contract versions

Package version, tour `schemaVersion`, and agent `protocolVersion` are separate. The current language and protocol are `0.1.0-draft.1`. Compilation rejects unsupported structure rather than silently interpreting a newer contract. Pin the package pair and authoring schema during this candidate phase. The React peer declares the exact core candidate version.

A breaking package or language change requires a version change, migration notes, schema/declaration/example updates and positive/negative consumer tests in the same PR. Do not mutate the meaning of an already distributed schema identifier. No automatic cross-version script migration is promised.

## Migrating from the original prototype

The `demo/` cue model is not the SDK grammar. Reauthor its scenes using the canonical schema, globally unique cue IDs, scene-local milliseconds, declared target aliases and host semantic references. The SDK-backed [Orbit script](site/orbit.tour.json) and [site host](site/app.mjs) show the migration.

Move application effects into registered host actions/conditions with explicit authorization. A cursor cue does not click. A capability declaration does not grant permission. Replace prototype global-time assumptions with scene-local time plus the visited path. Supply prepared narration through an approved resolver. Keep controls outside the camera and implement cleanup.

Checkpoints are process-local, same-run visual resume records. They are intentionally not portable application snapshots; a reload, changed host/fixture version or unresolved effect invalidates restoration.

## Publication gate

Before an actual registry release, the maintainer must authorize publication, confirm package/scope ownership and availability, choose supported environments, inspect all required checks, complete or explicitly disposition the manual acceptance checklist, and verify the final tarballs and license inventory. Only then remove `private:true` in a reviewed release change. No publishing credentials or automatic npm-release workflow are installed here.
