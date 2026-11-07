# Studio media and native project bundles

Implemented candidate APIs live in the optional `@dom-director/studio/media` entry; no npm release is implied. This layer does not start a microphone, connect a provider, persist data or call a network merely by import or construction.

## Transport and media ownership

`createMediaBank` owns raw local audio, decoded buffers and measured waveform peaks. AudioContext is lazy. Accepted files are at most 8 MiB each, mono/stereo and 180 seconds; the bank bounds original local bytes to 24 MiB and retained decoded samples to 128 MiB. These are application retention limits, not a proof that a browser codec cannot allocate temporarily during decoding. Imported originals are copied, checksummed and never rewritten by trims. Removing/clearing/destroying invalidates pending decode results. Cached identity changes are rejected. Host-supplied prepared sample references resolve only through an explicit resolver; no script URL is followed.

`createTransport` owns one playhead. Silent preview uses a monotonic presentation clock without loading media. Sound opt-in prepares selected sources and uses Web Audio time as the common authority, scheduling source trims and gain/fades against that clock. Seeking never executes app effects or generates narration. Pause/seek/load/destroy cancel preparation and disconnect scheduled sources. Actual decoded source bounds are checked before scheduling, rather than trusting imported metadata. Project replacement clears a previous loop.

The transport does not silently stretch audio, reconstruct business state, or claim deterministic decoding across every browser. Unit tests use explicit fake clocks/contexts; real decoding and playback require the separate browser suite. A failed audible preparation is reported and stays paused, not falsely reported as successful narration.

## Save/reopen

A `.director` file is a versioned newline-delimited JSON bundle. Its first record has `format: dom-director-studio/1`, the complete Studio project and a local-media manifest. Subsequent bounded records contain base64 original audio chunks identified by asset ID and index. It is not a ZIP archive or executable HTML. Each record goes through the core's bounded data-only parser; metadata follows the Studio validator. SHA-256 detects missing/corrupt/replaced bytes, not authorship or trust.

The importer bounds the complete file to 36 MiB, checks exactly the expected manifest fields/chunk counts/IDs/byte counts, and rejects duplicates, missing assets and unsupported versions before replacing the active project. Local media is included; prepared sample audio remains a named host reference. No token, permission grant, page form value or undo history is serialized. Authored text and recordings can themselves contain sensitive information. File downloads are explicit; browser-local autosave and cloud storage are not installed.

## Voice delivery adapters

`generateVoiceTake(provider, request, {signal})` accepts a host-owned adapter with declared voices and delivery styles. Unsupported choices fail before calling it. Requests carry authored text, selected voice/style, originating clip ID and project revision. Generation returns an **uncommitted** take and immutable-by-snapshot provenance; the caller must compare revisions and review replacement/retiming. Mutating the request while it is pending cannot rewrite its origin. Cancellation rejects a late result; it is not a billing guarantee.

No commercial provider, cost model, credential or voice-cloning service is selected or bundled. The public editor must say when no generator is connected, not turn pace/pitch into a fake expressive style. Browser speech audition is not an exportable media take. Microphone recording belongs to an explicit user gesture and visible record/stop/discard workflow in the consumer.

## Evidence

Fourteen local model/media tests cover exact binary bundle round-trips, corruption/missing chunks, resource bounds, stale decode cancellation, silent/audible clock selection, pause, source windows, loop reset, unsupported provider choices, cancellation and originating-revision preservation. Package consumers validate the exported subpath and declarations. These tests do not certify microphone codecs, physical devices, real provider quality, or end-to-end export rendering.
