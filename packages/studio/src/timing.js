import {DirectorError} from '@dom-director/core';
import {canonical} from '@dom-director/core/data';

// Opt-in document revision. Legacy projects are not rewritten on read/save.
export const LINKED_STUDIO_VERSION = '0.1.0-draft.2';
const identifier = /^[A-Za-z][A-Za-z0-9._-]{0,79}$/u;
const demand = (ok, message, path = '') => {
  if (!ok) throw new DirectorError('STUDIO_INVALID', message, 'compile', path);
};
const isId = value => typeof value === 'string' && identifier.test(value);

/** Internal: structural project validation precedes public use of these rows. */
export function timingRows(project) {
  const captions = new Map();
  for (const track of project.tracks) if (track.kind === 'captions')
    for (const clip of track.clips) captions.set(clip.id, {track, clip});
  const rows = [];
  for (const [ti, track] of project.tracks.entries()) {
    if (!['camera', 'cursor'].includes(track.kind)) continue;
    for (const [ci, clip] of track.clips.entries()) for (const [ki, key] of clip.keys.entries()) {
      if (key.timing === undefined) continue;
      const path = `/tracks/${ti}/clips/${ci}/keys/${ki}/timing`, link = key.timing;
      demand(project.studioVersion === LINKED_STUDIO_VERSION, 'Persistent word links require Studio project draft.2.', path);
      const fields = ['captionId', 'wordId', 'boundary', 'offsetMs'];
      demand(link && typeof link === 'object' && !Array.isArray(link) &&
        Object.keys(link).length === fields.length && fields.every(k => Object.hasOwn(link, k)), 'Invalid word timing link.', path);
      demand(isId(link.captionId) && isId(link.wordId) && ['start', 'end'].includes(link.boundary) &&
        Number.isInteger(link.offsetMs) && Math.abs(link.offsetMs) <= 180000, 'Invalid word boundary or timing offset.', path);
      const source = captions.get(link.captionId);
      demand(source?.clip.sceneId === clip.sceneId, 'The linked caption must exist in the same scene. Detach or relink this key first.', path);
      const wordIndex = source.clip.words?.findIndex(w => w.id === link.wordId) ?? -1;
      demand(wordIndex >= 0, 'The linked word is missing. Detach or relink its camera/cursor keys before removing word timing.', path);
      const word = source.clip.words[wordIndex];
      const baseMs = clip.offsetMs + source.clip.startMs + word[link.boundary === 'start' ? 'startMs' : 'endMs'] - clip.startMs;
      rows.push({track, clip, key, source, word, wordIndex, baseMs, path});
    }
  }
  return rows;
}

/** Reject inconsistent imported data instead of silently repairing its motion. */
export function checkTimingLinks(project) {
  for (const {key, baseMs, path} of timingRows(project))
    demand(key.atMs === baseMs + key.timing.offsetMs, 'Stored keyframe timing does not match its word link. Reopen the original project or repair the link.', path);
}

/** Resolve one trusted edit atomically, before normal bounds/collision/lock checks. */
export function synchronizeTimingLinks(before, after) {
  const old = new Map();
  for (const track of before.tracks) for (const clip of track.clips)
    for (const key of clip.keys || []) old.set(key.id, key);
  const touched = new Set();
  for (const row of timingRows(after)) {
    const {clip, key, baseMs, path} = row, previous = old.get(key.id);
    // A deliberate key-time edit adjusts its delay, never silently detaches it.
    if (previous?.timing && canonical(previous.timing) === canonical(key.timing) && previous.atMs !== key.atMs)
      key.timing.offsetMs = key.atMs - baseMs;
    demand(Number.isInteger(key.timing.offsetMs) && Math.abs(key.timing.offsetMs) <= 180000,
      'The linked timing offset is outside the supported range.', path);
    key.atMs = baseMs + key.timing.offsetMs;
    demand(Number.isInteger(key.atMs) && key.atMs >= 0 && key.atMs <= 360000,
      'This word edit moves a linked key outside its motion source. Adjust the delay or detach the key first.', path);
    touched.add(clip);
  }
  for (const clip of touched) clip.keys.sort((a, b) => a.atMs - b.atMs);
}
