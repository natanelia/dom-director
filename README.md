# DOM Director

**An agent-friendly engine for cinematic, interactive walkthroughs of real applications.**

One script. Watch it, try it, or let it guide you. Real DOM, not a recording.

> **Status: design foundation plus a fixture-specific concept demo, not a released library.** The reusable camera/player/audio SDK, authoring studio, and agent bridge are **not implemented**. Runtime APIs in the design documents are proposals. The project and package names are working names, not reserved trademarks or npm packages. This repository is private; no public site or npm package is deployed.

## Try the flagship concept

**Not a video. A living story.** A 45-second story through a live synthetic mission-control workspace, with a real interactive handoff.

[Run and inspect the demo](demo/README.md) · [Creative direction](docs/22-flagship-demo.md) · [Demo test evidence](demo/VALIDATION.md)

The demo has cinematic camera movement, a simulated cursor, prepared placeholder narration, captions, a transcript, scrubbing, playback speed, and Watch / Try / Guide modes. Its implementation is fixture-scoped, not the reusable SDK.

## The experience

A tutorial moves smoothly from an overview to a relevant control. Narration, closed captions, a clearly simulated cursor, and annotations share one timeline. A learner can pause, inspect the actual application, try a task in a fixture, or switch to a step-by-step guide. An agent can discover approved targets, draft a script, validate it, preview its effects, and explain a failure without unrestricted page access.

The essential distinction: **presentation is seekable; real-world effects are not automatically replayable.** Scrubbing a walkthrough must never repeat a save, submission, purchase, or deletion.

## Proposed minimal API — not yet runnable

```ts
const director = createDirector({
  surface: { scene: document.querySelector('#tour-scene') },
  overlay: document.querySelector('#tour-overlay'),
  targets: { save: () => document.querySelector('[data-tour="save"]') },
});

await director.load(script);
await director.play(); // invoke from a user interaction when audio is used
// director.pause(), director.seek({ sceneId: 'overview', timeMs: 800 })
// director.setMode('guide'), director.destroy()
```

The host supplies an explicitly transformable surface. We do **not** promise zero-configuration zooming of every existing page. Overlay-only mode is the fallback when a surface cannot safely be transformed.

## Start reading

- [Design index](docs/README.md): the full reading map and current status.
- [Vision and boundaries](docs/01-vision.md): what to build, and what not to promise.
- [Use-case atlas](docs/02-use-cases.md): opportunities beyond onboarding.
- [Architecture](docs/04-architecture.md): runtime ownership and integration boundaries.
- [Script format](docs/05-script-format.md) and [examples](examples/README.md): portable data contracts.
- [Agent contract](docs/10-agent-contract.md): authoring, discovery, validation, execution, and repair.
- [Roadmap](docs/16-roadmap.md): M0–M6 and the early flagship-demo workstream.
- [Agent working agreement](AGENTS.md): instructions for implementation agents.

## Validate the design foundation

Requires Python 3.11 or later and the pinned development dependencies. Node/npm provides convenience aliases and the demo model tests.

```sh
python3 -m pip install -r requirements-dev.txt
python3 tools/check_design.py
python3 -m unittest discover -s tests -v
node --test demo/tests/model.test.cjs
```

The Python checks validate schemas, positive and negative examples, cross-references, requirements/backlog coverage, and internal document links. They are not browser-runtime or performance evidence. Separate demo browser tests are documented in `demo/README.md`.

## Design principles

1. Framework-neutral core, optional React bindings, transports, and editors.
2. Stable semantic targets and declarative data before fragile selectors or generated code.
3. One owner for each animated property and one authority for presentation time.
4. Motion optional; captions, transcript, keyboard access, and escape first-class.
5. Local-first and network-silent by default; no hidden telemetry or model dependency.
6. Permission checks belong to the host, never to the script or the model.
7. Evidence before claims: performance budgets and support tables are targets until tested.

## Repository and release status

See [PUBLISHING.md](PUBLISHING.md). Keep repository visibility private unless the owner explicitly approves changing it. The root npm package is also marked `private: true` to prevent accidental publication.

## License

MIT. See [LICENSE](LICENSE). Example content is synthetic. Third-party media must carry its own permissions and attribution.
