# 14 · Authoring, packaging, distribution, and export

## One canonical representation

Versioned JSON is the source of truth. A TypeScript builder, agent tool, visual editor, or recorder produces the same schema. Builders provide autocomplete and convenience but do not embed callbacks into serialized scripts. Host callbacks stay in the application integration.

The simple authoring layer can accept scenes with a target, explanation, and duration and compile them to explicit cues. Advanced authors can inspect those cues. Round-tripping must preserve stable scene/cue IDs so translations, reviews, and analytics do not depend on array positions.

## Proposed authoring workflow

Start from a semantic target catalog and a learning objective. Choose the intended mode and fixture policy. Draft a storyboard. Prepare narration/transcript and locale-specific timings. Add camera, cursor, annotations, gates, and actions. Validate structural and semantic constraints. Review requested permissions. Preview with effects disabled. Run a fixture. Inspect motion, focus, privacy, and restoration. Publish a content-versioned package.

This is a future workflow. The repository currently supplies examples and validation tools, not a visual studio or runtime player.

## Visual studio — P2

A separate tool offers a target picker, scene/branch graph, track timeline, narration/caption editor, safe-area preview, breakpoint/locale previews, permission audit, motion comparison, and dry-run diagnostics. Clicking a target in the studio creates a semantic reference, not a fragile pixel path. Camera keyframes are editable but constrained to supported geometry.

A recording assistant may observe approved UI interactions and propose scenes. It must not record all form fields, network bodies, passwords, or private text by default. Local redaction precedes storage. Recorded click positions need semantic reconciliation and host confirmation before becoming actions. The author reviews the result before publishing.

## Proposed CLI, distinct from current tools

Future commands could include `director validate`, `director inspect`, `director preview`, `director test`, `director bundle`, and `director export`. These are **not implemented**. Current design checks are `python3 tools/check_design.py` and unit tests; see the README for setup.

Future CLI output should support both readable text and structured JSON with stable exit codes. Validation must be offline by default. Live preparation or capture requires an explicit host/test URL allowlist and should not browse arbitrary URLs from a script.

## Content packages

A bundle can contain a manifest, canonical script, locale variants, captions, transcripts, approved media, asset hashes/licenses, and app compatibility requirements. It must distinguish optional assets from required ones and record which features are unsupported without host adapters. No credentials, cookies, storage snapshots, real customer records, or production API tokens belong in it.

A future importer enforces path-traversal protection, total uncompressed size, file count, MIME policy, origin policy, and decompression limits. An archive hash detects change; signing/author trust is separate. Package identity and host capability identity are not interchangeable.

## Versions and updates

Separate schema version, script content version/hash, host integration version, and runtime version. A script can validate under the same schema while becoming incompatible with changed target semantics. A target manifest can declare deprecation aliases with explicit host review rather than heuristic fallback.

Semantic diffs highlight changed targets, instructions, timings, action inputs, permissions, and branch destinations. Any change to executable effects invalidates relevant approvals. Localization changes may rebuild timing without changing actions, but still require content review.

## Sharing and embedding

Use content ID + version + scene ID in a deep link. Keep sensitive application state out of URLs. When a shared link opens, authenticate through the host normally, preflight permissions, and offer read-only explanation when the original context is unavailable. Embeds need a documented frame/message protocol and clear boundaries around parent/child data access.

## Offline use

The core should not depend on a network. A host can bundle scripts, captions, narration, and a synthetic fixture. Offline replay cannot claim to reproduce a current server result. Optional service-worker caching is a host responsibility with explicit asset retention and update policy, not an automatically installed global worker.

## Live versus recorded outputs

**Live walkthrough:** real DOM, requires compatible host and permissions. **Static transcript/storyboard:** portable, accessible, no host effects. **Fixture package:** reproducible within its declared app/data environment. **Video:** fixed path and viewport, no live interactivity, produced by an optional capture/render pipeline.

Browser screen capture is permissioned and cannot silently choose arbitrary screen content. A deterministic export runner requires controlled viewport, fonts, assets, data, route state, and rendering readiness; media output still needs codec/container/muxing decisions. Simulated JavaScript time does not automatically control audio decoding, compositor rendering, WebGL, or every host clock. [S9, S13](21-sources.md).

The export feature should label what was captured, whether captions are burned in or sidecars, which path/locale was rendered, and whether all demonstrations ran in a fixture. No “perfect DOM to video” promise.

## Distribution strategy

Keep the minimal runtime dependency surface small. Publish only after core tests, license review, package-consumer tests, exports/types checks, and browser evidence. The current package is private and has no release workflow or npm token requirements. A docs/demo website may follow after a real vertical slice; an attractive landing page cannot substitute for runtime correctness.
