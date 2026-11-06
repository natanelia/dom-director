import {compile, SCHEMA_VERSION} from './compiler.js';
import {cloneData, freezeData, canonical} from './json.js';
import {DirectorError, diagnostic} from './errors.js';

export const STORYBOARD_VERSION = 1;
const id = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/u;
const targetId = /^[A-Za-z][A-Za-z0-9._-]{0,79}$/u;
const locale = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/u;
const rootKeys = ['version', 'id', 'title', 'locale', 'scenes'];
const sceneKeys = ['id', 'title', 'target', 'description', 'durationMs', 'transitionMs', 'maxScale', 'cursor'];
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && [...value].length <= max;
function demand(condition, path) {
  if (!condition) throw new DirectorError('INPUT_INVALID', 'Invalid storyboard field or unsupported property.', 'compile', path);
}
function keys(value, expected, path) {
  demand(value !== null && typeof value === 'object' && !Array.isArray(value), path);
  demand(Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key)), path);
}
function checked(input) {
  const board = cloneData(input);
  keys(board, rootKeys, '');
  demand(board.version === STORYBOARD_VERSION, '/version');
  demand(typeof board.id === 'string' && id.test(board.id), '/id');
  demand(text(board.title, 200), '/title');
  demand(typeof board.locale === 'string' && board.locale.length <= 64 && locale.test(board.locale), '/locale');
  demand(Array.isArray(board.scenes) && board.scenes.length >= 1 && board.scenes.length <= 50, '/scenes');
  const seen = new Set();
  board.scenes.forEach((scene, index) => {
    const path = '/scenes/' + index;
    keys(scene, sceneKeys, path);
    demand(typeof scene.id === 'string' && id.test(scene.id) && !seen.has(scene.id), path + '/id');
    seen.add(scene.id);
    demand(text(scene.title, 200), path + '/title');
    demand(typeof scene.target === 'string' && targetId.test(scene.target), path + '/target');
    demand(text(scene.description, 4000), path + '/description');
    demand(Number.isInteger(scene.durationMs) && scene.durationMs >= 250 && scene.durationMs <= 60000, path + '/durationMs');
    demand(Number.isInteger(scene.transitionMs) && scene.transitionMs >= 0 && scene.transitionMs <= scene.durationMs, path + '/transitionMs');
    demand(typeof scene.maxScale === 'number' && scene.maxScale >= 0.1 && scene.maxScale <= 4, path + '/maxScale');
    demand(typeof scene.cursor === 'boolean', path + '/cursor');
  });
  return board;
}

/** Compile bounded, linear presentation data. This never discovers targets or grants permissions. */
export function compileStoryboard(input) {
  try {
    const board = checked(input);
    const targets = Object.create(null);
    const scenes = board.scenes.map((scene, index) => {
      const alias = 'target.' + scene.id;
      targets[alias] = {ref: scene.target};
      const durationMs = scene.durationMs - scene.transitionMs;
      const cues = [
        {id: 'camera.' + scene.id, kind: 'camera', at: 0, durationMs: scene.transitionMs, target: alias, minScale: 0.1, maxScale: scene.maxScale},
        {id: 'highlight.' + scene.id, kind: 'highlight', at: scene.transitionMs, durationMs, target: alias, style: 'outline'},
      ];
      if (scene.cursor) cues.push({id: 'cursor.' + scene.id, kind: 'cursor', at: scene.transitionMs, durationMs, target: alias, gesture: 'point'});
      return {
        id: scene.id, title: scene.title, summary: scene.description, durationMs: scene.durationMs, cues,
        narration: {transcript: scene.description, cues: [{id: 'caption.' + scene.id, startMs: 0, endMs: scene.durationMs, text: scene.description}]},
        ...(index + 1 < board.scenes.length ? {next: board.scenes[index + 1].id} : {}),
      };
    });
    const result = compile({schemaVersion: SCHEMA_VERSION, id: board.id, title: board.title, locale: board.locale,
      entryScene: scenes[0].id, modes: ['watch'], capabilities: [], targets, scenes,
      defaults: {motion: 'respect-user', captions: 'on', easing: 'gentle'}});
    return result.ok ? {ok: true, value: result.plan.script} : result;
  } catch (error) {
    return {ok: false, diagnostics: [diagnostic(error, 'compile')]};
  }
}

/** Import only when recompilation preserves every canonical field and stable ID. Never strip advanced cues. */
export function readStoryboard(input) {
  const result = compile(input);
  if (!result.ok) return result;
  const script = result.plan.script;
  const unsupported = () => ({ok: false, diagnostics: [new DirectorError('INPUT_INVALID',
    'This tour cannot be edited as a storyboard without losing data. Keep using canonical JSON.', 'compile').diagnostic]});
  if (script.scenes.length > 50) return unsupported();
  const board = {version: STORYBOARD_VERSION, id: script.id, title: script.title, locale: script.locale,
    scenes: script.scenes.map(scene => {
      const camera = scene.cues.find(cue => cue.kind === 'camera');
      return {id: scene.id, title: scene.title, target: script.targets[camera?.target]?.ref ?? '',
        description: scene.summary, durationMs: scene.durationMs, transitionMs: camera?.durationMs ?? -1,
        maxScale: camera?.maxScale ?? 0, cursor: scene.cues.some(cue => cue.kind === 'cursor')};
    })};
  const roundTrip = compileStoryboard(board);
  if (!roundTrip.ok || canonical(roundTrip.value) !== canonical(script)) return unsupported();
  return {ok: true, value: freezeData(board)};
}
