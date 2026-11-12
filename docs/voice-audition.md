# Listen to voice takes before replacing them

Studio's take-replacement dialog offers **Listen to current clip**, **Listen to new
take**, and **Stop listening**. Import or record a take, generate one through an
explicit host-connected provider, or choose an existing asset from Available takes.
Opening the comparison is silent. Listening starts only after an explicit button
press, including keyboard activation. It is audible even when tour preview says
Sound off; that difference is explained in the dialog.

The current clip uses its authored source trim, volume and fades. The candidate
plays its complete decoded source at original volume, without clip fades, so its
full delivery can be judged even when it is longer than the scene. This is not a
loudness-normalized comparison. Catalog duration may be approximate; full-source
listening uses the decoded buffer length, while bounded current-clip listening
allows only the existing two-millisecond decode/rounding tolerance.

Switching takes stops and disconnects the previous source before preparing the next.
Only one audition owns the listening output. The timeline stays paused at the same
position and neither the project revision, scene duration, narration script, caption
word links nor the selected take changes. **Keep scene timing** and the explicit
**Fit scene to voice** review remain the only replacement paths. Undo still restores
the replacement as one edit; listening does not create undo entries.

Stop, Cancel, Escape, native dialog close, leaving the page, hiding the page, starting
a tour preview or changing the project stop listening. Returning to a hidden or
history-restored tab does not restart audio. Accepting a take or entering the retiming
review stops it too. Failed replacement validation leaves the comparison available.
Missing media, rejected audio startup and decode failures are shown in the dialog;
a failed current take does not prevent listening to a valid candidate.

No microphone permission, generation request, upload, recording or external provider
connection is introduced by auditioning. Local imported bytes use the existing media
bank. Prepared sample media can load from the host-approved same-origin source after
Listen. No audio is loaded merely to open the comparison. This does not implement a
voice-generation service or certify physical-device audio behavior.

## Reusable media API

`@dom-director/studio/media` exports `createTakeAuditioner`. It accepts a host-owned
media bank, an optional state callback, and a bounded startup timeout (15 seconds by
default). Creating it does not create an AudioContext or load media. The host must
call `play` from a deliberate listening action and coordinate it with other players.
The Studio integration pauses its existing transport first.

```js
const audition = createTakeAuditioner({bank, onState: showListeningState});
// Explicit user action; omitted duration means the full remaining decoded source.
const result = await audition.play(candidateAsset);
// Or listen to a source window, with its existing mix.
await audition.play(currentAsset, {
  sourceInMs: clip.sourceInMs, durationMs: clip.durationMs,
  gain: clip.gain, fadeInMs: clip.fadeInMs, fadeOutMs: clip.fadeOutMs,
});
audition.stop();
audition.destroy();
```

Each start replaces the previous audition. `play` resolves when playback is scheduled,
not when it finishes, with `playing`, `cancelled` or `error`. `inspect` and `onState`
report `idle`, `loading`, `playing`, `ended`, `error` or `destroyed`. An AbortSignal can
cancel pending preparation or active playback. Cancellation settles the caller even
when browser permission or decoding is still pending; late work cannot create a new
source. The factory releases its owned sources, gains, signal listeners and timers;
it never closes or suspends the host's shared AudioContext or destroys the media bank.

## Validation and limits

Model tests cover source scheduling, fades, input bounds, audio-start/decode failure,
late completion, cancellation, timeout, destruction and 100 ownership cycles. These
are not a general heap-leak proof. Focused browser cases exercise the actual comparison,
A/B switching, silent opening, exact undo, failed replacement recovery, keyboard/mobile
layout, page lifecycle and native dialog closing. Node/TypeScript consumers exercise
the exported API from installed tarballs. Studio's automated audit includes desktop
and mobile take-comparison states. Check current CI for results; these definitions
are not physical-device, assistive-technology or listening-quality certification.

Platform reference: [W3C Web Audio API — AudioBufferSourceNode and AudioContext](https://www.w3.org/TR/webaudio-1.0/)
(accessed 12 November 2026). One-shot source nodes and asynchronous context startup
are why each audition gets a new source and pending work is explicitly cancellable.
