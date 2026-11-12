# Find and replace captions

Studio's **Find captions…** button opens a text search across the current caption
language. You can choose another language, or explicitly search all tracks
(including hidden ones). Matches are ordered by their position in the project. A result
can open its caption in the inspector and move the paused playhead to that clip.
Search does not read the application DOM, voice scripts, audio, or private form values.

The search is literal, with optional Match case. Regular-expression syntax and
replacement tokens such as `$&` are treated as ordinary characters. Case-insensitive
matching uses JavaScript Unicode simple case folding; it is not locale-aware search,
accent removal, spelling correction, transcription or automatic speech alignment.

Select the matching captions to change, enter replacement text, and choose **Review
replacements**. The review shows before/after text and exactly which word timings and
camera/cursor links would be removed. Applying is a separate action and one undo step.
Caption positions, durations, styling, audio takes, voice scripts and language selection
stay unchanged. Search and review do not start playback or write the project.

A changed caption loses its existing word timings, matching the current single-caption
editing rule. Motion keys linked to those words are explicitly detached at their
current resolved times. No key is moved or deleted. This needs an extra confirmation
in the review. Cancel preserves both the words and their links; Undo restores the
caption and links together. A no-op replacement clears nothing. A locked caption or
locked dependent motion track blocks the entire proposed edit, not just that row.

Search results and review are paged in groups of 20 without silently excluding later
matches. The selection count includes all pages. Empty replacement text removes the
matched substring, but cannot leave a wholly blank caption. Inputs are bounded:
1–256 search characters, at most 4000 replacement/result characters per caption,
and at most 5000 nonoverlapping matches. Exceeding the search limit fails explicitly;
there is no truncated Replace all. Project validation and existing history bounds
still apply. A stale project revision invalidates review instead of overwriting newer
work. Searches are memory-only; no search history, telemetry or provider is installed.

## Reusable library entry

The unpublished implementation candidate exposes `@dom-director/studio/caption-search`:

```ts
import {findCaptionMatches, proposeCaptionReplacement} from '@dom-director/studio/caption-search';

const snapshot = store.snapshot();
const results = findCaptionMatches(snapshot.project, {
  query: 'checkpoint', matchCase: false, // active caption track by default
});
const proposal = proposeCaptionReplacement(snapshot.project, {
  query: 'checkpoint', replacement: 'review point',
  clipIds: results.captions.map(caption => caption.clipId),
});
// Show proposal.changes and proposal.detachedLinks; obtain the user's decision.
// Only after review:
store.commit(proposal.value, 'Replace captions', snapshot.revision);
```

`trackId: null` opts into all caption tracks; an explicit string selects one track.
Search ranges are half-open UTF-16 offsets for `String.slice`, not code-point offsets
or word identities. Results and proposals are frozen copies. Neither function needs
browser globals or commits to a store. Invalid input and locked/invalid edits throw;
callers must present the error rather than silently retrying with a smaller scope.
Authored text may itself be sensitive: it is not automatically redacted or uploaded.

## Verification boundaries

Model tests cover literal/Unicode matching, language scope, limits, frozen results,
locks, word/link changes, unchanged audio and exact undo/redo. The focused browser
journeys cover search, pagination, selection, review, cancellation, stale revisions,
markup safety, mobile layout and keyboard focus. They run in the existing staged and
public verification suites. Inspect the PR's actual check results; these test definitions
do not certify physical devices, screen-reader behavior or first-time user comprehension.
