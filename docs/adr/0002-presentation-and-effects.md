# ADR 0002 · Separate presentation from application effects

Status: accepted design direction for draft 0.1.0-draft.1; not implemented.
Date: 5 November 2026.

## Context

A timeline is seekable, but transactions, edits, and network calls are not inherently reversible or safe to repeat.

## Decision

Use a pure visual reducer and a separate authorized effect executor with barriers, visit IDs, deduplication, and host reconciliation.

## Alternatives considered

Replay every cue on seek; assume DOM snapshots capture app/server state; forbid all useful actions.

## Consequences and verification

Some seeks are blocked without a checkpoint. The player must explain this instead of faking successful state restoration.

See [detailed design](../07-timeline-and-playback.md). Supersede this ADR if new evidence changes the decision; do not rewrite historical rationale silently.
