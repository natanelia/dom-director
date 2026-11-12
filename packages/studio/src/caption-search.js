import {cloneData, freezeData} from '@dom-director/core/data';
import {editProject, requireProject, sceneTimeline} from './project.js';
import {describeTimingLinks} from './timing-links.js';

const MATCH_LIMIT = 5000;
function demand(ok, message, code = 'CAPTION_SEARCH_INVALID') {
  if (!ok) throw Object.assign(new Error(message), {code});
}
function settings(project, input, replace = false) {
  const options = cloneData(input);
  const allowed = ['query', 'matchCase', 'trackId', ...(replace ? ['replacement', 'clipIds'] : [])];
  demand(options && typeof options === 'object' && !Array.isArray(options) &&
    Object.keys(options).every(key => allowed.includes(key)), 'Use supported caption search options.');
  demand(typeof options.query === 'string' && options.query.length > 0 && options.query.length <= 256,
    'Enter 1–256 characters to find. Search is literal, not a regular expression.');
  const matchCase = Object.hasOwn(options, 'matchCase') ? options.matchCase : false;
  demand(typeof matchCase === 'boolean', 'Match case must be a boolean.');
  const trackId = Object.hasOwn(options, 'trackId') ? options.trackId : project.captionTrack;
  demand(trackId === null || project.tracks.some(track => track.id === trackId && track.kind === 'captions'),
    'Choose an existing caption track, or all caption tracks.');
  if (replace) {
    demand(typeof options.replacement === 'string' && options.replacement.length <= 4000,
      'Replacement text must be at most 4000 characters.');
    if (options.clipIds !== undefined) {
      demand(Array.isArray(options.clipIds) && options.clipIds.length > 0 && options.clipIds.length <= 1500 &&
        options.clipIds.every(id => typeof id === 'string') && new Set(options.clipIds).size === options.clipIds.length,
      'Choose unique matching caption IDs.', 'CAPTION_SELECTION_INVALID');
    }
  }
  return {...options, matchCase, trackId};
}
function expression(options) {
  // Both the search and replacement are literal; neither is executable regex syntax.
  return new RegExp(options.query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), options.matchCase ? 'gu' : 'giu');
}
function search(project, options) {
  const scenes = new Map(sceneTimeline(project).map(scene => [scene.id, scene]));
  const rows = [];
  let matches = 0;
  for (const [trackIndex, track] of project.tracks.entries()) {
    if (track.kind !== 'captions' || (options.trackId !== null && track.id !== options.trackId)) continue;
    for (const clip of track.clips) {
      const ranges = [];
      for (const match of clip.text.matchAll(expression(options))) {
        demand(++matches <= MATCH_LIMIT, 'More than 5000 matches. Narrow the search before continuing.', 'CAPTION_SEARCH_LIMIT');
        ranges.push({start: match.index, end: match.index + match[0].length});
      }
      if (!ranges.length) continue;
      const scene = scenes.get(clip.sceneId);
      rows.push({clipId: clip.id, trackId: track.id, trackName: track.name, sceneId: clip.sceneId,
        sceneTitle: scene.title, projectTimeMs: scene.startMs + clip.startMs, text: clip.text,
        locked: track.locked, enabled: track.enabled, wordCount: clip.words?.length ?? 0, ranges, trackIndex});
    }
  }
  rows.sort((a, b) => a.projectTimeMs - b.projectTimeMs || a.trackIndex - b.trackIndex || (a.clipId < b.clipId ? -1 : a.clipId > b.clipId ? 1 : 0));
  return {matches, captions: rows.map(({trackIndex, ...row}) => row)};
}

/** Read-only literal search. Ranges use UTF-16 offsets for String.slice, not word indices. */
export function findCaptionMatches(input, options) {
  const project = requireProject(input);
  return freezeData(search(project, settings(project, options)));
}

/** Prepare one reviewed edit; never commits, seeks, loads media or changes narration. */
export function proposeCaptionReplacement(input, options) {
  const project = requireProject(input), config = settings(project, options, true);
  const found = search(project, config), selected = config.clipIds ? new Set(config.clipIds) : null;
  if (selected) demand([...selected].every(id => found.captions.some(row => row.clipId === id)),
    'A selected caption no longer matches this search.', 'CAPTION_SELECTION_INVALID');
  const changes = [];
  for (const row of found.captions) {
    if (selected && !selected.has(row.clipId)) continue;
    const after = row.text.replace(expression(config), () => config.replacement);
    if (after === row.text) continue;
    demand(after.trim().length > 0 && after.length <= 4000,
      'A replacement would make a caption blank or longer than 4000 characters. No captions changed.', 'CAPTION_REPLACEMENT_INVALID');
    changes.push({clipId: row.clipId, trackId: row.trackId, trackName: row.trackName, sceneId: row.sceneId,
      sceneTitle: row.sceneTitle, projectTimeMs: row.projectTimeMs, before: row.text, after,
      replacements: row.ranges.length, clearedWordTimings: row.wordCount});
  }
  const changed = new Map(changes.map(change => [change.clipId, change]));
  const detachedLinks = describeTimingLinks(project).filter(link => changed.has(link.captionId));
  const value = changes.length ? editProject(project, draft => {
    for (const track of draft.tracks) for (const clip of track.clips) {
      const change = changed.get(clip.id);
      if (change) {clip.text = change.after; delete clip.words;}
      for (const key of clip.keys || []) if (changed.has(key.timing?.captionId)) delete key.timing;
    }
  }) : project;
  return freezeData({value, changes, detachedLinks,
    replacements: changes.reduce((total, change) => total + change.replacements, 0)});
}
