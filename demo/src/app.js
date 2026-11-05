(() => {
  'use strict';
  const M = DemoModel;
  const $ = id => document.getElementById(id);
  const data = DEMO_DATA, scenes = data.scenes, total = data.durationMs;
  const stage = $('stage'), surface = $('scene');
  const audio = new Audio(DEMO_AUDIO);
  audio.preload = 'auto'; audio.muted = true;
  const mediaQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { time:0, playing:false, started:false, manual:false, awaiting:false, guideHold:false,
    mode:'watch', cc:true, sound:false, reduced:mediaQuery.matches, speed:1, approved:false,
    clock:'text', audioUnavailable:false, ease:'cinematic', epoch:0, index:-1, lastCaption:'', lastCode:'', lastUiUpdate:-Infinity };
  let raf = 0, wallStart = 0, clockStart = 0, toastTimeout = 0, playTimeout = 0;
  let mediaClock = null;
  let pose = {x:0,y:0,scale:1}, geometry = {}, view = {width:1120,height:600};
  const targets = { routes:$('map-target'), review:$('review-target'), metrics:$('metrics-target'), approve:$('approve-route') };
  const hints = {
    watch:'Sit back. Every frame is a real, working interface.',
    try:'The story pauses at the checkpoint. You make the next move.',
    guide:'Move scene by scene. Complete the checkpoint to continue.'
  };
  const captionMessage = () => state.awaiting
    ? 'Your turn. Approve the checkpoint in the real interface to continue.'
    : state.manual
    ? 'You’re in control. The tour is paused; the interface is still alive.'
    : scenes[Math.max(0,state.index)].caption;

  function announce(text) { $('announcements').textContent = text; }
  function toast(text) {
    clearTimeout(toastTimeout); $('toast').textContent = text; $('toast').hidden = false;
    toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 3300);
  }
  function measure() {
    const parent = stage.getBoundingClientRect();
    view = {width:parent.width, height:parent.height};
    // Invert the existing camera transform once per invalidation, not every frame.
    // The scene has a dedicated transform owner and no ancestor scaling in this fixture.
    const scale = pose.scale || 1;
    for (const [id,el] of Object.entries(targets)) {
      const rect = el.getBoundingClientRect();
      geometry[id] = {x:(rect.left-parent.left-pose.x)/scale, y:(rect.top-parent.top-pose.y)/scale,
        width:rect.width/scale, height:rect.height/scale};
    }
    render(true);
  }
  function displayControls() {
    $('play-icon').textContent = state.playing ? 'Ⅱ' : '▶';
    $('play').setAttribute('aria-label', state.playing ? 'Pause walkthrough' : state.awaiting ? 'Waiting for checkpoint approval' : 'Play walkthrough');
    $('play').disabled = state.awaiting;
    $('next-step').hidden = state.mode !== 'guide';
    $('next-step').disabled = state.awaiting || state.index >= scenes.length-1;
    $('motion-toggle').textContent = state.reduced ? 'Motion off' : 'Motion on';
    $('motion-toggle').setAttribute('aria-pressed', String(state.reduced));
    $('sound').textContent = state.sound ? 'Sound on' : 'Sound off';
    $('sound').setAttribute('aria-pressed',String(state.sound));
    $('sound').setAttribute('aria-label', state.sound ? 'Mute prototype narration' : 'Enable prototype narration');
    $('captions').setAttribute('aria-pressed',String(state.cc));
    $('stage-intro').hidden = state.started;
    const label = state.awaiting ? 'Waiting for you · approve checkpoint'
      : state.manual ? 'You’re directing now · play to resume'
      : state.time >= total ? 'That’s a wrap. Your app is still live.'
      : state.guideHold ? 'Your pace · next scene when you’re ready'
      : state.playing ? (state.clock === 'text' ? 'Playing · captioned timeline' : 'Playing · narration-synced timeline')
      : state.started ? 'Paused · explore or press play' : 'Ready when you are';
    $('player-state').replaceChildren(Object.assign(document.createElement('i'),{}),document.createTextNode(label));
    stage.dataset.state = state.awaiting ? 'waiting' : state.manual ? 'interactive' : state.playing ? 'playing' : 'paused';
    stage.dataset.mode = state.mode;
    stage.dataset.clock = state.clock;
    stage.dataset.reducedMotion = String(state.reduced);
  }
  function render(force = false) {
    let sample;
    try { sample = M.sample(scenes, state.time, geometry, view, state.reduced, state.ease); }
    catch (error) { pause(); toast(error.message); return; }
    pose = sample.pose;
    surface.style.transform = `translate3d(${pose.x}px,${pose.y}px,0) scale(${pose.scale})`;
    const s = sample.scene;
    const changed = sample.index !== state.index;
    state.index = sample.index;
    if (changed || force) {
      $('shot-number').textContent = `SCENE ${String(state.index+1).padStart(2,'0')} / 06`;
      $('shot-title').textContent = s.title;
      document.querySelectorAll('.chapter-button').forEach((el,i) => {
        el.classList.toggle('active',i===state.index);
        if(i===state.index) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current');
      });
    }
    const target = geometry[sample.target];
    const showFrame = state.started && !state.manual && !!target;
    $('focus-frame').style.display = showFrame ? 'block' : 'none';
    if (showFrame) {
      const r = M.project(target,pose), margin=5;
      Object.assign($('focus-frame').style,{left:`${r.x-margin}px`,top:`${r.y-margin}px`,width:`${r.width+margin*2}px`,height:`${r.height+margin*2}px`});
      $('focus-label').textContent = state.awaiting ? 'YOUR TURN · REAL BUTTON' : `focus(“${s.target}”)`;
    }
    const cursorTarget = s.cursor && geometry[s.cursor];
    const showCursor = state.started && !state.manual && !state.reduced && !!cursorTarget;
    $('demo-cursor').style.display = showCursor ? 'block' : 'none';
    if(showCursor) {
      const r = M.project(cursorTarget,pose);
      const arrival = M.easing((state.time-s.startMs-500)/1600,'gentle');
      const tx = r.x + r.width*(s.cursor==='approve'?0.7:0.64), ty = r.y + r.height*(s.cursor==='approve'?0.6:0.55);
      const x = view.width*.47 + (tx-view.width*.47)*arrival;
      const y = view.height*.63 + (ty-view.height*.63)*arrival;
      $('demo-cursor').style.transform = `translate3d(${x}px,${y}px,0)`;
    }
    const caption = captionMessage();
    $('caption').hidden = !state.cc || !state.started;
    if(caption !== state.lastCaption || force) {
      $('caption-text').textContent = caption;
      $('caption-label').textContent = state.awaiting ? 'YOUR TURN' : state.manual ? 'LIVE INTERFACE' : 'DIRECTOR';
      state.lastCaption = caption;
    }
    $('current-time').textContent = M.formatTime(state.time);
    $('seek').value = String(state.time/1000);
    $('seek').style.background = `linear-gradient(to right,#c5df9a ${state.time/total*100}%,#44533e ${state.time/total*100}%)`;
    // Diagnostics are human-readable, throttled, and contain no host/user data.
    if (force || changed || Math.abs(state.time-state.lastUiUpdate)>100) {
      $('code-clock').textContent = M.formatTime(state.time,true);
      state.lastUiUpdate = state.time;
    }
    const code = JSON.stringify({ target:s.target, zoom:s.zoom, easing:state.ease, cursor:s.cursor, mode:state.mode, captions:state.cc },null,2);
    if(code!==state.lastCode){$('live-code').textContent=code;state.lastCode=code;}
  }
  function scheduleTick() {
    cancelAnimationFrame(raf);
    raf = state.playing ? requestAnimationFrame(tick) : 0;
  }
  function anchorClock() {
    clockStart = state.time; wallStart = performance.now();
    mediaClock = M.createMediaClock(state.time, wallStart, state.speed);
  }
  function readClock() {
    const now = performance.now();
    if (state.clock === 'audio') {
      const time = mediaClock.sample(audio.currentTime * 1000, now);
      if (time !== null) return M.clamp(time, 0, total);
      // Keep the last rendered position, not the decoder's invalid position.
      startTextClock('Narration timing was interrupted. Continuing with captions.');
      return state.time;
    }
    return M.clamp(clockStart + (now - wallStart) * state.speed, 0, total);
  }
  function pause() {
    if (state.playing) state.time = readClock();
    state.epoch++; clearTimeout(playTimeout);
    state.playing=false;audio.pause();cancelAnimationFrame(raf);raf=0;displayControls();
  }
  function startTextClock(message) {
    // Invalidate a pending play() before pausing media. A late resolution must
    // never revive audio or install a second animation loop after this handoff.
    state.epoch++; clearTimeout(playTimeout);
    state.clock='text'; state.sound=false; state.audioUnavailable=true;
    audio.pause(); audio.muted=true;
    $('sound').disabled=true;
    $('sound').setAttribute('aria-label','Narration unavailable; captioned playback');
    anchorClock();
    if(message) toast(message);
    displayControls(); scheduleTick();
  }
  async function play() {
    if(state.awaiting){toast('Approve the checkpoint first, or switch to Watch.');return;}
    if(state.playing)return;
    if(state.guideHold) {
      const next=scenes[state.index+1];
      if(next) state.time=next.startMs;
      state.guideHold=false;
    }
    if(state.time>=total-10) state.time=0;
    state.started=true;state.manual=false;state.playing=true;
    // Silent playback must not depend on a muted media decoder, its loading
    // policy, or its ended event. Opting into sound explicitly transfers time
    // authority to guarded media samples from this same presentation position.
    state.clock=state.sound&&!state.audioUnavailable?'audio':'text';
    const epoch=++state.epoch;
    anchorClock(); render(true); displayControls();
    if(state.clock==='audio'){
      playTimeout=setTimeout(()=>{
        if(epoch===state.epoch&&state.playing&&state.clock==='audio')
          startTextClock('Narration did not start. Continuing with captions.');
      },2500);
      try {
        audio.currentTime=state.time/1000;audio.playbackRate=state.speed;audio.muted=false;
        const attempt=audio.play();
        if(attempt) await attempt;
        if(epoch!==state.epoch){if(!state.playing||state.clock!=='audio')audio.pause();return;}
        clearTimeout(playTimeout);
      }catch(error){
        if(epoch!==state.epoch)return;
        startTextClock('Narration unavailable. Continuing with captions and the same visual timeline.');
        return;
      }
    }
    if(epoch!==state.epoch)return;
    scheduleTick();
  }
  function tick() {
    if(!state.playing)return;
    const previousIndex=M.sceneAt(scenes,state.time);
    const next=readClock();
    const limit=M.seekLimit(next,scenes,state.mode,state.approved);
    if(next>=limit && limit<next && state.mode!=='watch') {
      state.time=limit; state.playing=false; state.awaiting=true; audio.pause();
      clearTimeout(playTimeout);cancelAnimationFrame(raf);raf=0;state.epoch++;render(true);displayControls();
      announce('Your turn. Approve the checkpoint to continue.');return;
    }
    if(state.mode==='guide' && previousIndex<scenes.length-1 && next>=scenes[previousIndex+1].startMs){
      state.time=scenes[previousIndex+1].startMs-1;state.guideHold=true;state.playing=false;audio.pause();clearTimeout(playTimeout);cancelAnimationFrame(raf);raf=0;state.epoch++;
      render(true);displayControls();return;
    }
    state.time=next;render();
    if(state.time>=total){state.time=total;state.playing=false;state.epoch++;clearTimeout(playTimeout);audio.pause();cancelAnimationFrame(raf);raf=0;render(true);displayControls();return;}
    scheduleTick();
  }
  function seek(time,resume=state.playing) {
    pause();state.started=true;state.manual=false;state.guideHold=false;
    const requested=M.clamp(time,0,total);
    state.time=M.seekLimit(requested,scenes,state.mode,state.approved);
    state.awaiting=state.mode!=='watch'&&!state.approved&&requested>=scenes.find(s=>s.gate).startMs+1700;
    render(true);displayControls();
    if(resume&&!state.awaiting)void play();
  }
  function takeOver(focusReview=false) {
    pause();state.started=true;state.manual=true;state.guideHold=false;state.awaiting=false;
    if(focusReview){state.time=scenes[3].startMs+1800;render(true);}
    // Leave the current camera exactly where it is so pointer hit-testing does not move under the user.
    render(true);displayControls();
  }
  function scrollToDemo(){ $('experience').scrollIntoView({behavior:state.reduced?'auto':'smooth',block:'start'}); }
  function startFromHero(){seek(0,false);scrollToDemo();void play();}
  function resetFixture(notify=true) {
    state.approved=false;$('review-check').checked=true;$('approve-route').disabled=false;
    $('approve-route').classList.remove('approved');$('approve-route').replaceChildren(document.createTextNode('Approve checkpoint '),Object.assign(document.createElement('span'),{textContent:'↗'}));
    $('cleared-stat').replaceChildren(document.createTextNode('24'),Object.assign(document.createElement('small'),{textContent:'of 25 total'}));
    $('cleared-bar').style.width='96%';$('flag-count').textContent='01';
    if(notify)toast('Sandbox reset. No real data was changed.');
  }

  // An actual user-triggered fixture action. Seeking/sampling never invokes this.
  $('approve-route').addEventListener('click',()=>{
    if(!$('review-check').checked||state.approved)return;
    state.approved=true;$('approve-route').classList.add('approved');$('approve-route').disabled=true;
    $('approve-route').textContent='Checkpoint approved ✓';
    $('flag-count').textContent='00';$('cleared-bar').style.width='100%';
    $('cleared-stat').replaceChildren(document.createTextNode('25'),Object.assign(document.createElement('small'),{textContent:'all clear ✓'}));
    toast('That was a real button. Checkpoint approved.');
    if(state.awaiting){state.awaiting=false;state.manual=false;void play();}
    else {takeOver();render(true);}
  });
  $('review-check').addEventListener('change',()=>{ $('approve-route').disabled=!$('review-check').checked||state.approved; });
  $('reset-fixture').addEventListener('click',()=>resetFixture());
  $('route-toggle').addEventListener('click',()=>{
    const active=$('route-toggle').getAttribute('aria-pressed')==='true';
    $('route-toggle').setAttribute('aria-pressed',String(!active));
    $('alternate-route').setAttribute('opacity',active?'0':'1');
    toast(active?'Alternate route hidden.':'Alternate route visible. This map is live SVG.');
  });
  surface.addEventListener('pointerdown',()=>{
    if(state.playing && !state.awaiting)takeOver();
  });
  surface.addEventListener('focusin',event=>{
    if(state.playing&&!state.awaiting)takeOver();
    // Preserve keyboard reachability when a focused control is outside the current camera frame.
    const targetId=Object.entries(targets).find(([,el])=>el===event.target||el.contains(event.target))?.[0];
    if(targetId&&!state.awaiting){
      const projected=M.project(geometry[targetId],pose);
      if(projected.x<0||projected.y<0||projected.x+projected.width>view.width||projected.y+projected.height>view.height){
        const idx=scenes.findIndex(s=>s.target===targetId);
        if(idx>=0){pause();state.manual=true;state.started=true;state.time=scenes[idx].startMs+1600;render(true);displayControls();}
      }
    }
  });
  document.querySelectorAll('[data-focus]').forEach(button=>button.addEventListener('click',()=>{
    const idx=scenes.findIndex(s=>s.target===button.dataset.focus);
    seek(scenes[idx].startMs+1700,false);state.manual=true;render(true);displayControls();
  }));
  document.querySelectorAll('[data-notice]').forEach(button=>button.addEventListener('click',()=>toast(button.dataset.notice)));
  $('play').addEventListener('click',()=>{if(state.playing){pause();render(true);}else void play();});
  $('hero-play').addEventListener('click',startFromHero);
  $('footer-play').addEventListener('click',startFromHero);
  $('stage-play').addEventListener('click',()=>void play());
  $('restart').addEventListener('click',()=>seek(0,state.playing));
  $('seek').max=String(total/1000);
  $('seek').addEventListener('input',event=>seek(Number(event.target.value)*1000,false));
  $('takeover').addEventListener('click',()=>{takeOver(true);toast('Your turn. Try the checkpoint, or explore the route.');});
  $('try-action').addEventListener('click',()=>{
    setMode('try');scrollToDemo();seek(scenes[3].startMs+1700,false);toast('Approve the checkpoint to continue the story.');
  });
  $('chapter-audio').addEventListener('click',()=>{scrollToDemo();seek(scenes[2].startMs,true);});
  $('sound').addEventListener('click',()=>{
    const resume=state.playing, enable=!state.sound;
    pause();state.sound=enable;audio.muted=!enable;render(true);displayControls();
    if(enable)toast('Prototype voice: locally generated synthetic narration.');
    if(resume)void play();
  });
  $('captions').addEventListener('click',()=>{state.cc=!state.cc;render(true);displayControls();});
  $('rate').addEventListener('click',()=>{
    const choices=[1,1.25,1.5,.75];
    const resume=state.playing;pause();
    state.speed=choices[(choices.indexOf(state.speed)+1)%choices.length];
    $('rate').textContent=`${state.speed}×`;$('rate').setAttribute('aria-label',`Playback speed: ${state.speed} times`);
    if(resume)void play();
  });
  $('motion-toggle').addEventListener('click',()=>{state.reduced=!state.reduced;render(true);displayControls();});
  mediaQuery.addEventListener('change',event=>{state.reduced=event.matches;render(true);displayControls();});
  $('easing').addEventListener('change',event=>{state.ease=event.target.value;render(true);});
  function setMode(mode){
    if(!Object.hasOwn(hints,mode))return;
    pause();state.mode=mode;state.awaiting=false;state.guideHold=false;
    document.querySelectorAll('[data-mode]').forEach(button=>{const active=button.dataset.mode===mode;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
    $('mode-hint').textContent=hints[mode];
    seek(0,false);announce(`${mode} mode selected.`);
  }
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
  $('next-step').addEventListener('click',()=>{
    if(state.awaiting)return;
    const next=scenes[state.index+1];if(next)seek(next.startMs,true);
  });
  document.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]'))return;
    if(event.key==='Escape'){takeOver();announce('Tour paused. You are in control.');return;}
    const el=event.target;
    if(el.closest('input,textarea,select,button,a,[contenteditable=true]')||event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.code==='Space'){
      // Do not hijack page scrolling far away from the player.
      const bounds=$('theater').getBoundingClientRect();
      if(bounds.bottom<0||bounds.top>innerHeight)return;
      event.preventDefault();if(state.playing){pause();render(true);}else void play();
    }
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.playing){pause();render(true);}});
  audio.addEventListener('ended',()=>{
    // ended is a media event, not permission to skip the remaining script.
    // Ignore stale events after pause/seek and let tick() enforce guide gates.
    if(state.clock!=='audio'||!state.playing||!audio.ended)return;
    startTextClock(state.time<total-250
      ? 'Narration ended early. Continuing with captions.' : '');
    render(true);displayControls();
  });
  audio.addEventListener('error',()=>{
    if(state.clock==='audio')startTextClock('Audio could not load. The captioned walkthrough still works.');
    else{state.audioUnavailable=true;state.sound=false;$('sound').disabled=true;displayControls();}
  });
  audio.addEventListener('waiting',()=>{if(state.playing&&state.clock==='audio')$('player-state').textContent='Buffering · the camera waits with the audio';});
  audio.addEventListener('playing',displayControls);
  const resize=new ResizeObserver(measure);resize.observe(stage);

  scenes.forEach((s,index)=>{
    const button=document.createElement('button');button.className='chapter-button';button.dataset.scene=s.id;
    const n=document.createElement('span');n.className='chapter-no';n.textContent=`0${index+1} / ${M.formatTime(s.startMs)}`;
    const label=document.createElement('strong');label.textContent=s.title;button.append(n,label);
    button.addEventListener('click',()=>seek(s.startMs,true));$('chapter-strip').append(button);
    const row=document.createElement('button'),time=document.createElement('time'),text=document.createElement('span');
    time.textContent=M.formatTime(s.startMs);text.textContent=s.caption;row.append(time,text);
    row.addEventListener('click',()=>seek(s.startMs,false));$('transcript').append(row);
    if(index){const tick=document.createElement('i');tick.style.left=`${s.startMs/total*100}%`;$('chapter-ticks').append(tick);}
  });
  $('transcript-toggle').addEventListener('click',()=>{
    const show=$('transcript').hidden;$('transcript').hidden=!show;$('transcript-toggle').setAttribute('aria-expanded',String(show));
    $('transcript-toggle').replaceChildren(document.createTextNode(show?'Hide transcript ':'Read transcript '),Object.assign(document.createElement('span'),{textContent:show?'−':'＋'}));
  });
  document.querySelectorAll('[data-duration]').forEach(el=>{el.textContent=M.formatTime(total);});
  for(let i=0;i<38;i++){
    const bar=document.createElement('i');bar.style.height=`${7+(Math.sin(i*1.7)*.5+.5)*32+(i%4)*2}px`;$('decorative-waveform').append(bar);
  }
  const exported={...data,narration:'Bundled placeholder audio. All start/duration values are milliseconds.'};
  $('script-json').textContent=JSON.stringify(exported,null,2);
  function openDialog(id){pause();render(true);$(id).showModal();}
  $('script-open').addEventListener('click',()=>openDialog('script-dialog'));
  ['about-open','about-open-footer'].forEach(id=>$(id).addEventListener('click',()=>openDialog('about-dialog')));
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  $('copy-cue').addEventListener('click',async()=>{
    try{if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText($('live-code').textContent);$('copy-cue').textContent='Copied ✓';setTimeout(()=>$('copy-cue').textContent='Copy ↗',1800);}
    catch{openDialog('script-dialog');toast('Clipboard unavailable here. Export the cue sheet instead.');}
  });
  $('download-script').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(exported,null,2)+'\n'],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='dom-director-demo-cues.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  // With no application session, telemetry or transport, there is nothing to persist on exit.
  addEventListener('pagehide',()=>{pause();resize.disconnect();clearTimeout(toastTimeout);});
  measure();displayControls();
})();
