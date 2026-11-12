# 06 · Camera, geometry, and surfaces

## The honest performance contract

Camera motion changes a dedicated wrapper's `transform`, not its width, font size, CSS `zoom`, or application layout viewport. CSS transforms do not change normal flow, but can affect overflow and establish containing blocks and stacking contexts. They also affect client rectangles. [Sources S1–S2](21-sources.md). Thus the target guarantee is **no camera-driven layout-property writes during a shot**, not “the browser never lays out or repaints.” Setup, resize, host updates, measurement after invalidation, and native scroll can still require layout.

GPU compositing is an implementation opportunity, not a guarantee. High zoom may cause rerasterization; giant layers can exhaust memory. Never permanently set `will-change` across the entire application without measurement. Acquire layer hints around active motion, then release them.

## Supported surface strategies

**Managed scene (P0):** an explicit host-owned wrapper, uniform 2D scale and translation, `transform-origin: 0 0`. The overlay is outside it. This is the first supported cinematic path.

**Overlay-only (P0):** no scene transform. Spotlight, caption, transcript, cursor, and guide remain usable. Required fallback for reduced motion and unsuitable pages.

**Cooperative embedded app (P1):** transform an explicitly sized same-origin or cooperating frame as a whole. Child target discovery requires same-origin access or an approved messaging bridge. The child's own viewport does not shrink just because the outer frame is visually scaled.

**Native camera adapter (P2):** map, diagram, code editor, or 3D scene exposes its own focus operations and projected semantic targets. It may render new pixels rather than magnifying a canvas. Its costs and reversibility differ from CSS transforms.

**Arbitrary-page injection (research):** no universal support claim. A read-only preflight may recommend overlay-only mode rather than moving document/body or reparenting a SPA.

## Coordinate spaces

Use named types: ScenePoint, ClientPoint, OverlayPoint, and NativePoint. All DOM calculations use CSS pixels, not device pixels. Device pixel ratio influences rasterization only. A measurement is tagged with surface ID, geometry revision, scroll revision, and camera revision.

For the simplest unrotated, border-normalized managed surface:

```
client = viewportOrigin + translation + scale * scene
scene  = (client - viewportOrigin - translation) / scale
```

The actual implementation uses DOMMatrix transforms and validates invertibility. Do not subtract only `camera.x` from `getBoundingClientRect()` while forgetting the surface's page offset. Do not apply devicePixelRatio to DOM coordinates. For nested rotations or skew, an inverse-transformed axis-aligned rectangle is only a conservative bound; use verified quads or a host geometry adapter for precise fitting. P0 may reject unsupported perspective/3D chains instead of pretending to be exact.

## Framing

A shot has a target set, a safe viewport region, a padding value in **overlay CSS pixels**, a fit policy, and scale limits. Reserve captions, controls, side annotations, and device safe-area insets before solving the camera. For target bounds `(x, y, w, h)` in scene space and available safe box `(sx, sy, sw, sh)`:

```
k = clamp(minScale, maxScale,
          min((sw - 2*p) / w, (sh - 2*p) / h))
center = (sx + sw/2, sy + sh/2)
translation = center - k * (x + w/2, y + h/2)
```

The safe box is local to the viewport; viewportOrigin is added only in client-space conversion. Reject empty or non-finite geometry. If clamping at minScale prevents containment, report `FRAMING_CLIPPED` and choose the declared fallback. Multi-target shots fit their union, but widely separated targets may produce unreadable text; split the scene or offer an inset instead of zooming arbitrarily far out.

Host-authorized policies may prefer center, leading edge, or a contextual neighborhood. The initial format supports fit and bounded scale, not a full cinematic optimization language.

## Motion design

Offer named presets: `gentle`, `direct`, `overview`, and `instant`. Resolve presets to deterministic finite-duration easing. Interpolate scale in log space to make multiplicative zooms more balanced, with translation chosen to preserve a meaningful focal point. Use the current sampled pose when retargeting, not the previous requested destination. Interrupted animations never snap back before starting the next shot.

P0 avoids rotation, overshooting springs, depth blur, and large parallax effects. A path-planning extension may zoom out before a long pan, preserve context, avoid crossing sensitive regions, or enforce maximum apparent motion. These are proposed UX heuristics, not mathematically guaranteed comfort. Honor user motion preferences over script settings.

## Layout changes and target following

Camera time should be continuous; target geometry may change discretely. On a meaningful geometry revision, recompute an endpoint and retarget from the current pose. Use tolerance and hysteresis to avoid chasing one-pixel oscillations. A `follow` policy is opt-in, bounded in rate, and suspended while a user manipulates the target.

Read only dirty measurements; perform writes after all reads. ResizeObserver detects some size changes, not every position change; scroll, host notifications, relevant mutations, and animation-specific invalidations may also matter. Do not claim ResizeObserver alone solves all moving targets. Native browser hit testing already accounts for transforms; do not remap normal DOM pointer events a second time. Inverse mapping is for overlays, authored cursor paths, and adapters.

## Scrolling

A camera cannot reveal content clipped inside an overflow scroller simply by moving the outer page. `ensureVisible` is a separate host-authorized reveal effect. It can scroll designated containers or ask a virtualization adapter to materialize a target. Wait for a bounded readiness condition, remeasure, then frame. Preserve original scroll state only for engine-owned changes, and avoid restoring over deliberate user scrolling. Native user scroll usually pauses or retargets the shot according to policy.

## Fixed, sticky, portals, and top layer

A transformed ancestor changes the containing block for fixed descendants; this is why the integration contract is explicit. Sticky behavior depends on its scroll container and remains part of the baseline app layout. Portals rendered outside the scene do not magically follow its camera. The host can provide a scene portal root, an overlay target, or an overlay-only scene. Never reparent a framework portal behind the framework's back.

Dialogs, popovers, fullscreen content, and other top-layer behavior need individual tests; do not assume a transformed ancestor controls their painting like an ordinary child. If a scene requires an unsupported top-layer target, pause at normal scale or use a fallback. Browser chrome is outside the scene.

## Canvas, WebGL, SVG, and text

Scaling a canvas magnifies its existing raster output and can soften it. Rerendering at higher resolution costs memory and may require cooperation. A native map camera can refit geographic features while preserving sharp labels but is not identical to a whole-page zoom. Distinguish `dom-camera` and `native-camera` in a scene's ownership plan. SVG has its own viewBox/transforms; require tested conversions. DOM text may be rerasterized by the browser, so avoid claims of perpetually crisp or permanently cached text.

## Responsive and mobile behavior

A visual camera zoom must not masquerade as browser zoom. Pinch zoom, on-screen keyboards, browser bars, and VisualViewport changes can alter the user's actual view. Recompute safe regions while preserving user access to controls. Do not disable pinch zoom globally. P0 limits cinematic motion to well-characterized managed surfaces; narrow screens can default to overlay-only guidance.

## Acceptance experiments

A static dashboard shot should have no engine width/height writes. Compare baseline and camera trace to identify actual layout/raster/compositor work. Exercise 1×→3×→1× with nested scroll, fixed child, portal menu, open modal, SVG target, high-DPI canvas, browser zoom, and mobile keyboard. Prove hit testing and cleanup, not just an attractive transition. See [15](15-testing-and-performance.md).
