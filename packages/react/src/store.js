export const EMPTY_DIRECTOR_STATE = Object.freeze({status:'unmounted',sessionId:null,revision:-1});
const serverSnapshot = () => EMPTY_DIRECTOR_STATE;

/** Semantic snapshots only. Animation frames remain outside React's render loop. */
export function createDirectorStore(director) {
  let cached = EMPTY_DIRECTOR_STATE, key = '', off = null;
  const listeners = new Set();
  const getSnapshot = () => {
    if (!director) return EMPTY_DIRECTOR_STATE;
    const state = director.inspect();
    const next = JSON.stringify([state.revision,state.runId,state.status,state.sceneId,state.visitId,state.mode]);
    // A constructor can emit before the owner publishes the new session. Include
    // semantic identity/status, not frame time, so the settled snapshot is visible.
    if (cached === EMPTY_DIRECTOR_STATE || next !== key) {
      key = next;cached = Object.freeze({...state});
    }
    return cached;
  };
  const subscribe = listener => {
    if (!director || director.inspect().status==='destroyed') return () => {};
    const token = () => listener();listeners.add(token);
    if (!off) off = director.on(() => {getSnapshot();for (const notify of [...listeners]) notify();});
    let active = true;
    return () => {
      if (!active) return;active = false;listeners.delete(token);
      if (!listeners.size) {off?.();off = null;}
    };
  };
  return Object.freeze({getSnapshot,getServerSnapshot:serverSnapshot,subscribe});
}
