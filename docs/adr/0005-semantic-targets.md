# ADR 0005 · Use stable semantic targets

Status: accepted design direction for draft 0.1.0-draft.1; not implemented.
Date: 5 November 2026.

## Context

Pixel positions and arbitrary selectors are brittle and cannot describe canvas objects or approved agent visibility.

## Decision

Host registry maps stable IDs to current resolvers/projectors with labels, readiness, sensitivity, and capabilities.

## Alternatives considered

Global DOM scraping; fuzzy text selector healing; coordinates recorded once.

## Consequences and verification

Hosts must maintain semantic IDs. Automatic remappings remain reviewed proposals, especially for risky actions.

See [detailed design](../10-agent-contract.md). Supersede this ADR if new evidence changes the decision; do not rewrite historical rationale silently.
