# Multi-clip editing

The optional `@dom-director/studio/selection` entry provides atomic operations for
video-style selection across camera, cursor, voice and caption tracks. It uses the
existing Studio project format; it does not add a new schema, playback engine,
permission, provider or persistence layer. This first slice is the reusable model;
visual selection controls are a separate change. Packages remain unpublished.

```ts
import {selectionBounds, includeLinkedClips, moveClips,
  duplicateClips, deleteClips} from '@dom-director/studio/selection';

const snapshot = store.snapshot();
const ids = includeLinkedClips(snapshot.project, selectedIds);
const range = selectionBounds(snapshot.project, ids);
const moved = moveClips(snapshot.project, ids, 250); // +250 milliseconds
store.commit(moved, 'Move selected clips', snapshot.revision);
```

Selection uses stable clip IDs, not timeline pixel positions. Empty, duplicated,
unknown and oversized selections are refused. Returned snapshots and identity
lists are immutable. Reads and edits are data-only and do not resolve DOM targets,
read media, start playback, or execute application effects.

## Move, duplicate and delete

`selectionBounds` returns the earliest start and latest end in **project time**,
including gaps. The returned clip IDs are in project order, independent of click
order. This range can drive a selection loop; it does not promise that every
moment in the range contains selected media.

`moveClips` applies one integer-millisecond delta to every selected clip's start.
Each clip keeps its original scene. Source trims, motion windows, keyframe times,
caption wording and audio gains remain unchanged. Negative offsets are allowed
when every clip still fits its scene. There is no implicit ripple movement or
cross-scene reassignment. Scene bounds, overlaps and track locks are checked on
the complete result: any failure rejects the whole edit, never a partial subset.

`duplicateClips` takes an explicit offset and returns `{value, clipIds}`. Copies
have fresh globally unique clip, keyframe and gesture identities. Authored words
that already carry IDs get fresh ones; optional IDs remain absent on unlinked
words that do not have them. Internal caption-word links are remapped to the copied captions/words; original
links still refer to the original items. Asset references and source windows are
shared, not copied or re-encoded. Duplicating into occupied time is an error; the
helper does not guess where free space or a new scene should be.

`deleteClips` removes the selected clips together. It retains scenes, tracks and
audio assets, including unused assets needed for undo. Deleting clips does not
shorten the scene or close a gap. A successful edit can be committed once for one
undo step, with an expected revision to reject stale proposals.

## Timing-link boundaries

Moving only one side of a persistent caption-word link would either move
unselected keys or keep a selected key from following its clip. The group API
refuses that ambiguous edit. `includeLinkedClips` explicitly expands the
selection to all connected caption/motion clips, including transitive links. It
does not change the project and never silently selects extra items during a move.
The host should show the expanded selection before executing it.

Duplicating motion requires its linked captions in the selection, so copied
motion does not unexpectedly follow an original caption. Copying a caption alone
is safe: its original dependent keys remain unchanged. Deleting a caption while
an unselected motion key still depends on it is refused; deleting the dependent
motion alone is safe. Detaching a link is a separate, explicit existing operation.
Locks still apply after expansion; including a locked dependency does not bypass
it. Group edits do not rewrite voice data or infer speech alignment.

## Verification and boundaries

`packages/studio/test/selection.test.js` covers bounds, immutable input, ordering,
scene-local movement, collisions, locked tracks, word-link closure, fresh identity
mapping, duplicate/delete, and revision-checked undo. `tools/check_studio.py`
consumes this export from actual packed tarballs in Node and TypeScript. Test
source is not proof of a passing run; inspect the associated PR checks.

This entry does not implement automatic layout, gap removal, box selection,
multiclip trimming, cross-scene dragging or a general track-group format. The
host owns selection UI and preview. The native project file is unchanged and
contains no editor selection or implicit approval.
