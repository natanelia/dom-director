import {createDirector, createGuidance, createCheckpointStore, mountControls} from '../../packages/core/src/index.js';

// One data-only script. The host, not the script, determines what each mode may do.
export const sharedScenario = {
  schemaVersion:'0.1.0-draft.1', id:'one-story-three-modes', title:'The last checkpoint', locale:'en',
  entryScene:'overview', modes:['watch','try','guide'], capabilities:['condition:checkpoint.approved','fixture:reset'],
  targets:{workspace:{ref:'app.workspace'},approve:{ref:'app.approve'}},
  scenes:[
    {id:'overview',title:'See the bigger picture',summary:'Twenty-four checks are clear. One needs your attention. This is a real interface, not a recording.',durationMs:1800,
      cues:[{id:'overview-shot',kind:'camera',at:0,durationMs:600,target:'workspace',minScale:.1,maxScale:1}],next:'review'},
    {id:'review',title:'Make the next move',summary:'Watch explains without approving. Try and Guide wait for you to review and approve the isolated checkpoint.',durationMs:3000,
      cues:[{id:'review-shot',kind:'camera',at:0,durationMs:600,target:'approve',maxScale:2,paddingPx:24},
        {id:'review-ring',kind:'highlight',at:650,durationMs:2200,target:'approve'},
        {id:'review-pointer',kind:'cursor',at:650,durationMs:2000,target:'approve',gesture:'point'},
        {id:'approval',kind:'gate',at:1100,conditionRef:'checkpoint.approved',timeoutMs:30000,onTimeout:'pause',instruction:'Check Reviewed, then press Approve checkpoint. No real data will be submitted.'}],next:'finish'},
    {id:'finish',title:'Still your application',summary:'The tour can stop or rewind. Your approval is not replayed or undone. Reset practice is a separate, explicit action.',durationMs:1600,
      cues:[{id:'finish-shot',kind:'camera',at:0,durationMs:600,reset:true}]},
  ],
};

