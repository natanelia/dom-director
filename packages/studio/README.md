# DOM Director Studio — implementation candidate

Optional rich-project authoring and presentation primitives, separate from the existing small core player. This package is private and unpublished. The owner approved implementation of design PR #22 on 7 November 2026; this is an incremental implementation, not a claim that every design stage is finished.

`createSample()` provides a purpose-built three-scene, four-track project using the repository's licensed prepared synthetic narration. `validateProject` reads bounded data-only JSON and rejects unknown versions/fields, unsafe object shapes, source URLs, invalid times, duplicate identities and lane overlap. `createEvaluator` samples camera, cursor and CC deterministically with the core's existing geometry and easing. Callers supply approved scene-coordinate target bounds; no DOM discovery or actions occur in the evaluator.

```js
import {createSample, createProjectStore, updateClip, createEvaluator} from '@dom-director/studio';
const store = createProjectStore(createSample());
const before = store.snapshot();
store.commit(updateClip(before.project, 'cc.overview.0', {text: 'A real application.'}), 'Edit caption', before.revision);
const plan = createEvaluator(store.snapshot().project);
// plan.sample(timeMs, approvedTargetRects, viewportRect)
```

Projects have separately versioned scenes, tracks, clips, caption/cursor themes, audio references and motion source windows. They are NOT canonical core `Tour` scripts, and must not be flattened through the earlier storyboard importer. The existing core Tour APIs remain unchanged. The additive `@dom-director/core/data` entry exposes the existing bounded JSON primitives for authoring packages.

Clip edits use integer milliseconds. Camera and cursor splits retain source windows and original curves rather than restarting easing at a split. Voice splits retain original asset/source ranges. Caption splits with authored word timing require word boundaries; plain text splits repeat the text, to be edited by the author. Retiming is an explicit proposal listing changed items, preserving caption text and never stretching audio. Locked tracks block direct edits and indirect scene movement. Undo stores metadata only and reports evicted recovery points.

Subtitles support bounded plain-text VTT/SRT import and text/timing export, with explicit loss of Studio appearance. Unsupported markup/settings are refused, not silently stripped. Voice generation, external assets, actual application effects, branches, recording, persistent storage and browser execution are not implicitly enabled by this model.

Run `node --test packages/studio/test/*.test.js` with the local core linked under `node_modules/@dom-director/core`. `tools/check_studio.py` tests packed consumers and TypeScript declarations. No npm publication is performed. The full editor and media/browser integration are separate reviewable changes.
