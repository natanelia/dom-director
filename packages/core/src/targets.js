import {requireValue} from './errors.js';
import {rect} from './geometry.js';
const ID=/^[A-Za-z][A-Za-z0-9._-]{0,79}$/u;
/** Host resolvers are trusted code, never supplied in portable scripts. */
export function createTargetRegistry(entries={}, {privateTargets=[]}={}){
  const targets=new Map(),listeners=new Set(),grants=new Set(privateTargets);let revision=0;
  const invalidate=()=>{revision++;for(const listener of [...listeners]){try{listener(revision);}catch{/* Observer isolation. */}}};
  function register(id,definition){
    requireValue(ID.test(id)&&!targets.has(id),'TARGET_REGISTRATION','Target IDs must be valid and unique.');
    const value=typeof definition==='function'?{resolve:definition,label:id}:definition;
    requireValue(value&&typeof value.label==='string'&&value.label.length>0&&value.label.length<=200&&
      (typeof value.resolve==='function'||typeof value.bounds==='function')&&
      ['public','private','secret'].includes(value.sensitivity||'public'),'TARGET_REGISTRATION','A target needs a label, sensitivity and a host resolver.');
    targets.set(id,Object.freeze({...value,sensitivity:value.sensitivity||'public'}));invalidate();
    let active=true;return()=>{if(active){active=false;targets.delete(id);invalidate();}};
  }
  for(const [id,definition]of Object.entries(entries))register(id,definition);
  return {register,invalidate,get revision(){return revision;},has:id=>targets.has(id),
    descriptor(id){const value=targets.get(id);requireValue(value,'TARGET_UNREGISTERED','Target is not registered.');return value;},
    resolve(id){
      const definition=this.descriptor(id);
      requireValue(definition.sensitivity==='public'||definition.sensitivity==='private'&&grants.has(id),'TARGET_DENIED','Target is outside the host visibility grant.');
      const value=definition.resolve?.();
      requireValue(!value||value.nodeType===1,'TARGET_AMBIGUOUS','Resolver must return exactly one element or null.');
      if(definition.bounds){const bound=definition.bounds();requireValue(bound&&['scene','client'].includes(bound.space),'TARGET_SPACE','Virtual bounds must declare their coordinate space.');requireValue(bound.visible!==false,'TARGET_HIDDEN','Target is not visible.');return {virtual:true,space:bound.space,rect:rect(bound),element:value,approximate:!!bound.approximate};}
      requireValue(value?.isConnected,'TARGET_MISSING','Target is not currently available.');
      const win=value.ownerDocument.defaultView,css=win.getComputedStyle(value);
      requireValue(css.visibility!=='hidden'&&css.visibility!=='collapse'&&value.getClientRects().length>0,'TARGET_HIDDEN','Target is not visible.');
      return {element:value};
    },
    catalog(){return [...targets].filter(([,d])=>d.sensitivity==='public').map(([id,d])=>({id,label:d.label,kind:d.bounds?'virtual':'dom'}));},
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}
  };
}
export function createGeometryCache(surface,registry){
  let key='',snapshot=null,dirty=true,reads=0,elements=[],generation=0;
  const win=surface.scene.ownerDocument.defaultView,resize=new win.ResizeObserver(()=>{dirty=true;});
  const off=[surface.subscribe(()=>{dirty=true;}),registry.subscribe(()=>{dirty=true;})];
  return {get reads(){return reads;},invalidate(){dirty=true;},
    measure(ids){
      const ordered=[...new Set(ids)].sort(),next=ordered.join('\0'),dynamic=ordered.some(id=>registry.descriptor(id).dynamic===true);
      if(!dirty&&!dynamic&&key===next&&snapshot&&elements.every(el=>el.isConnected))return snapshot;
      const resolved=ordered.map(id=>registry.resolve(id)),dom=resolved.filter(t=>!t.virtual),base=surface.snapshot(dom.map(t=>t.element));reads+=dom.length;
      const nextElements=dom.map(t=>t.element);
      if(nextElements.length!==elements.length||nextElements.some((el,i)=>el!==elements[i])){
        resize.disconnect();nextElements.forEach(el=>resize.observe(el));elements=nextElements;
      }
      const bounds=Object.create(null);let index=0;
      ordered.forEach((id,i)=>{bounds[id]=resolved[i].virtual?{...resolved[i],revision:surface.revision}:base.bounds[index++];});
      snapshot={...base,bounds,registryRevision:registry.revision,geometryRevision:++generation};key=next;dirty=false;return snapshot;
    },destroy(){off.forEach(fn=>fn());resize.disconnect();elements=[];snapshot=null;key='';}
  };
}
