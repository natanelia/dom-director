# M3 review and portability follow-up

The first HTTP CI run passed Chromium and WebKit but failed the Firefox real-MP3 test. A diagnostic-only follow-up retained the strict progress assertion and exposed `MEDIA_ERROR` at presentation time zero; the engine held instead of skipping. The former generic timeout did not explain this distinction.

The strict cross-browser real-media test now generates five seconds of mono PCM WAV with the Python standard library and requires actual decoded media authority, progress between 250 and 3000 ms, and p95 JavaScript media/DOM sampling skew below 100 ms. A separate test retains the bundled MP3: it either requires the same real-playback assertions or verifies a native decode/unsupported-source error (codes 3/4), a bounded hold, and explicit caption-only continuation. No browser is skipped, autoplay is not disabled, and clock errors or startup timeouts are not accepted as codec fallback.

Local Chromium passed all ten media integration cases. The PCM observation had 13 samples with p95/max 2.93 ms. These are JavaScript sampling measurements, not speaker/display latency. Native media format availability remains browser/OS dependent; the library does not ship codecs.

Self-review also added two pure regressions: a verified natural end of shorter prepared narration hands time back to the visual clock without forcing scene completion, and repeated waiting notifications cannot indefinitely extend a stalled decoder deadline. Early or implausible end events still hold/fail explicitly.

The total pure suite is now 55 cases on the remote base; runtime HTTP integration is 41 cases per browser. Passing results must be verified on the latest PR head before merge. There is no physical iPhone or screen-reader certification claim.
