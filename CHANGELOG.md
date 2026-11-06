# Changelog

## 0.1.0-rc.0 — implementation candidate, 6 November 2026

This version is a source/packed-tarball candidate. It has not been published to npm.

Implemented the managed DOM camera and overlay-only fallback; canonical bounded data-only scripts; deterministic visual playback; branching; simulated pointer, annotation and highlight tracks; prepared narration with guarded audio/text clocks; captions/transcripts and controls; host-authorized guided tasks and isolated practice; same-run versioned visual checkpoints; an in-process JSON agent bridge and reviewed target repair proposals; optional React lifecycle bindings; and typed package consumers.

The flagship Orbit experience now uses the SDK rather than its original fixture-only engine. The original prototype is preserved. The agent playground exercises discovery, validation, review and playback without pretending to be a live model.

Review and regression work repaired invalid media-clock/end-event jumps, stale asynchronous completion, mode-preparation races, back-forward cache lifecycle, incorrect virtual-target declarations, camera correction on non-geometric invalidations, and subpixel geometry feedback. Performance and repeated-cleanup evidence is recorded in the release report.

See [release evidence and limitations](docs/release-candidate.md), [version/migration policy](PUBLISHING.md), and [the PR ledger](docs/16-roadmap.md). Manual device/assistive-technology acceptance and registry publication remain separate gates.
