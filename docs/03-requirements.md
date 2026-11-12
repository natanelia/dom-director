# 03 · Requirements and traceability

All **112 runtime requirements below are proposed**, not implemented or verified. `plannedTests` IDs are acceptance-test plans, not claims that tests exist. The current design-tool tests have separate names and validate the specification artifacts only.

[requirements.json](requirements.json) is the machine-readable source of truth. [backlog.json](backlog.json) maps every requirement to a work package. Priority meanings are defined in the [design index](README.md). Implementation evidence stays empty until code and tests exist.

## Status transitions

`proposed → implemented → verified` requires explicit evidence. A merged document can remain proposed behavior. A runtime requirement is verified only for the environments and versions recorded in its evidence. If a design changes, update acceptance criteria, tests, and any ADR in the same review.

## Script language

Design: [05-script-format.md](05-script-format.md). Work package: `B01`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| FMT-001 | P0 | **Versioned closed grammar.** Reject unknown schema versions, unknown operation kinds, and unknown closed-object fields. |
| FMT-002 | P0 | **Bounded parsing.** Reject duplicate keys, non-finite numbers, excessive nesting, and documents over the declared byte limit. |
| FMT-003 | P0 | **Stable identifiers.** Reject duplicate scene/cue IDs and unresolved entry/destination/target/narration references. |
| FMT-004 | P0 | **Semantic timing.** Resolve phrase anchors deterministically and reject negative or out-of-scene cue intervals. |
| FMT-005 | P0 | **Acyclic branches.** Reject cycles and unreachable scenes; accept shared terminal scenes and explicit choices. |
| FMT-006 | P0 | **Data-only execution.** Reject serialized callbacks or executable operation kinds; keep host callbacks outside scripts. |
| FMT-007 | P0 | **Capability declarations.** Require named action/condition requests to be declared; declaration alone never authorizes execution. |
| FMT-008 | P0 | **Readable authoring.** Provide a minimal three-scene example and an advanced example using the same canonical format. |

## Surface integration

Design: [06-camera-and-geometry.md](06-camera-and-geometry.md). Work package: `B02`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| SUR-001 | P0 | **Explicit managed root.** Mount against an intentional host wrapper without reparenting or remounting application nodes. |
| SUR-002 | P0 | **Overlay separation.** Keep controls and captions outside the transformed scene at all camera scales. |
| SUR-003 | P0 | **No camera layout writes.** A steady shot writes transforms rather than width, height, font size, or CSS zoom. |
| SUR-004 | P0 | **Fixed and sticky preflight.** Document and test changed containing-block/scroll behavior; offer fallback when unsuitable. |
| SUR-005 | P0 | **Portals and top layer.** Test external portals, dialogs, and popovers; never claim automatic scene membership. |
| SUR-006 | P0 | **Overlay-only fallback.** Run semantic explanations and guides when managed transformation is unavailable or disabled. |
| SUR-007 | P0 | **Property ownership.** Prevent a second controller from silently competing for an owned surface transform. |
| SUR-008 | P0 | **Restoration journal.** Restore only engine-owned changes still carrying the engine value; preserve unrelated host edits. |

## Target discovery and geometry

Design: [06-camera-and-geometry.md](06-camera-and-geometry.md). Work package: `B04`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| TGT-001 | P0 | **Semantic registry.** Resolve stable host IDs lazily; a replaced element can resolve without editing the script. |
| TGT-002 | P0 | **Ambiguity failure.** Missing or ambiguous targets pause/fail explicitly; never select a destructive lookalike. |
| TGT-003 | P0 | **Coordinate identity.** Tag geometry with coordinate space and revisions; test surface offsets and scene/client round-trips. |
| TGT-004 | P0 | **Bounded invalidation.** Batch dirty geometry reads before writes and avoid full-document scans every frame. |
| TGT-005 | P0 | **Scroll reveal.** Separate authorized scroll/reveal effects from camera framing and wait for readiness. |
| TGT-006 | P1 | **Virtualized targets.** Support a host materialization/readiness adapter; do not report an offscreen unmounted row as a proven stale ID. |
| TGT-007 | P1 | **Virtual geometry.** Accept host-projected non-DOM target bounds without pretending canvas objects are DOM nodes. |
| TGT-008 | P0 | **Unsupported transforms.** Reject noninvertible or unproven perspective geometry with an explicit diagnostic. |

