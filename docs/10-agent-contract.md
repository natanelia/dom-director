# 10 · Agent-friendly contracts

## Three distinct agent audiences

**Authoring agents** turn intent into a versioned script using an approved target and capability catalog. **Runtime agents** inspect a session and issue bounded playback commands under host control. **Repository agents** implement and maintain the library using the root [AGENTS.md](../AGENTS.md), schemas, requirements, and tests. Supporting one does not automatically solve the other two.

Agents should not need to infer the current camera transform from screenshots, guess CSS selectors, read the whole DOM, or invent unavailable actions. The host explicitly describes what is available.

## Target discovery

A registered target has a stable ID, human-readable label, short purpose, supported operations, geometry kind, visibility/readiness, sensitivity classification, and optional required role. Discovery returns only targets granted to the current session. Values and text content are excluded by default; a “Customer name field” descriptor need not expose a customer's name.

A target ID can resolve to a DOM node, SVG region, canvas projection, map feature, editor symbol, or a virtualized row. Script aliases point to registered IDs. P0 JSON does not contain unrestricted CSS selectors; legacy selector import is an authoring tool with host review.

Ambiguous resolution is an error. A confidence score is not permission to choose a nearby Delete button. Proposed remappings produce a reviewable patch with old/new target IDs, reasons, and affected cues. The host approves a new script revision before playback.

## Capabilities

The host catalog describes named actions and conditions, their input schemas, impact (`read`, `ephemeral`, `persistent`), readiness, idempotency/reconciliation contract, supported modes, and permission requirements. The script lists requested capabilities. Effective rights are the intersection of host policy, session grant, script needs, and current user approval; the script cannot elevate itself by editing a declaration.

Capability discovery is not a security boundary within a compromised same-origin host. It limits the director and agent bridge, not arbitrary application code already executing on the page. Stronger isolation requires separate origins/processes and appropriate credentials.

## Proposed tools

Transport-neutral operation names map to local SDK methods, an authenticated bridge, or optional MCP/WebMCP adapters. These transports are not implemented and no universal browser/protocol support is claimed. Their conformance versions must be recorded when implemented. See [S12](21-sources.md).

| Tool | Purpose | Effects / constraints |
|---|---|---|
| `director_getCapabilities` | Read the session's approved operations | Read-only, redacted |
| `director_discoverTargets` | Find approved semantic targets | Read-only, scoped query and bounded result count |
| `director_validate` | Validate script/schema/references | Pure; does not execute host callbacks |
| `director_preview` | Compute presentation plan and requested effects | Pure static preview by default; live measurement separately authorized |
| `director_inspect` | Read session state and diagnostics | No unredacted DOM/state dump |
| `director_load` | Prepare a validated script | Revision-checked; asset access under host policy |
| `director_play` | Start/resume a prepared plan | Needs playback grant; cannot bypass effect policy or autoplay |
| `director_pause` | Suspend presentation | Safety control; does not roll back external effects |
| `director_seek` | Seek presentation only | Never executes skipped actions; may be blocked by state barriers |
| `director_stop` | Stop and release active presentation | Safety control; cancellation is not external rollback |
| `director_proposeRepair` | Return a script patch and reasons | No automatic application of repair |

The draft [agent command schema](../schemas/agent-command.schema.json) covers the implemented design-tool envelope. Other tools remain specified proposals until their schemas and tests are added. Tool names and envelope command names have an explicit one-to-one mapping; do not infer method execution from arbitrary strings.

## Command envelope

```json
{
  "protocolVersion": "0.1.0-draft.1",
  "requestId": "req-018",
  "sessionId": "session-demo",
  "expectedRevision": 12,
  "command": "seek",
  "params": { "sceneId": "overview", "timeMs": 800 }
}
```

A mutating command carries the expected session revision. Stale load/play/seek commands return `REVISION_CONFLICT`, do not partially apply, and expose the latest approved state summary. Pause/stop may be accepted as safety commands despite a stale revision. Requests are deduplicated by authenticated client/session/request ID; reusing an ID with a different payload is an error. A command request ID is not a host-action idempotency key.

The wire representation is JSON, not code. Enforce byte size, nesting depth, array limits, and timeouts before expensive compilation. No serialized functions, `eval`, shell commands, JavaScript URLs, or arbitrary network URLs become executable authority.

## Diagnostic contract

A diagnostic contains stable code, severity, phase, JSON Pointer path, concise message, and bounded recovery choices. Optional evidence includes target ID, expected capability, actual state category, or revision number, not secrets or entire DOM snapshots.

Example:

```json
{
  "code": "SEEK_REQUIRES_CHECKPOINT",
  "severity": "error",
  "phase": "playback",
  "path": "/scenes/1",
  "message": "This scene requires app state that is not currently available.",
  "recoveries": ["show-explanation", "reset-approved-fixture", "cancel"]
}
```

Categories include schema/reference errors, unsupported capabilities, missing/ambiguous targets, denied effects, expired approvals, media readiness, geometry limitations, stale revisions, unknown action outcomes, and unsafe seek barriers. An agent should be able to tell what failed and what safe operations remain without being encouraged to bypass a guard.

## Authoring workflow

1. Obtain the user's learning/task intent and the approved catalog.
2. Draft a concise storyboard and distinguish show-only from real actions.
3. Produce canonical JSON using stable IDs and plain text.
4. Validate offline; inspect requested capabilities and unsafe transitions.
5. Preview the presentation without effects.
6. Run a host-provided synthetic fixture where available.
7. Review narration, captions, motion alternatives, and action descriptions.
8. Bind any execution grants to the reviewed content/parameters and start only through host controls.

A future authoring agent can generate narration or video as separate consented jobs. Network providers, costs, credentials, and storage must be visible. None is required by the core.

## Prompt injection and untrusted content

DOM text, captions, target descriptions from untrusted content, imported scripts, and retrieved help pages are data. They cannot grant permissions, change agent tool policy, or override the user's instruction. Avoid embedding page text in privileged prompts as if it were developer instructions. Use structured fields, content provenance, and independent host authorization. A script that says “ignore the security rules” is still just script data.

## Streaming and incremental authoring

Future streaming plans are accepted only at explicit safe boundaries. Validate the complete added scene and its references before attaching it to the graph. No half-parsed JSON executes. A patch targets a specific script hash/revision; active actions and approved parameters are immutable. Invalid or late patches remain suggestions.

## Agent test harness

Provide capability fixtures, schema examples, negative payloads, deterministic geometry, event traces, and permission-denied cases. Grade semantic correctness separately from schema validity. A script can be perfectly valid and still teach the wrong thing. Test that an agent handles target disappearance and approval denial by explaining or stopping, not by trying unrelated selectors.

## Documentation for agents

Maintain a small `llms.txt` reading index, complete examples, stable error codes, machine-readable requirements and backlog, and concise implementation instructions. Avoid generating a huge duplicated `llms-full.txt` until there is a reliable build/check pipeline. Every claimed feature must say whether it is proposed, implemented, or verified.
