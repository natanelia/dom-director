# ADR 0006 · Motion is optional; explanations remain equivalent

Status: accepted design direction for draft 0.1.0-draft.1; not implemented.
Date: 5 November 2026.

## Context

A video-like experience can exclude users through motion, audio-only meaning, focus changes, or inaccessible controls.

## Decision

Provide reduced-motion/overlay-only guidance, captions, transcript, keyboard controls, and a reliable exit from the beginning.

## Alternatives considered

Add accessibility after the player; force fast animation for reduced motion; treat decorative cursor movement as sufficient explanation.

## Consequences and verification

Every scenario needs meaningful text and semantic outcomes. Manual assistive-technology review is required before conformance claims.

See [detailed design](../11-accessibility.md). Supersede this ADR if new evidence changes the decision; do not rewrite historical rationale silently.
