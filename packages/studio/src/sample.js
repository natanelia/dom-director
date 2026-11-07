import {STUDIO_VERSION,CAPTION_THEME,CURSOR_THEME,requireProject} from './project.js';
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
