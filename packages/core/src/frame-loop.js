/** Keep one pending frame. Repeated commands must not postpone its delivery. */
export function createFrameLoop(scheduler, running, tick, onError) {
  let pending = null, epoch = 0, destroyed = false;
  function cancel() {
    epoch++;
    if (pending !== null) scheduler.cancel(pending);
    pending = null;
  }
  function sync() {
    if (destroyed || !running()) { cancel(); return; }
    if (pending !== null) return;
    const generation = epoch;
    pending = scheduler.request(() => {
      if (destroyed || generation !== epoch) return;
      pending = null;
      try { if (running()) tick(); } catch (error) { onError(error); }
      finally { sync(); }
    });
  }
  return {sync, destroy() { if (!destroyed) { destroyed = true; cancel(); } }};
}
