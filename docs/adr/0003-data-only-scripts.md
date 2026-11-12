# ADR 0003 · Portable scripts are data, not executable code

Status: accepted design direction for draft 0.1.0-draft.1; not implemented.
Date: 5 November 2026.

## Context

Agent-authored content and shared tutorials are untrusted; arbitrary callback serialization expands the authority and portability problem.

## Decision

Versioned closed JSON grammar, semantic target/action references, bounded input, host-owned executable adapters and permissions.

## Alternatives considered

eval-based scripts; serialized JavaScript callbacks; unrestricted browser automation DSL.

## Consequences and verification

Host integration requires a capability registry. Static validation cannot replace authorization or prove an app outcome.

See [detailed design](../05-script-format.md). Supersede this ADR if new evidence changes the decision; do not rewrite historical rationale silently.
