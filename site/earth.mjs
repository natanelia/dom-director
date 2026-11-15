/** A deliberately local, illustrative host app. DOM Director never owns its effects. */
const RAD=Math.PI/180;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const lerp=(a,b,t)=>a+(b-a)*t;
export const EARTH_DEFAULT_STATE=Object.freeze({metric:'population',year:2000,region:'world',connections:false,night:false,rotation:28,tilt:12,zoom:1});
const REGIONS={world:{name:'Whole world',rotation:28,tilt:12},asia:{name:'Asia Pacific',rotation:105,tilt:24},europe:{name:'Europe',rotation:18,tilt:42},americas:{name:'The Americas',rotation:-80,tilt:18},africa:{name:'Africa',rotation:20,tilt:0}};
const METRICS={population:{name:'Population',unit:'M',color:'#83dfca',light:'#d9fff3',label:'Sample population',detail:'Millions of people in our sample cities',values:[16,13,11,19,12,8,10,14,9,7,12,6,7,5,10,8,6,8,5,4]},energy:{name:'Clean energy',unit:'%',color:'#ffc17a',light:'#ffeed2',label:'Clean energy share',detail:'Illustrative share of electricity from clean sources',values:[20,18,32,11,14,9,26,12,18,22,8,29,21,12,18,23,15,10,24,28]},connectivity:{name:'Connectivity',unit:'%',color:'#aeb6ff',light:'#ebeaff',label:'Connected population',detail:'Illustrative share with internet access',values:[38,42,30,16,12,15,28,20,14,35,8,25,27,19,16,23,22,12,29,34]}};
// Authored simplified coastlines and fictional statistics; no downloaded geographic dataset.
const COASTS=[
 [[-168,69],[-148,71],[-130,69],[-119,76],[-96,77],[-80,72],[-64,59],[-56,52],[-64,47],[-74,45],[-78,36],[-81,29],[-80,25],[-82,25],[-84,30],[-90,29],[-97,26],[-97,22],[-91,18],[-87,21],[-87,17],[-84,11],[-80,9],[-77,8],[-80,7],[-83,8],[-86,11],[-90,14],[-95,16],[-99,16],[-105,20],[-110,24],[-115,28],[-117,32],[-124,42],[-130,53],[-143,60],[-161,58],[-168,64]],
 [[-81,12],[-71,11],[-61,6],[-50,1],[-35,-6],[-39,-18],[-48,-28],[-54,-35],[-66,-55],[-73,-51],[-75,-38],[-72,-20],[-81,-5]],
 [[-53,82],[-29,80],[-18,70],[-42,59],[-51,63],[-60,75]],
 [[-10,36],[-9,44],[-1,44],[2,50],[9,54],[6,58],[18,71],[31,70],[30,61],[45,67],[65,70],[90,76],[110,74],[132,71],[159,69],[178,65],[170,58],[155,56],[161,49],[145,45],[141,39],[129,36],[122,30],[121,22],[112,19],[109,10],[104,1],[99,8],[97,17],[89,21],[80,8],[76,8],[72,20],[66,24],[56,25],[50,13],[43,13],[35,30],[30,32],[28,40],[22,40],[20,35],[15,38],[12,44],[7,43],[3,41],[-1,36]],
 [[-17,28],[-11,35],[1,37],[11,33],[24,33],[33,30],[36,22],[43,12],[51,11],[43,0],[40,-13],[35,-21],[28,-34],[18,-35],[11,-18],[9,-2],[1,5],[-8,5],[-16,14]],
 [[113,-22],[122,-15],[130,-12],[136,-16],[142,-11],[146,-18],[153,-27],[150,-37],[139,-39],[130,-33],[117,-35],[113,-29]],
 [[-8,50],[-5,58],[-2,59],[1,52]],[[130,31],[135,34],[140,40],[142,45],[145,44],[143,37],[138,34]],
 [[47,-13],[50,-16],[47,-25],[44,-24]],[[95,5],[103,-1],[106,-6],[101,-4]],[[108,7],[117,7],[119,1],[114,-4],[109,-1]],
 [[106,-6],[115,-8],[120,-9],[113,-9]],[[132,-2],[142,-3],[151,-6],[146,-9],[138,-7]],[[166,-35],[174,-41],[172,-46],[168,-45]],
 [[-24,65],[-18,67],[-13,65],[-19,63]],[[44,43],[51,43],[54,39],[49,37]],
];
const CITIES=[['New York',-74,41,'americas'],['Los Angeles',-118,34,'americas'],['Mexico City',-99,19,'americas'],['São Paulo',-47,-24,'americas'],['Buenos Aires',-58,-35,'americas'],['London',0,51,'europe'],['Paris',2,49,'europe'],['Istanbul',29,41,'europe'],['Lagos',3,6,'africa'],['Cairo',31,30,'africa'],['Nairobi',37,-1,'africa'],['Cape Town',18,-34,'africa'],['Mumbai',73,19,'asia'],['Singapore',104,1,'asia'],['Jakarta',107,-6,'asia'],['Shanghai',121,31,'asia'],['Seoul',127,38,'asia'],['Tokyo',140,36,'asia'],['Sydney',151,-34,'asia'],['Melbourne',145,-38,'asia']];
const CONNECTIONS=[[0,5],[0,3],[0,1],[1,17],[3,4],[5,6],[5,8],[6,7],[7,9],[9,10],[10,11],[7,12],[12,13],[13,14],[13,15],[15,16],[16,17],[13,18],[18,19],[8,3]];
const vector=(lon,lat)=>{const c=Math.cos(lat*RAD);return [c*Math.sin(lon*RAD),Math.sin(lat*RAD),c*Math.cos(lon*RAD)];};
const normalized=v=>{const length=Math.hypot(...v);return v.map(n=>n/length);};
const midpoint=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function inTriangle(p,a,b,c){const x=cross(a,b,p),y=cross(b,c,p),z=cross(c,a,p);return (x>=0&&y>=0&&z>=0)||(x<=0&&y<=0&&z<=0);}
function meshPolygon(input){
  const vertices=input.map(p=>p.slice()),triangles=[];
  const area=vertices.reduce((sum,p,i)=>{const q=vertices[(i+1)%vertices.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
  if(area<0)vertices.reverse();
  let budget=vertices.length*vertices.length;
  while(vertices.length>3&&budget--){let clipped=false;
    for(let i=0;i<vertices.length;i++){
      const a=vertices[(i+vertices.length-1)%vertices.length],b=vertices[i],c=vertices[(i+1)%vertices.length];
      if(cross(a,b,c)<=0||vertices.some(p=>p!==a&&p!==b&&p!==c&&inTriangle(p,a,b,c)))continue;
      triangles.push([a,b,c]);vertices.splice(i,1);clipped=true;break;
    }
    if(!clipped)break;
  }
  if(vertices.length===3)triangles.push(vertices);
  const result=[];
  function divide(a,b,c,depth=0){
    const edges=[[a,b,c],[b,c,a],[c,a,b]],longest=edges.map(([p,q])=>Math.hypot(p[0]-q[0],p[1]-q[1]));
    const i=longest.indexOf(Math.max(...longest));
    if(longest[i]>8&&depth<12){const [p,q,r]=edges[i],m=midpoint(p,q);divide(p,m,r,depth+1);divide(m,q,r,depth+1);}
    else result.push([vector(...a),vector(...b),vector(...c)]);
  }
  triangles.forEach(t=>divide(...t));return result;
}
function lineBetween(a,b,steps){
  const av=vector(...a),bv=vector(...b),dot=clamp(av.reduce((s,n,i)=>s+n*bv[i],0),-1,1),angle=Math.acos(dot),sin=Math.sin(angle);
  return Array.from({length:steps+1},(_,i)=>{const t=i/steps;if(Math.abs(sin)<1e-6)return normalized(av.map((n,j)=>lerp(n,bv[j],t)));return av.map((n,j)=>(n*Math.sin((1-t)*angle)+bv[j]*Math.sin(t*angle))/sin);});
}
const LAND=COASTS.flatMap(meshPolygon);
const OUTLINES=COASTS.map(polygon=>polygon.flatMap((p,i)=>{const q=polygon[(i+1)%polygon.length];return lineBetween(p,q,Math.max(2,Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])/3))).slice(0,-1);}));
const GRID=[...[-60,-30,0,30,60].map(lat=>Array.from({length:121},(_,i)=>vector(i*3-180,lat))),...Array.from({length:12},(_,i)=>Array.from({length:61},(_,j)=>vector(i*30,j*3-90)))];
const CITY_VECTORS=CITIES.map(([,lon,lat])=>vector(lon,lat));
const ARCS=CONNECTIONS.map(([a,b])=>lineBetween(CITIES[a].slice(1,3),CITIES[b].slice(1,3),48).map((v,i)=>v.map(n=>n*(1+Math.sin(i/48*Math.PI)*.29))));

