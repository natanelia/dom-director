# Review a voice replacement's timing changes

Choose **Fit scene to voice** in the take comparison to inspect the proposed edit
before accepting it. The review shows the scene's old and new duration, its change
in seconds, and the number of later scenes that move. Expand **CC**, **Camera**,
**Cursor**, or **Voice** to inspect the affected items. All positions show three
decimal places: one millisecond is `0.001 s`.

The review compares the original project with the actual proposed replacement.
It does not calculate another version of the retime. Caption text stays intact,
audio is never stretched, and viewing details does not change the current take,
playhead, project revision, or undo history. Listening stops when the review opens.

## Read the details

- **Timeline** positions are measured from the start of the complete project.
  Clip and word rows show start/end positions and their individual changes.
  Keyframe and cursor-gesture rows show the exact point and its change.
- **Source window** positions refer to the original audio or motion source.
  A split motion clip can retain keys outside its visible window because those
  keys still define the motion. Such keys remain listed, with their visibility
  before and after the edit. Their project position can be outside the scene.
- **CC** includes all affected caption languages, including inactive or disabled
  tracks and authored word boundaries. Hidden languages are labeled explicitly.
- **Linked keys** name their original caption word, language, start/end boundary,
  and fixed delay. These links follow authored timings; they do not recognize
  speech or automatically align the replacement recording with the words.
- **Voice** identifies the old and new take, source trim, timeline window, and any
  changed fades. This row remains available when the new duration is unchanged.

Each track group displays at most 20 items at a time. **Previous** and **Next** show
the remaining items; the page counter states the displayed range and full count.
Later scenes' shifted clips, words, and motion points are included in these groups.
No changed row is silently dropped because it falls outside the first page.

## Accept, cancel, or recover

**Cancel** or **Escape** leaves the project unchanged and returns keyboard focus to
the Voice inspector control that opened the comparison. The review opens with
Cancel focused. **Use take and retime** is the only acceptance action and commits
the already-reviewed proposal with its originating revision. One **Undo** restores
the previous take and all timing changes together. Save/reopen retains the result
through the existing native `.director` format.

A project edit while the review is open makes its acceptance stale. The error is
shown inside the dialog; cancel and select the take again to review a fresh
proposal. Locked tracks, conflicting linked keys, invalid lengths, and multiple
voice clips in the fitted scene keep the existing atomic rejection behavior.
The comparison remains available if building a proposal fails.

## Reusable description API

`@dom-director/studio/editing` exports `describeVoiceReplacementImpact`:

```js
const proposal = proposeVoiceReplacement(project, clipId, asset, {fitScene: true});
const impact = describeVoiceReplacementImpact(project, proposal.value, clipId);
const nextCaptionPage = describeVoiceReplacementImpact(
  project, proposal.value, clipId,
  {limit: 20, offsets: {captions: 20}},
);
```

The helper validates both projects, rejects incompatible identities or unrelated
edits, and returns an owned, deeply frozen description. Its scene summary and group
totals cover the entire comparison. Each group includes `items`, `offset`, `limit`,
and `hasMore`. The default page size is 20; callers can request 1–100 rows per group
with non-negative integer offsets. Positions are integer project milliseconds;
source positions are separately named. Stable row IDs, clip IDs, and available
word/key/gesture IDs support rendering without text matching. The helper never
commits an edit, starts media, or introduces a second retiming engine.

## Validation and boundaries

`packages/studio/test/voice-impact.test.js` checks model coordinates, linked and
off-window keys, hidden languages, source trims, bounds, purity, rejection, undo,
and native round trips. Installed JavaScript and TypeScript consumers check the
editing export. `studio-tests/voice_impact_test.py` exercises the real comparison
and review, cancellation/focus, acceptance/playback, long lists, mobile reduced
motion, stale reviews, and rejection recovery. These journeys join the existing
Chromium/Firefox/WebKit staged and verified-public review suite. The accessibility
audit retains violations and incomplete findings for the new review states.

Check the PR's current test and deployment evidence for executed results. These
test definitions do not certify physical devices or assistive technology; the
manual acceptance work remains in issue #19. This change adds no public route,
provider, microphone request, audio stretching, storage, or publishing destination.
