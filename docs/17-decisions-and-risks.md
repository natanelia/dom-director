# 17 · Decisions, alternatives, and risks

## Architectural decisions

| ADR | Decision |
|---|---|
| [0001](adr/0001-managed-surfaces.md) | Managed surfaces first; overlay-only fallback; no universal wrapper promise |
| [0002](adr/0002-presentation-and-effects.md) | Presentation time and application effects are separate domains |
| [0003](adr/0003-data-only-scripts.md) | Versioned data-only scripts; host-owned executable capabilities |
| [0004](adr/0004-clock-authority.md) | One presentation-time authority per segment |
| [0005](adr/0005-semantic-targets.md) | Stable semantic target registry before selector guessing |
| [0006](adr/0006-accessibility.md) | Motion optional and equivalent transcript/guide experience |
| [0007](adr/0007-local-first.md) | Network-silent core and explicit privacy boundaries |
| [0008](adr/0008-platform-core.md) | Platform-first prototype; dependencies must satisfy ownership contracts |

These are accepted **design directions**, not implemented guarantees. Change them through a superseding ADR with evidence.

## Alternatives considered

Use an existing pan/zoom library plus tooltip library: quickest initial experiment, but ownership of time, effects, focus, and overlay placement still needs an integration layer. Use a presentation framework: good for authored scenes, but not automatically suitable for existing SPA state and portals. Record screenshots/video: predictable sharing, but loses real interactivity and live semantic targets. Use browser automation for everything: useful for fixture testing/export, but inappropriate as the unprivileged in-app runtime. Build a full editor first: attractive but risks hiding fundamental browser problems under authoring UI.

The selected path is a small explicit runtime contract with adapters. It is not a claim that no other library offers overlapping features.

## Risk register

| Risk | Severity | Mitigation / decision gate |
|---|---|---|
| Wrapper changes fixed/portal/top-layer behavior | High | M1 integration spike; explicit fallback and documented unsupported cases |
| Large layers or text rerasterization stutter | High | Trace real devices; bounded surfaces; optional layer hints; no GPU guarantee |
| Scrubbing duplicates real effects | Critical | Separate effect ledger, barriers, host idempotency and reconciliation |
| Late async completion mutates a newer run | High | AbortSignal + epoch checks + cancellation-at-every-await tests |
| Narration drifts or autoplay fails | High | Single clock authority, real media readiness, retry/text-only UI |
| Target ID remains valid but semantics change | High | Host manifest versions, compatibility checks, reviewed remappings |
| Motion or focus harms usability | High | Reduced-motion default, static path, manual assistive-tech testing |
| Agent prompt injection or excessive authority | Critical | Data-only input, scoped discovery, host authorization, no auto-approval |
| Recording/export leaks data | Critical | Separate grant, isolated fixtures, redaction before persistence, artifact review |
| Cross-origin frame cannot cooperate | Medium | Opaque whole-frame/overlay fallback; no claimed bypass |
| Native map and page cameras fight | High | Exclusive leases and explicit sequential handoff |
| Browser backgrounding changes timing | Medium | Pause, reprepare, preserve user intent; no timer catch-up effects |
| App is not resettable | High | Disable try/replay-effect mode; explain state limitations |
| Schema becomes an unbounded workflow language | High | Acyclic P0 graph, bounded actions, reviewed extensions |
| All use cases inflate core bundle and API | High | Milestone gates, optional adapters, minimal dependency graph |
| TTS/vendor features create lock-in | Medium | Prepared assets and transcript as portable contract; provider adapters optional |
| Session resume incorrectly trusts old state | High | Script/app/checkpoint version checks and revalidation |
| Multi-agent control races | High | Single session lease, revisions, user priority, request dedupe |
| A successful tour is misreported as learning | Medium | Distinguish acknowledgment, interaction, outcome, and assessment evidence |
| Name/package collision | Low initially | Working names only; check/reserve before publication |

## Early stop / narrow-scope criteria

If the managed wrapper cannot support a realistic host without major restructuring, ship overlay-only guidance first and make cinematic integration opt-in. If audio precision cannot meet the measured fixture target, ship coarse scene-level synchronization with honest diagnostics rather than “word-perfect” claims. If reliable effect reconciliation is unavailable, keep automated actions fixture-only. If an adapter needs invasive access to a third-party app, do not quietly broaden the core's authority.