function normalizeState(previous,patch){
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new TypeError('Earth state must be an object.');
  const next={...previous};
  for(const [key,value] of Object.entries(patch)){
    if(!Object.hasOwn(EARTH_DEFAULT_STATE,key))throw new TypeError('Unknown Earth setting: '+key);
    if(key==='metric'){if(typeof value!=='string'||!Object.hasOwn(METRICS,value))throw new TypeError('Unknown Earth metric.');next.metric=value;}
    else if(key==='region'){if(typeof value!=='string'||!Object.hasOwn(REGIONS,value))throw new TypeError('Unknown Earth region.');next.region=value;}
    else if(key==='connections'||key==='night'){if(typeof value!=='boolean')throw new TypeError('Earth layer values must be booleans.');next[key]=value;}
    else {if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError('Earth view values must be finite numbers.');next[key]=value;}
  }
  next.year=Math.round(clamp(next.year,2000,2025));next.tilt=clamp(next.tilt,-65,65);next.zoom=clamp(next.zoom,.8,1.35);
  next.rotation=((next.rotation+180)%360+360)%360-180;
  if(Object.hasOwn(patch,'region')&&patch.region!==previous.region){if(!Object.hasOwn(patch,'rotation'))next.rotation=REGIONS[next.region].rotation;if(!Object.hasOwn(patch,'tilt'))next.tilt=REGIONS[next.region].tilt;}
  return next;
}
function valueAt(index,state){const base=METRICS[state.metric].values[index],progress=(state.year-2000)/25;return state.metric==='population'?base*(1+progress*(.22+(index%5)*.09)):Math.min(99,base+progress*(28+(index%6)*6));}
function stats(state){const indices=CITIES.map((_,i)=>i).filter(i=>state.region==='world'||CITIES[i][3]===state.region);const values=indices.map(i=>valueAt(i,state));return {indices,value:values.reduce((a,b)=>a+b,0)/(state.metric==='population'?1:values.length)};}

