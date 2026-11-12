# 05 · Walkthrough script format

## Status and authority

The draft language is `0.1.0-draft.1`. The [JSON Schema](../schemas/tour.schema.json) is the structural contract; this document defines semantics that JSON Schema cannot express. The [design validator](../tools/check_design.py) checks a useful subset of those semantics offline. It does not resolve a live DOM, authorize host actions, or demonstrate runtime playback.

Use JSON Schema Draft 2020-12. Schema IDs are `urn:dom-director:schema:...` identifiers, not hosted URLs. Known schemas are bundled; validators must not fetch arbitrary remote schemas. [S14](21-sources.md).

## Top-level shape

Required fields: `schemaVersion`, `id`, `title`, `locale`, `entryScene`, `modes`, `capabilities`, `targets`, and `scenes`. Optional fields: `defaults`, `assets`, and `meta`. Unknown top-level and cue fields are rejected; action `args` is an intentionally open JSON object validated again by the host action's own schema.

`modes` declares intended experiences, not permission to run them. `capabilities` requests named operations such as `action:fixture.setPreview` or `condition:selection.valid`. Host preparation must still grant them. `targets` maps script aliases to stable host refs, for example `{ "save": { "ref": "settings.save" } }`. Raw CSS selector discovery is deliberately outside the portable draft script.

Identifiers are bounded ASCII names starting with a letter, followed by letters, digits, dot, underscore, or hyphen. The draft validator reserves prototype-pollution-sensitive keys in untrusted JSON. Locales have a conservative language-tag syntax; validating that syntax does not prove a particular translation exists or is linguistically correct.

## Scenes and graph

A scene has `id`, `title`, `summary`, `durationMs`, and `cues`. Its summary supplies a concise non-moving explanation. `next` specifies a single destination. Alternatively, `choices` supplies labeled destinations offered after the scene reaches its nominal end. No `next` or `choices` means terminal. They cannot coexist.

The scene graph must be acyclic, all referenced destinations must exist, and all scenes must be reachable from `entryScene`. Shared ending scenes are valid. Acyclic graphs simplify bounded preparation and prevent unbounded agent-generated retry loops. Conditional expressions and loops are deferred, not silently accepted extension fields.

Scene time is measured in integer milliseconds, independent of wall-clock waits. A scene's nominal duration contains all its timed cues; interactive gates can add unknown waiting time. Re-entering a scene in a new run creates a new visit identity even when the content ID is unchanged.

## Cue kinds

| Kind | Purpose | Required payload beyond `id`, `kind`, `at` |
|---|---|---|
| `camera` | Focus a semantic target or reset | `durationMs`; exactly one of `target` or `reset: true` |
| `highlight` | Outline/spotlight/underline a target | `target`, `durationMs` |
| `annotation` | Plain-text target explanation | `target`, `durationMs`, `text` |
| `cursor` | Visual pointing/click/touch/drag | `target`, `durationMs`, `gesture`; drag additionally needs `fromTarget` |
| `gate` | Wait for a host condition | `conditionRef`, `timeoutMs`, `instruction` |
| `action` | Request a named host operation | `actionRef`, `args`, `timeoutMs` |

A camera cue supports `fit`, `paddingPx`, `minScale`, `maxScale`, and a named easing. The default maxScale is 3; a cue can choose a tighter limit. The draft default minScale is 0.5. Bounds must be consistent. Duration zero is an immediate visual update. All camera cues target one registered surface in P0. Multi-target framing can use a host-defined group target; a more expressive target-set syntax is deferred.

A highlight/annotation/cursor is active on its interval; a camera's final pose holds until superseded or reset. Camera cues may not overlap or start at the same timestamp on the single surface. One simulated cursor is supported in the draft, so cursor cues also may not overlap or start simultaneously. Parallel camera + highlight + caption + annotation is normal. Multiple annotations/highlights are allowed, with placement/collision handling specified by the renderer.

`cursor.gesture: 'click'` is decoration only. Real effects require a separate action cue. A drag requires `fromTarget`; other gestures must not supply it. Guides normally use user-driven gates rather than synthetic events.

