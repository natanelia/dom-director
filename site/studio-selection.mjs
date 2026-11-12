import {findClip} from './studio-sdk/index.js';
import {selectionBounds,includeLinkedClips,moveClips,duplicateClips,deleteClips,createSelectionSnapper,matchClipAppearance,setVoiceMix} from './studio-sdk/selection.js';

/** UI-only selection. All project edits still use the host's revision-checked commit. */
export function createSelectionTools(host){
  const doc=host.document,$=id=>doc.getElementById(id),off=[];
  let group=[],disposed=false,cancelDrag=null,suppressClick=false;
  $('clip-list').textContent='Select clips';$('clip-list').title='Choose one or more clips across tracks';
  $('loop').textContent='Loop selection';$('loop').setAttribute('aria-label','Loop selected range');
  const snapshot=()=>host.snapshot(),project=()=>snapshot().project;
  const ids=()=>group.length>1?[...group]:host.active().clipId?[host.active().clipId]:[];
  const focusClip=id=>[...$('lanes').querySelectorAll('button[data-clip]')].find(n=>n.dataset.clip===id)?.focus({preventScroll:true});
  const textTime=ms=>(ms/1000).toFixed(3)+'s';
  function on(target,type,fn,options){target.addEventListener(type,fn,options);off.push(()=>target.removeEventListener(type,fn,options));}
  function el(tag,text,parent){const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;}
  function button(id,text,parent,fn){const b=el('button',text,parent);b.type='button';b.id=id;b.addEventListener('click',fn);return b;}
  function activate(id){const {track,clip}=findClip(project(),id);host.setActive({sceneId:clip.sceneId,kind:track.kind,clipId:id,keyId:clip.keys?.[0]?.id||null});}
  function normalize(){
    if(disposed)return false;
    const available=new Set(project().tracks.flatMap(t=>t.clips.map(c=>c.id)));
    const prior=group.length;group=group.filter(id=>available.has(id));
    if(prior>1&&group.length===1)activate(group[0]);
    if(group.length<2){group=[];return false;}
    if(!group.includes(host.active().clipId))activate(group[0]);
    return true;
  }
  function clear(){cancelDrag?.();if(group.length>1)host.resetLoop();group=[];}
  function set(values,primary=values[0],{focus=false}={}){
    cancelDrag?.();const range=selectionBounds(project(),values);
    if(range.clipIds.length===1){clear();host.selectSingle(range.clipIds[0]);if(focus)focusClip(range.clipIds[0]);return;}
    group=[...range.clipIds];
    activate(range.clipIds.includes(primary)?primary:range.clipIds[0]);
    host.stop();host.resetLoop();host.refresh();
    if(focus)focusClip(host.active().clipId);
    host.message(range.clipIds.length+' clip'+(range.clipIds.length===1?'':'s')+' selected. Selection does not change your project.');
  }
  function toggle(id){
    if(!host.ensure())return;
    const current=new Set(ids());if(current.has(id)){if(current.size===1)return;current.delete(id);}else current.add(id);
    set([...current],current.has(host.active().clipId)?host.active().clipId:[...current][0],{focus:true});
  }
  function includeLinks(){if(!host.ensure())return;set(includeLinkedClips(project(),ids()),host.active().clipId);}
  function safe(work){if(!host.ensure())return;try{return work();}catch(error){host.message(error.message,true);return false;}}
  function move(delta,focus=false){return safe(()=>{
    if($('ripple').checked)throw Error('Turn Ripple off before moving a selection. Group edits never move unselected clips.');
    const before=snapshot(),selected=ids();host.commit(moveClips(before.project,selected,delta),'Move '+selected.length+' clips',before.revision);
    if(focus)focusClip(host.active().clipId);return true;
  });}
  function duplicate(delta){return safe(()=>{
    const before=snapshot(),selected=ids(),result=duplicateClips(before.project,selected,delta);
    host.commit(result.value,'Duplicate '+selected.length+' clips',before.revision);set(result.clipIds,result.clipIds[0]);return true;
  });}
  function remove(){return safe(()=>{
    const before=snapshot(),selected=ids();host.commit(deleteClips(before.project,selected),'Delete '+selected.length+' clips',before.revision);
    group=[];host.refresh();$('clip-list').focus({preventScroll:true});return true;
  });}
  function offset(){const input=$('selection-offset');
    if(!input||!input.checkValidity()||!Number.isFinite(input.valueAsNumber))throw Error('Enter an offset in seconds, with up to three decimal places.');
    return Math.round(input.valueAsNumber*1000);
  }
  function duplicateWithOffset(){return safe(()=>duplicate(offset()));}
  function renderVoiceMix(root,rows){
    const section=el('details',undefined,root);section.id='selection-voice-mix';
    el('summary','Voice mix',section);
    const summary=el('p',undefined,section);summary.className='note';
    const range=(key,format)=>{const values=rows.map(row=>row.clip[key]),low=Math.min(...values),high=Math.max(...values);
      return low===high?format(low):format(low)+'–'+format(high);};
    summary.textContent='Current volume: '+range('gain',n=>String(Math.round(n*100000)/1000)+'%')+
      ' · fade in: '+range('fadeInMs',textTime)+' · fade out: '+range('fadeOutMs',textTime)+'.';
    const hint=el('p','Blank keeps each clip’s value. Apply mix updates all selected voices; takes and timing stay unchanged. Volume is absolute, not loudness normalization.',section);
    hint.className='note';hint.id='selection-mix-hint';
    const form=el('form',undefined,section);form.noValidate=true;form.id='selection-mix-form';
    const controls=[];
    for(const [key,id,labelText,max,step,scale] of [
      ['gain','volume','Volume (%)',200,'any',.01],
      ['fadeInMs','fade-in','Fade in (seconds)',180,'.001',1000],
      ['fadeOutMs','fade-out','Fade out (seconds)',180,'.001',1000],
    ]){
      const label=el('label',labelText,form);label.className='field';
      const input=el('input',undefined,label);input.type='number';input.id='selection-mix-'+id;
      input.min='0';input.max=String(max);input.step=step;input.placeholder='Keep existing';
      input.setAttribute('aria-describedby','selection-mix-hint selection-mix-status');
      controls.push({key,input,scale});
    }
    const status=el('p','No new settings. Enter a value, then apply.',form);status.id='selection-mix-status';status.className='note';status.setAttribute('role','status');
    const apply=el('button','Apply mix',form);apply.type='submit';apply.id='selection-mix-apply';apply.disabled=true;
    form.addEventListener('input',()=>{
      host.stop();for(const {input} of controls)input.removeAttribute('aria-invalid');
      apply.disabled=!controls.some(({input})=>input.value!==''||input.validity.badInput);
      status.textContent='Not applied yet. Choose Apply mix to update the selected clips.';
    });
    form.addEventListener('submit',event=>{
      event.preventDefault();if(!host.ensure())return;
      const values=controls.map(({input})=>input.value),changes={};
      try{
        for(const {key,input,scale} of controls){
          if(!input.checkValidity()){
            input.setAttribute('aria-invalid','true');input.focus();
            throw Error(key==='gain'?'Enter a volume from 0% to 200%.':'Enter a fade from 0 to 180 seconds, with up to three decimal places.');
          }
          if(input.value==='')continue;
          const value=input.valueAsNumber*scale;
          if(!Number.isFinite(value))throw Error('Enter a finite mix value.');
          changes[key]=scale===1000?Math.round(value):value;
        }
        const before=snapshot();
        host.commit(setVoiceMix(before.project,ids(),changes),'Update selected voice mix',before.revision);
        $('selection-voice-mix').open=true;
        for(let i=0;i<controls.length;i++)$(controls[i].input.id).value=values[i];
        $('selection-mix-apply').disabled=false;$('selection-mix-apply').focus({preventScroll:true});
        $('selection-mix-status').textContent='Mix applied. Undo restores all selected clips together.';
      }catch(error){
        status.textContent=error.message;host.message(error.message,true);
        if(error.code==='VOICE_MIX_FADE_RANGE')for(const {key,input} of controls)if(key!=='gain')input.setAttribute('aria-invalid','true');
      }
    });
  }
  function renderInspector(root){
    if(!normalize())return false;
    const range=selectionBounds(project(),group),rows=group.map(id=>findClip(project(),id));
    for(const b of doc.querySelectorAll('.inspector-tabs [data-kind]'))b.setAttribute('aria-pressed','false');
    el('span','MULTI-CLIP EDIT',root).className='eyebrow';
    const heading=el('h2',group.length+' clips selected',root);heading.id='selection-heading';
    const trackCount=new Set(rows.map(r=>r.track.id)).size;
    el('p','From '+textTime(range.startMs)+' to '+textTime(range.endMs)+' · '+trackCount+' '+(trackCount===1?'track':'tracks')+'.',root).className='context';
    const kind=rows[0].track.kind;
    if(kind==='voice'&&rows.every(row=>row.track.kind===kind))renderVoiceMix(root,rows);
    const instructions=el('p','Shift/Ctrl/Cmd-click clips to change the group, or use Select clips. Drag a selected clip to move the group. Moves stay in the original scenes; no ripple or group trim.',root);instructions.className='note';
    if(rows.some(r=>r.track.locked))el('p','This selection includes a locked track. Unlock it or remove its clips before editing.',root).className='warning';
    if($('ripple').checked)el('p','Turn Ripple off to move this group without changing unselected clips.',root).className='warning';
    const label=el('label','Offset (seconds)',root);label.className='field';
    const input=el('input',undefined,label);input.id='selection-offset';input.type='number';input.min='-1800';input.max='1800';input.step='.001';input.required=true;input.value='0.250';
    const hint=el('p','A positive offset moves later; a negative offset moves earlier. Overlaps and scene boundaries reject the whole edit.',root);hint.id='selection-offset-hint';hint.className='note';input.setAttribute('aria-describedby',hint.id);
    const actions=el('div',undefined,root);actions.className='actions selection-actions';
    button('selection-move','Move by offset',actions,()=>safe(()=>move(offset())));
    button('selection-at-playhead','Start at playhead',actions,()=>safe(()=>move(Math.round(host.time())-selectionBounds(project(),ids()).startMs)));
    button('selection-duplicate','Duplicate by offset',actions,()=>duplicateWithOffset());
    button('selection-delete','Delete selected clips',actions,remove);
    if((kind==='captions'||kind==='cursor')&&rows.every(row=>row.track.kind===kind)){
      const section=el('details',undefined,root);section.id='selection-appearance';
      el('summary','Match appearance',section);
      const label=el('label','Copy look from',section);label.className='field';
      const source=el('select',undefined,label);source.id='selection-style-source';
      for(const row of rows){
        const title=project().scenes.find(scene=>scene.id===row.clip.sceneId).title;
        const option=el('option',title+' · '+row.track.name+' · '+textTime(row.clip.startMs),source);option.value=row.clip.id;
      }
      source.value=host.active().clipId;
      const note=el('p','Copy the chosen clip’s full visible '+(kind==='captions'?'caption':'cursor')+' style to the other selected clips as explicit overrides. Existing per-clip styling is replaced; text, timing, narration, paths and word links stay unchanged. Undo restores the previous looks.',section);
      note.id='selection-style-hint';note.className='note';source.setAttribute('aria-describedby',note.id);
      button('selection-match-style','Apply appearance',section,()=>safe(()=>{
        const before=snapshot(),sourceId=source.value;
        host.commit(matchClipAppearance(before.project,sourceId,ids()),'Match selected '+(kind==='captions'?'caption':'cursor')+' appearance',before.revision);
        $('selection-style-source').value=sourceId;
        $('selection-appearance').open=true;$('selection-match-style').focus({preventScroll:true});
      }));
    }
    const dependents=includeLinkedClips(project(),group);
    if(dependents.length!==group.length)button('selection-linked','Include linked clips ('+dependents.length+')',root,includeLinks);
    button('selection-single','Edit only the primary clip',root,()=>{const id=host.active().clipId;clear();host.selectSingle(id);});
    el('p','Split and trim one clip at a time. A group is temporary: saving keeps the edited project, not the selection.',root).className='note';
    return true;
  }
  function openList(){safe(()=>{
    const before=snapshot(),pending=new Set(ids());let count,apply,error;
    const boxes=[];
    function update(){count.textContent=pending.size+' selected';apply.disabled=pending.size===0;for(const box of boxes)box.checked=pending.has(box.dataset.selectionClip);}
    host.modal('Select clips',body=>{
      el('p','Choose clips across tracks. Apply selection does not edit the project. Locked tracks remain locked.',body);
      count=el('p','',body);count.setAttribute('role','status');
      const actions=el('div',undefined,body);actions.className='actions';
      button('selection-scene','Select this scene',actions,()=>{pending.clear();for(const t of before.project.tracks)for(const c of t.clips)if(c.sceneId===host.active().sceneId)pending.add(c.id);update();});
      button('selection-none','Clear choices',actions,()=>{pending.clear();update();});
      button('selection-list-linked','Include linked clips',actions,()=>{if(!pending.size)return;try{for(const id of includeLinkedClips(before.project,[...pending]))pending.add(id);update();}catch(e){error.textContent=e.message;}});
      const scenes=new Map(before.project.scenes.map(s=>[s.id,s.title]));
      for(const track of before.project.tracks){
        const fieldset=el('fieldset',undefined,body);fieldset.className='selection-track';el('legend',track.name+(track.locked?' · locked':''),fieldset);
        for(const clip of track.clips){const label=el('label',undefined,fieldset);label.className='selection-choice';
          const box=el('input',undefined,label);box.type='checkbox';box.dataset.selectionClip=clip.id;boxes.push(box);
          el('span',scenes.get(clip.sceneId)+' · '+textTime(clip.startMs)+'–'+textTime(clip.startMs+clip.durationMs)+(clip.text?' · '+clip.text:''),label);
          box.addEventListener('change',()=>{if(box.checked)pending.add(clip.id);else pending.delete(clip.id);update();});
        }
      }
      error=el('p','',body);error.className='error';error.setAttribute('role','alert');
    },[['Cancel',host.closeDialog],['Apply selection',()=>{
      if(!pending.size)return;
      if(snapshot().revision!==before.revision){error.textContent='The project changed. Close this dialog and choose clips again.';return;}
      const values=[...pending],primary=values.includes(host.active().clipId)?host.active().clipId:values[0];
      host.closeDialog();set(values,primary,{focus:true});
    },true]]);
    apply=$('dialog-actions').lastElementChild;apply.id='selection-apply';update();
  });}
  function guide(value,scale){
    const element=$('snap-guide');if(!element)return;
    element.hidden=!value;if(!value)return;
    element.style.left=(135+value.timeMs/1000*scale)+'px';element.dataset.time=String(value.timeMs);
    element.firstElementChild.textContent=value.label+' · '+textTime(value.timeMs);
  }
  function blockClick(){suppressClick=true;}
  // Keep cancellation through pointerup; a new gesture, not a zero-delay timer, clears it.
  on(doc,'pointerdown',()=>{suppressClick=false;},{capture:true});
  on($('lanes'),'click',event=>{
    const clip=event.target.closest('button[data-clip]');if(!clip)return;
    if(suppressClick&&event.detail>0){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();return;}
    if(event.shiftKey||event.ctrlKey||event.metaKey){event.preventDefault();event.stopImmediatePropagation();toggle(clip.dataset.clip);}
  },{capture:true});
  on($('lanes'),'keydown',event=>{
    if(disposed||event.isComposing||group.length<2||event.target.closest('[data-timeline-key]'))return;
    const clip=event.target.closest('button[data-clip]');
    if(!clip||!group.includes(clip.dataset.clip)||event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();event.stopImmediatePropagation();move((event.key==='ArrowLeft'?-1:1)*(event.shiftKey?100:10),true);
    }
  },{capture:true});
  on($('lanes'),'pointerdown',event=>{
    const clicked=event.target.closest('button[data-clip]');
    if(!clicked||group.length<2||!group.includes(clicked.dataset.clip)||event.button!==0||event.isPrimary===false||event.shiftKey||event.ctrlKey||event.metaKey)return;
    event.preventDefault();event.stopImmediatePropagation();cancelDrag?.();
    if(!host.ensure())return;
    if(event.target.closest('[data-trim]')){host.message('Select one clip before trimming. Group trimming is not enabled.',true);return;}
    if($('ripple').checked){host.message('Turn Ripple off before moving a selection.',true);return;}
    const origin=snapshot(),selected=ids(),scale=Number($('timeline-zoom').value),pointer=event.pointerId;
    let snapper;
    try{moveClips(origin.project,selected,0);snapper=createSelectionSnapper(origin.project,selected,{pixelsPerSecond:scale,playheadMs:host.time()});}
    catch(error){host.message(error.message,true);return;}
    host.stop();
    const capture=[...$('lanes').querySelectorAll('button[data-clip]')].find(n=>n.dataset.clip===clicked.dataset.clip);if(!capture)return;
    const setIds=new Set(selected),nodes=[...$('lanes').querySelectorAll('[data-clip],[data-key-clip]')].filter(n=>setIds.has(n.dataset.clip||n.dataset.keyClip));
    const prior=nodes.map(n=>({n,style:n.getAttribute('style'),keyTime:n.dataset.keyTime}));
    const start=event.clientX,scroll=$('timeline-scroll').scrollLeft,controller=new AbortController();
    let candidate=null,moved=false,finished=false,frame=null,lastX=start,lastAlt=event.altKey,lastError='',lastHint='';
    const restore=()=>{for(const item of prior){if(item.style===null)item.n.removeAttribute('style');else item.n.setAttribute('style',item.style);if(item.keyTime!==undefined)item.n.dataset.keyTime=item.keyTime;delete item.n.dataset.selectionDrag;}};
    const cleanup=()=>{
      finished=true;controller.abort();if(frame!==null)cancelAnimationFrame(frame);frame=null;
      if(cancelDrag===cancel)cancelDrag=null;
      if(capture.hasPointerCapture(pointer))capture.releasePointerCapture(pointer);
      restore();guide(null,scale);if(moved)blockClick();
    };
    const cancel=(reason='Group drag cancelled. No clips changed.')=>{if(finished)return;cleanup();host.message(reason);};
    const sample=(x,alt)=>{
      if(finished)return;
      if(snapshot().revision!==origin.revision||!capture.isConnected){cancel('The project changed. Group drag cancelled.');return;}
      const pixels=x-start+$('timeline-scroll').scrollLeft-scroll;
      if(Math.abs(pixels)<4&&!moved)return;moved=true;
      const result=snapper.snap(pixels/scale*1000,{bypass:alt||!$('snap').checked});
      try{
        candidate=moveClips(origin.project,selected,result.deltaMs);restore();
        const offset=result.deltaMs/1000*scale;
        for(const item of prior){const n=item.n;n.dataset.selectionDrag='valid';if(item.keyTime!==undefined){const ms=Number(item.keyTime)+result.deltaMs,pixels=ms/1000*scale;n.dataset.keyTime=String(ms);n.style.left=Math.max(0,pixels-12)+'px';n.style.setProperty('--key-center',Math.min(12,pixels)+'px');}else n.style.left=(parseFloat(n.style.left)+offset)+'px';}
        guide(result.guide,scale);lastError='';
        const hint=result.guide?'Snap: '+result.guide.label+' · '+textTime(result.guide.timeMs):'Moving '+selected.length+' clips. Release applies once; Escape cancels.';
        if(hint!==lastHint){host.message(hint);lastHint=hint;}
      }catch(error){candidate=null;restore();guide(null,scale);for(const {n} of prior)n.dataset.selectionDrag='invalid';
        if(lastError!==error.message)host.message(error.message+' Release changes nothing.',true);lastError=error.message;lastHint='';
      }
    };
    const schedule=()=>{if(frame===null)frame=requestAnimationFrame(()=>{frame=null;sample(lastX,lastAlt);});};
    const finish=e=>{
      if(e.pointerId!==pointer||finished)return;
      if(frame!==null)cancelAnimationFrame(frame);frame=null;sample(e.clientX,e.altKey);if(finished)return;
      const next=candidate,changed=moved,failed=lastError;cleanup();
      if(!changed)return;
      if(!next){host.message((failed||'Invalid group movement')+' No clips changed.',true);return;}
      try{host.commit(next,'Move '+selected.length+' clips',origin.revision);focusClip(host.active().clipId);}
      catch(error){host.message(error.message,true);}
    };
    cancelDrag=cancel;
    try{capture.setPointerCapture(pointer);}catch{cancel();return;}
    capture.addEventListener('pointermove',e=>{if(e.pointerId===pointer){lastX=e.clientX;lastAlt=e.altKey;schedule();}},{signal:controller.signal});
    capture.addEventListener('pointerup',finish,{signal:controller.signal});
    capture.addEventListener('pointercancel',()=>cancel(),{signal:controller.signal});
    capture.addEventListener('lostpointercapture',()=>{if(!finished)cancel();},{signal:controller.signal});
    $('timeline-scroll').addEventListener('scroll',schedule,{signal:controller.signal});
  },{capture:true});
  on(doc,'keydown',event=>{if(event.key==='Escape'&&cancelDrag){event.preventDefault();event.stopImmediatePropagation();cancelDrag();}},{capture:true});
  for(const type of ['resize','blur','pagehide'])on(doc.defaultView,type,()=>cancelDrag?.());
  on(doc,'visibilitychange',()=>{if(doc.hidden)cancelDrag?.();});
  on($('timeline-zoom'),'input',()=>cancelDrag?.());on($('fit-timeline'),'click',()=>cancelDrag?.());
  on($('ripple'),'change',()=>{cancelDrag?.();if(group.length>1)host.refresh();});
  return {get size(){return group.length>1?group.length:ids().length;},ids,normalize,clear,set,contains:id=>ids().includes(id),
    renderInspector,openList,remove,duplicate:duplicateWithOffset,
    bounds:()=>selectionBounds(project(),ids()),
    destroy(){if(disposed)return;cancelDrag?.();disposed=true;off.splice(0).forEach(fn=>fn());group=[];suppressClick=false;}};
}
