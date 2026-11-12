import {findCaptionMatches,proposeCaptionReplacement} from './studio-sdk/caption-search.js';

/** Caption proofreading only. Host owns project revisions, preview and undo. */
export function createCaptionSearch(host){
  const doc=host.document,$=id=>doc.getElementById(id),pageSize=20;
  let disposed=false,ownedPanel=null;
  function el(tag,text,parent){const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(parent)parent.append(node);return node;}
  function button(id,text,parent,work){const node=el('button',text,parent);if(id)node.id=id;node.type='button';node.addEventListener('click',work);return node;}
  const entry=button('find-captions','Find captions…',null,open);entry.className='full';
  $('add-scene').after(entry);
  const time=ms=>(ms/1000).toFixed(3)+'s';
  function open(){
    if(disposed||!host.ensure())return;
    host.stop();const snapshot=host.snapshot();
    let query,replacement,track,matchCase,form,results,pager,status,error,selectionCount,reviewPanel,back,apply;
    let found=null,selected=new Set(),page=0,proposal=null,reviewing=false,consent=null;
    const live=()=>{
      if(!host.ensure())throw Error('Finish or correct the current project edit before continuing.');
      if(disposed||host.snapshot().revision!==snapshot.revision)throw Error('The project changed. Close and reopen caption search before continuing.');
    };
    const options=()=>({query:query.value,matchCase:matchCase.checked,trackId:track.value||null});
    function fail(e){error.textContent=e.message;apply.disabled=true;}
    function updateAction(){
      selectionCount.textContent=selected.size+' matching caption'+(selected.size===1?'':'s')+' selected';
      apply.disabled=reviewing?(!proposal||!!consent&&!consent.checked):(!found||!selected.size);
    }
    function highlighted(parent,row){
      let start=0;
      for(const range of row.ranges){parent.append(doc.createTextNode(row.text.slice(start,range.start)));el('mark',row.text.slice(range.start,range.end),parent);start=range.end;}
      parent.append(doc.createTextNode(row.text.slice(start)));
    }
    function pages(parent,total,index,change,prefix='caption-page',description='caption results'){
      parent.replaceChildren();const count=Math.max(1,Math.ceil(total/pageSize));
      const previous=button(prefix+'-previous','Previous',parent,()=>change(index-1));previous.disabled=index===0;previous.setAttribute('aria-label','Previous '+description+' page');
      el('span','Page '+(index+1)+' of '+count,parent).setAttribute('role','status');
      const next=button(prefix+'-next','Next',parent,()=>change(index+1));next.disabled=index+1>=count;next.setAttribute('aria-label','Next '+description+' page');
      parent.hidden=count===1;
    }
    function showResults(){
      results.replaceChildren();pager.replaceChildren();pager.hidden=true;
      if(!found)return;
      const subset=found.captions.slice(page*pageSize,(page+1)*pageSize);
      for(const row of subset){
        const item=el('li',undefined,results);item.className='caption-search-result';
        const label=el('label',undefined,item);label.className='selection-choice';
        const check=el('input',undefined,label);check.type='checkbox';check.dataset.captionChoice=row.clipId;check.checked=selected.has(row.clipId);
        check.addEventListener('change',()=>{check.checked?selected.add(row.clipId):selected.delete(row.clipId);updateAction();});
        const text=el('span',undefined,label);
        el('strong',row.sceneTitle+' · '+time(row.projectTimeMs),text);
        el('small',row.trackName+(row.enabled?'':' · hidden')+(row.locked?' · locked':''),text);
        const content=el('span',undefined,text);content.className='caption-match-text';highlighted(content,row);
        const jump=button('', 'Edit this caption',item,()=>{
          try{
            live();const content=$('dialog-body').firstChild;
            $('dialog').addEventListener('close',()=>{
              if(!disposed&&!$('dialog').open&&$('dialog-body').firstChild===content)$('caption-text')?.focus({preventScroll:true});
            },{once:true});
            host.closeDialog();host.selectSingle(row.clipId);
          }catch(e){fail(e);}
        });jump.dataset.captionOpen=row.clipId;
      }
      pages(pager,found.captions.length,page,next=>{page=next;showResults();results.querySelector('input')?.focus();});
      updateAction();
    }
    function search(){
      error.textContent='';proposal=null;
      try{
        live();found=findCaptionMatches(snapshot.project,options());selected=new Set(found.captions.map(row=>row.clipId));page=0;
        status.textContent=found.matches+' occurrence'+(found.matches===1?'':'s')+' in '+found.captions.length+' caption'+(found.captions.length===1?'':'s')+'. No project changes.';
      }catch(e){found=null;selected.clear();status.textContent='';fail(e);}
      showResults();updateAction();
    }
    function backToSearch(){
      reviewing=false;proposal=null;consent=null;reviewPanel.replaceChildren();reviewPanel.hidden=true;form.hidden=false;
      back.hidden=true;apply.textContent='Review replacements';error.textContent='';updateAction();query.focus();
    }
    function review(){
      error.textContent='';
      try{
        live();proposal=proposeCaptionReplacement(snapshot.project,{...options(),replacement:replacement.value,clipIds:[...selected]});
        if(!proposal.changes.length){status.textContent='The replacement makes no text changes. Word timings and links are unchanged.';return;}
        reviewing=true;form.hidden=true;reviewPanel.hidden=false;reviewPanel.replaceChildren();back.hidden=false;
        el('h3','Review '+proposal.replacements+' replacement'+(proposal.replacements===1?'':'s'),reviewPanel);
        el('p',proposal.changes.length+' captions change. Clip positions, duration, styling and voice audio stay unchanged. Apply creates one undo step.',reviewPanel);
        const timed=proposal.changes.filter(change=>change.clearedWordTimings>0);
        if(timed.length){
          const warning=el('p',timed.length+' changed caption'+(timed.length===1?' loses its':'s lose their')+' word timing. '+proposal.detachedLinks.length+' camera/cursor timing link'+(proposal.detachedLinks.length===1?' is':'s are')+' detached; the keys stay at their current times.',reviewPanel);warning.className='warning';warning.id='caption-replace-warning';
          if(proposal.detachedLinks.length){
            const details=el('details',undefined,reviewPanel);el('summary','Affected motion links ('+proposal.detachedLinks.length+')',details);
            const list=el('ul',undefined,details);list.id='caption-detached-links';
            const navigation=el('div',undefined,details);navigation.className='actions';
            function showLinks(index){
              list.replaceChildren();
              for(const link of proposal.detachedLinks.slice(index*pageSize,(index+1)*pageSize))el('li',link.kind+' · '+link.keyId+' · “'+link.text+'” · stays at '+time(link.projectTimeMs),list).tabIndex=-1;
              pages(navigation,proposal.detachedLinks.length,index,next=>{showLinks(next);list.firstElementChild?.focus();},'caption-links-page','affected links');
            }
            showLinks(0);
          }
          const label=el('label',undefined,reviewPanel);label.className='selection-choice';consent=el('input',undefined,label);consent.type='checkbox';consent.id='caption-clear-timing';consent.setAttribute('aria-describedby','caption-replace-warning');
          el('span','Clear the listed word timings and detach their motion links. Keep the keys in place.',label);consent.addEventListener('change',updateAction);
        }
        const list=el('ol',undefined,reviewPanel);list.id='caption-replacement-diff';list.className='caption-search-results';
        const navigation=el('div',undefined,reviewPanel);navigation.className='actions';
        function show(index){
          list.replaceChildren();
          for(const change of proposal.changes.slice(index*pageSize,(index+1)*pageSize)){
            const item=el('li',undefined,list);item.className='caption-search-result';el('strong',change.sceneTitle+' · '+change.trackName,item).tabIndex=-1;
            el('small','Before',item);el('p',change.before,item);el('small','After',item);el('p',change.after,item);
          }
          pages(navigation,proposal.changes.length,index,next=>{show(next);list.querySelector('strong')?.focus();},'caption-review-page','replacement review');
        }
        show(0);apply.textContent='Apply replacements';updateAction();
        (consent||back).focus();
      }catch(e){proposal=null;fail(e);}
    }
    host.modal('Find and replace captions',body=>{
      ownedPanel=el('section',undefined,body);ownedPanel.className='caption-search';
      el('p','Search authored captions only, not narration or page content. Nothing changes until you review and apply. Searches and replacements are literal text.',ownedPanel).className='note';
      error=el('p','',ownedPanel);error.id='caption-search-error';error.className='error';error.setAttribute('role','alert');
      form=el('form',undefined,ownedPanel);form.noValidate=true;
      function input(labelText,id,type='text'){
        const label=el('label',labelText,form);label.className='field';const n=el(type==='select'?'select':'input',undefined,label);n.id=id;if(type!=='select')n.type=type;return n;
      }
      query=input('Find text','caption-query');query.maxLength=256;query.required=true;
      replacement=input('Replace with','caption-replacement');replacement.maxLength=4000;
      el('p','An empty replacement removes matched text; an entirely blank caption is not allowed.',form).className='note';
      track=input('Search in','caption-search-track','select');
      const all=el('option','All caption tracks (including hidden)',track);all.value='';
      for(const t of snapshot.project.tracks.filter(t=>t.kind==='captions')){const option=el('option',t.name+(t.enabled?'':' · hidden')+(t.locked?' · locked':''),track);option.value=t.id;}
      track.value=snapshot.project.captionTrack;
      const label=el('label',undefined,form);label.className='selection-choice';matchCase=el('input',undefined,label);matchCase.type='checkbox';matchCase.id='caption-match-case';el('span','Match case',label);
      const find=el('button','Find captions',form);find.type='submit';find.id='caption-search-submit';
      status=el('p','Enter text to find across your captions.',form);status.id='caption-search-status';status.setAttribute('role','status');
      const selection=el('div',undefined,form);selection.className='actions';
      button('caption-select-all','Select all matches',selection,()=>{if(found){selected=new Set(found.captions.map(row=>row.clipId));showResults();}});
      button('caption-select-none','Clear selection',selection,()=>{selected.clear();showResults();});
      selectionCount=el('p','0 matching captions selected',form);selectionCount.id='caption-selected-count';selectionCount.setAttribute('role','status');
      results=el('ol',undefined,form);results.id='caption-search-results';results.className='caption-search-results';
      pager=el('div',undefined,form);pager.className='actions';pager.hidden=true;
      reviewPanel=el('section',undefined,ownedPanel);reviewPanel.id='caption-search-review';reviewPanel.hidden=true;
      form.addEventListener('submit',event=>{event.preventDefault();search();});
      for(const field of [query,track,matchCase])field.addEventListener('input',()=>{
        found=null;proposal=null;selected.clear();results.replaceChildren();pager.hidden=true;error.textContent='';status.textContent='Search changed. Choose Find captions to update the results.';updateAction();
      });
      replacement.addEventListener('input',()=>{proposal=null;error.textContent='';updateAction();});
    },[['Close',host.closeDialog],['Back to results',backToSearch],['Review replacements',()=>{
      if(!reviewing){review();return;}
      try{
        live();if(!proposal||consent&&!consent.checked)return;
        host.commit(proposal.value,'Replace text in '+proposal.changes.length+' captions',snapshot.revision);
        host.closeDialog();entry.focus({preventScroll:true});
      }catch(e){fail(e);}
    },true]]);
    back=$('dialog-actions').children[1];back.id='caption-search-back';back.hidden=true;
    apply=$('dialog-actions').lastElementChild;apply.id='caption-replace-review';apply.disabled=true;query.focus();
  }
  return {open,destroy(){if(disposed)return;disposed=true;if(ownedPanel&&$('dialog-body').contains(ownedPanel))host.closeDialog();entry.remove();ownedPanel=null;}};
}
