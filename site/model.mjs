/** Presentation helpers only; timing, camera and effects belong to the SDK. */
export function timecode(ms, precise=false) {
  const n=Math.max(0,Math.floor(ms));
  return String(Math.floor(n/60000)).padStart(2,'0')+':'+String(Math.floor(n/1000)%60).padStart(2,'0')+(precise?'.'+String(n%1000).padStart(3,'0'):'');
}
export function timeline(script) {
  let start=0;
  const scenes=script.scenes.map(scene=>{const value={...scene,startMs:start};start+=scene.durationMs;return value;});
  return {scenes,total:start,position(state){return (scenes.find(s=>s.id===state.sceneId)?.startMs||0)+(state.timeMs||0);},
    locate(ms){const value=Math.max(0,Math.min(start,ms));const scene=[...scenes].reverse().find(s=>s.startMs<=value)||scenes[0];return {sceneId:scene.id,timeMs:Math.min(scene.durationMs,value-scene.startMs)};}};
}
export function withEasing(script,value) {
  if(!['gentle','direct','overview','instant'].includes(value))throw new Error('Unknown camera easing.');
  return {...script,defaults:{...script.defaults,easing:value}};
}
