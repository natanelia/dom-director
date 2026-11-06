# Visual storyboard editor

The [public agent playground](https://natanelia.github.io/dom-director/agent.html) includes a native, local-first editor built on the [storyboard compiler](storyboard-authoring.md). Draft from the approved catalog, select a scene, edit its title/caption/target/timing/zoom, and apply. Add, duplicate, reorder or remove scenes; undo/redo edits; download canonical JSON. Validate the resulting script, review that exact version, load it paused, then request playback separately.

Text entry immediately pauses the playground's player and invalidates the prior agent review. Unapplied scene fields block agent validation/load/play, including attempts to recheck the review box. Discarding fields does not restore permission. Raw JSON edits discard the visual history; reimport is explicit and refuses unknown targets or any script that cannot round-trip without losing data. Existing advanced action scripts remain available through the raw JSON workflow and still face the original host permission checks.

## Optional reusable controls

The editor is an optional `@dom-director/core/storyboard-editor` subpath. It creates no DOM until mounted and adds no dependency. Mount one instance per document in an empty root, outside the raw textarea and the camera-controlled scene. Controls use the `storyboard-` ID namespace. The host owns styling, target approval, playback, validation and review; supplying target syntax never grants permission.

```ts
import {mountStoryboard} from '@dom-director/core/storyboard-editor';

const storyboard = mountStoryboard({
  root: document.querySelector('#storyboard-root')!,
  editor: rawJson,
  getTargets: () => approvedCatalog,
  onDirty() {
    director.pause();
    invalidateReview();
  },
  write(script) {
    director.pause();
    invalidateReview();
    rawJson.value = JSON.stringify(script, null, 2);
  },
});

// After replacing the raw JSON, explicitly offer reimport:
rawJson.addEventListener('input', () => {
  director.pause();
  invalidateReview();
  storyboard.invalidate();
});
// storyboard.importCurrent() is called by the explicit import control.
// Reject agent validate/load/play while storyboard.pending is true.
// On host unmount: storyboard.destroy(), then dispose host-owned resources.
```

`getTargets` must return host-approved metadata, not arbitrary DOM scans. `write` is synchronous and must replace the canonical JSON and invalidate review. `onDirty` must pause/invalidate immediately; this renderer does not independently enforce host permissions. The host must gate its own execution and validation entrypoints on `pending`. The playground implements those checks in its agent bridge policy and button handlers. Native host controls remain host-owned.

## Boundaries

This editor supports the compiler's bounded linear, text-captioned Watch subset, not a full multi-track or branching studio. No recording, generated voice, model provider, image upload, remote transport, analytics, autosave or storage is installed. Draft labels come only from approved catalog metadata; private values in the synthetic app are not exported. User-authored text is rendered as text, never markup. Downloading JSON is explicit and includes no review grant.

History is in memory only: at most 30 snapshots and 2 MiB of serialized history. Undo after a fresh edit drops the old redo branch. Reloading loses the local draft. Timers, download URLs and event handlers are released by `destroy`. The raw JSON editor remains the route for audio, actions, gates, branches, custom cue IDs and other advanced content. Physical-device and assistive-technology acceptance is still tracked in [issue #19](https://github.com/natanelia/dom-director/issues/19).

## Evidence

`site-tests/storyboard_test.py` exercises export privacy, stable IDs and history, invalid timing, exact-review invalidation, advanced JSON preservation, approved-target import, text rendering, keyboard/mobile layout and history bounds. The same tests run in Chromium, Firefox and WebKit against the staged artifact and, after hash/revision verification, the authorized public synthetic site. Package checks consume both optional exports from real tarballs. Accessibility checks include the agent's ready and loaded editor states. Inspect current CI results; automated checks are not screen-reader or physical-device certification.
