import {DirectorError, requireValue} from './errors.js';
import {cloneData, freezeData, canonical} from './json.js';

const failure = (code, message) => new DirectorError(code, message);
const check = signal => {
  if (signal.aborted) throw signal.reason instanceof DirectorError ? signal.reason : failure('CANCELLED', 'The operation was cancelled.');
};
const idPattern = /^[A-Za-z][A-Za-z0-9._-]{0,79}$/u;
const modes = ['watch', 'try', 'guide'];

/** Host-only authority. Script capability declarations are never permission grants. */
export function createGuidance({actions = {}, conditions = {}, authorize = () => false, fixture = null,
  maxLedger = 1000, maxLedgerBytes = 4194304, now = () => performance.now(), activity,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id)} = {}) {
  requireValue(typeof authorize === 'function' && Number.isInteger(maxLedger) && maxLedger > 0 && Number.isInteger(maxLedgerBytes) && maxLedgerBytes > 0,
    'GUIDANCE_OPTIONS', 'Invalid host guidance policy.');
  const page = globalThis.document;
  activity ||= {
    isActive: () => !page?.hidden,
    subscribe(listener) { page?.addEventListener('visibilitychange', listener); return () => page?.removeEventListener('visibilitychange', listener); },
  };
  requireValue(typeof activity.isActive === 'function' && typeof activity.subscribe === 'function', 'GUIDANCE_OPTIONS', 'Invalid foreground activity source.');
  const actionMap = new Map(), conditionMap = new Map(), ledger = new Map(), active = new Set();
  const bytes = new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);
  const scope = [...bytes].map(n => n.toString(16).padStart(2, '0')).join('');
  let revoked = false, fixtureUnknown = false, resetting = false, retainedBytes = 0;

  for (const [id, action] of Object.entries(actions)) {
    requireValue(idPattern.test(id) && action && typeof action.execute === 'function' && typeof action.validate === 'function' &&
      ['read', 'ephemeral', 'persistent'].includes(action.impact), 'ACTION_REGISTRATION', 'Actions need an impact, validator and executor.');
    requireValue(action.impact !== 'persistent' || action.idempotent === true || typeof action.reconcile === 'function',
      'ACTION_REGISTRATION', 'Persistent actions require idempotency or reconciliation.');
    const allowed = action.modes || modes;
    requireValue(Array.isArray(allowed) && allowed.length > 0 && allowed.every(mode => modes.includes(mode)), 'ACTION_REGISTRATION', 'Invalid action modes.');
    actionMap.set(id, Object.freeze({...action, modes: Object.freeze([...allowed])}));
  }
  for (const [id, condition] of Object.entries(conditions)) {
    requireValue(idPattern.test(id) && condition && typeof condition.read === 'function' && typeof condition.subscribe === 'function' &&
      ['level', 'edge'].includes(condition.trigger || 'level') && ['acknowledgment', 'ui', 'domain', 'server'].includes(condition.evidence),
      'CONDITION_REGISTRATION', 'Conditions need observation, subscription and an evidence level.');
    const hints = condition.hints || [];
    requireValue(Array.isArray(hints) && hints.length <= 10 && hints.every(hint => typeof hint === 'string' && hint.length <= 2000),
      'CONDITION_REGISTRATION', 'Hints must be bounded, authored text.');
    conditionMap.set(id, Object.freeze({...condition, hints: Object.freeze([...hints]), trigger: condition.trigger || 'level'}));
  }
  function live() { requireValue(!revoked, 'CAPABILITY_REVOKED', 'Host guidance authority has been revoked.'); }
  async function bounded(work, parent, timeoutMs, foreground = false) {
    live();requireValue(Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300000, 'GUIDANCE_TIMEOUT', 'A bounded deadline is required.');
    const controller = new AbortController();active.add(controller);
    let timer = null, unsubscribe = () => {}, remaining = timeoutMs, last = now(), charging = false, closed = false;
    const abort = () => controller.abort(failure('CANCELLED', 'The operation was cancelled.'));
    parent?.addEventListener('abort', abort, {once: true});if (parent?.aborted) abort();
    const deadline = () => {
      if (closed || controller.signal.aborted) return;
      const current = now();
      requireValue(Number.isFinite(current) && current >= last, 'CLOCK_INVALID', 'Deadline time must be monotonic.');
      if (charging) remaining -= current - last;
      last = current;if (timer !== null) clearTimer(timer);timer = null;
      charging = !foreground || activity.isActive() === true;
      if (remaining <= 0) controller.abort(failure('TIMEOUT', 'The host operation exceeded its deadline.'));
      else if (charging) timer = setTimer(() => controller.abort(failure('TIMEOUT', 'The host operation exceeded its deadline.')), remaining);
    };
    const changed = () => { try { deadline(); } catch (error) { controller.abort(error); } };
    let cancel;
    const cancelled = new Promise((_, reject) => {
      cancel = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', cancel, {once: true});if (controller.signal.aborted) cancel();
    });
    try {
      if (foreground) { unsubscribe = activity.subscribe(changed);requireValue(typeof unsubscribe === 'function', 'GUIDANCE_OPTIONS', 'Activity subscription needs cleanup.'); }
      deadline();
      return await Promise.race([Promise.resolve().then(() => { check(controller.signal);return work(controller.signal); }), cancelled]);
    } finally {
      closed = true;if (timer !== null) clearTimer(timer);
      try { if (typeof unsubscribe === 'function') unsubscribe(); } catch { /* Cleanup must not mask the original outcome. */ }
      parent?.removeEventListener('abort', abort);controller.signal.removeEventListener('abort', cancel);active.delete(controller);
    }
  }
  function request(capability, context, cue, args = {}) {
    return freezeData(cloneData({capability, runId: context.runId, sceneId: context.sceneId, visitId: context.visitId,
      mode: context.mode, script: context.script, cueId: cue.id, args}));
  }
  async function grant(req, signal) {
    check(signal);live();requireValue(await authorize(req, signal) === true, 'CAPABILITY_DENIED', 'The host denied this operation.');check(signal);live();
  }
  function wait(condition, context, signal) {
    return new Promise((resolve, reject) => {
      let finished = false, armed = false, unsubscribe = null, pending = null, baseline, lastRevision = -1;
      const read = () => {
        const value = condition.read(context), snapshot = typeof value === 'boolean' ? {satisfied: value} : value;
        requireValue(snapshot && typeof snapshot.satisfied === 'boolean', 'CONDITION_INVALID', 'Conditions must return explicit state.');
        if (condition.trigger === 'edge') {
          requireValue(Number.isFinite(snapshot.revision) && snapshot.revision >= lastRevision && snapshot.revision >= 0,
            'CONDITION_INVALID', 'Edge conditions require monotonic revisions.');
          lastRevision = snapshot.revision;
        }
        return snapshot;
      };
      const finish = (error, value) => {
        if (finished) return;
        if (!armed) { pending = {error, value};return; }
        finished = true;signal.removeEventListener('abort', abort);
        try { unsubscribe?.(); } catch { /* A host cleanup failure cannot report false success or retry an effect. */ }
        error ? reject(error) : resolve(value);
      };
      const abort = () => finish(signal.reason || failure('CANCELLED', 'Condition wait cancelled.'));
      const observe = () => {
        if (finished || pending) return;
        try { check(signal);const value = read();
          if (value.satisfied && (condition.trigger === 'level' || value.revision > baseline.revision)) finish(null, {completed: true, evidence: condition.evidence});
        } catch (error) { finish(error); }
      };
      try {
        check(signal);if (condition.trigger === 'edge') baseline = read();
        signal.addEventListener('abort', abort, {once: true});
        unsubscribe = condition.subscribe(observe, context);
        requireValue(typeof unsubscribe === 'function', 'CONDITION_INVALID', 'Condition subscriptions must return cleanup.');
        armed = true;
        if (signal.aborted) { pending = null;abort(); }
        else if (pending) { const outcome = pending;pending = null;finish(outcome.error, outcome.value); }
        else observe(); // Subscribe before checking; never lose a state change during setup.
      } catch (error) { armed = true;pending = null;finish(error); }
    });
  }
  function validateAction(cue, context) {
    const action = actionMap.get(cue.actionRef);
    requireValue(action, 'ACTION_UNAVAILABLE', 'The action is not registered.');
    requireValue(action.modes.includes(context.mode), 'MODE_DENIED', 'The action is unavailable in this mode.');
    requireValue(action.impact !== 'persistent' || context.mode === 'guide', 'ACTION_MODE_DENIED', 'Persistent actions require guided mode.');
    requireValue(!action.requiresFixture || fixture?.isolated === true, 'FIXTURE_REQUIRED', 'This action requires an isolated fixture.');
    return action;
  }
  const api = {
    isolated: fixture?.isolated === true,
    preflight(script, mode) {
      live();requireValue(modes.includes(mode) && script.modes.includes(mode), 'MODE_UNAVAILABLE', 'Mode is not offered.');
      if (mode === 'try') requireValue(fixture?.isolated === true && typeof fixture.reset === 'function' && !fixtureUnknown && script.capabilities.includes('fixture:reset'),
        'FIXTURE_REQUIRED', 'Try mode requires a declared, resettable isolated fixture.');
      for (const scene of script.scenes) for (const cue of scene.cues) {
        if (cue.kind === 'action') validateAction(cue, {mode});
        if (cue.kind === 'gate') requireValue(conditionMap.has(cue.conditionRef), 'CONDITION_UNAVAILABLE', 'The condition is not registered.');
      }
    },
    async prepareMode(context, parent) {
      api.preflight(context.script, context.mode);
      return bounded(async signal => { await grant(request('mode:' + context.mode, context, {id: 'mode-change'}), signal);return {completed: true}; }, parent, 5000);
    },
    async enter(cue, context, parent) {
      live();requireValue(!resetting && !fixtureUnknown, 'FIXTURE_UNKNOWN', 'Fixture reset must be reconciled before further work.');
      const capability = cue.kind === 'action' ? 'action:' + cue.actionRef : 'condition:' + cue.conditionRef;
      requireValue(['action', 'gate'].includes(cue.kind) && context.script.capabilities.includes(capability), 'CAPABILITY_UNDECLARED', 'The script did not declare this capability.');
      if (cue.kind === 'gate') {
        const condition = conditionMap.get(cue.conditionRef);requireValue(condition, 'CONDITION_UNAVAILABLE', 'The condition is not registered.');
        const req = request(capability, context, cue);
        await bounded(signal => grant(req, signal), parent, Math.min(cue.timeoutMs, 5000));
        let result;
        try { result = await bounded(signal => wait(condition, context, signal), parent, cue.timeoutMs, true); }
        catch (error) { if (error?.diagnostic?.code === 'TIMEOUT' && cue.onTimeout === 'skip-scene') { await bounded(signal => grant(req, signal), parent, Math.min(cue.timeoutMs, 5000));return {skipScene: true}; }throw error; }
        await bounded(signal => grant(req, signal), parent, Math.min(cue.timeoutMs, 5000));return result;
      }
      const action = validateAction(cue, context), req = request(capability, context, cue, cue.args);
      requireValue(action.validate(req.args) === true, 'ACTION_ARGUMENTS', 'Action input did not pass the host validator.');
      const key = scope + ':' + context.runId + ':' + context.visitId + ':' + cue.id;
      const fingerprint = canonical({script: context.script, ref: cue.actionRef, args: req.args, mode: context.mode});
      const previous = ledger.get(key);
      if (previous) {
        requireValue(previous.fingerprint === fingerprint, 'ACTION_BINDING_CHANGED', 'Action parameters or script changed for an existing operation.');
        if (previous.state === 'succeeded') return bounded(async signal => { await grant(req, signal);return {completed: true}; }, parent, cue.timeoutMs);
        requireValue(previous.state === 'not-started', previous.state === 'unknown' ? 'ACTION_OUTCOME_UNKNOWN' : 'ACTION_IN_PROGRESS', 'Reconcile this action before retrying.');
      }
      requireValue(previous || ledger.size < maxLedger, 'ACTION_LEDGER_FULL', 'The bounded effect ledger is full.');
      const bytes = previous?.bytes || 2 * (fingerprint.length + canonical(req).length);
      requireValue(previous || retainedBytes + bytes <= maxLedgerBytes, 'ACTION_LEDGER_FULL', 'The effect ledger reached its retained-text budget.');
      if (!previous) retainedBytes += bytes;
      const entry = previous || {key, fingerprint, actionRef: cue.actionRef, request: req, bytes};entry.state = 'authorizing';ledger.set(key, entry);
      try { return await bounded(async signal => {
        await grant(req, signal);
        if (action.check) requireValue(await action.check(req, signal) === true, 'ACTION_PRECONDITION', 'The host precondition is not satisfied.');
        await grant(req, signal);check(signal);entry.state = 'pending';
        const result = await action.execute(req.args, {...req, idempotencyKey: key, signal});
        check(signal);requireValue(result?.completed === true, 'ACTION_OUTCOME_UNKNOWN', 'The host did not establish action completion.');
        entry.state = 'succeeded';return {completed: true};
      }, parent, cue.timeoutMs); }
      catch (error) { entry.state = entry.state === 'pending' ? 'unknown' : entry.state === 'succeeded' ? 'succeeded' : 'not-started';throw error; }
    },
    async reconcile(key, parent) {
      const entry = ledger.get(key);requireValue(entry?.state === 'unknown' && !entry.reconciling, 'ACTION_RECONCILE', 'Only an idle unknown action can be reconciled.');
      const action = actionMap.get(entry.actionRef);requireValue(typeof action.reconcile === 'function', 'ACTION_RECONCILE', 'The host did not provide reconciliation.');
      entry.reconciling = true;
      try { return await bounded(async signal => {
        await grant(entry.request, signal);const result = await action.reconcile({idempotencyKey: key, signal});check(signal);
        requireValue(['succeeded', 'not-started', 'unknown'].includes(result), 'ACTION_RECONCILE', 'Invalid reconciliation outcome.');entry.state = result;return result;
      }, parent, 5000); } finally { entry.reconciling = false; }
    },
    async reset(context, parent) {
      requireValue(context.mode === 'try' && fixture?.isolated === true && typeof fixture.reset === 'function' && !fixtureUnknown && !resetting && context.script.capabilities.includes('fixture:reset'),
        'FIXTURE_REQUIRED', 'A declared, isolated and unambiguous reset is required.');
      requireValue(![...ledger.values()].some(entry => ['pending', 'unknown', 'authorizing'].includes(entry.state)), 'ACTION_OUTCOME_UNKNOWN', 'Resolve in-flight or unknown actions before resetting.');
      resetting = true;const req = request('fixture:reset', context, {id: 'fixture-reset'});let dispatched = false;
      try { return await bounded(async signal => {
        await grant(req, signal);dispatched = true;const result = await fixture.reset({signal});check(signal);
        requireValue(result?.completed === true, 'FIXTURE_UNKNOWN', 'Fixture reset was not confirmed.');return {completed: true};
      }, parent, fixture.timeoutMs || 5000); }
      catch (error) { if (dispatched) fixtureUnknown = true;throw error; } finally { resetting = false; }
    },
    hints(ref) { return [...(conditionMap.get(ref)?.hints || [])]; },
    inspect() { return [...ledger.values()].map(({key, actionRef, state}) => ({key, actionRef, state})); },
    catalog() { return {
      actions: [...actionMap].filter(([, a]) => a.discoverable !== false).map(([id, a]) => ({id, label: a.label || id, impact: a.impact})),
      conditions: [...conditionMap].filter(([, c]) => c.discoverable !== false).map(([id, c]) => ({id, label: c.label || id, evidence: c.evidence, trigger: c.trigger})),
    }; },
    revoke() { revoked = true;for (const controller of active) controller.abort(failure('CAPABILITY_REVOKED', 'Host guidance authority was revoked.')); },
    destroy() { api.revoke(); },
  };
  return api;
}
