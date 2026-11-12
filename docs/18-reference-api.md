# 18 · Proposed SDK and adapter API

**Design only. There is no package to install or runtime to import yet.** Names below are proposals. The schema and examples are the executable language checks; TypeScript fragments illustrate integration shape, not a completed declaration package.

## Minimal host integration

```ts
const director = createDirector({
  surface: {
    kind: 'managed-dom',
    scene: document.querySelector<HTMLElement>('#tour-scene')!,
  },
  overlay: document.querySelector<HTMLElement>('#tour-overlay')!,
  targets: {
    'settings.save': {
      label: 'Save settings',
      resolve: () => document.querySelector('[data-tour="save"]'),
      sensitivity: 'public',
    },
  },
  policy: { network: 'deny', effects: 'deny' },
});

const result = await director.load(script);
if (!result.ok) showDiagnostics(result.diagnostics);
// The host's real Play button calls director.play().
```

Validate required nodes instead of actually relying on non-null assertions in application production code. A future convenience overload may accept a lazy resolver directly; all overloads normalize to one target contract.

## Core types

```ts
type Mode = 'watch' | 'try' | 'guide';
type Result<T> =
  | { ok: true; value: T; revision: number }
  | { ok: false; diagnostics: Diagnostic[]; revision: number };

interface Director {
  load(script: unknown, options?: { signal?: AbortSignal }): Promise<Result<PreparedPlan>>;
  play(): Promise<Result<{ runId: string }>>;
  pause(): void;
  stop(): void;
  seek(position: { sceneId: string; timeMs: number }): Promise<Result<Position>>;
  setMode(mode: Mode): Promise<Result<Mode>>;
  setRate(rate: number): Result<number>;
  setCaptions(options: { enabled: boolean; locale?: string }): Result<void>;
  setMotion(enabled: boolean): void;
  getSnapshot(): SessionSnapshot;
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
  onEvent(listener: (event: DirectorEvent) => void): () => void;
  waitForCompletion(runId: string): Promise<RunCompletion>;
  destroy(): void;
}
```

`play()` resolves after playback starts, not after the whole interactive tour finishes. `waitForCompletion` reports completed/cancelled/failed for a specific run and never confuses a later run with an earlier one. Stop is idempotent. Destroy releases synchronous engine-owned resources and aborts pending work; it cannot synchronously undo an external transaction.

Commands are serialized through the session state machine. Immediate safety commands can interrupt a pending prepare/seek. Programmatic APIs and UI controls use the same transition rules.

## Target contract

```ts
interface TargetDescriptor {
  label: string;
  purpose?: string;
  sensitivity: 'public' | 'private' | 'secret';
  resolve(context: ResolveContext): Element | VirtualTarget | null;
  reveal?: string; // registered capability ID; not code in a JSON script
}

interface VirtualTarget {
  kind: 'virtual';
  geometry(context: GeometryContext): GeometryResult;
}
```

A geometry result identifies its coordinate space, revision, bounds/quad, visibility, and whether it is approximate. “No target,” “not yet ready,” “clipped,” and “unsupported transform” are different outcomes. Secret targets are not discoverable to an agent and should normally be excluded from tours entirely.

## Host actions and conditions

```ts
interface HostAction<Input, Output> {
  inputSchema: object;
  impact: 'read' | 'ephemeral' | 'persistent';
  modes: Mode[];
  retry: 'never' | 'idempotent';
  execute(input: Input, context: {
    signal: AbortSignal;
    runId: string;
    visitId: string;
    idempotencyKey: string;
  }): Promise<Output>;
  reconcile?: (idempotencyKey: string) => Promise<ActionOutcome<Output>>;
}

interface HostCondition {
  semantics: 'level' | 'edge';
  snapshot(): ConditionSnapshot;
  subscribe(listener: (value: ConditionSnapshot) => void): () => void;
}
```

The host separately registers authorization logic. An input schema does not authorize an operation. The runtime's effect ledger does not replace server idempotency. An edge condition includes a revision/event identity so the runtime can distinguish a prior success from a new outcome.

## Assets and checkpoints

`AssetResolver.resolve(assetId, signal)` returns an approved resource and metadata, not unrestricted network access. `CheckpointAdapter.capture/restore/verify` is optional, versioned, and scoped to a fixture or explicit host state. A host without checkpoint support still supports visual scenes; it cannot promise arbitrary stateful seeking.

## Events

Events include `prepared`, `playback-started`, `paused`, `scene-entered`, `visual-settled`, `gate-entered`, `condition-satisfied`, `action-requested`, `action-completed`, `action-outcome-unknown`, `seek-blocked`, `diagnostic`, `completed`, and `destroyed`. Each carries run/scene/visit IDs when applicable, sequence, scene time, and redacted details. High-frequency geometry/frame events are development opt-ins, not default analytics.

## Defaults

No autoplay on construction. No network or effects without host policy. Respect reduced motion. No unlimited zoom. No automatic schema fetching. No arbitrary HTML in annotations. No automatic DOM reparenting. No retry of a persistent action with unknown outcome. A missing required target pauses with a diagnostic. Controls remain available outside the camera scene.

## Error style and cancellation

Expected failures use Result/Diagnostic rather than throwing an unstructured string. Programmer errors such as using a destroyed instance may throw a documented error or return a stable result consistently; settle that choice in implementation before publication. Abort and stop must not produce unhandled promise rejections. Resource cleanup occurs even when a plugin callback throws.

## Plugin boundary

A future plugin declares version, capabilities, owned properties, clock behavior, cleanup, and privacy impact. Plugins do not automatically receive all targets or actions. Plugins that cannot be sampled/seeking safely must declare that limitation and may introduce an explicit state barrier. Do not make arbitrary plugin lifecycle callbacks part of portable JSON.