## Camera and visual rendering

Design: [06-camera-and-geometry.md](06-camera-and-geometry.md). Work package: `B05`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| CAM-001 | P0 | **Safe-area framing.** Fit targets inside viewport regions reserved for controls, captions, and insets. |
| CAM-002 | P0 | **Scale bounds.** Clamp to declared limits and report clipping when containment cannot be achieved. |
| CAM-003 | P0 | **Named easing.** Provide deterministic finite-duration presets plus an immediate/non-moving path. |
| CAM-004 | P0 | **Smooth interruption.** Retarget from the current sampled pose rather than snapping to an obsolete endpoint. |
| CAM-005 | P0 | **Conflict detection.** Reject overlapping camera or cursor ownership intervals in the single-surface draft. |
| CAM-006 | P1 | **Moving target policy.** Reframe on meaningful geometry changes with bounded follow/hysteresis behavior. |
| CAM-007 | P0 | **Native hit testing.** Allow browser hit testing through transforms; do not double-transform ordinary DOM input. |
| CAM-008 | P1 | **Canvas quality honesty.** Document raster magnification and optional host rerender costs rather than promising crisp unlimited zoom. |

## Playback and time

Design: [07-timeline-and-playback.md](07-timeline-and-playback.md). Work package: `B03`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| TIM-001 | P0 | **Single time authority.** All visual tracks sample coordinated scene time; media segments can become the authority. |
| TIM-002 | P0 | **Pause and resume.** Pause freezes presentation/audio and resumes without losing the user pause reason. |
| TIM-003 | P0 | **Presentation-only seeking.** Seeking never executes skipped actions or claims to undo external side effects. |
| TIM-004 | P0 | **State barriers.** Block unsupported seeks across host-state dependencies unless a compatible checkpoint is available. |
| TIM-005 | P0 | **Cancellation epochs.** Ignore late async completions from earlier runs/seeks and release cancellable resources. |
| TIM-006 | P0 | **Visibility policy.** Pause on hidden-tab suspension by default; do not catch up by executing queued actions. |
| TIM-007 | P0 | **Branch-aware progress.** Display current path and unknown waits honestly instead of a false total duration. |
| TIM-008 | P0 | **Rate changes.** Sample old clock state before updating rate; preserve continuity and media alignment. |
| TIM-009 | P0 | **Independent pause reasons.** A gate completion does not resume a presentation the user separately paused. |
| TIM-010 | P0 | **Run identity.** Distinguish run/scene/visit/request IDs and correlate completion with the correct run. |

## Narration captions and cursor

Design: [08-media-captions-and-cursor.md](08-media-captions-and-cursor.md). Work package: `B06`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| MED-001 | P1 | **Prepared narration.** Resolve approved audio through a host asset policy and validate readiness/duration. |
| MED-002 | P1 | **Phrase synchronization.** Resolve visual anchors against language-specific authored cue times and test measured skew. |
| MED-003 | P1 | **Autoplay recovery.** Handle rejected media play with a real-user retry or explicit text-only mode. |
| MED-004 | P1 | **Buffering behavior.** Freeze dependent presentation tracks during required-media buffering; preserve user control. |
| MED-005 | P1 | **Closed captions.** Provide togglable captions with language selection and relevant non-speech information. |
| MED-006 | P1 | **Transcript and WebVTT.** Expose a complete transcript and produce a sidecar from the same canonical timing data. |
| MED-007 | P1 | **Visual-only cursor.** Click/drag/touch decorations do not dispatch input, execute actions, or grant consent. |
| MED-008 | P1 | **Localization timing.** Localized content carries its own timings rather than reusing source-language word offsets. |

## Guidance and practice

