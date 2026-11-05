# ADR 0004 · One presentation clock authority per segment

Status: accepted design direction for draft 0.1.0-draft.1; not implemented.
Date: 5 November 2026.

## Context

Independent animation and media timers drift and react differently to pause, seek, rate, and suspension.

## Decision

Coordinate scene time centrally, using media position for prepared narration segments and continuity-preserving clock handoffs.

## Alternatives considered

Start timers together and hope; allow each track to own wall time; use speech events as a universal precise clock.

## Consequences and verification

Backends must support sampling/synchronization. Perfect audio-output synchronization remains a measured hypothesis, not a promise.

See [detailed design](../07-timeline-and-playback.md). Supersede this ADR if new evidence changes the decision; do not rewrite historical rationale silently.
