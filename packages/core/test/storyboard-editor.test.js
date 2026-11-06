import test from 'node:test';
import assert from 'node:assert/strict';
import {mountStoryboard} from '../src/storyboard-editor.js';
test('optional editor imports without browser globals and rejects invalid mounting', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof mountStoryboard, 'function');
  assert.throws(() => mountStoryboard({root: null, editor: null}), error => error.diagnostic.code === 'CONTROLS_SURFACE');
});
