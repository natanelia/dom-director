# Optional React bindings

Local implementation candidate; not published to npm. React and the core remain peer dependencies, not bundled copies. Importing or server-rendering the adapter does not read `window`/`document`, construct a surface, or play a tour. The normal entry is a client-component boundary for frameworks using React Server Components; ordinary server rendering remains supported.

```jsx
import {useMemo} from 'react';
import {useDirector, useDirectorState, DirectorControls} from '@dom-director/react';

export function Tour({script}) {
  // Keep construction policy stable. Changing options deliberately rebuilds the owner.
  const options = useMemo(() => ({
    targets: {'app.save': () => document.querySelector('[data-tour="save"]')},
  }), []);
  const {director, error, viewportRef, sceneRef, overlayRef} = useDirector({script, options});
  const state = useDirectorState(director);
  return <>
    <div ref={viewportRef} style={{position:'relative',height:500,overflow:'hidden'}}>
      <div ref={sceneRef} style={{width:1100,height:500}}><YourApplication /></div>
    </div>
    <div ref={overlayRef} style={{position:'fixed',inset:0,pointerEvents:'none'}} />
    <DirectorControls director={director} />
    <output>{error?.message || state.status}</output>
  </>;
}
```

The host supplies an intentional scene root and a separate overlay. Existing application DOM is never reparented. The hook creates the director only after all three refs attach, loads each new script identity without autoplay, and destroys its owned instance on cleanup. Memoize construction `options` and generated scripts; passing new objects every render intentionally requests new preparation. Do not destroy the owned director yourself; unmount the hook instead. Guidance, narration resolvers and registries supplied in options remain host-owned.

`useDirectorState(director)` uses `useSyncExternalStore` with cached semantic snapshots. Frame time alone never invalidates its snapshot. To update an imperative progress display, use `useDirectorFrame(director, callback)`; it subscribes to frames without scheduling React state updates itself. `DirectorControls` mounts the SDK's native controls in its own empty div. Keep it outside the scene and do not render React children into that owned div.

`DirectorProvider` and `useDirectorContext` share a borrowed director, including through React portals. They do not own its lifecycle. Portal/top-layer placement still follows the core surface contract; context sharing does not make a document overlay paint above a native dialog.

For callback-ref target registration, create a host registry once, pass it to `useDirector`, and use `useDirectorTarget(registry, id, {label, sensitivity, dynamic})` on the actual element. Its ref owns registration and unregisters on detach. IDs must be unique. Missing targets fail explicitly; a remount does not authorize a lookalike replacement or replay an effect. Registries can also use the core's virtual-bounds adapter directly without a React wrapper.

`createReactBindings(React, core)` is the dependency-injected alternative for hosts that already provide those modules. It exposes the same hooks/components, with no globals.

## Validation

Seven dependency-free store tests cover stable snapshots, semantic identity, subscription cleanup and destroyed owners. The separate React CI installs exact test-only versions, bundles a real core consumer, runs three server-rendering cases, and exercises eight browser cases: Strict Mode, stable rerenders, frame isolation, script replacement, portals, ref cleanup, repeated mount/unmount, and hydration. React 18.3.1 is tested in Chromium; React 19.3.1 is tested in Chromium, Firefox and WebKit. Check the PR results before treating that matrix as passed. No physical-device or accessibility certification is implied.

The fixture dependencies are isolated under `react-tests/`; the adapter itself has no runtime dependencies beyond its peers. Installation scripts are disabled for test packages. No registry publication, model provider, telemetry, persistent storage or remote agent transport is configured.
