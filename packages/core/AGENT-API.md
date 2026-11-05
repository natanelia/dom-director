# In-process agent API

`createAgentBridge` implements the ten commands in the canonical draft agent-command schema: getCapabilities, discoverTargets, validate, preview, inspect, load, play, pause, seek and stop. This is an in-process adapter, not an MCP server, browser extension, authenticated network transport or autonomous model provider. It installs no globals and makes no network requests itself.

```js
import {createAgentBridge, AGENT_PROTOCOL_VERSION} from './src/index.js';
const bridge = createAgentBridge(director, {
  clientId: 'support-agent', // Bound by trusted host code, not by an incoming message.
  targetIds: ['app.overview', 'app.review'],
  capabilities: guidance.catalog(), // Host-approved descriptive metadata only.
  authorize: async (request, signal) => hostPolicy.allows(request),
});
const result = await bridge.handle(JSON.stringify({
  protocolVersion: AGENT_PROTOCOL_VERSION,
  requestId: 'request-1', sessionId: director.sessionId,
  command: 'inspect', params: {},
}));
bridge.destroy();
```

The default authorizer denies every command, including reads. The host can narrow `commands`; getCapabilities calls them offered, not granted, because each request still needs authorization. Target discovery intersects public registry metadata with the explicit `targetIds` allowlist. It never resolves a DOM element or returns its text, input value or geometry. Private and secret registry targets are not exposed by this bridge. Loading a tour checks the same target intersection; knowing an ID cannot grant access.

Incoming messages must be JSON strings. The shared parser rejects duplicate/reserved keys, invalid Unicode, non-finite values, functions, excessive depth/nodes and inputs above 1 MiB. The embedded canonical schema rejects extra fields and arbitrary method names. A closed command switch replaces dynamic method dispatch. Validate and preview are static: they compile data without resolving targets, fetching assets or executing actions. They explicitly report that live target binding is unchecked. Load prepares but never automatically plays.

Load, play and seek require an exact expectedRevision, rechecked after asynchronous authorization. Stale commands return REVISION_CONFLICT without executing. Pause and stop accept stale revisions but still require host permission. All execution grants should be bound by the host to the reviewed script and current user intent. An agent playback grant cannot override guidance/effect authorization, action idempotency, seek barriers or browser autoplay policy.

Request IDs are deduplicated for one host-bound client/bridge lifetime. A different payload with the same ID is rejected; an identical retry receives the original result and never repeats the command. Canonical SHA-256 fingerprints avoid retaining completed request payloads. Cached results are reauthorized before being disclosed. Use new IDs for fresh reads: a repeated inspect ID intentionally returns its original snapshot. This is not distributed exactly-once delivery across bridge recreation, page reload or process failure; persistent application effects still require their own host ledger and server idempotency.

Defaults: 128 retained requests, eight concurrent commands plus two reserved safety-command slots, a 4 MiB serialized ledger budget, 64 KiB maximum reply, and a five-second authorization deadline. Records are never silently evicted. A full ledger requires a new authorized session; the host's native pause/stop controls remain independent of the bridge. Cancellation, timeout or revocation prevents late authorization from executing. Trusted host callbacks must honor AbortSignal and remain bounded; the adapter cannot reclaim resources held by arbitrary host code that ignores cancellation.

Inspect returns a fixed state summary, not captions, transcripts, DOM contents, action arguments, effect keys or an application-state dump. Host exceptions become value-redacted diagnostics. Catalog descriptions and script text remain data, never privileged instructions. A transport added later must authenticate the client, enforce origin/rate policy and version its threat model separately; a clientId string alone is not authentication.

## Target repair

`proposeTargetRepair(script, {alias, replacement, reason}, approvedCatalog)` returns a frozen proposal containing a base-script SHA-256 hash, affected cue IDs, and narrow JSON Patch test/replace operations. The replacement must be an explicit, unique approved ID. There is no selector guessing, DOM inspection, automatic application or implicit approval. The host reviews the proposal, checks its base hash against the current script, applies the data change, recompiles and loads a new revision through normal authorization.

This helper is not an additional wire command: proposeRepair remains outside the current draft command envelope. No repair can authorize a destructive action merely by claiming confidence.

## Evidence and limits

28 pure tests cover default-deny policy, bounded JSON, redaction, allowlists, revisions, concurrent deduplication, replay authorization, timeouts, revocation, safety slots, ledger saturation and repair proposals. Seven browser integration cases exercise the real director/registry/guidance path. Check the PR checks for the measured Chromium/Firefox/WebKit results. No remote transport or live model integration is claimed.
