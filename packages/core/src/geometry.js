import {requireValue} from './errors.js';
export const IDENTITY = Object.freeze({x: 0, y: 0, scale: 1});
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function rect(value) {
  requireValue(value && ['x','y','width','height'].every(k => Number.isFinite(value[k])) &&
    value.width > 0 && value.height > 0, 'INVALID_GEOMETRY', 'Bounds must be finite and nonempty.');
  return {x: value.x, y: value.y, width: value.width, height: value.height};
}
export function pose(value) {
  requireValue(value && [value.x, value.y, value.scale].every(Number.isFinite) && value.scale > 0,
    'INVALID_POSE', 'Camera coordinates must be finite and scale must be positive.');
  return {x: value.x, y: value.y, scale: value.scale};
}
export function union(bounds) {
  requireValue(bounds.length > 0, 'INVALID_GEOMETRY', 'At least one target is required.');
  const checked = bounds.map(rect), x = Math.min(...checked.map(r => r.x)), y = Math.min(...checked.map(r => r.y));
  return {x, y, width: Math.max(...checked.map(r => r.x+r.width))-x,
    height: Math.max(...checked.map(r => r.y+r.height))-y};
}
export function fit(bounds, safe, {paddingPx = 24, minScale = .1, maxScale = 4} = {}) {
  bounds = rect(bounds); safe = rect(safe);
  requireValue([paddingPx,minScale,maxScale].every(Number.isFinite) && paddingPx >= 0 && minScale > 0 &&
    maxScale >= minScale && maxScale <= 16, 'INVALID_FRAMING', 'Invalid padding or scale limits.');
  const width = safe.width-2*paddingPx, height = safe.height-2*paddingPx;
  requireValue(width > 0 && height > 0, 'INVALID_SAFE_AREA', 'Padding consumes the safe area.');
  const wanted = Math.min(width/bounds.width, height/bounds.height), scale = clamp(wanted,minScale,maxScale);
  return {pose: {x: safe.x+safe.width/2-scale*(bounds.x+bounds.width/2),
    y: safe.y+safe.height/2-scale*(bounds.y+bounds.height/2), scale}, clipped: wanted < minScale};
}
export function easing(t, name = 'gentle') {
  t = clamp(t,0,1);
  if (name === 'instant') return 1;
  if (name === 'direct') return t;
  if (name === 'overview') return t*t*(3-2*t);
  requireValue(name === 'gentle', 'INVALID_EASING', 'Unknown easing preset.');
  return t < .5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
}
export function interpolate(from, to, progress, preset = 'gentle') {
  from = pose(from); to = pose(to);
  requireValue(Number.isFinite(progress), 'INVALID_TIME', 'Progress must be finite.');
  const t = easing(progress,preset);
  return {x: from.x+(to.x-from.x)*t, y: from.y+(to.y-from.y)*t,
    scale: Math.exp(Math.log(from.scale)+(Math.log(to.scale)-Math.log(from.scale))*t)};
}
export function project(bounds, camera, origin = {x:0,y:0}) {
  bounds=rect(bounds); camera=pose(camera);
  return {x: origin.x+camera.x+bounds.x*camera.scale, y: origin.y+camera.y+bounds.y*camera.scale,
    width: bounds.width*camera.scale, height: bounds.height*camera.scale};
}
