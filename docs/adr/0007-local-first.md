# ADR 0007 · Network-silent core and explicit privacy boundaries

Status: accepted design direction for draft 0.1.0-draft.1; not implemented.
Date: 5 November 2026.

## Context

Tutorials, recordings, and agent tools can expose sensitive application data even when the camera itself is harmless.

## Decision

No default telemetry, recording, cloud AI, or persistence. Scope discovery and authorize all external asset/agent/capture flows.

## Alternatives considered

Hosted-service dependency; automatic analytics; full DOM/session capture by default.

## Consequences and verification

Optional integrations need explicit consent, data-flow documentation, and separate threat models. Same-origin execution is not isolation.

See [detailed design](../12-security-and-privacy.md). Supersede this ADR if new evidence changes the decision; do not rewrite historical rationale silently.
