import {DirectorError, requireValue, diagnostic} from './errors.js';

const managers = new WeakSet();
const uncertain = new Set(['pending', 'authorizing', 'unknown']);
const fail = (code, message) => new DirectorError(code, message, 'checkpoint');
const validVersion = value => typeof value === 'string' && value.length > 0 && value.length <= 128;

/** In-memory, same-run visual resume. Never snapshots DOM, restores host data, or replays effects. */
export function createCheckpointStore(director, {
  versions, verify, authorize = () => false, maxCheckpoints = 16, maxBytes = 1048576, timeoutMs = 5000,
} = {}) {
  requireValue(director && ['inspect', 'describe', 'on', 'pause', 'seek'].every(key => typeof director[key] === 'function'),
    'CHECKPOINT_OPTIONS', 'A director is required.');
  requireValue(typeof versions === 'function' && typeof verify === 'function' && typeof authorize === 'function' &&
    Number.isInteger(maxCheckpoints) && maxCheckpoints > 0 && maxCheckpoints <= 1000 &&
    Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= 16777216 &&
    Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 30000,
    'CHECKPOINT_OPTIONS', 'Provide bounded storage, a deadline, versions and host verification.');
  requireValue(!managers.has(director), 'CHECKPOINT_OWNER', 'A checkpoint store already owns this director.');
  managers.add(director);
  const entries = new Map();
  let serial = 0, disposed = false, operation = null, retainedBytes = 0;
  function live() { requireValue(!disposed, 'DESTROYED', 'The checkpoint store was destroyed.'); }
  function version() {
    const value = versions();
    requireValue(value && ['script', 'host', 'fixture'].every(key => validVersion(value[key])),
      'CHECKPOINT_VERSION', 'Explicit script, host and fixture versions are required.');
    return Object.freeze({script: value.script, host: value.host, fixture: value.fixture});
  }
  function safeState() {
    const state = director.inspect();
    requireValue(state.runId && !['destroyed', 'idle', 'error'].includes(state.status), 'CHECKPOINT_STATE', 'Load a healthy tour first.');
    requireValue(!state.waitingFor && !state.pendingOperation && !state.effects?.some(effect => uncertain.has(effect.state)),
      'CHECKPOINT_BUSY', 'Resolve pending conditions, preparation and uncertain effects first.');
    return state;
  }
  function sameVersions(a, b) { return ['script', 'host', 'fixture'].every(key => a[key] === b[key]); }
  function check(token) {
    live();requireValue(operation === token && !token.controller.signal.aborted, 'CANCELLED', 'Checkpoint operation was cancelled.');
    requireValue(director.describe() === token.description && director.inspect().runId === token.runId,
      'CHECKPOINT_INCOMPATIBLE', 'The loaded script or run changed.');
  }
  function request(kind, record, currentVersions) {
    return Object.freeze({capability: 'checkpoint:' + kind, checkpointId: record?.id || null,
      sessionId: director.sessionId, runId: director.inspect().runId,
      scriptId: director.describe()?.id, versions: currentVersions});
  }
  async function execute(kind, id, signal) {
    let token, timer, off, abort;
    try {
      live();requireValue(!operation, 'CHECKPOINT_BUSY', 'Another checkpoint operation is pending.');
      const before = safeState(), record = kind === 'restore' ? entries.get(id) : null;
      if (kind === 'capture') requireValue(entries.size < maxCheckpoints, 'CHECKPOINT_FULL', 'Remove a checkpoint before capturing another.');
      else requireValue(record, 'CHECKPOINT_UNKNOWN', 'The checkpoint is not available.');
      token = {controller: new AbortController(), description: director.describe(), runId: before.runId, expected: ['paused']};
      operation = token;
      abort = () => token.controller.abort();
      signal?.addEventListener('abort', abort, {once: true});if (signal?.aborted) abort();
      off = director.on(event => {
        if (token.expected[0] === event.type) token.expected.shift();
        else token.controller.abort(); // Includes Stop, reload, mode changes and user takeover.
      });
      check(token);
      const paused = director.pause();requireValue(paused.ok, 'CHECKPOINT_STATE', 'The tour could not be paused.');
      check(token);requireValue(token.expected.length === 0, 'CHECKPOINT_STATE', 'Pause was not confirmed.');
      const current = safeState(), currentVersions = version(), req = request(kind, record, currentVersions);
      if (record) {
        requireValue(record.description === token.description && record.summary.runId === current.runId &&
          record.summary.mode === current.mode && sameVersions(record.summary.versions, currentVersions),
          'CHECKPOINT_INCOMPATIBLE', 'Script, run, mode or host versions no longer match.');
        requireValue(record.path.every((visit, index) => current.path[index]?.visitId === visit.visitId && current.path[index]?.sceneId === visit.sceneId),
          'CHECKPOINT_PATH', 'The selected branch no longer contains this checkpoint.');
        requireValue(record.effects === JSON.stringify(current.effects || []), 'CHECKPOINT_EFFECTS_CHANGED',
          'Effect evidence changed; a checkpoint cannot undo or replay effects.');
      }
      const cancelled = new Promise((_, reject) => {
        const rejectAbort = () => reject(fail('CANCELLED', 'Checkpoint operation was cancelled.'));
        token.controller.signal.addEventListener('abort', rejectAbort, {once: true});
        token.removeAbort = () => token.controller.signal.removeEventListener('abort', rejectAbort);
        if (token.controller.signal.aborted) rejectAbort();
        timer = setTimeout(() => token.controller.abort(), timeoutMs);
      });
      await Promise.race([cancelled, (async () => {
        check(token);
        requireValue(await authorize(req, token.controller.signal) === true, 'CAPABILITY_DENIED', 'The host denied this checkpoint operation.');
        check(token);
        // Host callbacks receive metadata only; they must be read-only and honor cancellation.
        const proof = record?.summary || Object.freeze({sceneId: current.sceneId, timeMs: current.timeMs, mode: current.mode, versions: currentVersions});
        requireValue(await verify(proof, token.controller.signal) === true, 'CHECKPOINT_INCOMPATIBLE', 'The host could not verify compatible state.');
        check(token);
        requireValue(await authorize(req, token.controller.signal) === true, 'CAPABILITY_DENIED', 'Checkpoint permission is no longer valid.');
        check(token);
      })()]);
      check(token);
      requireValue(sameVersions(currentVersions, version()), 'CHECKPOINT_INCOMPATIBLE', 'Host versions changed during verification.');
      const latest = safeState();
      requireValue(latest.revision === current.revision && latest.mode === current.mode &&
        JSON.stringify(latest.effects || []) === JSON.stringify(current.effects || []),
        'CHECKPOINT_STATE_CHANGED', 'The session changed during verification.');
      if (kind === 'capture') {
        const checkpointId = 'checkpoint.' + (++serial);
        const summary = Object.freeze({id: checkpointId, scriptId: token.description.id, locale: token.description.locale,
          sessionId: director.sessionId, runId: current.runId, sceneId: current.sceneId, visitId: current.visitId,
          timeMs: current.timeMs, mode: current.mode, versions: currentVersions});
        const path = current.path.map(visit => ({...visit})), effects = JSON.stringify(current.effects || []);
        const bytes = 2 * (JSON.stringify(summary).length + JSON.stringify(path).length + effects.length);
        requireValue(retainedBytes + bytes <= maxBytes, 'CHECKPOINT_FULL', 'The checkpoint text budget is full.');
        entries.set(checkpointId, {id: checkpointId, summary, description: token.description, path, effects, bytes});
        retainedBytes += bytes;
        return {ok: true, value: summary};
      }
      token.expected = ['paused', 'seeked'];
      const result = director.seek({sceneId: record.summary.sceneId, timeMs: record.summary.timeMs});
      check(token);if (!result.ok) return result;
      requireValue(token.expected.length === 0, 'CHECKPOINT_STATE', 'Visual restore was not confirmed.');
      return {ok: true, value: director.inspect()}; // Remains paused; current accessibility preferences win.
    } catch (error) {
      return {ok: false, diagnostics: [diagnostic(error, 'checkpoint')]};
    } finally {
      clearTimeout(timer);off?.();signal?.removeEventListener('abort', abort);token?.removeAbort?.();
      if (operation === token) operation = null;
    }
  }
  return Object.freeze({
    capture({signal} = {}) { return execute('capture', null, signal); },
    restore(id, {signal} = {}) { return execute('restore', id, signal); },
    list() { live();return [...entries.values()].map(entry => entry.summary); },
    remove(id) { live();requireValue(!operation, 'CHECKPOINT_BUSY', 'A checkpoint operation is pending.');const entry = entries.get(id);if (!entry) return false;retainedBytes -= entry.bytes;return entries.delete(id); },
    clear() { live();requireValue(!operation, 'CHECKPOINT_BUSY', 'A checkpoint operation is pending.');entries.clear();retainedBytes = 0; },
    destroy() { if (disposed) return;disposed = true;operation?.controller.abort();entries.clear();retainedBytes = 0;managers.delete(director); },
  });
}
