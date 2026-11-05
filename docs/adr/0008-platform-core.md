# ADR 0008 · Prototype the core on web-platform primitives

Status: accepted design direction for draft 0.1.0-draft.1; not implemented.
Date: 5 November 2026.

## Context

Existing pan/zoom and tour libraries solve useful pieces, but may bring independent clocks or property/focus ownership.

## Decision

Prototype minimal geometry and a synchronized renderer directly; adopt a backend only after contract and benchmark evidence.

## Alternatives considered

Stack libraries without ownership rules; rewrite everything on principle; build the visual studio first.

## Consequences and verification

Some foundational code is custom, but reuse remains possible. No performance superiority is claimed without comparable measurements.

See [detailed design](../13-integrations.md). Supersede this ADR if new evidence changes the decision; do not rewrite historical rationale silently.