Design: [09-guidance-and-interactivity.md](09-guidance-and-interactivity.md). Work package: `B08`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| GDE-001 | P1 | **Watch try guide modes.** Separate presentation, fixture practice, and user-driven guidance policies. |
| GDE-002 | P1 | **Domain outcome gates.** Wait for named meaningful outcomes rather than treating a click as successful completion. |
| GDE-003 | P1 | **Edge versus level conditions.** Subscribe/check without races and distinguish current state from a new event after entry. |
| GDE-004 | P1 | **Timeout recovery.** Offer more time/pause/declared fallback without fabricating success or blocking exit. |
| GDE-005 | P1 | **User takeover.** Pause automated motion on user manipulation and revalidate before resuming. |
| GDE-006 | P1 | **Mode transition safety.** Prepare/authorize a new mode before committing; do not silently broaden action rights. |
| GDE-007 | P1 | **Hints and choices.** Provide accessible authored hints/branches without turning a final hint into an unapproved action. |
| GDE-008 | P1 | **Fixture requirement.** Disable try/reset behavior unless the host supplies an explicitly isolated resettable fixture. |

## Effects and checkpointing

Design: [07-timeline-and-playback.md](07-timeline-and-playback.md). Work package: `B09`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| ACT-001 | P1 | **Host-owned actions.** Invoke only registered operations with validated inputs and current authorization. |
| ACT-002 | P1 | **Impact classification.** Use host read/ephemeral/persistent classification; script text cannot downgrade it. |
| ACT-003 | P1 | **Action ledger.** Deduplicate an effect within its run/scene/visit/cue identity without claiming universal exactly-once. |
| ACT-004 | P1 | **Idempotency and reconciliation.** Persistent retryable effects require host idempotency/status handling; unknown outcomes block blind retries. |
| ACT-005 | P1 | **Confirmation binding.** Bind required human approval to exact action parameters and the reviewed script/session. |
| ACT-006 | P1 | **Effect cancellation limits.** Explain externally committed/unknown outcomes after stop instead of assuming rollback. |
| ACT-007 | P1 | **Versioned checkpoints.** Verify script, host-state, and fixture versions before restoring a checkpoint. |
| ACT-008 | P1 | **Resume privacy.** Opt-in resume persists redacted state references, not credentials or arbitrary production snapshots. |

## Agent usability

Design: [10-agent-contract.md](10-agent-contract.md). Work package: `B10`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| AGT-001 | P1 | **Approved discovery.** Expose only allowed target descriptors and capabilities; omit sensitive values by default. |
| AGT-002 | P1 | **Offline validation.** Agents can validate structure/semantics without executing effects or contacting the host. |
| AGT-003 | P1 | **Pure preview.** Static preview lists requested effects but executes none. |
| AGT-004 | P1 | **Structured diagnostics.** Errors carry stable codes, phases, JSON Pointer paths, and safe recovery choices. |
| AGT-005 | P1 | **Revision checks.** Reject stale state-changing commands; safety pause/stop remain available. |
| AGT-006 | P1 | **Request deduplication.** Deduplicate repeated request IDs and reject changed payloads under the same ID. |
| AGT-007 | P1 | **Reviewed repair.** Propose target/script patches for review instead of silently healing to uncertain controls. |
| AGT-008 | P1 | **No agent approval bypass.** Do not expose an agent operation that impersonates human consent or broadens host policy. |

## Accessibility

Design: [11-accessibility.md](11-accessibility.md). Work package: `B07`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| A11-001 | P0 | **Motion preference.** Respect reduced motion and live preference changes with an equivalent non-moving path. |
| A11-002 | P0 | **Keyboard controls.** All player functions and exits work without a pointing device. |
| A11-003 | P0 | **Focus ownership.** Camera pans do not steal focus; explicit target focus and restoration are tested. |
| A11-004 | P0 | **Stable readable controls.** Captions/controls remain outside the camera and usable with large text/browser zoom. |
| A11-005 | P0 | **Semantic alternatives.** Instructions name targets/outcomes and do not rely only on color, motion, sound, or pointer location. |
| A11-006 | P0 | **Screen-reader review.** Provide step summaries and transcript without per-frame or per-word live-region spam. |
| A11-007 | P0 | **Adjustable pacing.** Allow pause, reading time, and appropriate timeout extension; never trap users in onboarding. |
| A11-008 | P0 | **Manual conformance evidence.** Do not claim accessibility conformance from automated checks alone. |

## Security and privacy

