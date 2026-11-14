import {STUDIO_VERSION,CAPTION_THEME,CURSOR_THEME,requireProject} from './project.js';

/** One authored story shared by the live Earth tutorial and the Studio sample. */
export const EARTH_CHECKPOINTS = Object.freeze([
  {id:'earth.overview',title:'Take the planet for a spin',target:'earth.globe',control:'orbit',durationMs:7000,
    text:'Meet Earth, a world of data you can touch. Drag the globe, or focus it and use the arrow keys to explore.',
    instruction:'Drag the globe to rotate it, or focus the globe and press an arrow key.'},
  {id:'earth.metric',title:'See a different world',target:'earth.metric',control:'metric',durationMs:7000,
    text:'One planet, different stories. Choose Energy to change the color and height of the data pillars.',
    instruction:'Choose Energy under Choose a story. Watch the pillars change.'},
  {id:'earth.year',title:'Move through time',target:'earth.year',control:'year',durationMs:7000,
    text:'Move the year slider to reveal how the picture changes. Each pillar responds to the year you choose.',
    instruction:'Move the Travel through time slider to 2020 or later.'},
  {id:'earth.region',title:'Bring a region into focus',target:'earth.region',control:'region',durationMs:7000,
    text:'Choose Asia to turn the globe toward a new perspective. Regional data comes forward while the rest of the world recedes.',
    instruction:'Choose Asia Pacific under Find your region. The globe turns toward it.'},
  {id:'earth.connections',title:'Connect the dots',target:'earth.connections',control:'connections',durationMs:7000,
    text:'Turn on Connections to trace arcs between places. Change the year or region to explore the network.',
    instruction:'Turn on Connections to draw the network across the globe.'},
  {id:'earth.lighting',title:'Discover the world after dark',target:'earth.lighting',control:'night',durationMs:7000,
    text:'Switch to Night to bring the lights into view. This is still your app: keep exploring, or reset the view and begin again.',
    instruction:'Turn on Night view to change the lighting and reveal the city lights.'},
].map(Object.freeze));

/** Caption-first sample: the old Orbit narration never speaks over the Earth story. */
export function createEarthSample(){
  const scenes=EARTH_CHECKPOINTS.map(({id,title,durationMs})=>({id,title,durationMs}));
  const common=(s,kind)=>({id:kind+'.'+s.id,sceneId:s.id,startMs:0,durationMs:s.durationMs});
  // Keep the planet and its controls in frame. The cursor teaches the exact control,
  // carrying its preceding endpoint across each scene boundary without a jump.
  const point=step=>({target:step.target,x:0,y:0,curve:0,easing:'gentle'});
  return requireProject({studioVersion:STUDIO_VERSION,id:'earth-studio',title:'Earth · a world you can change',canvas:{width:960,height:540},scenes,
    captionTheme:{...CAPTION_THEME,background:'#071b29',color:'#f0fafb',size:24,y:88,width:84},
    cursorTheme:{...CURSOR_THEME,color:'#8df2dd',stroke:'#071b29'},captionTrack:'cc.en',assets:[],
    tracks:[
      {id:'camera',kind:'camera',name:'Camera',enabled:true,locked:false,clips:scenes.map(s=>({...common(s,'camera'),offsetMs:0,keys:[{id:'camera.from.'+s.id,atMs:0,target:'earth.overview',zoom:1,x:0,y:0,easing:'gentle'},{id:'camera.to.'+s.id,atMs:1200,target:'earth.overview',zoom:1,x:0,y:0,easing:'gentle'}]}))},
      {id:'cursor',kind:'cursor',name:'Cursor',enabled:true,locked:false,clips:scenes.map((s,i)=>({...common(s,'cursor'),offsetMs:0,keys:[{id:'cursor.from.'+s.id,atMs:0,...point(EARTH_CHECKPOINTS[Math.max(0,i-1)])},{id:'cursor.to.'+s.id,atMs:1400,...point(EARTH_CHECKPOINTS[i]),curve:i?28:0}],gestures:[]}))},
      {id:'voice',kind:'voice',name:'Voiceover',enabled:true,locked:false,clips:scenes.map((s,i)=>({...common(s,'voice'),assetId:null,script:EARTH_CHECKPOINTS[i].text,sourceInMs:0,gain:1,fadeInMs:0,fadeOutMs:0}))},
      {id:'cc.en',kind:'captions',name:'CC · English',language:'en',enabled:true,locked:false,clips:scenes.map((s,i)=>({...common(s,'cc'),text:EARTH_CHECKPOINTS[i].text}))},
    ]});
}

export function createSample(){
  const scenes=[{id:'overview',title:'The living workspace',durationMs:6980},{id:'signal',title:'Find the important detail',durationMs:8208},{id:'story',title:'Follow the route',durationMs:7409}];
  const text=['This looks like a product video. But every pixel you see belongs to a real, working interface.','Instead of pointing at everything, bring the important detail into focus. Your layout stays exactly where it was.','Now follow the route. The camera, captions, and simulated cursor all move together on one timeline.'];
  const targets=['orbit.overview','orbit.metrics','orbit.map'];
  const common=(s,id)=>({id:id+'.'+s.id,sceneId:s.id,startMs:0,durationMs:s.durationMs});
  return requireProject({studioVersion:STUDIO_VERSION,id:'orbit-studio',title:'A living product story',canvas:{width:960,height:540},scenes,
    captionTheme:{...CAPTION_THEME},cursorTheme:{...CURSOR_THEME},captionTrack:'cc.en',
    assets:scenes.map(s=>({id:'audio.'+s.id,name:'Orbit · '+s.title+' (prepared synthetic voice)',mime:'audio/mpeg',durationMs:s.durationMs+150,source:'sample',sample:'voice.'+s.id})),
    tracks:[
      {id:'camera',kind:'camera',name:'Camera',enabled:true,locked:false,clips:scenes.map((s,i)=>({...common(s,'camera'),offsetMs:0,keys:[{id:'camera.from.'+s.id,atMs:0,target:'orbit.overview',zoom:1,x:0,y:0,easing:'gentle'},{id:'camera.to.'+s.id,atMs:i?1600:1000,target:targets[i],zoom:1,x:0,y:0,easing:'gentle'}]}))},
      {id:'cursor',kind:'cursor',name:'Cursor',enabled:true,locked:false,clips:scenes.map((s,i)=>({...common(s,'cursor'),offsetMs:0,keys:[{id:'cursor.from.'+s.id,atMs:0,target:'orbit.overview',x:-220,y:90,curve:0,easing:'gentle'},{id:'cursor.to.'+s.id,atMs:2500,target:targets[i],x:0,y:0,curve:55,easing:'gentle'}],gestures:[{id:'click.'+s.id,atMs:3300,kind:'click'}]}))},
      {id:'voice',kind:'voice',name:'Voiceover',enabled:true,locked:false,clips:scenes.map((s,i)=>({...common(s,'voice'),assetId:'audio.'+s.id,script:text[i],sourceInMs:0,gain:1,fadeInMs:60,fadeOutMs:100}))},
      {id:'cc.en',kind:'captions',name:'CC · English',language:'en',enabled:true,locked:false,clips:scenes.flatMap((s,i)=>{const parts=text[i].match(/[^.!?]+[.!?]?/gu).map(t=>t.trim()),boundary=Math.round(s.durationMs/parts.length);return parts.map((t,j)=>({id:'cc.'+s.id+'.'+j,sceneId:s.id,startMs:j*boundary,durationMs:j===parts.length-1?s.durationMs-j*boundary:boundary,text:t}));})},
    ]});
}
