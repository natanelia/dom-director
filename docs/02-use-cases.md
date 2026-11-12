# 02 · Use-case atlas

This is a deliberately broad opportunity map, not a promise to implement every idea in version one. Each use case reuses a small set of primitives: semantic targets, scenes, synchronized tracks, gates, host actions, safe fixtures, and accessible alternatives. “Core” means architecturally covered by the proposed foundation, not implemented today.

## Adoption and education

| ID | Use case / beneficiary | Required behavior | Scope and boundary |
|---|---|---|---|
| UC-01 | First-run onboarding for a new user | Short optional tour, saved progress, skip, relevant targets | Core; no compulsory completion trap |
| UC-02 | Progressive feature discovery | Context-specific mini-scenes after explicit invocation | P1; no hidden behavior tracking by default |
| UC-03 | Role-specific employee training | Host-approved role variants and outcome gates | Core; script cannot grant roles |
| UC-04 | Watch → try → guide learning | Shared explanation, fixture reset, handover | Core + fixture adapter; never call production a sandbox |
| UC-05 | Adaptive skill tutoring | Choice branches, hints, outcome checks | P1; do not infer competence from clicks alone |
| UC-06 | Complex form assistance | Explain fields and errors without reading secrets | Core; real submission stays with user/host policy |
| UC-07 | Keyboard-shortcut teaching | Shortcut overlays and user-generated key gates | P1; do not intercept editing/IME indiscriminately |
| UC-08 | Accessible transcript-first coaching | Equivalent static instructions and semantic navigation | Core; no motion/audio-only meaning |

## Product communication

| ID | Use case / beneficiary | Required behavior | Scope and boundary |
|---|---|---|---|
| UC-09 | Product launch / feature demo | Cinematic shots, narration, captions, fixture | Core; no private customer data |
| UC-10 | Living release notes | Version-specific scenes and deep links | P1; stale scripts fail visibly |
| UC-11 | Sales demo personalized to a role | Approved branch/data variants | P1; do not export real prospect records accidentally |
| UC-12 | Embedded interactive documentation | Scene player beside or inside a sandboxed example | P1; origin/frame boundaries explicit |
| UC-13 | Conference live presentation | Presenter pacing, safe fallback, hotkeys | P1; network outage must not strand controls |
| UC-14 | Offline exhibition / kiosk | Bundled assets, resettable fixture, idle restart policy | P2; opt-in kiosk policy, no coercive consumer UX |
| UC-15 | Before-and-after redesign explanation | Paired scenes/surfaces and coordinated annotations | P2; no blanket compatibility promise for dual cameras |
| UC-16 | Multilingual product education | Per-locale narration/caption timings and text direction | P1; not word-for-word timestamp reuse |

## Support and software quality

| ID | Use case / beneficiary | Required behavior | Scope and boundary |
|---|---|---|---|
| UC-17 | Executable support answer | Open help at a precise target, guide through a fix | Core; validate app version and permissions first |
| UC-18 | User-authored bug report | Record approved events, annotate the failure, redact locally | P2; neither full state recovery nor secret capture |
| UC-19 | Reproducible bug walkthrough | Fixture seed, deterministic plan, assertions, checkpoints | P1; requires host-owned fixture/network control |
| UC-20 | Pull-request visual review | Tell a change story against an isolated preview | P2; untrusted preview has no production credentials |
| UC-21 | Test-as-tutorial | Compile a safe scenario into human explanation + test intent | P2; tutorial success and test coverage are distinct |
| UC-22 | Visual regression explanation | Point to changed components with expected-state notes | P2; measured evidence, not invented diagnosis |
| UC-23 | Guided incident runbook | Read-only checks, real-user decisions, audited transitions | P1; destructive remediation needs separate authorization |
| UC-24 | Migration assistant | Explain old/new controls and pause for real choices | P1; do not migrate data through decorative clicks |

## Data, maps, and specialized interfaces

| ID | Use case / beneficiary | Required behavior | Scope and boundary |
|---|---|---|---|
| UC-25 | Narrated dashboard story | Target chart marks, filters, source notes, branching detail | Core + chart adapter; data freshness disclosed by host |
| UC-26 | Map route or spatial issue review | Geographic targets, page/native-camera handoff | P2 adapter; no double-zoom ownership conflict |
| UC-27 | Code or notebook explanation | Line/symbol targets, reveal, annotation, result gates | P1 adapter; do not execute arbitrary notebook cells |
| UC-28 | CAD / 3D scene training | Projected anchors and native camera choreography | Research; geometry and occlusion are domain-owned |
| UC-29 | Timeline / media editor training | Playhead targets, nested timelines, explicit clock roles | P2; one outer clock authority, separate domain time |
| UC-30 | Spreadsheet model explanation | Cell/range targets and formula-result annotations | P2 adapter; no universal proprietary editor integration |
| UC-31 | Interactive scientific explanation | Sliders, simulations, outcomes, transcript equivalence | P1 fixture; outputs are host computation, not video claims |
| UC-32 | High-stakes software interface training | Read-only explanation and synthetic practice | P1; no medical/financial decisions or automatic submissions |