export function mountSharedScenario(doc = document) {
  const $ = id => doc.getElementById(id), listeners = new Set(), cleanups = [];
  const models = Object.fromEntries(['watch','try','guide'].map(mode => [mode,{reviewed:false,approved:false,revision:0}]));
  let allowed = true, disposed = false, saved = null, busy = false;
  const modeModel = () => models[director.inspect().mode];
  const notify = () => { for (const fn of [...listeners]) fn(); };
  const guidance = createGuidance({
    authorize: req => req.capability.startsWith('mode:') ||
      (req.capability==='condition:checkpoint.approved' && allowed) ||
      (req.capability==='fixture:reset' && req.mode==='try'),
    conditions:{'checkpoint.approved':{
      evidence:'domain', trigger:'level', label:'The isolated checkpoint is approved',
      hints:['Tick Reviewed before pressing Approve checkpoint. The simulated cursor never clicks for you.'],
      read: context => context.mode==='watch' || models[context.mode].approved,
      subscribe: callback => {listeners.add(callback);return()=>listeners.delete(callback);},
    }},
    fixture:{isolated:true,reset:async({signal})=>{
      if(signal.aborted)return {completed:false};
      models.try={reviewed:false,approved:false,revision:models.try.revision+1};
      notify();return {completed:true};
    }},
  });
  const director = createDirector({
    surface:{viewport:$('scenario-viewport'),scene:$('scenario-scene'),overlay:$('scenario-overlay')},
    targets:{'app.workspace':()=>$('scenario-scene'),'app.approve':()=>$('approval-card')},guidance,
  });
  const loaded = director.load(sharedScenario);
  if(!loaded.ok){guidance.destroy();director.destroy();throw new Error(loaded.diagnostics[0].message);}
  const controls = mountControls(director,$('scenario-controls'));
  const checkpoints = createCheckpointStore(director,{
    versions:()=>({script:'shared-scenario-v1',host:'isolated-host-v1',fixture:String(modeModel().revision)}),
    authorize:()=>allowed,
    verify: snapshot => snapshot.versions.fixture===String(modeModel().revision),
  });
  function report(result, success='') {
    if(disposed)return;
    $('scenario-message').textContent=result?.ok===false ? result.diagnostics[0].code+': '+result.diagnostics[0].message : success;
    update();
  }
  function update() {
    if(disposed)return;
    const state=director.inspect(),model=models[state.mode];
    $('runtime-status').dataset.status=state.status;
    $('runtime-status').dataset.scene=state.sceneId;
    $('runtime-status').dataset.waiting=state.waitingFor?.kind||'';
    $('runtime-status').dataset.error=state.waitingFor?.error||'';
    $('runtime-status').textContent=`${state.mode.toUpperCase()} / ${state.sceneId} / ${state.status}`;
    $('reviewed').checked=model.reviewed;
    $('reviewed').disabled=state.mode==='watch'||model.approved;
    $('approve-checkpoint').disabled=state.mode==='watch'||!model.reviewed||model.approved;
    $('approve-checkpoint').textContent=model.approved?'Checkpoint approved ✓':'Approve checkpoint ↗';
    $('approved-count').textContent=model.approved?'25':'24';
    $('approval-state').textContent=model.approved?'Approved by you.':'Waiting for review.';
    $('mode-description').textContent={watch:'Watch the story. Nothing is approved for you.',try:'Practice in an isolated sandbox. Reset touches only this practice state.',guide:'You set the pace. Continue between scenes and complete the real task.'}[state.mode];
    doc.querySelectorAll('[data-scenario-mode]').forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.scenarioMode===state.mode));button.disabled=busy;
    });
    $('save-position').disabled=busy||!!state.waitingFor||!!state.pendingOperation;
    $('restore-position').disabled=busy||!saved||!!state.waitingFor||!!state.pendingOperation;
    $('checkpoint-label').textContent=saved?`Saved at ${saved.sceneId} · ${(saved.timeMs/1000).toFixed(1)}s`:'No position saved';
  }
  const on=(el,type,fn)=>{el.addEventListener(type,fn);cleanups.push(()=>el.removeEventListener(type,fn));};
  on($('reviewed'),'change',()=>{const model=modeModel();model.reviewed=$('reviewed').checked;model.revision++;notify();update();});
  on($('approve-checkpoint'),'click',()=>{
    const state=director.inspect(),model=modeModel();
    if(state.mode==='watch'||!model.reviewed||model.approved)return;
    model.approved=true;model.revision++;notify();update();
  });
  on($('allow-observation'),'change',()=>{allowed=$('allow-observation').checked;notify();});
  async function run(work,success) {
    if(busy||disposed)return;busy=true;update();
    try{const result=await work();report(result,success);}catch{report({ok:false,diagnostics:[{code:'HOST_FAILURE',message:'The example could not complete this operation.'}]});}
    finally{busy=false;update();}
  }
  doc.querySelectorAll('[data-scenario-mode]').forEach(button=>on(button,'click',()=>run(()=>director.setMode(button.dataset.scenarioMode),'Mode ready. Press Play.')));
  on($('save-position'),'click',()=>run(async()=>{
    checkpoints.clear();saved=null;const result=await checkpoints.capture();if(result.ok)saved=result.value;return result;
  },'Position saved. Playback is paused.'));
  on($('restore-position'),'click',()=>run(()=>checkpoints.restore(saved.id),'Position restored without changing application data. Press Play to continue.'));
  cleanups.push(director.on(update));
  $('canonical-script').textContent=JSON.stringify(sharedScenario,null,2);
  update();
  const destroy=()=>{if(disposed)return;disposed=true;cleanups.forEach(fn=>fn());checkpoints.destroy();controls.destroy();director.destroy();guidance.destroy();listeners.clear();};
  on(doc.defaultView,'pagehide',destroy);
  return {director,checkpoints,destroy};
}

if(globalThis.document?.getElementById('scenario-root')) mountSharedScenario();
