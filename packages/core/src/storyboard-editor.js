import {compileStoryboard, readStoryboard} from './storyboard.js';

import {requireValue} from './errors.js';

/** A bounded local editor, not a recorder or an authority to run scripts. */
export function mountStoryboard({root, editor, getTargets, write, onDirty}) {
  requireValue(root?.nodeType === 1 && editor?.nodeName === 'TEXTAREA' && root.ownerDocument === editor.ownerDocument &&
    !root.contains(editor) && root.childNodes.length === 0 && [getTargets, write, onDirty].every(fn => typeof fn === 'function'),
    'CONTROLS_SURFACE', 'Storyboard controls need an empty root, a separate textarea and host callbacks.');
  const doc = root.ownerDocument, cleanup = [], urls = new Map();
  let board = null, selected = null, dirty = false, disposed = false, serial = 0;
  let history = [], position = -1, retainedBytes = 0;
  const bytes = text => new TextEncoder().encode(text).length;
  function el(tag, text, parent = root) {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    parent.append(node); return node;
  }
  function on(node, event, callback) { node.addEventListener(event, callback); cleanup.push(() => node.removeEventListener(event, callback)); }
  function button(id, text, parent, callback) {
    const node = el('button', text, parent); node.type = 'button'; node.id = 'storyboard-' + id;
    on(node, 'click', callback); return node;
  }
  el('h3', 'Build the story, not the JSON.');
  el('p', 'Choose approved targets, shape each scene, then validate and review the generated script. Text captions only; no generated voice.').className = 'small';
  const toolbar = el('div'); toolbar.className = 'actions';
  button('import', 'Edit current JSON', toolbar, () => importCurrent());
  const downloadButton = button('download', 'Download JSON', toolbar, download);
  const undo = button('undo', 'Undo', toolbar, () => travel(-1));
  const redo = button('redo', 'Redo', toolbar, () => travel(1));
  const status = el('p'); status.id = 'storyboard-status'; status.className = 'small'; status.setAttribute('role', 'status');
  const list = el('ol'); list.id = 'storyboard-scenes'; list.className = 'storyboard-scenes'; list.setAttribute('aria-label', 'Storyboard scenes');
  const form = el('form'); form.id = 'storyboard-form'; form.noValidate = true;
  const fieldset = el('fieldset', undefined, form); el('legend', 'Selected scene', fieldset);
  const fields = {};
  function field(name, label, type = 'text', properties = {}) {
    const wrap = el('label', label, fieldset); wrap.className = 'storyboard-field';
    const node = el(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input', undefined, wrap);
    node.id = 'storyboard-' + name;
    if (node.tagName === 'INPUT') node.type = type;
    Object.assign(node, properties); fields[name] = node; return node;
  }
  field('tour-title', 'Tour title', 'text', {maxLength: 200, required: true});
  field('title', 'Scene title', 'text', {maxLength: 200, required: true});
  field('target', 'Approved target', 'select');
  field('description', 'Caption and transcript', 'textarea', {maxLength: 4000, required: true});
  field('duration', 'Scene duration (milliseconds)', 'number', {min: '250', max: '60000', step: '1', required: true});
  field('transition', 'Camera transition (milliseconds)', 'number', {min: '0', max: '60000', step: '1', required: true});
  field('scale', 'Maximum zoom', 'number', {min: '0.1', max: '4', step: '0.1', required: true});
  field('cursor', 'Show simulated pointer', 'checkbox');
  const actions = el('div', undefined, fieldset); actions.className = 'actions';
  const apply = el('button', 'Apply scene edits', actions); apply.type = 'submit'; apply.id = 'storyboard-apply';
  button('discard', 'Discard field edits', actions, () => {dirty = false; render(); note('Field edits discarded. Validate and review before playback.');});
  const structure = el('div', undefined, fieldset); structure.className = 'actions';
  const add = button('add', 'Add scene', structure, () => mutate('add'));
  const duplicate = button('duplicate', 'Duplicate scene', structure, () => mutate('duplicate'));
  const up = button('up', 'Move earlier', structure, () => mutate('up'));
  const down = button('down', 'Move later', structure, () => mutate('down'));
  const remove = button('remove', 'Remove scene', structure, () => mutate('remove'));
  function note(text) {if (!disposed) status.textContent = text;}
  function reject(result) {note(result.diagnostics[0].message); return false;}
  function available(value) {
    const approved = new Set(getTargets().map(target => target.id));
    return value.scenes.every(scene => approved.has(scene.target));
  }
  function remember(value, reset = false) {
    const text = JSON.stringify(value), size = bytes(text);
    if (size > 2 * 1024 * 1024) return false;
    if (reset) {history = []; position = -1;}
    history = history.slice(0, position + 1);
    if (history.at(-1) !== text) history.push(text);
    retainedBytes = history.reduce((total, item) => total + bytes(item), 0);
    while (history.length > 30 || retainedBytes > 2 * 1024 * 1024) retainedBytes -= bytes(history.shift());
    position = history.length - 1; return true;
  }
  function render() {
    fieldset.disabled = !board;
    downloadButton.disabled = !board || dirty;
    undo.disabled = !board || dirty || position <= 0;
    redo.disabled = !board || dirty || position >= history.length - 1;
    if (!board) {list.replaceChildren(); return;}
    if (!board.scenes.some(scene => scene.id === selected)) selected = board.scenes[0].id;
    const index = board.scenes.findIndex(scene => scene.id === selected), scene = board.scenes[index];
    list.replaceChildren();
    // Delegated click handling avoids retaining handlers for each history render.
    for (const [i, item] of board.scenes.entries()) {
      const row = el('li', undefined, list), choice = el('button', `${i + 1}. ${item.title} · ${item.durationMs / 1000}s`, row);
      choice.type = 'button'; choice.dataset.sceneId = item.id;
      if (item.id === selected) choice.setAttribute('aria-current', 'step');
    }
    fields['tour-title'].value = board.title; fields.title.value = scene.title; fields.description.value = scene.description;
    fields.duration.value = String(scene.durationMs); fields.transition.value = String(scene.transitionMs);
    fields.scale.value = String(scene.maxScale); fields.cursor.checked = scene.cursor;
    fields.target.replaceChildren();
    for (const target of getTargets()) {const option = el('option', target.label, fields.target); option.value = target.id;}
    fields.target.value = scene.target;
    up.disabled = index === 0; down.disabled = index === board.scenes.length - 1;
    remove.disabled = board.scenes.length === 1; add.disabled = duplicate.disabled = board.scenes.length >= 50;
    note(`${board.scenes.length} scenes · ${board.scenes.reduce((total, item) => total + item.durationMs, 0) / 1000}s · no application actions`);
  }
  function importCurrent() {
    if (disposed) return false;
    if (dirty) {note('Apply or discard field edits before importing JSON.'); return false;}
    const result = readStoryboard(editor.value);
    if (!result.ok) {invalidate(); return reject(result);}
    if (!available(result.value)) {invalidate(); note('This script references targets outside the approved catalog. JSON was not changed.'); return false;}
    board = result.value; selected = board.scenes[0].id; dirty = false;
    remember(board, true); render(); return true;
  }
  function invalidate() {
    board = null; selected = null; dirty = false; history = []; position = -1; retainedBytes = 0;
    render(); note('Draft from the catalog, or use Edit current JSON for a supported storyboard.');
  }
  function commit(value, nextSelected = selected) {
    const result = compileStoryboard(value);
    if (!result.ok) return reject(result);
    if (!available(value)) {note('Select a target from the current approved catalog.'); return false;}
    const normalized = readStoryboard(result.value).value;
    try {write(result.value);} catch {note('The host could not accept the edited script.'); return false;}
    if (!remember(normalized)) {note('The local history budget was exceeded.'); return false;}
    board = normalized; selected = nextSelected; dirty = false;
    render(); return true;
  }
  function clean() {
    if (!board || disposed) return false;
    if (dirty) {note('Apply or discard field edits first.'); return false;}
    return true;
  }
  function nextId() {
    let value; do {value = 'scene-added-' + (++serial);} while (board.scenes.some(scene => scene.id === value));
    return value;
  }
  function mutate(kind) {
    if (!clean()) return;
    const value = JSON.parse(JSON.stringify(board));
    const i = value.scenes.findIndex(scene => scene.id === selected);
    let nextSelected = selected;
    if (kind === 'add' || kind === 'duplicate') {
      if (value.scenes.length >= 50) return;
      nextSelected = nextId();
      const item = kind === 'duplicate' ? {...value.scenes[i], id: nextSelected} :
        {id: nextSelected, title: 'New scene', target: getTargets()[0]?.id || '', description: 'Explain this part of the application.', durationMs: 3500, transitionMs: 900, maxScale: 2, cursor: true};
      value.scenes.splice(i + 1, 0, item);
    } else if (kind === 'remove') {
      if (value.scenes.length === 1) return;
      value.scenes.splice(i, 1); nextSelected = value.scenes[Math.min(i, value.scenes.length - 1)].id;
    } else {
      const destination = i + (kind === 'up' ? -1 : 1);
      if (destination < 0 || destination >= value.scenes.length) return;
      [value.scenes[i], value.scenes[destination]] = [value.scenes[destination], value.scenes[i]];
    }
    commit(value, nextSelected);
  }
  function travel(direction) {
    if (!clean()) return;
    const next = position + direction;
    if (next < 0 || next >= history.length) return;
    const value = JSON.parse(history[next]), generated = compileStoryboard(value);
    if (!generated.ok || !available(value)) {note('The previous draft is no longer compatible with the approved catalog.'); return;}
    try {write(generated.value);} catch {note('The host could not restore this draft.'); return;}
    position = next; board = value; dirty = false; render();
  }
  function download() {
    if (!clean()) return;
    const generated = compileStoryboard(board); if (!generated.ok) return reject(generated);
    const url = URL.createObjectURL(new Blob([JSON.stringify(generated.value, null, 2) + '\n'], {type: 'application/json'}));
    const link = el('a'); link.href = url; link.download = 'dom-director-' + board.id + '.json';
    link.click(); link.remove();
    urls.set(url, setTimeout(() => {URL.revokeObjectURL(url); urls.delete(url);}, 1000));
    note('Canonical JSON exported. No application values or review permission were included.');
  }
  on(list, 'click', event => {
    const choice = event.target.closest('button[data-scene-id]');
    if (!choice || !list.contains(choice) || !clean()) return;
    selected = choice.dataset.sceneId; render();
    [...list.querySelectorAll('button')].find(button => button.dataset.sceneId === selected)?.focus();
  });
  on(form, 'input', () => {
    if (!board) return;
    dirty = true; downloadButton.disabled = undo.disabled = redo.disabled = true; onDirty();
    note('Unsaved scene edits. Apply or discard them before validating or playing.');
  });
  on(form, 'submit', event => {
    event.preventDefault(); if (!board || disposed) return;
    if (!form.reportValidity()) return;
    const value = JSON.parse(JSON.stringify(board)), scene = value.scenes.find(scene => scene.id === selected);
    value.title = fields['tour-title'].value;
    Object.assign(scene, {title: fields.title.value, target: fields.target.value, description: fields.description.value,
      durationMs: fields.duration.valueAsNumber, transitionMs: fields.transition.valueAsNumber, maxScale: fields.scale.valueAsNumber, cursor: fields.cursor.checked});
    commit(value);
  });
  invalidate();
  return {get pending() {return dirty;}, importCurrent, invalidate,
    destroy() {if (disposed) return; disposed = true; cleanup.splice(0).forEach(off => off()); for (const [url, timer] of urls) {clearTimeout(timer); URL.revokeObjectURL(url);} urls.clear(); history = []; retainedBytes = 0; board = null; root.replaceChildren();}};
}