export function createEarthApp({root,onChange,interactive=true}={}){
  if(!root?.ownerDocument)throw new TypeError('Earth needs a host element.');
  const document=root.ownerDocument,window=document.defaultView,cleanups=[];
  const initialInert=root.inert,initialClass=root.classList.contains('earth-app'),initialPosition=root.style.position;
  const ownsPosition=window.getComputedStyle(root).position==='static';
  if(ownsPosition)root.style.position='relative';
  let state={...EARTH_DEFAULT_STATE},display={...state},disposed=false,raf=null,drag=null,enabled=!!interactive,reducedOverride=null;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('earth-app');
  root.innerHTML=`<header class="earth-topbar"><div class="earth-brand"><span class="earth-brand-icon" aria-hidden="true">◉</span><strong>EARTH<span>OBSERVATORY</span></strong></div><span class="earth-topbar-tab">Explore</span><span class="earth-topbar-note"><i></i> A living planet, in your hands</span><span class="earth-edition">01 / EXPLORE</span></header>
    <div class="earth-workspace"><section class="earth-visual" aria-label="Interactive Earth visualization"><div class="earth-headline"><div><p class="earth-eyebrow">A DIFFERENT PERSPECTIVE</p><h2>One planet. Many stories.</h2></div><span class="earth-live-tag">3D EXPLORER</span></div><div class="earth-globe-wrap"><canvas class="earth-globe" width="1304" height="752" tabindex="0" role="img" aria-label="Interactive 3D Earth. Drag or use arrow keys to rotate. Use plus and minus to zoom."></canvas><div class="earth-globe-caption"><span class="earth-legend-dot"></span><span class="earth-legend">Population</span><span class="earth-region-name">Whole world</span></div><div class="earth-zoom"><button type="button" data-earth-zoom="in" aria-label="Zoom into Earth">+</button><button type="button" data-earth-zoom="out" aria-label="Zoom out of Earth">−</button></div><p class="earth-orbit-help">DRAG TO ROTATE <span>·</span> ARROW KEYS TO EXPLORE</p></div><div class="earth-summary"><div><span class="earth-summary-label">Sample population</span><strong class="earth-summary-value"></strong></div><div><span>Sample cities</span><strong class="earth-city-count">20</strong></div><div><span>Snapshot</span><strong class="earth-snapshot">2000</strong></div><p class="earth-summary-detail"></p></div></section>
    <section class="earth-controls" aria-label="Earth controls"><div class="earth-controls-heading"><span class="earth-eyebrow">MAKE THE WORLD MOVE</span><span class="earth-controls-number">01—05</span></div><fieldset class="earth-control earth-metric-control"><legend><span>01</span> Choose a story</legend><div class="earth-metrics" role="group" aria-label="Statistic to visualize"><button type="button" data-earth-metric="population" aria-pressed="true">Population</button><button type="button" data-earth-metric="energy" aria-pressed="false">Energy</button><button type="button" data-earth-metric="connectivity" aria-pressed="false">Internet</button></div><p>New colors. A new perspective.</p></fieldset>
    <div class="earth-control earth-year-control"><label for="earth-year"><span>02</span> Travel through time <output class="earth-year-value">2000</output></label><input id="earth-year" class="earth-year" type="range" min="2000" max="2025" value="2000" step="1"><div class="earth-range-labels"><span>2000</span><span>2025</span></div></div>
    <div class="earth-control earth-region-control"><label for="earth-region"><span>03</span> Find your region</label><select id="earth-region" class="earth-region"><option value="world">Whole world</option><option value="asia">Asia Pacific</option><option value="europe">Europe</option><option value="americas">The Americas</option><option value="africa">Africa</option></select></div>
    <div class="earth-control earth-layer-control"><button type="button" class="earth-toggle" data-earth-layer="connections" aria-pressed="false"><span><b>04</b> Show connections</span><i aria-hidden="true"></i></button><p>See the links between sample cities.</p></div>
    <div class="earth-control earth-layer-control"><button type="button" class="earth-toggle" data-earth-layer="night" aria-pressed="false"><span><b>05</b> Turn on night view</span><i aria-hidden="true"></i></button><p>A planet that never quite sleeps.</p></div>
    <button type="button" class="earth-reset">↺ Reset world</button></section></div>
    <footer class="earth-footer"><span><i></i> LIVE CONTROLS · REAL CHANGES</span><span>Illustrative demo data · not for analysis</span><span class="earth-coordinates">12° N / 28° E</span></footer>`;
  const $=selector=>root.querySelector(selector),canvas=$('.earth-globe'),context=canvas.getContext('2d');
  if(!context){root.replaceChildren();root.classList.toggle('earth-app',initialClass);if(ownsPosition)root.style.position=initialPosition;throw new Error('This browser cannot draw the Earth demo.');}
  // IDs are unique even if a host mounts multiple controlled applications.
  const suffix=createEarthApp.instances=(createEarthApp.instances||0)+1;
  for(const name of ['year','region']){const input=$('.earth-'+name);input.id='earth-'+name+'-'+suffix;$('.earth-'+name+'-control label').htmlFor=input.id;}
  const targets={'earth.overview':root,'earth.globe':$('.earth-visual'),'earth.metric':$('.earth-metric-control'),'earth.year':$('.earth-year-control'),'earth.region':$('.earth-region-control'),'earth.connections':$('[data-earth-layer="connections"]'),'earth.lighting':$('[data-earth-layer="night"]'),'earth.reset':$('.earth-reset')};
  function on(node,type,fn,options){node.addEventListener(type,fn,options);cleanups.push(()=>node.removeEventListener(type,fn,options));}
  const clickLayer=document.createElement('div');clickLayer.className='earth-click-layer';clickLayer.setAttribute('aria-hidden','true');root.append(clickLayer);
  function clickNode(source){const node=document.createElement('div');node.className='earth-click-feedback';node.dataset.source=source;const ring=document.createElement('span'),dot=document.createElement('span');ring.className='earth-click-ring';dot.className='earth-click-dot';node.append(ring,dot);clickLayer.append(node);return node;}
  const demoClick=clickNode('demo'),manualClicks=new Set();demoClick.hidden=true;
  let clickSample=null,clickPoint=null,lastKeyboard=null,clickRadius=null,clickOpacity=null,appliedMotion=reduced.matches;
  const clickPositions=new WeakMap();
  const motionReduced=()=>reducedOverride??reduced.matches;
  function localPoint(element,client){
    const box=root.getBoundingClientRect();
    if(!box.width||!box.height||!root.clientWidth||!root.clientHeight)return null;
    const target=client?null:element.getBoundingClientRect(),x=client?.x??target.left+target.width/2,y=client?.y??target.top+target.height/2;
    return {x:(x-box.left)*root.clientWidth/box.width,y:(y-box.top)*root.clientHeight/box.height};
  }
  function placeClick(node,point){const previous=clickPositions.get(node);if(previous?.x!==point.x)node.style.left=point.x+'px';if(previous?.y!==point.y)node.style.top=point.y+'px';clickPositions.set(node,point);}
  function hideDemoClick(){if(!demoClick.hidden)demoClick.hidden=true;}
  function paintDemoClick(){
    if(!clickSample||clickSample.progress===1){hideDemoClick();return;}
    clickPoint??=localPoint(targets[clickSample.target]);
    if(!clickPoint){hideDemoClick();return;}
    const progress=clickSample.progress,reduced=motionReduced(),radius=reduced?14:7+28*progress,opacity=reduced?.9:1-progress;
    if(demoClick.hidden)demoClick.hidden=false;placeClick(demoClick,clickPoint);
    if(demoClick.dataset.static!==String(reduced))demoClick.dataset.static=String(reduced);
    if(clickOpacity!==opacity){demoClick.style.opacity=String(opacity);clickOpacity=opacity;}
    if(clickRadius!==radius){const ring=demoClick.firstElementChild;ring.style.width=ring.style.height=radius*2+'px';clickRadius=radius;}
  }
  /** Pure presentation sample. It has no timer, application action or input dispatch. */
  function setClickFeedback(sample){
    if(disposed)return;
    // A paused Director observes this scene. Rewriting an unchanged attribute would
    // invalidate it, render this same sample again and keep a mutation loop alive.
    if(sample===null){if(clickSample===null)return;clickSample=null;clickPoint=null;hideDemoClick();delete demoClick.dataset.target;delete demoClick.dataset.progress;return;}
    if(!sample||typeof sample!=='object'||Array.isArray(sample)||typeof sample.target!=='string'||!Object.hasOwn(targets,sample.target))throw new TypeError('Unknown Earth click target.');
    if(typeof sample.progress!=='number'||!Number.isFinite(sample.progress)||sample.progress<0||sample.progress>1)throw new RangeError('Earth click progress must be between zero and one.');
    if(clickSample?.target===sample.target&&clickSample.progress===sample.progress)return;
    if(clickSample?.target!==sample.target)clickPoint=null;
    clickSample={target:sample.target,progress:sample.progress};
    if(demoClick.dataset.target!==sample.target)demoClick.dataset.target=sample.target;
    if(demoClick.dataset.progress!==String(sample.progress))demoClick.dataset.progress=String(sample.progress);
    paintDemoClick();
  }
  function removeManualClick(entry){
    window.clearTimeout(entry.timer);for(const animation of entry.animations){animation.onfinish=null;animation.cancel();}entry.node.remove();manualClicks.delete(entry);
  }
  function makeStaticClick(entry){
    for(const animation of entry.animations){animation.onfinish=null;animation.cancel();}entry.animations=[];
    entry.node.dataset.static='true';entry.node.firstElementChild.style.width=entry.node.firstElementChild.style.height='28px';
  }
  function showManualClick(element,client){
    if(!enabled||disposed)return;const point=localPoint(element,client);if(!point)return;
    while(manualClicks.size>=3)removeManualClick(manualClicks.values().next().value);
    const node=clickNode('manual'),entry={node,animations:[],timer:null};placeClick(node,point);manualClicks.add(entry);
    const reduced=motionReduced(),ring=node.firstElementChild,dot=node.lastElementChild;
    node.dataset.static=String(reduced);
    if(reduced){ring.style.width=ring.style.height='28px';}
    else {
      const animation=ring.animate([{width:'14px',height:'14px',opacity:1},{width:'70px',height:'70px',opacity:0}],{duration:700,easing:'linear',fill:'both'});
      entry.animations.push(animation,dot.animate([{opacity:1},{opacity:0}],{duration:700,easing:'linear',fill:'both'}));
      animation.onfinish=()=>removeManualClick(entry);
    }
    entry.timer=window.setTimeout(()=>removeManualClick(entry),reduced?350:700);
  }
  function manualTarget(event){const element=event.target.closest?.('button,input,select,canvas');return element&&root.contains(element)?element:null;}
  on(root,'pointerdown',event=>{if(event.button!==0)return;const element=manualTarget(event);if(element)showManualClick(element,{x:event.clientX,y:event.clientY});},true);
  on(root,'keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||!['Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','+','=','-'].includes(event.key))return;
    const element=manualTarget(event);if(!element)return;lastKeyboard={element,at:window.performance.now()};showManualClick(element);
  },true);
  // Assistive-technology and native keyboard activation may arrive without a pointer event.
  on(root,'click',event=>{if(event.detail!==0)return;const element=manualTarget(event);if(element&&!(lastKeyboard?.element===element&&window.performance.now()-lastKeyboard.at<250))showManualClick(element);},true);
  function updateDom(){
    const metric=METRICS[state.metric],summary=stats(state);
    root.style.setProperty('--earth-accent',metric.color);root.dataset.earthMetric=state.metric;root.dataset.earthYear=String(state.year);root.dataset.earthRegion=state.region;root.dataset.earthConnections=String(state.connections);root.dataset.earthNight=String(state.night);
    root.querySelectorAll('[data-earth-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.earthMetric===state.metric)));
    $('.earth-year').value=String(state.year);$('.earth-year').style.setProperty('--earth-progress',(state.year-2000)*4+'%');$('.earth-year-value').textContent=String(state.year);
    $('.earth-region').value=state.region;$('.earth-region-name').textContent=REGIONS[state.region].name;$('.earth-legend').textContent=metric.name;
    $('[data-earth-layer="connections"]').setAttribute('aria-pressed',String(state.connections));$('[data-earth-layer="night"]').setAttribute('aria-pressed',String(state.night));
    $('.earth-summary-label').textContent=metric.label;$('.earth-summary-value').textContent=summary.value.toFixed(1)+metric.unit;$('.earth-city-count').textContent=String(summary.indices.length);$('.earth-snapshot').textContent=String(state.year);$('.earth-summary-detail').textContent=metric.detail;
    $('.earth-coordinates').textContent=Math.abs(Math.round(state.tilt))+'° '+(state.tilt>=0?'N':'S')+' / '+Math.abs(Math.round(state.rotation))+'° '+(state.rotation>=0?'E':'W');
    canvas.setAttribute('aria-label',`Interactive 3D Earth. ${REGIONS[state.region].name}, ${metric.name}, ${state.year}: ${summary.value.toFixed(1)}${metric.unit} across ${summary.indices.length} sample cities. Illustrative data. Drag or use arrow keys to rotate; plus and minus to zoom.`);
  }
  function frame(view){
    if(disposed)return;
    const ctx=context,W=652,H=376,cx=326,cy=179,r=153*view.zoom,metric=METRICS[view.metric],theta=view.rotation*RAD,phi=view.tilt*RAD,st=Math.sin(theta),ct=Math.cos(theta),sp=Math.sin(phi),cp=Math.cos(phi);
    ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,W,H);
    const turn=v=>{const x=v[0]*ct-v[2]*st,z=v[0]*st+v[2]*ct;return [x,v[1]*cp-z*sp,v[1]*sp+z*cp];};
    const project=(p,scale=1)=>[cx+p[0]*r*scale,cy-p[1]*r*scale];
    function circle(x,y,rad,fill){ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
    function path(points,predicate=()=>true){let begun=false;ctx.beginPath();for(const v of points){const p=turn(v),valid=predicate(p);if(!valid){begun=false;continue;}const [x,y]=project(p);if(begun)ctx.lineTo(x,y);else{ctx.moveTo(x,y);begun=true;}}ctx.stroke();}
    function arcs(front){if(!view.connections)return;ctx.lineWidth=1.3;ctx.strokeStyle=view.night?'rgba(150,232,220,.68)':'rgba(155,222,208,.5)';for(let i=0;i<ARCS.length;i++){const [a,b]=CONNECTIONS[i];if(view.region!=='world'&&CITIES[a][3]!==view.region&&CITIES[b][3]!==view.region)continue;path(ARCS[i],p=>front?p[2]>=0:p[2]<0);}}
    const halo=ctx.createRadialGradient(cx,cy,r*.85,cx,cy,r*1.25);halo.addColorStop(0,'rgba(79,160,177,0)');halo.addColorStop(.65,view.night?'rgba(46,120,154,.15)':'rgba(65,153,176,.16)');halo.addColorStop(1,'rgba(39,98,134,0)');circle(cx,cy,r*1.25,halo);
    arcs(false);
    const ocean=ctx.createRadialGradient(cx-r*.45,cy-r*.45,r*.05,cx,cy,r*1.05);ocean.addColorStop(0,view.night?'#102c3b':'#24565b');ocean.addColorStop(.57,view.night?'#0b1e2d':'#12343f');ocean.addColorStop(1,'#06101b');circle(cx,cy,r,ocean);
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
    ctx.beginPath();
    for(const triangle of LAND){
      const points=triangle.map(turn),clipped=[];
      for(let i=0;i<3;i++){const a=points[i],b=points[(i+1)%3];if(a[2]>=0)clipped.push(a);if((a[2]>=0)!==(b[2]>=0)){const t=a[2]/(a[2]-b[2]);clipped.push(normalized(a.map((n,j)=>lerp(n,b[j],t))));}}
      if(clipped.length<3)continue;
      clipped.forEach((p,i)=>{const [x,y]=project(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();
    }
    ctx.fillStyle=view.night?'#123b3f':'#387c73';ctx.fill();
    ctx.lineWidth=.7;ctx.strokeStyle=view.night?'rgba(73,129,133,.35)':'rgba(144,209,189,.46)';for(const line of OUTLINES)path([...line,line[0]],p=>p[2]>.006);
    ctx.lineWidth=.5;ctx.strokeStyle=view.night?'rgba(112,153,170,.1)':'rgba(142,199,200,.16)';GRID.forEach(line=>path(line,p=>p[2]>=0));
    const shade=ctx.createLinearGradient(cx-r,cy-r*.3,cx+r,cy+r*.5);shade.addColorStop(0,'rgba(170,230,220,.04)');shade.addColorStop(.45,'rgba(0,0,0,0)');shade.addColorStop(1,view.night?'rgba(0,4,15,.76)':'rgba(0,6,20,.66)');ctx.fillStyle=shade;ctx.fillRect(cx-r,cy-r,r*2,r*2);
    const rim=ctx.createRadialGradient(cx,cy,r*.83,cx,cy,r);rim.addColorStop(0,'rgba(0,0,0,0)');rim.addColorStop(.8,'rgba(75,157,174,.03)');rim.addColorStop(1,'rgba(92,180,205,.31)');circle(cx,cy,r,rim);
    ctx.restore();ctx.beginPath();ctx.arc(cx,cy,r+.4,0,Math.PI*2);ctx.strokeStyle='rgba(111,190,206,.35)';ctx.lineWidth=.8;ctx.stroke();
    arcs(true);
    const markers=CITY_VECTORS.map((v,index)=>({point:turn(v),index})).filter(x=>x.point[2]>.04).sort((a,b)=>a.point[2]-b.point[2]);
    const labels=[];
    for(const {point,index} of markers){
      const active=view.region==='world'||CITIES[index][3]===view.region,value=valueAt(index,view),height=(.045+value/(view.metric==='population'?35:100)*.20)*(active?1:.35),base=project(point),tip=project(point,1+height),alpha=active?(.45+.55*point[2]):.15;
      ctx.globalAlpha=alpha;
      if(view.night){const glow=ctx.createRadialGradient(...base,0,...base,9);glow.addColorStop(0,'rgba(255,203,128,.65)');glow.addColorStop(1,'rgba(255,190,100,0)');circle(...base,9,glow);}
      circle(...base,active?3.3:1.9,metric.color+'55');ctx.beginPath();ctx.moveTo(...base);ctx.lineTo(...tip);ctx.strokeStyle=metric.color;ctx.lineWidth=active?2.8:1.4;ctx.lineCap='round';ctx.stroke();circle(...tip,active?2.5:1.4,metric.light);
      if(active&&point[2]>.65&&labels.length<4){const text=CITIES[index][0],x=tip[0]+(point[0]>0?7:-7),y=tip[1]-5,width=text.length*5,box={left:x-(point[0]>0?0:width),right:x+(point[0]>0?width:0),top:y-10,bottom:y+3};if(labels.every(b=>b.right+5<box.left||b.left>box.right+5||b.bottom+4<box.top||b.top>box.bottom+4)){ctx.font='9px system-ui,sans-serif';ctx.fillStyle='#d6e8e5';ctx.textAlign=point[0]>0?'left':'right';ctx.fillText(text,x,y);labels.push(box);}}
    }
    ctx.globalAlpha=1;ctx.lineCap='butt';
  }
  function cancel(){if(raf!==null){window.cancelAnimationFrame(raf);raf=null;}if(root.dataset.earthRendering!=='false')root.dataset.earthRendering='false';}
  function setState(patch,{animate=true}={}){
    if(disposed)return;
    const next=normalizeState(state,patch),changed=Object.keys(next).some(k=>next[k]!==state[k]);state=next;
    if(!changed&&!raf)return;
    cancel();updateDom();
    const moving=['rotation','tilt','zoom','year'].some(key=>display[key]!==state[key]);
    if(!animate||!moving||(reducedOverride??reduced.matches)){display={...state};frame(display);return;}
    const from={...display},to={...state},start=window.performance.now(),rotationDelta=((to.rotation-from.rotation+540)%360)-180;
    function tick(now){if(disposed)return;const t=clamp((now-start)/550,0,1),ease=1-(1-t)**3;
      display={...to,rotation:from.rotation+rotationDelta*ease,tilt:lerp(from.tilt,to.tilt,ease),zoom:lerp(from.zoom,to.zoom,ease),year:lerp(from.year,to.year,ease)};frame(display);
      if(t<1)raf=window.requestAnimationFrame(tick);else{raf=null;display={...to};root.dataset.earthRendering='false';}
    }
    root.dataset.earthRendering='true';raf=window.requestAnimationFrame(tick);
  }
  function userChange(control,patch,options){if(!enabled||disposed)return;const before=state;setState(patch,options);if(Object.keys(state).some(key=>state[key]!==before[key]))onChange?.({...state},{control,source:'user'});}
  root.querySelectorAll('[data-earth-metric]').forEach(button=>on(button,'click',()=>userChange('metric',{metric:button.dataset.earthMetric})));
  on($('.earth-year'),'input',event=>userChange('year',{year:Number(event.target.value)},{animate:false}));
  on($('.earth-region'),'change',event=>userChange('region',{region:event.target.value}));
  on($('[data-earth-layer="connections"]'),'click',()=>userChange('connections',{connections:!state.connections}));
  on($('[data-earth-layer="night"]'),'click',()=>userChange('lighting',{night:!state.night}));
  on($('.earth-reset'),'click',()=>userChange('reset',{...EARTH_DEFAULT_STATE}));
  root.querySelectorAll('[data-earth-zoom]').forEach(button=>on(button,'click',()=>userChange('globe',{zoom:state.zoom+(button.dataset.earthZoom==='in'?.1:-.1)})));
  on(canvas,'pointerdown',event=>{if(!enabled||event.button!==0)return;const rect=canvas.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,rotation:state.rotation,tilt:state.tilt,scale:652/Math.max(1,rect.width)};canvas.setPointerCapture(event.pointerId);canvas.classList.add('earth-dragging');});
  on(canvas,'pointermove',event=>{if(!drag||event.pointerId!==drag.id||!enabled)return;userChange('globe',{rotation:drag.rotation-(event.clientX-drag.x)*drag.scale*.32,tilt:drag.tilt+(event.clientY-drag.y)*drag.scale*.27},{animate:false});});
  function release(event){if(!drag||event.pointerId!==drag.id)return;drag=null;canvas.classList.remove('earth-dragging');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}
  on(canvas,'pointerup',release);on(canvas,'pointercancel',release);on(canvas,'lostpointercapture',()=>{drag=null;canvas.classList.remove('earth-dragging');});
  on(canvas,'keydown',event=>{const changes={ArrowLeft:{rotation:state.rotation-12},ArrowRight:{rotation:state.rotation+12},ArrowUp:{tilt:state.tilt+8},ArrowDown:{tilt:state.tilt-8},'+':{zoom:state.zoom+.1},'=':{zoom:state.zoom+.1},'-':{zoom:state.zoom-.1},Home:{...EARTH_DEFAULT_STATE}};if(!enabled||!changes[event.key])return;event.preventDefault();event.stopPropagation();userChange('globe',changes[event.key]);});
  const resize=new window.ResizeObserver(()=>{if(!disposed){frame(display);clickPoint=null;paintDemoClick();}});resize.observe(root);
  function applyMotionPreference(){const value=motionReduced();if(appliedMotion===value)return;appliedMotion=value;root.dataset.earthReducedMotion=String(value);if(value){cancel();display={...state};frame(display);for(const entry of manualClicks)makeStaticClick(entry);}paintDemoClick();}
  on(reduced,'change',applyMotionPreference);
  function setReducedMotion(value){if(disposed)return;if(typeof value!=='boolean'&&value!==null)throw new TypeError('Earth motion preference must be a boolean or null.');if(reducedOverride===value)return;reducedOverride=value;applyMotionPreference();}
  function setInteractive(value){if(disposed)return;enabled=!!value;root.inert=!enabled;root.dataset.earthInteractive=String(enabled);if(!enabled){const id=drag?.id;drag=null;canvas.classList.remove('earth-dragging');if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);for(const entry of manualClicks)removeManualClick(entry);}}
  setInteractive(interactive);root.dataset.earthRendering='false';root.dataset.earthReducedMotion=String(reduced.matches);updateDom();frame(display);
  return {targets,getState:()=>({...state}),setState,setInteractive,setReducedMotion,setClickFeedback,reset:()=>setState({...EARTH_DEFAULT_STATE}),destroy(){if(disposed)return;disposed=true;cancel();resize.disconnect();cleanups.splice(0).forEach(off=>off());for(const entry of manualClicks)removeManualClick(entry);clickSample=null;clickPoint=null;root.inert=initialInert;root.classList.toggle('earth-app',initialClass);if(ownsPosition&&root.style.position==='relative')root.style.position=initialPosition;root.style.removeProperty('--earth-accent');for(const key of ['earthMetric','earthYear','earthRegion','earthConnections','earthNight','earthInteractive','earthRendering','earthReducedMotion'])delete root.dataset[key];root.replaceChildren();}};
}
