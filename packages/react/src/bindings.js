import {createDirectorStore} from './store.js';
const EMPTY = Object.freeze({});

/** Dependency-injected bindings; the normal entry imports the host's React/core peers. */
export function createReactBindings(React, core) {
  const {createElement,createContext,useContext,useEffect,useMemo,useRef,useState,useCallback,useSyncExternalStore} = React;
  const DirectorContext = createContext(null);
  function useDirector({script = null, options = EMPTY, onDiagnostic} = EMPTY) {
    const [viewport,viewportRef] = useState(null), [scene,sceneRef] = useState(null), [overlay,overlayRef] = useState(null);
    const [director,setDirector] = useState(null), [error,setError] = useState(null);
    const current = useRef(null), reporter = useRef(onDiagnostic);
    useEffect(() => {reporter.current = onDiagnostic;},[onDiagnostic]);
    const report = useCallback(value => {
      setError(value);
      try {reporter.current?.(value);} catch { /* Host reporting must not interfere with cleanup. */ }
    },[]);
    useEffect(() => {
      if (!viewport || !scene || !overlay) return;
      let instance;
      try {
        instance = core.createDirector({...options,surface:{...options.surface,viewport,scene,overlay}});
        current.current = instance;setDirector(instance);setError(null);
      } catch (cause) {
        const value = core.DirectorError && cause instanceof core.DirectorError ? cause.diagnostic :
          Object.freeze({code:'REACT_PREPARE_FAILED',message:'The walkthrough could not be prepared.',phase:'integration',severity:'error',path:'',recoveries:Object.freeze(['stop'])});
        report(value);
      }
      return () => {
        if (current.current === instance) current.current = null;
        instance?.destroy();setDirector(value => value === instance ? null : value);
      };
    },[viewport,scene,overlay,options,report]);
    useEffect(() => {
      if (!director || current.current !== director || script === null) return;
      const result = director.load(script);
      if (!result.ok) report(result.diagnostics[0]);else setError(null);
    },[director,script,report]);
    return {director,error,viewportRef,sceneRef,overlayRef};
  }
  function useDirectorState(director) {
    const store = useMemo(() => createDirectorStore(director),[director]);
    return useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
  }
  function useDirectorFrame(director, callback) {
    const latest = useRef(callback);
    useEffect(() => {latest.current = callback;},[callback]);
    useEffect(() => {
      if (!director || director.inspect().status==='destroyed') return;
      return director.onFrame(value => latest.current?.(value));
    },[director]);
  }
  /** A ref owns a registry binding; callback refs cover both React 18 and 19 lifecycles. */
  function useDirectorTarget(registry,id,{label=id,sensitivity='public',dynamic=false} = EMPTY) {
    return useMemo(() => {
      let unregister = null;
      return element => {
        unregister?.();unregister = null;
        if (element && registry) unregister = registry.register(id,{label,sensitivity,dynamic,resolve:() => element});
      };
    },[registry,id,label,sensitivity,dynamic]);
  }
  function DirectorControls({director,id,className,style} = EMPTY) {
    const container = useRef(null);
    useEffect(() => {
      if (!director || !container.current || director.inspect().status==='destroyed') return;
      const controls = core.mountControls(director,container.current);
      return () => controls.destroy();
    },[director]);
    return createElement('div',{ref:container,id,className,style});
  }
  function DirectorProvider({director,children}) {
    return createElement(DirectorContext.Provider,{value:director},children);
  }
  const useDirectorContext = () => useContext(DirectorContext);
  return {useDirector,useDirectorState,useDirectorFrame,useDirectorTarget,DirectorControls,DirectorProvider,useDirectorContext};
}
