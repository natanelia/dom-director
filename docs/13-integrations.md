# 13 · Frameworks, surfaces, and host adapters

## Integration levels

**Level 0 — explanation only:** overlay, transcript, captions, and target highlighting; no page transform or application effects. **Level 1 — managed camera:** an explicit scene root and stable target registry. **Level 2 — guided tasks:** host conditions and approved reveal/actions. **Level 3 — reproducible practice:** fixture reset, checkpoints, and deterministic data. Higher levels require more host cooperation; do not advertise all levels after only mounting a tooltip.

## Plain DOM first

The reference implementation should mount against a small static application without a framework. This isolates geometry, ownership, and lifecycle defects. Targets are lazy functions registered by ID; the engine resolves current nodes as needed. Destroying the director never removes host-owned application nodes.

## React

A proposed adapter owns the director in an effect, supplies stable refs and a host portal container, and destroys it on cleanup. Strict development lifecycle re-entry must not duplicate subscriptions, audio, or global handlers. The integration must tolerate a target being replaced during a concurrent render. Do not set React state on every camera frame just to update transforms.

A `useDirector()` hook can expose low-frequency session state through an external-store subscription. A `DirectorProvider` is optional convenience, not a core dependency. A target hook registers/unregisters semantic IDs while preserving a stable resolver contract. Hydration starts with no camera mutation; initialize only after the host surface exists.

Portals need explicit ownership. App dialogs can render into an approved scene portal root when semantically appropriate, or become overlay-only scenes. A global toast or modal outside the scene cannot be assumed to follow the page camera. Keep player UI independent of app portal animation.

## Vue, Svelte, and other frameworks

Use lifecycle-specific adapters over the same framework-neutral director. Avoid separate timing engines per framework. Components should bind existing host elements rather than clone the app tree. SSR imports must not touch `window` or `document`; browser-only initialization is explicit. Framework adapters are tested independently and do not expand browser guarantees automatically.

## Routers and multi-page applications

Same-page scene changes are not navigation. A route adapter can prepare/reveal a target by requesting an approved route, waiting for readiness, and returning a new geometry revision. Route transitions may change app layout and state; they are effects with their own cancellation and history policy.

Full document navigation destroys in-memory state. A future multi-page extension stores an opt-in, redacted resume token and revalidates script/app versions after load. A URL is a content/scene pointer, not permission to reconstruct arbitrary state or run an action. Cross-origin navigation requires a separately designed cooperative protocol.

## Shadow DOM

Registered resolvers may reference open shadow-root elements. Closed roots require a component-provided geometry/action adapter; the library cannot pierce them universally. Target labels and semantic outcomes should be supplied by the component, not guessed from its rendered text. Event retargeting and composed paths need tests for each integration.

## Iframes

An outer transform can magnify an iframe element as a visual surface without inspecting its child document. Inspecting or targeting inside a cross-origin frame requires cooperation. A bridge should exchange semantic descriptors and geometry in declared coordinate spaces, not expose unrestricted DOM access. Verify exact origin/source/session identity on messages. A non-cooperative frame can still be explained as an opaque whole-frame target. [S8](21-sources.md).

## Canvas and WebGL

A canvas is a DOM element, but its internal objects are not. Expose semantic targets such as `diagram.node.alpha` or `map.issue.sample` with projected rectangles/quads, readiness, and optional reveal. The host owns camera projection and hit testing. The director never assumes a selector can identify a drawn shape.

A map integration can choose between whole-page magnification and a native camera action. Use an explicit policy: `dom-only`, `native-only`, or authored sequential handoff. Never independently animate both toward one logical target without a specified composition. Native camera events feed geometry invalidation so the overlay cursor remains aligned.

For a map-editor-like demonstration, use synthetic features and neutral domain names. This design does not copy any employer's internal UI, datasets, APIs, or product behavior.

## Charts, virtual lists, code editors

Charts expose data-point/series targets through a projector. Virtual lists expose a reveal/materialize operation and report when the item exists; a missing row is not necessarily a stale selector. Code editors expose symbols/line ranges and a reveal API rather than brittle DOM internals. Every adapter declares whether revealing a target modifies scroll, selection, route, or persistent data.

## Existing libraries

Panzoom demonstrates transform-based pan/zoom primitives, while Driver.js provides guided overlays and interactive steps. They are useful references or optional integration points, not dependencies automatically selected for the core. [S10–S11](21-sources.md). A candidate animation backend must satisfy a shared-clock, seek, interruption, cleanup, and property-ownership contract before adoption.

Do not run two independent camera controllers or two overlay focus managers simultaneously. The core's initial transform math is small enough to prototype directly; reuse a dependency only when its benefits outweigh clock/ownership mismatch. This is a proposed decision, not a claim that custom code will outperform established libraries.

## Content security policy and styling

Prefer shipped styles and explicit class names/CSS custom properties. Avoid inline script generation and eval-like runtime compilation. A strict-CSP integration may need an adopted stylesheet or host-supplied styles; document exactly which APIs/styles are used. Optional UI components must not require a globally injected stylesheet that resets the app.

Schemas are trusted repository assets. Any future browser validator should use an audited precompiled/static approach suitable for the supported CSP, not compile arbitrary remote schemas at runtime. The current repository's design validator is development tooling, not the future browser runtime.

## Capability reports

At prepare time produce a report for managed transforms, overlay-only fallback, targets, portals, native camera, media, conditions, actions, reset/checkpoint, and export. Each entry is supported, degraded, unavailable, or untested with reasons. Do not infer “supported” merely from the presence of a browser API.
