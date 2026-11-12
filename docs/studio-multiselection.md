# Multi-clip editing

The optional `@dom-director/studio/selection` entry provides atomic operations for
video-style selection across camera, cursor, voice and caption tracks. It uses the
existing Studio project format; it does not add a new schema, playback engine,
permission, provider or persistence layer. Studio uses the same helpers for
multitrack selection and grouped edits. Packages remain unpublished.

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

## In Studio

Shift-, Ctrl- or Cmd-click timeline clips to toggle them in the selection. A normal
click returns to one clip. **Select clips** opens a labeled checkbox list for touch
and keyboard users, with **Select this scene**, **Clear choices**, and **Include
linked clips**. Applying a selection never edits the project. Selection is temporary
editor state, not a persisted track group or part of the saved project.

With several clips selected, the inspector shows the selected time range and track
count. Enter an offset in seconds for **Move by offset** or **Duplicate by offset**;
**Start at playhead** aligns the earliest selected start. **Delete selected clips**
removes the group. Drag any selected clip to move them together, or focus one and
use Left/Right to nudge 10 milliseconds (Shift: 100 milliseconds). Each successful
operation is one revision-checked undo step. Copies become the new selection.

The drag preview commits only on release. Escape, pointer cancellation, lost focus,
resize, a changed project or changed timeline scale cancels it. Releasing at an
invalid position changes nothing, not the last valid preview. Snapping uses any
selected edge against unselected clips, keys, words, scene boundaries or the
playhead. Alt-drag bypasses magnets and the grid. Selected items never snap to
one another as though they were stationary.

**Loop selection** loops the group's project-time bounding range, including gaps
and any unselected content within that range. It does not solo the selected media.
Use **Edit only the primary clip** or a normal timeline click to return to one
inspector. Selecting a keyframe remains a single-key operation. Split and trim
require one clip; group movement requires Ripple off, so unselected clips cannot
move unexpectedly. Full-scene clips have no spare movement space until trimmed;
the editor refuses out-of-scene placement rather than silently resizing a scene.

When timing-linked captions and motion are only partly selected, the operation
explains the conflict. **Include linked clips** explicitly shows the expanded group
before retrying. A locked dependency remains locked. Group edits never detach
links, alter voice audio, extend scene lengths or dispatch application actions.

## Match a look without changing the story

Select two or more **caption clips**, or two or more **cursor clips**, then open
**Match appearance** in the group inspector. Choose **Copy look from** and apply.
The chosen source stays untouched. Every other selected clip receives the source's
full effective appearance: built-in defaults, project theme, track theme and clip
overrides, in that order. Text, word timing and links, motion paths, gestures,
clip timing and voice takes remain unchanged. This is one undoable operation.

Matching replaces the destination clips' style overrides rather than changing
track/project defaults. The result is an explicit snapshot: later theme or source
changes do not update it. Select a single caption to reset its style scope when
inheritance is preferred again. Mixed-kind groups, camera and voice groups do not
offer this control. A locked destination rejects the whole edit. A locked source
can be read when the other destinations are on unlocked caption tracks.

Integrators use `matchClipAppearance(project, sourceId, destinationIds)` from the
same `@dom-director/studio/selection` entry. Destinations may include the source;
it is never rewritten. IDs must be current and unique. No media or DOM is read,
no provider is contacted and the project format is unchanged. The returned
immutable project still requires the host's revision-checked commit.

## Adjust narration as a group

Select two or more **voice clips**, open **Voice mix**, and enter a volume
percentage, fade-in time, fade-out time, or any combination. Choose **Apply mix**
to commit once. Empty fields keep each clip's own value; zero explicitly mutes a
clip or removes that fade. The current range of values is shown above the fields.
These are absolute volume/envelope settings, not a relative adjustment, voice
style change or loudness normalization. Entering values pauses preview but does
not edit the project until Apply mix. Changing selection discards unapplied mix
fields. Preview and export use only the committed project.

Fades are entered in seconds with millisecond precision. Fade in plus fade out
must fit **every** selected clip, including any fade left unchanged. An invalid
value, mixed-kind selection or locked voice track rejects the whole operation;
no clip is silently shortened or partially changed. Track mute state, voice take,
source trim, script text, duration, placement, captions and word-linked motion
remain untouched. The normal one-step undo/redo and save/reopen preserve the edit.
Muted tracks stay muted; no take is loaded or regenerated by applying settings.

The data-only `setVoiceMix(project, clipIds, changes)` operation is available from
`@dom-director/studio/selection`. Supply at least one of `gain` (linear 0–2),
`fadeInMs` or `fadeOutMs` (whole milliseconds). Unknown fields are rejected.
Integrators still commit the returned project with an expected revision. The
existing transport, WAV exporter and video renderer consume the same stored
clip envelopes; no new audio format, schema or rendering path is introduced.

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

`studio-tests/selection_test.py` adds twelve browser journeys for selection, exact
offsets, dragging, cancellation, locks, links, duplicate/delete, keyboard, looping,
mobile layout and magnetic snapping. The existing review runner exercises them
in the three supported test engines before and after publication. The Studio
audit additionally covers the checkbox dialog and desktop/mobile group inspector.
These tests do not replace physical-device or screen-reader acceptance.

This entry does not implement automatic layout, gap removal, box selection,
multiclip trimming, cross-scene dragging or a general track-group format. The
host owns selection UI and preview. The native project file is unchanged and
contains no editor selection or implicit approval.

Appearance coverage is in `packages/studio/test/selection-appearance.test.js` and
`studio-tests/appearance_test.py`: precedence, locked/mixed groups, word-link and
source-window preservation, one-step undo, mobile keyboard use and file round-trip.
The packed consumer checks the same exported operation. Automated accessibility
audits include the desktop and mobile matching inspector; manual acceptance is
still required. Test definitions are not claims of passing checks.

Batch-mix evidence is exercised by `packages/studio/test/selection-voice-mix.test.js`
and `studio-tests/voice_mix_test.py`, including source preservation, partial updates,
locked/invalid groups, one-step undo, file round-trip and real offline audio sample
checks. Package consumers exercise the exported function and its typed contract.
Browser tests run against staged and verified public builds; inspect their actual
results before making compatibility claims.
