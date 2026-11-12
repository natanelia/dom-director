# ADR 0001 · Managed surfaces before arbitrary injection

Status: accepted design direction for draft 0.1.0-draft.1; not implemented.
Date: 5 November 2026.

## Context

Existing applications have fixed elements, portals, scroll containers, and framework ownership that a generic wrapper can disturb.

## Decision

Require an explicit host-provided transformable scene and separate overlay; ship overlay-only fallback.

## Alternatives considered

Automatic body transforms/reparenting; iframe everything; screenshot-only playback.

## Consequences and verification

Integration takes deliberate host setup. This is preferable to a fragile universal claim. M1 must validate realistic edge cases.

See [detailed design](../06-camera-and-geometry.md). Supersede this ADR if new evidence changes the decision; do not rewrite historical rationale silently.
