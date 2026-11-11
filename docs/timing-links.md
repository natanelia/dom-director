# Persistent caption-word timing links

The optional `@dom-director/studio/timing-links` entry links a camera or cursor
keyframe to an **authored caption word boundary plus a delay**. Unlike the earlier
one-time alignment helper, subsequent word timing or caption-position edits keep
the linked key synchronized. Audio and application actions are never changed by a link.

## Format and compatibility

Creating the first link explicitly promotes that project to `0.1.0-draft.2`.
The reader still accepts `0.1.0-draft.1` projects without rewriting them. Saving an
old project alone does not migrate it. Draft.2 adds optional stable word IDs and
keyframe `timing` records with `captionId`, `wordId`, `boundary` and `offsetMs`.
Older strict readers reject draft.2 rather than discarding links. The package
version remains the unpublished `0.1.0-rc.0` candidate; project and package versions
are separate. Removing the last link does not implicitly downgrade the project.

Imported data must include the exact resolved key time. Inconsistent references,
missing words, cross-scene references and forged cached times are rejected, not
silently repaired. Save/reopen retains IDs, links and timing. VTT/SRT cannot carry
these relationships; use the native `.director` project to keep them.

## Reusable API

```js
import {linkKeyframeToCaptionWord, describeTimingLinks,
  setTimingLinkOffset, detachTimingLink} from '@dom-director/studio/timing-links';

const next = linkKeyframeToCaptionWord(project, 'camera.overview',
  'camera.to.overview', {
    captionId: 'cc.overview.0', wordIndex: 1,
    boundary: 'start', offsetMs: 200,
  });
// Commit next through the host's existing revision-checked undo store.
// Use describeTimingLinks(next) to inspect the resolved, immutable descriptions.
```

Creation requires a visible key and an authored word in the same scene's active,
visible caption track. No speech recognition or automatic audio alignment occurs.
Approximate, evenly distributed word timings remain approximate until corrected.
A previously unidentified word needs an unlocked caption track once to acquire its
stable identity; linking other keys to that identity does not alter the caption.

The relationship remains on that original caption language when another language
is selected or hidden. It never silently attaches to a translated or similar word.
Offsets are whole milliseconds; positive means later, negative earlier. Scene
retiming follows the updated word while keeping that delay fixed in milliseconds.
Voice replacement can still retime a scene only through its existing reviewed
proposal; plain caption corrections never regenerate or stretch audio.

## Editing semantics

All dependent changes share one validated transaction and undo entry. Moving a
linked key directly changes its delay, not its relationship. Changing a key's
position, target, zoom or easing leaves the link intact. Creating an extra key
starts at an absolute time and does not inherit the selected key's link.

Trimming motion preserves off-window source keys needed for interpolation. A link
outside the visible trimmed window still follows its word; descriptions expose
`visible: false`. Splitting motion retains linked source keys on both halves and
preserves the sampled animation. Splitting captions transfers a reference to the
new caption using the stable word ID, never text matching. Duplicated captions get
new word IDs; existing links stay on the original. Duplicated motion carries a
correspondingly increased delay so the duplicate still plays at its new location.

A missing word, an invalid source time, a key collision or a locked affected track
rejects the complete edit and preserves the prior project. Removing word timing
or deleting a caption with dependents requires an explicit detach or relink first.
`detachTimingLink` freezes one key at its current resolved time;
`detachCaptionTimingLinks` removes all relationships to one caption, respecting
motion-track locks. Neither changes voice audio or caption content.

Preview, WAV planning and local video rendering validate the same project. The
camera/cursor evaluator samples resolved times; there is no separate asynchronous
link scheduler or per-frame mutation of the draft.

## Evidence and boundaries

`packages/studio/test/timing-links.test.js` covers migration, stable identities,
word/caption edits, split/trim/duplicate, deterministic evaluation, retiming,
lock/collision failures, undo and native bundles. `tools/check_studio.py` exercises
the public subpath in installed tarballs with positive/negative TypeScript cases.
The new runtime modules are named explicitly in the public build allowlist.

This model addition does not connect a voice provider, recognize speech, enable
application actions, publish packages or certify physical devices. Inspect the
associated PR checks before claiming browser or deployed-UI acceptance.
