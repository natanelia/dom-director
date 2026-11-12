# Security and privacy

DOM Director is an implementation candidate. Report a suspected vulnerability through the repository's available private security-reporting channel when enabled; do not put credentials, private scripts or customer DOM in a public issue. Where no private channel is configured, contact the repository owner before sharing sensitive reproduction details.

## Boundaries

Portable scripts are bounded JSON, not callbacks, selectors or executable methods. The compiler uses embedded repository-owned schemas. Semantic targets, media sources, conditions and effects are separately registered by the host. Agent discovery returns approved metadata, not arbitrary DOM values. Secret targets cannot be resolved; private target use requires an explicit host grant.

Agent authorization defaults to deny and is rechecked after asynchronous work. Mutating commands use revisions and request identity; repeated requests cannot silently change their payload. Native host controls remain available when bounded ledgers are full. The bridge is in-process; it does not provide authenticated remote/MCP transport.

Actions require host validation and authorization. Persistent effects require Guide mode and idempotency or reconciliation. A script capability list is only a declaration. Visual seek and simulated cursor gestures never create consent or replay actions. Cancellation after dispatch can leave an unknown outcome; the host must reconcile it before retry. Exactly-once execution across arbitrary services is not promised.

Checkpoints retain bounded in-memory visual state and verify script/host/fixture versions. They do not restore business data. The default runtime installs no telemetry, recording, storage or network transport. Opted-in narration can request a host-authorized source; adapters can do work only within the host policy supplied to them.

## Host obligations

Protect actions on the server as well as in the UI. Treat host adapters as trusted code, honor AbortSignals, validate media and target boundaries, and return explicit completion evidence. Keep controls outside the camera and supply an appropriate overlay for native top-layer UI. Do not expose a privileged bridge to untrusted origins without a separately reviewed authentication and transport design.

The strict CSP test permits same-origin modules and inline styles, but no eval, inline scripts or connection grants. A host with a stricter style policy needs its own integration work. GitHub Pages headers are not asserted to match that fixture.

## Release review

Adversarial unit and real-browser cases cover parser limits, reserved/duplicate keys, malformed clocks, stale completion, target visibility, denied effects, revision races, request retention and cleanup. These are implementation evidence, not an independent penetration test. See the [release-candidate report](docs/release-candidate.md), relevant PR review comments and current CI. Never put real user data in retained test artifacts.
