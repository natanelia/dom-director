/* Pure, fixture-scoped camera/timeline model; not the proposed public SDK. */
const DemoModel = (() => {
  'use strict';
  const WIDTH = 1120, HEIGHT = 600;
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  function easing(t, kind = 'cinematic') {
    t = clamp(t, 0, 1);
    if (kind === 'linear') return t;
    if (kind === 'gentle') return t * t * (3 - 2 * t);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function overview(view, reduced = false) {
    const s = view.width < 700 && !reduced
      ? Math.max(view.width / WIDTH, view.height / HEIGHT)
      : Math.min(view.width / WIDTH, view.height / HEIGHT);
    const center = view.width < 700 && !reduced ? 530 : WIDTH / 2;
    return { x: view.width / 2 - center * s, y: (view.height - HEIGHT * s) / 2, scale: s };
  }
  function fit(rect, view, maxScale = 2) {
    if (!rect || !Number.isFinite(rect.width) || rect.width <= 0 || rect.height <= 0)
      throw new Error('DEMO_TARGET_MISSING: target must have positive geometry.');
    const padX = view.width < 700 ? 22 : 52;
    const top = 38, bottom = 95;
    const width = Math.max(1, view.width - padX * 2);
    const height = Math.max(1, view.height - top - bottom);
    const scale = Math.min(width / rect.width, height / rect.height, maxScale);
    const x = view.width / 2 - (rect.x + rect.width / 2) * scale;
    const y = top + height / 2 - (rect.y + rect.height / 2) * scale;
    // Keep scene edges outside the aperture whenever the scaled surface can fill it.
    return { scale,
      x: WIDTH * scale >= view.width ? clamp(x, view.width - WIDTH * scale, 0) : (view.width - WIDTH * scale) / 2,
      y: HEIGHT * scale >= view.height ? clamp(y, view.height - HEIGHT * scale, 0) : (view.height - HEIGHT * scale) / 2
    };
  }
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, scale: a.scale + (b.scale - a.scale) * t });
  function project(rect, pose) {
    return { x: rect.x * pose.scale + pose.x, y: rect.y * pose.scale + pose.y,
      width: rect.width * pose.scale, height: rect.height * pose.scale };
  }
  function sceneAt(scenes, time) {
    return Math.max(0, scenes.findLastIndex(s => time >= s.startMs));
  }
  function formatTime(ms, precise = false) {
    const safe = Math.max(0, Math.floor(ms));
    return `${String(Math.floor(safe / 60000)).padStart(2, '0')}:${String(Math.floor(safe / 1000) % 60).padStart(2, '0')}` + (precise ? `.${String(safe % 1000).padStart(3, '0')}` : '');
  }
  function sample(scenes, time, rects, view, reduced, kind) {
    const index = sceneAt(scenes, time), scene = scenes[index];
    const effectiveTarget = s => view.width < 700 && s.target === 'review' ? 'approve' : s.target;
    const poseFor = s => reduced || s.target === 'overview' ? overview(view, reduced) : fit(rects[effectiveTarget(s)], view, s.zoom);
    const from = index ? poseFor(scenes[index - 1]) : overview(view, reduced);
    const destination = poseFor(scene);
    const progress = reduced ? 1 : easing((time - scene.startMs) / 1450, kind);
    return { index, scene, target:effectiveTarget(scene), pose: mix(from, destination, progress), progress };
  }
  function seekLimit(time, scenes, mode, approved) {
    const gate = scenes.find(s => s.gate);
    return mode !== 'watch' && !approved && gate ? Math.min(time, gate.startMs + 1700) : time;
  }
  // Media is authoritative only while its samples stay plausible. Explicit seeks
  // create a new clock; decoder jumps are not treated as user seeks. Tolerances
  // allow coarse/rounded media clocks without permitting a scene-sized leap.
  function createMediaClock(startTime, startWall, rate = 1) {
    if (![startTime, startWall, rate].every(Number.isFinite) || startTime < 0 || rate <= 0)
      throw new Error('DEMO_CLOCK_INVALID: finite origin and positive rate required.');
    let previousTime = startTime, previousWall = startWall;
    return {
      sample(time, now) {
        if (!Number.isFinite(time) || !Number.isFinite(now) || time < 0 || now < previousWall)
          return null;
        if (time < previousTime - 100 ||
            time > startTime + (now - startWall) * rate + 250 ||
            time > previousTime + (now - previousWall) * rate + 250)
          return null;
        if (time > previousTime) { previousTime = time; previousWall = now; }
        return previousTime;
      }
    };
  }
  return { WIDTH, HEIGHT, clamp, easing, overview, fit, mix, project, sceneAt, formatTime, sample, seekLimit, createMediaClock };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DemoModel;
