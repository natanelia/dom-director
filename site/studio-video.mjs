/** Local-render handoff only: never executes a command or uploads a project. */
export const VIDEO_DEFAULTS = Object.freeze({format:'mp4', width:1280, fps:30, range:'all', start:'0', end:'10', audio:true, captions:true, reduced:false});

function milliseconds(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,3})?$/.test(value.trim())) throw Error('Use seconds with up to three decimal places.');
  const [whole, fraction=''] = value.trim().split('.');
  const ms = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
  if (!Number.isSafeInteger(ms) || ms < 0) throw Error('Choose a valid nonnegative time.');
  return ms;
}

/** Fixed filenames and validated enums/numbers keep authored text out of shell syntax. */
export function videoCommand(options) {
  const {format, width, fps, range, start, end, audio, captions, reduced} = options;
  if (!['mp4','webm'].includes(format) || ![960,1280,1920].includes(width) || ![24,30,60].includes(fps)) throw Error('Choose a supported format, resolution and frame rate.');
  if (!['all','range'].includes(range) || [audio,captions,reduced].some(value => typeof value !== 'boolean')) throw Error('Choose explicit range, sound, caption and motion settings.');
  const args = ['python3','tools/render_video.py','--project','walkthrough.director','--output','walkthrough.'+format,'--width',String(width),'--fps',String(fps)];
  let frames = null;
  if (range === 'range') {
    const first = milliseconds(start), last = milliseconds(end);
    if (last <= first) throw Error('End must be after start.');
    if (last - first > 120000) throw Error('Export at most 120 seconds at a time.');
    args.push('--start-ms',String(first),'--end-ms',String(last));
    frames = Math.ceil((last - first) * fps / 1000);
  }
  if (!audio) args.push('--silent');
  if (!captions) args.push('--no-captions');
  if (reduced) args.push('--reduced-motion');
  return {command:args.join(' '), frames};
}

