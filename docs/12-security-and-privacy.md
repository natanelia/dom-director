# 12 · Threat model, permissions, and privacy

## Assets and trust boundaries

Protect the host's data and credentials, user intent, action authority, private screen content, browser performance, and the ability to exit. Trusted components are the host policy implementation and reviewed engine code. Scripts, agent output, imported text/media metadata, target labels from untrusted content, and remote messages are untrusted inputs.

Running a library in a same-origin application does not create an isolation boundary against arbitrary code already present there. A fixture that shares production credentials or backend access is not safe merely because it looks like a demo. Separate origin/storage/backend permissions when meaningful isolation is needed.

## Threats and controls

| Threat | Required control |
|---|---|
| Agent-generated script invokes privileged business action | Host-owned allowlist, input schema, grant, precondition, confirmation when required |
| Script embeds JavaScript/HTML or malicious asset URL | Data-only grammar, plain-text rendering, URI scheme/origin policy, no dynamic code execution |
| Caption or page text contains prompt injection | Treat as content, preserve provenance, do not change privileged instructions/policy |
| Scrubbing repeats a purchase/save/delete | Effect ledger, state barriers, presentation-only seek, host idempotency/reconciliation |
| Confused-deputy cross-frame message | Exact origin and source verification, explicit session binding, capability scope, freshness checks |
| Agent reads sensitive DOM | Allowlisted semantic discovery; no arbitrary page dump; field-level redaction |
| Recording/export leaks private content | Separate capture grant, local pre-redaction, reviewable export manifest, isolated fixture preferred |
| Huge script freezes the page | Size/depth/cue limits, bounded validation, deadlines, worker option after measurement |
| Stale agent command overrides user control | Session revision check, user-owned control priority, expiring control lease |
| Replay/retry duplicates network effects | Host idempotency key and status query; unknown outcome blocks retries |
| Malicious preview app accesses secrets | Isolated origin/profile and no production credentials in capture/test runner |
| Imported CSS hides player or permission UI | Dedicated host-controlled UI surface; detect unsafe integration; never place consent inside transformed app |

## Authorization model

A script's `capabilities` list is a request, not a grant. Effective authority is computed by the host. Actions have named inputs and impact classification. A script cannot change an action from persistent to ephemeral. The runtime checks capability availability at load and authorization again immediately before execution.

A grant is bound to user/session, script revision or content hash, action ID, parameter digest, scope, and expiration. A changed script or changed parameters can invalidate an approval. The director does not offer an agent-callable “approve everything” endpoint. User approval lives in host-owned UI and is not satisfied by a simulated cursor or scripted event.

A broad local playback grant is distinct from an action grant. Pause and stop remain accessible even when a grant expires. Revocation blocks new effects, aborts cancellable work, and reports any external work that may already have started.

## Data minimization

By default, no telemetry, recording, network transport, cloud AI, or persistence. Local diagnostics use IDs and categories instead of raw DOM, form values, or screenshots. Passwords, authentication tokens, private keys, and payment fields must never be sampled into scripts or logs. Redaction must happen before serialization/persistence, not only when an export button is clicked.

A privacy mask in a browser overlay is not a universal guarantee for every capture path. The export adapter must prove that its capture output includes masking, or use a fixture that never contains sensitive data. Treat masks as defense in depth, not the sole protection for production secrets.

## Asset and content policy

Resolve asset identifiers through a host policy. Default to bundled/same-origin approved assets. Reject `javascript:` URLs, embedded executable content, and unapproved remote origins. Optional inline data assets need explicit MIME and byte limits. Avoid fetching remote schemas at validation time; bundle known schemas locally.

Plain-text annotations and captions avoid a broad HTML sanitization surface. Rich content is deferred and would require a separately specified safe component registry. Content hashes help detect changes but do not establish that an author or asset is trustworthy. Provenance and signature verification are separate concerns.

## Frame/bridge policy

Same-origin access does not eliminate the need for per-session capability scope. Cross-origin frames require a cooperating bridge or remain opaque. Validate `event.origin` and `event.source`; never use wildcard target origins for privileged messages. Bind the handshake to an unpredictable session nonce and negotiated protocol, then validate every message. A nonce alone is not authorization against a compromised allowed origin.

An optional remote agent service requires authenticated transport, least privilege, rate limits, explicit data-sharing consent, and auditable revocation. Do not expose a global `window.eval`-style convenience endpoint. Browser-local and remote agent bridges have different threat models and must be documented separately. [S8, S12](21-sources.md).

## Capture and export

Browser display capture requires user participation/permission; normal page code cannot silently record arbitrary screens. Export via browser automation belongs to a separate explicitly authorized runner. Capture can contain third-party content and sensitive data, and audio availability varies. [S9](21-sources.md). The core cannot guarantee “export any DOM to perfect video.”

## Privacy-preserving analytics, if added

Opt-in event sink, documented event schema, no persistent user IDs by default, no target text/values, sampling and retention controls, and a complete off switch. Completion statistics are not evidence of learning or comprehension. Aggregate locally where possible. Data flows must be obvious to adopters.

## Abuse resistance and human control

Do not use simulated cursors to impersonate user consent, trick someone into granting permissions, or obscure a risky operation. Narration must accurately describe the action. A guide may explain an unavailable capability but may not encourage bypassing the host's authorization. No fake browser chrome or deceptive confirmation UI.

## Security review gates

Before a usable release: negative schema cases, script size limits, XSS payloads in text fields, malicious target descriptions, stale/replayed commands, invalid origins, duplicate actions, aborted-action races, capture redaction tests, and control visibility under hostile host styles. Record residual risks, especially same-origin trust and external action ambiguity.
