# Studio editing transactions

The optional `@dom-director/studio/editing` entry provides validated project edits for the video-style workspace. It is a private implementation candidate, not an npm publication. Operations return a new immutable project or an explicit proposal; they do not change playback, perform application actions, contact a provider, or persist data.

## Selected-item editing

`setAppearance` scopes caption/cursor changes to a clip, track, or project. Clip reset removes only that override. Text, paths, and timings remain unchanged. `applyCaptionPreset` applies the supplied Clean, Contrast, or Minimal caption theme. Existing locked tracks prevent both direct and indirect edits.

`addKeyframe`, `updateKeyframe`, and `deleteKeyframe` preserve stable identity and sorted source-time keys. A new key uses clip-relative time, converted through its motion source window. It initially copies the preceding key unless the caller supplies a sampled composition. Hosts should supply that sampled composition when inserting a key into an in-progress move to preserve the appearance. `addGesture` creates a visual cursor pulse only, never a DOM click.

Scene and caption operations create valid IDs, reject overlaps, and enforce the existing project budgets. New scenes use approved references supplied by the integrating host. These helpers do not authorize a reference merely because its syntax is valid.

## Import and voice replacement

`proposeCaptionImport` imports a new caption-language track without deleting the original. Text/time VTT and SRT are supported by the existing parser. Captions crossing a scene boundary are split with their full text retained in each piece; the proposal reports this for the author's review. Cues outside the project are refused, not truncated. Appearance and word alignment are not inferred from plain subtitles.

`proposeVoiceReplacement` never time-stretches a take. Keeping scene timing requires the complete take to fit. Fitting a scene to a new take explicitly proposes movement of visual clips and later scene boundaries, preserving caption text. This automatic operation requires a single voice clip starting at the scene boundary; more complex mixes must be edited explicitly. A host commits the accepted result against the originating revision as one undo step. Failed or stale replacement must leave the current take intact. These helpers do not decode audio or certify provider quality.

## Verification

Thirteen editing tests cover style isolation, lock checks, stable keyframe identity, gesture safety, scene round-trips, overlap refusal, cross-scene subtitle imports, longer/shorter take proposals, and complete undo. Run `node --test packages/studio/test/*.test.js`. Packed consumer checks cover the editing subpath and its TypeScript declaration. Browser integration is a separate implementation slice.