## Agent-native experiences

| ID | Use case / beneficiary | Required behavior | Scope and boundary |
|---|---|---|---|
| UC-33 | Preview an agent's proposed task | Show targets and intended changes before consent | Core; preview has zero effects |
| UC-34 | Human supervises an approved agent task | Progress events, clear action status, pause/stop/takeover | P1; policy lives outside the model |
| UC-35 | Explain completed agent actions | Render verified trace as a narrated account | P1; explain observed actions, not hidden reasoning |
| UC-36 | Agent-authored contextual help | Discover allowlisted targets, generate valid JSON, preflight | Core; page text is data, not instructions |
| UC-37 | Agent repairs a stale walkthrough | Suggest target remapping and semantic diff for review | P1; never silently click a “similar” destructive target |
| UC-38 | Agent creates localized variants | Translate content and rebuild narration anchors | P1; preserve action semantics and approval requirements |
| UC-39 | Agent evaluates a candidate script | Static lint + sandbox execution + structured report | P1; static validity is not task correctness |
| UC-40 | Multiple agents collaborate on authoring | Versioned patches, revision checks, single playback lease | P2; no uncontrolled simultaneous surface ownership |

## Beyond conventional tours

| ID | Use case / beneficiary | Required behavior | Scope and boundary |
|---|---|---|---|
| UC-41 | A “task lens” rather than a full tour | One-step focus, explanation, optional gate | Core; avoid forcing a player UI for a tiny hint |
| UC-42 | Bookmark and share an explanation | Scene-level deep link with versioned content ID | P1; no serialized sensitive application state in URL |
| UC-43 | Collaborative guided review | Shared scene progression with local consent and geometry | P2; co-navigation is not remote control |
| UC-44 | Personalized pacing | User-selected speed, explanation depth, motion preference | P1; no inference of disability or hidden profiling |
| UC-45 | Executable product specification | Acceptance steps become demo scenarios and assertions | P2; host business rules remain source of truth |
| UC-46 | Same story as live demo, transcript, or video | Export adapters over a declared path and fixture | P2; DOM-to-video capture is not a free core feature |
| UC-47 | Interrupt-and-explore learning | Pause, inspect real UI, revalidate, resume explanation | Core; do not overwrite user edits on return |
| UC-48 | Data provenance and uncertainty story | Attach source/version notes to narrated claims | P1; script must not invent citations or confidence |

## Cross-cutting reusable patterns

**Explain → demonstrate → practice → verify.** A single learning objective is expressed as content plus an outcome contract. Watch uses a fixture action; guide waits for the user's outcome; try resets the fixture and measures the learner's attempt. Do not mechanically substitute synthetic clicks for real interaction.

**Preview → authorize → act → verify → explain.** An agent shows a proposed plan in read-only preview. Authorization binds to exact host actions and parameters, not to the attractiveness of the presentation. Verification uses host results. The post-action explanation is built from those results, including failures.

**Overview → context → detail → return.** Avoid endless zooming from unrelated controls. The camera conveys hierarchy, holds long enough for reading, and returns to context. A non-moving guide preserves the same order and meanings.

**Observe → package → replay in fixture.** Bug reproduction is strongest when the host can provide an approved state seed and deterministic fixture. Without it, label the artifact an annotated observation, not a replayable reproduction.

## What these uses imply for the core

Support semantic targets that are not DOM nodes. Make content and timing data inspectable and versioned. Keep event observation separate from actions. Offer static rendering and overlay-only mode. Preserve a small portable execution model rather than embedding a video editor, workflow automation platform, analytics service, and remote desktop into one package.

## What should be built first

UC-01, UC-04, UC-09, UC-17, UC-33, and UC-36 are the initial proof set. A synthetic dashboard can exercise them without privileged browser APIs. UC-26 is a strong adapter demonstration after the plain-DOM version is reliable. Collaborative playback, generic recording, arbitrary-page injection, and deterministic video export must earn their complexity through separate prototypes.