Design: [12-security-and-privacy.md](12-security-and-privacy.md). Work package: `B12`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| SEC-001 | P0 | **Network-silent default.** No telemetry, capture, remote AI, persistence, or remote asset access without explicit host setup. |
| SEC-002 | P0 | **Untrusted content.** Render script text safely and treat page/agent text as data rather than privileged instructions. |
| SEC-003 | P0 | **Least authority.** Intersect host/session/script/user grants and recheck before each effect. |
| SEC-004 | P0 | **Redaction before storage.** Exclude secrets and minimize data before logging, serializing, or recording. |
| SEC-005 | P0 | **Bridge authentication.** Verify frame origin/source/session and scope remote tool access; no wildcard privileged messaging. |
| SEC-006 | P0 | **Resource limits.** Enforce input size/depth/array/time limits and reject unsafe URI schemes/traversal. |
| SEC-007 | P0 | **Revocation and exit.** Revoke new effects while retaining user pause/stop and reporting already-started work. |
| SEC-008 | P2 | **Capture isolation.** Require separate capture authorization and verify redaction or use a data-safe fixture. |

## Authoring and distribution

Design: [14-authoring-and-distribution.md](14-authoring-and-distribution.md). Work package: `B14`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| AUT-001 | P1 | **Canonical authoring.** Human builders and agents emit the same inspectable versioned JSON. |
| AUT-002 | P2 | **Semantic diffs.** Review changes to targets, actions, permissions, branches, and timing; invalidate relevant grants. |
| AUT-003 | P2 | **Visual studio boundary.** Keep visual authoring tools optional and outside the core runtime. |
| AUT-004 | P2 | **Recorder minimization.** An optional recorder stores approved semantic events with local redaction, not all inputs/network bodies. |
| AUT-005 | P2 | **Offline bundles.** Package approved assets/licenses/hashes without credentials and enforce safe archive extraction. |
| AUT-006 | P1 | **Deep links.** Share content/version/scene IDs without serializing sensitive app state into URLs. |
| AUT-007 | P2 | **Honest output types.** Distinguish live, transcript, fixture, and video outputs and their different capabilities. |
| AUT-008 | P2 | **Export prerequisites.** Video export uses a separately authorized controlled runner and documented codecs/assets/timing limits. |

## Quality and evidence

Design: [15-testing-and-performance.md](15-testing-and-performance.md). Work package: `B13`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| QUA-001 | P0 | **Pure model tests.** Test geometry, cue resolution, state transitions, and permission decisions independently of DOM rendering. |
| QUA-002 | P0 | **Adversarial browser tests.** Exercise target removal, portals, modal layers, scroll/resize, cancellation, and denied actions. |
| QUA-003 | P0 | **Before after performance.** Compare baseline/candidate under identical fixtures and retain environment metadata/raw traces. |
| QUA-004 | P0 | **Memory and cleanup.** Repeated lifecycle tests show no unbounded retained nodes/listeners/audio/animation resources. |
| QUA-005 | P0 | **Measured browser support.** Publish actual tested browser/device versions rather than infer support from API presence. |
| QUA-006 | P1 | **Media skew evidence.** Measure audiovisual cue error rather than claim synchronization because timers start together. |
| QUA-007 | P0 | **Private test artifacts.** Use synthetic fixtures and sanitize traces/screenshots before public CI storage. |
| QUA-008 | P0 | **Truthful status.** Separate proposed, implemented, and verified features; design checks are not runtime evidence. |

## Framework and domain integration

Design: [13-integrations.md](13-integrations.md). Work package: `B11`.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| INT-001 | P1 | **Framework neutral core.** Use the same clock/renderer/contracts from plain DOM and framework adapters. |
| INT-002 | P1 | **React lifecycle.** Handle development lifecycle re-entry, unmount, target replacement, and portals without duplicated effects. |
| INT-003 | P1 | **SSR safe imports.** Do not access browser globals during a server import; initialize explicitly after host readiness. |
| INT-004 | P1 | **Cooperative frames.** Treat inaccessible frames as opaque unless an authorized bridge provides targets. |
| INT-005 | P2 | **Native camera lease.** Define explicit page/native-camera handoff and projected target invalidation. |
| INT-006 | P1 | **Route and shadow adapters.** Declare route/reveal effects and require component cooperation for closed shadow roots. |

## Evidence policy

A test plan is not a passing test. A screenshot is not proof that focus, effects, or cleanup are correct. A benchmark target is not a result. A green schema check is not a host authorization decision. Record those distinctions in every implementation PR.
