# Reuse a complete scene

Select a scene in Studio's scene rail and choose **Duplicate scene**. The copy is inserted immediately after the source, selected, and held paused at its beginning. Its title ends in “(copy)”. The operation copies the whole scene, regardless of which clip or group is selected. When an undo entry is available, Undo removes that copy as one project edit; redo restores the same copied identities. History is bounded, not a durable backup.

Undo/redo keep the selected scene and the preview together. A surviving selected scene retains its scene-relative playhead when possible. If history removes that scene, selection returns to the nearest earlier surviving scene (otherwise the next surviving scene), paused at its beginning. This also applies to undoing Add scene. Redo restores project data without automatically selecting a newly reintroduced copy.

## What is copied

Every track contributes its clips for the source scene, including inactive caption languages and disabled voice lanes. Caption text, word boundaries, styles, camera/cursor keys, paths, gestures, clip placement, source windows, narration text, selected takes, gain and fades are retained. Camera and cursor keys linked to caption words are rebound to the **copied** caption and word identities. Editing a copied caption's timing therefore moves its copied keys, not the original scene's keys.

The new scene, clips, keyframes, gestures and identified words receive unique IDs. Track identities, approved targets and audio asset references are reused. The operation does not duplicate audio bytes, load a voice take, record input, run application actions or change the project's format version. A saved project reopens with the copied scene and its independent timing links intact.

## Boundaries and recovery

The copy extends the story by the source scene's duration and moves later scenes later. Existing locked-track rules remain in force: duplication is refused when it would add clips to a locked track or move any later locked clip in absolute time. An unrelated locked track that is not changed or moved is allowed. Disabled tracks are not exempt from locks.

The existing limits of 60 scenes, 30 minutes total and per-track/total clip budgets still apply. Any rejected duplication leaves the original project unchanged. Invalid uncommitted input must be corrected or discarded before duplication. Successful duplication stops playback; it never auto-starts the copy. This is scene reuse within one project, not a cross-project asset importer, linked template, or full undo of application state.

## Reusable API

```ts
import {duplicateScene} from '@dom-director/studio/editing';

const before = store.snapshot();
const result = duplicateScene(before.project, selectedSceneId);
store.commit(result.value, 'Duplicate scene', before.revision);
// result.sceneId identifies the new scene; the host owns selection and playback.
```

The function returns a new validated, frozen project and the copied scene ID. It does not mutate its input. The host applies it using its ordinary revision-checked commit. Like the rest of the Studio package, this entry is an implementation candidate available from source/local tarballs, not an npm publication claim.

## Verification

`packages/studio/test/scene-duplication.test.js` covers preservation, independently linked words, split source windows, hidden languages, shared audio bundles, identity collisions, locks, project budgets and undo/redo. The installed-package consumers exercise the actual exported API and its TypeScript declarations. `studio-tests/scene_duplication_test.py` exercises real controls, invalid fields, playback interruption, keyboard/mobile focus and save/reopen. The existing review runner includes those cases in staged and public three-engine checks. Test definitions alone are not a passing result; inspect the associated CI run. Automated checks do not complete physical-device or assistive-technology acceptance.
