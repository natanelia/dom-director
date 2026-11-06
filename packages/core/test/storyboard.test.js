import test from 'node:test';
import assert from 'node:assert/strict';
import {compileStoryboard, readStoryboard} from '../src/storyboard.js';
import {compile} from '../src/compiler.js';
const scene = id => ({id, title: 'A scene', target: 'app.reports', description: 'Read this caption.', durationMs: 3500, transitionMs: 900, maxScale: 2, cursor: true});
const board = () => ({version: 1, id: 'example', title: 'Example', locale: 'en', scenes: [scene('first'), scene('second')]});
const plain = value => JSON.parse(JSON.stringify(value));

test('builder produces a canonical, frozen, text-only Watch tour without mutating input', () => {
  const input = board(), before = plain(input), result = compileStoryboard(input);
  assert.equal(result.ok, true); assert.deepEqual(input, before);
  const tour = result.value;
  assert.equal(compile(tour).ok, true); assert.deepEqual(tour.modes, ['watch']); assert.deepEqual(tour.capabilities, []);
  assert.equal(tour.assets, undefined); assert.ok(Object.isFrozen(tour.scenes[0].cues));
  assert.equal(tour.scenes[0].narration.cues[0].endMs, 3500);
  assert.equal(tour.scenes[0].next, 'second'); assert.equal(tour.scenes[1].next, undefined);
});
test('object and JSON storyboard inputs compile identically', () => {
  assert.deepEqual(compileStoryboard(board()), compileStoryboard(JSON.stringify(board())));
});
test('round-trip preserves all fields and accepts reordered JSON properties', () => {
  const input = board(), generated = compileStoryboard(input).value;
  const result = readStoryboard(JSON.stringify({...generated, scenes: generated.scenes}));
  assert.equal(result.ok, true); assert.deepEqual(plain(result.value), input); assert.ok(Object.isFrozen(result.value.scenes));
  assert.deepEqual(compileStoryboard(result.value).value, generated);
});
test('reordering preserves scene, cue, caption and target IDs and rebuilds linear edges', () => {
  const input = board(), before = compileStoryboard(input).value;
  input.scenes.reverse(); const after = compileStoryboard(input).value;
  assert.equal(after.entryScene, 'second'); assert.equal(after.scenes[0].next, 'first');
  assert.deepEqual(after.scenes[0].cues, before.scenes[1].cues);
  assert.deepEqual(after.scenes[0].narration, before.scenes[1].narration);
  assert.deepEqual(after.targets, before.targets);
});
test('zero and full-duration transitions remain valid; pointer is optional', () => {
  for (const transitionMs of [0, 3500]) {
    const input = board(); input.scenes[0].transitionMs = transitionMs; input.scenes[0].cursor = false;
    const result = compileStoryboard(input); assert.equal(result.ok, true);
    assert.equal(result.value.scenes[0].cues.some(cue => cue.kind === 'cursor'), false);
    assert.equal(readStoryboard(result.value).ok, true);
  }
});
test('duplicate identities, bounds, unknown fields and incorrect types fail closed', () => {
  const mutations = [
    b => {b.scenes = [];}, b => {b.scenes = Array.from({length: 51}, (_, i) => scene('s' + i));},
    b => {b.scenes[1].id = 'first';}, b => {b.scenes[0].id = 's'.repeat(65);}, b => {b.scenes[0].target = '#secret';},
    b => {b.scenes[0].durationMs = 249;}, b => {b.scenes[0].durationMs = 60001;}, b => {b.scenes[0].durationMs = 1000.5;},
    b => {b.scenes[0].transitionMs = -1;}, b => {b.scenes[0].transitionMs = 3501;}, b => {b.scenes[0].maxScale = 0;},
    b => {b.scenes[0].maxScale = 4.1;}, b => {b.scenes[0].cursor = 'yes';}, b => {b.scenes[0].description = ' ';},
    b => {b.scenes[0].description = 'x'.repeat(4001);}, b => {b.scenes[0].extra = 'SECRET';},
    b => {b.version = 2;}, b => {b.title = '';}, b => {b.locale = 'bad_locale';}, b => {b.capabilities = ['action:save'];},
  ];
  for (const mutate of mutations) {
    const input = board(); mutate(input); const result = compileStoryboard(input);
    assert.equal(result.ok, false); assert.ok(result.diagnostics.length); assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
});
test('accessors, functions, duplicate keys, reserved keys, oversized input and cycles are rejected', () => {
  const accessor = board(); let reads = 0; Object.defineProperty(accessor, 'title', {get() {reads++; return 'SECRET';}, enumerable: true});
  const cycle = board(); cycle.scenes.push(cycle);
  for (const input of [accessor, cycle, {run() {}}, '{"version":1,"version":1}', '{"__proto__":{}}', 'x'.repeat(1048577)]) assert.equal(compileStoryboard(input).ok, false);
  assert.equal(reads, 0);
});
test('maximum-length scene IDs still produce valid globally unique cue IDs', () => {
  const input = board(); input.scenes[0].id = 's'.repeat(64);
  assert.equal(compileStoryboard(input).ok, true);
});
test('advanced scripts are not flattened, stripped or granted permissions', () => {
  const changes = [
    t => {t.meta = {description: 'Keep this metadata'};}, t => {t.defaults.easing = 'direct';},
    t => {t.scenes[0].cues[0].paddingPx = 30;}, t => {t.scenes[0].cues[0].id = 'custom-camera-id';},
    t => {t.scenes[0].narration.cues[0].text = 'Different caption';},
    t => {t.capabilities.push('action:save'); t.scenes[0].cues.push({id:'save',kind:'action',at:0,actionRef:'save',args:{},timeoutMs:1000});},
    t => {t.scenes[0].choices = [{id:'choice',label:'Choose',next:'second'}]; delete t.scenes[0].next;},
    t => {t.assets = {voice:{kind:'audio',uri:'./voice.mp3'}}; t.scenes[0].narration.audioAsset = 'voice';},
  ];
  for (const mutate of changes) {
    const input = plain(compileStoryboard(board()).value); mutate(input); const before = plain(input);
    assert.equal(compile(input).ok, true); assert.equal(readStoryboard(input).ok, false); assert.deepEqual(input, before);
  }
});
test('invalid canonical JSON yields bounded diagnostics instead of throwing', () => {
  for (const value of [null, '{}', '{', 1, []]) assert.equal(readStoryboard(value).ok, false);
});
