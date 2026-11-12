# Keep camera and cursor keys synchronized with caption words

Studio's **Caption sync** panel exposes the persistent word-link model from PR #36.
The controls belong to the selected Camera or Cursor key, not to voice generation.
They follow **authored caption timing**; they do not recognize speech or move audio.
Check the current PR and deployed revision before assuming this UI is published.

## Create a link

In CC, open **Word highlighting** and add or edit word timing. Evenly distributed
words are approximate starting points. Choose a Camera or Cursor keyframe, then
**Link to caption word…**. Choose a word from the scene's visible caption language,
its start or end, and an optional whole-millisecond delay. Negative delays lead the
word; positive delays follow it. The review shows the exact old and new key time.
**Keep linked** applies one undoable edit; cancelling leaves the project unchanged.

Linked timeline diamonds and key-list entries have a visible link marker and an
accessible linked description. The inspector names the source word, its language,
start/end boundary, delay, and resolved time. It labels keys outside a trimmed clip
and sources in a hidden language rather than silently replacing them.

## Edit or detach

**Edit timing link…** changes the existing word boundary/delay, or explicitly
selects another word. The current source stays available even if its language is
hidden. Choosing a new word uses the active, enabled caption language. A project
revision change invalidates an open review instead of applying an old proposal.

Moving a linked key on the timeline or editing its exact time changes its delay;
it does not silently remove the relation. Editing the source word time moves its
linked keys in the same transaction. **Detach link** preserves the resolved time,
position, appearance, and easing. Undo restores the relation.

The source caption displays its dependent motion keys with navigation in both
directions. Replacing timed text, switching to a plain caption, or deleting that
caption lists the affected keys before offering to detach and continue. That
combined operation is one revision-checked undo step. It never drops references
silently, changes recorded narration, or overrides a locked track. Cancel leaves
both the source and its dependents intact.

## Precision, compatibility and boundaries

Word/key timing fields expose milliseconds as seconds with three decimal places.
The model remains integer-millisecond based. Clip source windows, including split
halves, are respected. Source identities survive save/reopen and remain associated
with their original language. The first link opts the project into draft.2; legacy
files are not upgraded just by opening Studio or looking at a proposal. Older
strict readers must reject rather than flatten a linked project.

No new provider, microphone request, persistence, page route, runtime schema,
application permission or publishing destination is added by these controls.
The public synthetic host remains inert during authoring and visual playback.
Recording codecs, physical devices, screen readers and first-time usability still
require the separate manual acceptance work in issue #19.

## Validation

`studio-tests/timing_link_test.py` exercises creation/cancellation, exact offsets,
shared camera/cursor movement, locked dependencies, collisions, caption review,
detach, split-source coordinates, save/reopen, hidden languages, stale reviews,
keyboard focus and mobile layout. It joins the existing three-engine staged and
verified-public review runner. The Studio axe audit adds the link review, inspector,
mobile, dependency, and destructive-edit review states. These are test definitions,
not blanket claims of browser, device or accessibility certification.
