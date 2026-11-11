import {freezeData} from '@dom-director/core/data';
import {editProject, findClip, freshId, requireProject, sceneTimeline, LINKED_STUDIO_VERSION} from './project.js';
import {timingRows} from './timing.js';
const demand = (ok, message) => {if (!ok) throw new Error(message);};

/** Link one visible motion key to an authored word; never infers speech timing. */
export function linkKeyframeToCaptionWord(input, clipId, keyId, {captionId, wordIndex, boundary = 'start', offsetMs = 0} = {}) {
  const project = requireProject(input), {track, clip} = findClip(project, clipId);
  demand(['camera', 'cursor'].includes(track.kind), 'Choose a camera or cursor clip.');
  const key = clip.keys.find(k => k.id === keyId);
  demand(key && key.atMs >= clip.offsetMs && key.atMs <= clip.offsetMs + clip.durationMs, 'Select a keyframe inside its visible clip.');
  const source = findClip(project, captionId);
  demand(source.track.kind === 'captions' && source.track.id === project.captionTrack && source.track.enabled && source.clip.sceneId === clip.sceneId,
    'Choose a timed word in this scene’s visible caption language.');
  demand(Number.isInteger(wordIndex) && wordIndex >= 0 && source.clip.words?.[wordIndex], 'Choose an existing timed word.');
  demand(['start', 'end'].includes(boundary) && Number.isInteger(offsetMs) && Math.abs(offsetMs) <= 180000, 'Choose a word boundary and whole-millisecond delay.');
  const word = source.clip.words[wordIndex];
  demand(word.id || !source.track.locked, 'Unlock the caption track once to give this word a persistent identity.');
  const local = source.clip.startMs + word[boundary === 'start' ? 'startMs' : 'endMs'] + offsetMs - clip.startMs;
  demand(local >= 0 && local <= clip.durationMs, 'The word and delay must place this key inside its visible clip.');
  return editProject(project, next => {
    next.studioVersion = LINKED_STUDIO_VERSION;
    const word = findClip(next, captionId).clip.words[wordIndex];
    word.id ??= freshId(next, 'word');
    findClip(next, clipId).clip.keys.find(k => k.id === keyId).timing = {captionId, wordId: word.id, boundary, offsetMs};
  });
}

/** Explicit delay edit; absolute-time helpers also adjust this delay when linked. */
export function setTimingLinkOffset(input, clipId, keyId, offsetMs) {
  demand(Number.isInteger(offsetMs) && Math.abs(offsetMs) <= 180000, 'Use a delay in whole milliseconds within ±180 seconds.');
  return editProject(requireProject(input), next => {
    const key = findClip(next, clipId).clip.keys?.find(k => k.id === keyId);
    demand(key?.timing, 'Select a word-linked camera or cursor keyframe.');
    key.timing.offsetMs = offsetMs;
  });
}

/** Keep the resolved key time and all its visual properties; only remove the relation. */
export function detachTimingLink(input, clipId, keyId) {
  return editProject(requireProject(input), next => {
    const key = findClip(next, clipId).clip.keys?.find(k => k.id === keyId);
    demand(key?.timing, 'Select a word-linked camera or cursor keyframe.');
    delete key.timing;
  });
}

/** A host can offer one reviewed transaction before clearing/replacing timed text. */
export function detachCaptionTimingLinks(input, captionId) {
  const project = requireProject(input);
  demand(findClip(project, captionId).track.kind === 'captions', 'Choose a caption clip.');
  return editProject(project, next => {
    for (const track of next.tracks) for (const clip of track.clips) for (const key of clip.keys || [])
      if (key.timing?.captionId === captionId) delete key.timing;
  });
}

/** Stable IDs stay bound to their original language, even when that track is hidden. */
export function describeTimingLinks(input) {
  const project = requireProject(input), offsets = new Map(sceneTimeline(project).map(s => [s.id, s.startMs]));
  return freezeData(timingRows(project).map(({track, clip, key, source, word, wordIndex}) => ({
    clipId: clip.id, keyId: key.id, kind: track.kind, sceneId: clip.sceneId,
    captionId: source.clip.id, captionTrackId: source.track.id, wordId: word.id, wordIndex, text: word.text,
    boundary: key.timing.boundary, offsetMs: key.timing.offsetMs, sourceTimeMs: key.atMs,
    clipTimeMs: key.atMs - clip.offsetMs, projectTimeMs: offsets.get(clip.sceneId) + clip.startMs + key.atMs - clip.offsetMs,
    visible: key.atMs >= clip.offsetMs && key.atMs <= clip.offsetMs + clip.durationMs,
  })));
}
