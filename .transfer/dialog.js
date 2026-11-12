function offerTake(clipId,asset,origin){
  let audition=null;
  const endAudition=()=>{if(activeAudition===audition)activeAudition=null;audition?.destroy();audition=null;};
  const release=()=>{endAudition();if(!project().assets.some(a=>a.id===asset.id))bank.remove(asset.id);};
  if(revision()!==origin){release();message('The project changed. This take has not replaced anything.',true);return;}
  stop();
  const currentClip=copy(findClip(project(),clipId).clip),currentAsset=project().assets.find(a=>a.id===currentClip.assetId);
  modal('Use this voice take?',body=>{
    node('p',asset.name+' · '+seconds(asset.durationMs)+' seconds',body);
    const panel=node('section',undefined,body);panel.id='take-comparison';panel.setAttribute('aria-label','Compare voice takes');
    node('h3','Listen before replacing',panel);
    node('p','Listen plays sound even when tour preview is muted. Current uses its source trim, volume and fades; new plays the full source at original volume without fades. Nothing is replaced by listening.',panel).className='note';
    const controls=node('div',undefined,panel);controls.className='actions';
    const status=node('p','Choose a take to listen. The tour stays paused.',panel);status.id='audition-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    let choice=null;
    const currentButton=button('Listen to current clip',controls,()=>listen('current'),'audition-current');currentButton.disabled=!currentAsset;
    const nextButton=button('Listen to new take',controls,()=>listen('new'),'audition-new');
    const stopButton=button('Stop listening',controls,()=>audition?.stop(),'audition-stop');stopButton.disabled=true;
    if(!currentAsset)node('p','There is no current take to compare.',panel).className='note';
    function update(state){
      if(disposed||!panel.isConnected)return;
      panel.dataset.state=state.state;panel.dataset.choice=choice||'';
      const running=['loading','playing'].includes(state.state);stopButton.disabled=!running;
      for(const [kind,b] of [['current',currentButton],['new',nextButton]])b.setAttribute('aria-pressed',String(running&&kind===choice));
      status.classList.toggle('error',state.state==='error');
      status.textContent=state.state==='loading'?'Preparing '+(choice==='current'?'current clip':'new take')+'…':state.state==='playing'?'Listening to '+(choice==='current'?'current clip':'new take')+'. The project is unchanged.':state.state==='ended'?'Finished listening. Choose either take to compare again.':state.error||'Listening stopped. The project is unchanged.';
    }
    audition=createTakeAuditioner({bank,onState:update});activeAudition=audition;
    panel.dataset.state='idle';for(const b of [currentButton,nextButton])b.setAttribute('aria-pressed','false');
    function listen(kind){
      if(disposed||revision()!==origin){endAudition();status.textContent='The project changed. Close and reopen the take comparison.';return;}
      stop();choice=kind;
      const options=kind==='current'?{sourceInMs:currentClip.sourceInMs,durationMs:currentClip.durationMs,gain:currentClip.gain,fadeInMs:currentClip.fadeInMs,fadeOutMs:currentClip.fadeOutMs}:{};
      void audition.play(kind==='current'?currentAsset:asset,options);
    }
    node('p','Keep scene timing uses the entire take only if it fits. Fit scene to voice proposes new visual timing without changing caption text or stretching the audio.',body);
  },[['Cancel',closeDialog],['Keep scene timing',()=>replace(false)],['Fit scene to voice',()=>replace(true),true]]);dialogCleanup=release;
  function replace(fit){try{
    audition?.stop();const proposal=proposeVoiceReplacement(project(),clipId,asset,{fitScene:fit});if(revision()!==origin)throw Error('This proposal is stale. Select the take again.');
    if(fit){endAudition();dialogCleanup=null;modal('Review timing changes',body=>{node('p','Scene length changes by '+seconds(proposal.deltaMs)+' seconds. Later scenes move with it. Voice audio is not stretched; authored caption text stays intact.',body);node('p',proposal.changes.length+' visual clips are retimed. Locked tracks cannot be changed.',body);},[['Cancel',closeDialog],['Use take and retime',()=>{try{commit(proposal.value,'Replace voice and retime scene',origin);closeDialog();}catch(e){message(e.message,true);}},true]]);dialogCleanup=release;}
    else {commit(proposal.value,'Replace voice take',origin);closeDialog();}
  }catch(e){node('p',e.message,$('dialog-body')).className='error';}}
}