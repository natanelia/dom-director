# M1 implementation: managed browser surface

## Delivered

`packages/core/src/surface.js` introduces an explicit managed surface, exclusive
ownership, coordinate conversion using DOMMatrix, interruptible focus/reset,
resize/scroll/mutation invalidation, live reduced-motion handling, and conservative
overlay-only fallback. `geometry.js` contains pure fitting, easing, projection and
log-scale interpolation. `journal.js` restores only still-owned inline properties
and their original priorities.

The initial backend is native requestAnimationFrame plus CSS transform writes.
No dependency backend was added: the required frame sampling and interruption
semantics are directly expressible with platform primitives. This is an engineering
choice, not a measured claim that this backend outperforms other libraries.

## Review fixes

Dirty target geometry initially changed an endpoint against the original animation
origin. Review replaced that with retargeting from the currently rendered pose and
remaining duration. Tests explicitly check that interrupting does not change the
pose synchronously. A test initially awaited the first animation accidentally;
corrected it to retain the pending promise before interrupting.

## Evidence and boundaries

Pure tests cover safe boxes, scale clipping, deterministic easing, 2,000 seeded
coordinate round trips, ownership restoration, and server-safe imports. Browser
fixtures exercise real hit testing, offsets/borders, nested scroll, resize, portals,
modal/popover targets, conservative fixed/sticky fallback, interruption/abort,
reduced motion, target disappearance, and 100 create/destroy cycles.

Local browser: system Chromium 144.0.7559.96; Node 22.16.0; Python 3.13.5. Local
HTTP navigation is prohibited by the managed browser, so the explicit
`RUNTIME_TRANSPORT=memory` test mode imports identical source through data modules.
It is not HTTP evidence. CI uses normal HTTP in Chromium, Firefox, and WebKit.
CI results must be checked before claiming those engines passed.

Actual browser zoom, physical mobile devices, screen-reader use, performance traces,
and retained heap analysis remain release-evidence work, not claims inferred from
this fixture. The 100-cycle test proves lease/style restoration, not GPU/heap freedom.
The existing Orbit demo remains untouched until the player integration is ready.
