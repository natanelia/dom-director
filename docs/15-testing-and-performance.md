# 15 · Validation, test strategy, and performance evidence

## Current evidence versus future evidence

The current repository validates design artifacts: JSON Schema structure, example scripts, semantic references/timing/graphs, command examples, requirement/backlog coverage, and local Markdown links. Unit tests deliberately reject invalid inputs. There is no browser runtime to benchmark yet. A green design check is not a smooth-animation, security, accessibility, or compatibility certification.

## Test pyramid

**Pure model tests:** framing arithmetic, coordinate transforms, cue anchor resolution, deterministic easing, timeline reducer, path selection, effect barrier decisions, permission intersection, and restoration journal conflict rules.

**Property tests:** scene/client round-trips under supported transforms; any sequence of play/pause/seek/stop cannot repeat an effect; stale completions cannot change a newer epoch; JSON round-trips preserve canonical semantics; every reachable state has a stop path. Random inputs must be bounded and reproducible by seed.

**Browser integration tests:** real DOM and media behavior across target browsers, scroll/resize, portals, keyboard focus, styles, and cleanup. Do not substitute mocks for the interactions most likely to break in browsers.

**Manual UX/accessibility review:** motion comfort, narration comprehension, caption usability, screen-reader experience, mobile keyboard and touch, and recovery from confusing states.

## Essential adversarial cases

Cancel in every await boundary. Remove the target mid-shot. Replace it with another element at the same selector. Move the scene origin. Open a top-layer modal. Resize the browser. Change actual browser zoom. Scroll a nested container. Toggle reduced motion. Background/foreground the tab. Reject autoplay. Stall audio. Seek repeatedly while narration plays. Unmount a framework root. Trigger an action that times out after committing externally. Reuse an RPC request ID with different parameters. Deny approval. Revoke a grant. Inject markup/prompt instructions into labels. Supply unknown cue kinds and oversized/deep JSON.

Each case must produce explicit state/diagnostics, no unintended effect, and a usable escape route. “Did not crash” is insufficient.

## Proposed browser validation matrix

At release time pin concrete versions of Chromium, Firefox, and WebKit for automated tests, and test actual Safari/iOS and Android Chrome on representative devices where supported. Record OS/device, viewport, device pixel ratio, browser zoom, reduced-motion setting, and input method. “Latest two versions” can be a support policy, but the release report must list what was actually tested.

The initial compatibility position is **unverified**. Feature detection is necessary but not evidence that fixed positioning, media, or top-layer interactions work correctly. Unsupported surfaces must expose a reliable fallback.

## Reproducible performance protocol

Benchmark a realistic static dashboard and a separate actively updating dashboard. Use identical viewport, target path, duration, DOM, font/assets, device, browser, and warm-up for baseline and candidate. Keep the baseline application running without the director to measure unrelated host work. Then compare a minimal hand-written transform camera against the engine and any dependency backend under consideration.

Use at least 5 warm-up runs and 20 recorded runs per case as an initial lab protocol. Report per-run medians plus p95/p99 where sample density is meaningful, spread, outliers, and trace artifacts; do not pool one lucky run into a universal speed claim. Randomize order when thermal/cache effects matter. Do not force garbage collection in ordinary user paths or hide setup costs.

Measure script preparation separately from steady motion, target reveal, audio preparation, seek, and teardown. A camera animation that is fast only after a huge precomputation must disclose that cost.

## Metrics

Frame pacing and dropped frames; engine main-thread work per frame; layout/style/paint/raster/compositor activity; geometry read/write counts; long tasks; memory before/load/playing/after-destroy; active observers/listeners; asset preparation latency; narration/visual skew; target framing error; input responsiveness during guide mode; time to stop; bundle sizes by actual import path.

No single portable browser memory API captures all GPU/textures/layers, and compositor traces differ by browser. Label each measurement's scope. “No layout-property writes” is not the same as “zero layout events.” Track engine-attributable work separately from host updates.

## Preliminary budgets — hypotheses to validate

For a declared 60 Hz reference desktop fixture, aim for engine steady-state main-thread work below 3 ms at p95, no unbounded per-frame allocations, no full-DOM scan per frame, no ongoing engine animation loop while fully paused and idle, and no monotonic retained-node growth across 100 load/play/destroy cycles. Aim for narration-boundary skew within 100 ms at p95 in the controlled media fixture. These are engineering targets, not measured results or promises for every device.

Do not set a public compressed-bundle-size claim until a usable implementation exists. Establish a measured budget after M1/M2; keep optional framework, transport, editor, and capture dependencies out of the minimal entry point.

## Fixtures

Small static DOM; 10,000-node dashboard; deeply nested scroll; virtualized list; fixed sidebar/sticky header; portal menu; dialog/popover; SVG chart; high-DPI canvas; native-camera stub; shadow-root component; cooperating iframe; inaccessible cross-origin iframe; route replacement; RTL/long translations; high-contrast and large-text modes. All fixture data is synthetic.

## Deterministic visual testing

Use an injected clock in pure-model tests and sample exact logical times. Browser screenshot tests wait for declared font/asset/host readiness. They must specify whether animations are sampled or disabled; disabling animation cannot prove animated behavior. Browser clock tools help control timers, but they do not establish deterministic media decoding or GPU output on their own. [S13](21-sources.md).

Keep functional assertions separate from screenshots: correct action count, state transitions, target resolution, focus ownership, and clean teardown. Pixel tolerances must be justified for font/raster differences rather than increased until a failing test passes.

## Failure artifact format

Store script hash, fixture version, browser/device metadata, seed, command/event trace, approved redacted diagnostics, and optional screenshots/video after privacy review. Never upload credentials or production DOM snapshots to public CI. A performance change requires before/after data and a correctness check, not only a new benchmark chart.

## Release gates

No runtime release until the first-use, cancel, seek, target disappearance, denied effects, media failure, reduced motion, keyboard exit, and teardown paths pass. No “accessible” blanket claim without manual review. No cross-browser badge without listed evidence. No export or agent-bridge enablement without the relevant security review.