## Time references

`at` is either a nonnegative integer millisecond offset or:

```json
{ "narrationCue": "review-save", "edge": "start", "offsetMs": -200 }
```

The cue ID is scoped to narration in the same scene. The offset defaults to zero. Compile it to a numeric time using the selected language's cue metadata. The result must be nonnegative and fit within the scene. Unknown cue IDs are errors. The offline validator resolves these references even when the example has no audio file.

All visual intervals must end within `durationMs`. Gates and actions have an instantaneous scene-time marker and a separate wall/foreground wait deadline. At a shared timestamp, barriers are processed before later visual sampling/effects, using source order for non-conflicting barriers. See [07](07-timeline-and-playback.md).

## Narration and captions

A scene may contain `narration: { transcript, cues, audioAsset? }`. Each cue has `id`, `startMs`, `endMs`, and plain `text`. Cue IDs are unique within the scene, starts are sorted, and end must be after start and within the scene. Caption overlap is allowed for meaningful authored content; the renderer must handle the active cue set.

If `audioAsset` is supplied, it refers to a declared asset of kind `audio`. The host verifies actual media duration/readiness. Without it, the content is a timed text/transcript preview, not a claim of audible narration. Narration starts at scene time zero in this draft. Multiple offset audio segments and music mixing require a future language revision.

The included caption sidecar is derived from the canonical cue data. It is not an independent timing authority. The validator checks that the fixture's sidecar matches its source cues.

## Assets

Assets declare kind, URI, optional locale, SHA-256, and license. The structural schema does not authorize a URL. The draft offline validator accepts bounded relative `./...` paths without parent traversal or HTTPS URLs without credentials; host origin policy remains mandatory. No JavaScript/data/file URLs or silent arbitrary schema fetching. Local assets referenced by example tours must exist inside the example package during repository checks.

## Gates and actions

A condition/action reference must be declared in `capabilities` with the corresponding prefix. Declaration is necessary but not sufficient: the host must bind the name, validate action inputs, and authorize execution. Static validation cannot establish that `fixture.setPreview` is actually isolated or safe.

`gate.onTimeout` defaults to pause. `skip-scene` follows an explicit next scene or ends a terminal scene; it is invalid on a scene with unresolved choices. Timeout does not mark success. `action` failures pause unless a separately specified recovery policy exists; this draft does not include automatic retries.

No action is triggered by static preview or presentation-only seeking. Persistent-effect classification comes from the host registry, not this JSON. A scene containing an action establishes a potential state barrier that the runtime must honor.

## Defaults, limits, and precedence

Precedence: safety/user accessibility policy → host capability policy → script defaults → cue preference, with a cue never overriding a safety restriction. The offline schema permits bounded authoring values; runtime policy may narrow them further.

Draft limits: 1 MiB UTF-8 input per document, nesting depth 40, at most 1,000 scenes, 1,000 cues per scene, 10,000 cues in aggregate, 1,000 targets/assets, scene duration up to one hour, and individual gate/action timeout up to five minutes. These are protective format limits, not performance claims. Runtime may set stricter limits. Duplicate JSON keys and non-finite numbers are rejected before semantic interpretation.

## Validation phases

Parse and resource limits → schema → unique IDs → target/asset references → narration anchors and cue ranges → camera/cursor ownership intervals → capability declarations → scene graph → host preflight → policy → live readiness. Current tooling covers the offline stages and repository artifact consistency. It does not implement the final live stages.

## Compatibility and extension policy

An exact draft version is required. Unknown cue kinds or unknown safety fields fail closed. A future migration may produce a new reviewed script, but the player must not silently guess what an unknown action means. Vendor extensions require a future namespaced, capability-reviewed design; arbitrary fields are not currently an extension mechanism.

## Examples

Start with [minimal](../examples/minimal.tour.json), then [narration anchors](../examples/narrated-settings.tour.json), [guide gates](../examples/guided-task.tour.json), [choices](../examples/branching.tour.json), [fixture actions](../examples/safe-fixture.tour.json), and [semantic map targets](../examples/semantic-map.tour.json).