function installVideoHandoff() {
  const $ = id => document.getElementById(id);
  if ($('studio')?.dataset.ready !== 'true') return;
  const trigger=$('export-open'), dialog=$('dialog'), title=$('dialog-title'), body=$('dialog-body'), actions=$('dialog-actions');
  const lifetime=new AbortController();
  let values={...VIDEO_DEFAULTS}, epoch=0;
  function node(tag,text,parent) {const element=document.createElement(tag);if(text!==undefined)element.textContent=text;parent?.append(element);return element;}
  function button(label,id,callback) {const element=node('button',label,actions);element.type='button';element.id=id;element.addEventListener('click',callback);return element;}
  dialog.addEventListener('close',()=>{epoch++;},{signal:lifetime.signal});
  trigger.addEventListener('click',()=>{
    // Runs after the editor's normal export handler. Reuse its validation and modal.
    if (!dialog.open || title.textContent !== 'Keep or share your work' || $('video-open')) return;
    const note=body.querySelector('.note');
    if (note) note.textContent='Video rendering is available through the local computer tool. Interactive publishing is not available.';
    const entry=button('Video (local)…','video-open',show);
    actions.insertBefore(entry,actions.querySelector('.primary'));
  },{signal:lifetime.signal});
  window.addEventListener('pagehide',event=>{epoch++;if(!event.persisted)lifetime.abort();},{signal:lifetime.signal});

  function show() {
    $('stop').click();
    ++epoch;
    title.textContent='Prepare a local video export';body.replaceChildren();actions.replaceChildren();
    node('p','Render an MP4 or WebM on your computer using Python, Chromium and FFmpeg. This panel prepares a command; it does not render video in this browser or upload your project.',body);
    const guide=node('p',undefined,body);
    const link=node('a','Setup and rendering guide ↗',guide);link.href='https://github.com/natanelia/dom-director/blob/main/docs/video-export.md';link.target='_blank';link.rel='noopener noreferrer';
    const fields={};
    function select(id,label,choices) {
      const wrapper=node('label',label,body);wrapper.className='field';
      const input=node('select',undefined,wrapper);input.id='video-'+id;
      for(const [value,text] of choices){const option=node('option',text,input);option.value=String(value);}
      input.value=String(values[id]);fields[id]=input;input.addEventListener('change',update);return input;
    }
    select('format','Video format',[['mp4','MP4 · H.264 / AAC'],['webm','WebM · VP9 / Opus']]);
    const resolution=select('width','Resolution',[[960,'540p · 960 × 540'],[1280,'720p · 1280 × 720'],[1920,'1080p · 1920 × 1080']]);
    select('fps','Frames per second',[[24,'24 fps'],[30,'30 fps'],[60,'60 fps']]);
    select('range','Saved-project range',[['all','Entire saved project · up to 120 seconds'],['range','Exact time range']]);
    const times=node('div',undefined,body);times.className='row';
    for(const [id,label] of [['start','Start (seconds)'],['end','End (seconds, exclusive)']]){
      const wrapper=node('label',label,times);wrapper.className='field';
      const input=node('input',undefined,wrapper);input.type='number';input.min='0';input.step='0.001';input.id='video-'+id;input.value=values[id];input.setAttribute('aria-describedby','video-summary');
      fields[id]=input;input.addEventListener('input',update);
    }
    for(const [id,label] of [['audio','Include voiceover'],['captions','Burn in styled captions'],['reduced','Use reduced motion']]){
      const wrapper=node('label',undefined,body);wrapper.className='field checkbox';const input=node('input',undefined,wrapper);input.type='checkbox';input.id='video-'+id;input.checked=values[id];wrapper.append(document.createTextNode(label));fields[id]=input;input.addEventListener('change',update);
    }
    node('p','These are export settings, independent of Sound off, CC and Motion switches in the preview. The renderer validates targets and voice takes before writing a file.',body).className='note';
    const summary=node('p',undefined,body);summary.id='video-summary';summary.setAttribute('role','status');
    node('h3','1. Save the project you want to render',body);
    node('p','Save your current draft, then place the downloaded file in the repository checkout as walkthrough.director. Check Downloads for renamed copies. Rendering uses that saved file—not later edits in this tab.',body);
    const save=node('button','Save current project (.director)',body);save.id='video-save';save.type='button';save.addEventListener('click',()=>$('save-project').click());
    node('h3','2. Run this in the prepared source checkout',body);
    const label=node('label','Render command',body);label.className='field';const command=node('textarea',undefined,label);command.id='video-command';command.readOnly=true;command.rows=4;command.spellcheck=false;
    node('p','Setup is required once; see the guide above. Existing videos are never overwritten: move an old walkthrough.mp4 / walkthrough.webm and its report before reusing the command. Longer projects need multiple ranges. No rendered video has been created by this panel.',body).className='note';
    const status=node('p',undefined,body);status.id='video-copy-status';status.setAttribute('role','status');
    button('Back','video-back',()=>{dialog.close();trigger.click();});
    button('Close','video-close',()=>dialog.close());
    const copy=button('Copy command','video-copy',async()=>{
      // Each copy has its own navigation epoch; a restored dialog can copy again.
      const text=command.value, token=epoch;
      try{
        if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText(text);
        if(dialog.open&&epoch===token&&command.value===text)status.textContent='Command copied. Run it locally after saving the project and completing setup.';
      }catch{
        if(dialog.open&&epoch===token&&command.value===text){command.focus();command.select();status.textContent='Clipboard unavailable. Select and copy the command above.';}
      }
    });copy.className='primary';
    function update(){
      values={format:fields.format.value,width:Number(fields.width.value),fps:Number(fields.fps.value),range:fields.range.value,start:fields.start.value,end:fields.end.value,audio:fields.audio.checked,captions:fields.captions.checked,reduced:fields.reduced.checked};
      times.hidden=values.range!=='range';status.textContent='';
      try{
        const result=videoCommand(values);command.value=result.command;copy.disabled=false;summary.className='note';
        summary.textContent=(result.frames===null?'The renderer checks that the saved project fits the 120-second limit.':result.frames+' frames; the final partial frame holds to its boundary.')+' Compatible Orbit projects only.';
        fields.start.removeAttribute('aria-invalid');fields.end.removeAttribute('aria-invalid');
      }catch(error){command.value='';copy.disabled=true;summary.className='error';summary.textContent=error.message;fields.start.setAttribute('aria-invalid','true');fields.end.setAttribute('aria-invalid','true');}
    }
    update();resolution.focus();
  }
}

// Module scripts finish before DOMContentLoaded; the main editor owns the first export listener.
if(typeof document!=='undefined'){
  if(document.readyState==='complete')installVideoHandoff();
  else document.addEventListener('DOMContentLoaded',installVideoHandoff,{once:true});
}
