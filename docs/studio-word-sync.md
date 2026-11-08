# Studio word timing and motion alignment

This slice implements reusable, offline timing helpers for the existing Studio project format. It does not transcribe speech or create persistent links. The following workspace controls are a separate integration slice; inspect the PR and live verification before treating them as deployed.

## Editing contract

`captionWordAnchors(project, sceneId)` returns immutable start/end markers for the active, enabled caption language in that scene. Every marker identifies its caption, zero-based word index, text, boundary and exact time in three coordinate systems: caption-local, scene-local and project-global milliseconds. Caption text is authored project content, not scraped application data.

`stampCaptionWord(project, captionId, wordIndex, boundary, projectTimeMs)` stamps one start or end from the shared playhead. Timing remains integer milliseconds. The existing word must retain positive duration, stay inside its caption and not overlap either neighbour. Invalid or locked edits fail without shifting other words, changing caption text, rewriting a voice take or partially modifying the project.

`alignKeyframeToCaptionWord(project, clipId, keyId, anchor)` changes only the time of one visible camera/cursor key. It translates the word's scene time into the motion clip's source window, including split/trim offsets. Collisions with another key, boundaries outside the clip, missing words, different scenes, inactive caption languages and locked motion tracks are refused. Other keys, target positions, easing and voice audio remain unchanged. A locked caption track can supply a read-only anchor.

Alignment is an explicit **one-time edit**, not a persistent link. Editing the caption later does not silently move a previously aligned key. Review and align it again when necessary. Applying the returned project through `createProjectStore.commit` uses the normal revision check and single-step undo.

The timeline snapper also considers start/end markers in the active visible caption language. Scene/clip/playhead/keyframe precedence is preserved at coincident markers. Inactive languages and hidden tracks contribute no word magnets. Snap-off/Alt bypass still disables both magnets and the grid. Markers are captured once per gesture; proposed edits still need the ordinary validation and lock checks.

## Intended creator flow

In CC, enable Word highlighting, choose a word, listen using the existing voice track and pause the shared transport. **Start here** or **End here** assigns the playhead to that boundary. Exact timing inputs remain available; the interface must not round authored millisecond boundaries to centiseconds. Evenly spaced words are estimates until the author corrects them, not a speech-alignment result.

For Camera or Cursor, select a key and choose **Align to word**. Pick a named word start/end in the scene's active captions, inspect the old/new times, then apply. Cancel, a stale revision or an invalid destination leaves the project intact. Merely opening the picker or auditioning a word is not a project edit.

## Verification and boundaries

`packages/studio/test/word-sync.test.js` exercises coordinate conversion, exact precision, isolation, split source windows, invalid ranges/collisions, locks, undo and revision checks, magnetic guides, inactive tracks and malformed input. `package-tests/studio-timeline.ts` includes positive/negative typed consumer checks through the installed editing subpath. Browser tests for the UI belong to the integration PR.

No project version bump, new dependency, speech service, provider connection, network request, recording permission, persistent storage, application action or publication route is introduced. Automatic speech alignment, automatic retiming after changed narration and actual persistent word links remain separate work.
