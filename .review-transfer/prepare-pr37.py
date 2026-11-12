"""Temporary transfer helper; never changes a branch, PR, or deployment."""
from pathlib import Path
import base64, hashlib, json, os, subprocess, urllib.request
ROOT = Path.cwd()
EXPECTED = {
    'site/studio.mjs': ('114d0780110c90abd96a6e2e8823945f60cfc502', '40d39a33ca0d70fabc25584c57d9ee4111a5356a'),
    'studio-tests/timing_link_test.py': ('d4c3272908211c94b06f03e376c865a50a493f1e', '45d226f6da14d7e98a727d7e3978222b17b0860e'),
}
def blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
assert os.environ['GITHUB_REPOSITORY'] == 'natanelia/dom-director'
for name, (before, after) in EXPECTED.items():
    assert blob((ROOT/name).read_bytes()) == before, name
p=ROOT/'site/studio.mjs'; s=p.read_text()
def replace(old,new):
    global s
    assert s.count(old)==1, (old[:100],s.count(old))
    s=s.replace(old,new)
replace('dialogCleanup=null,fieldCommit=false;', 'dialogCleanup=null,fieldCommit=false,dialogEpoch=0;')
anchor='function selectTimelineKey(clipId,keyId){'
replace(anchor,'''/** Keep exact time-axis positions while giving dense keys separate hit areas.
 * Pack across the entire track, including keys on adjacent split clips. */
function packTimelineKeys(body){
  if(!body.parentElement.classList.contains('motion-lane'))return;
  const ends=[],keys=[...body.querySelectorAll('[data-timeline-key]')].filter(n=>!n.hidden);
  keys.sort((a,b)=>parseFloat(a.style.left)-parseFloat(b.style.left));
  for(const key of keys){
    const left=parseFloat(key.style.left),free=ends.findIndex(end=>left>=end+2),row=free<0?ends.length:free;
    ends[row]=left+24;key.style.top=(35+row*26)+'px';
  }
  body.parentElement.style.height=Math.max(62,36+ends.length*26)+'px';
}
'''+anchor)
replace("for(const side of ['start','end']){const h=node('span',undefined,b);h.className='trim '+side;h.dataset.trim=side;h.setAttribute('aria-hidden','true');}\n    }\n  }", "for(const side of ['start','end']){const h=node('span',undefined,b);h.className='trim '+side;h.dataset.trim=side;h.setAttribute('aria-hidden','true');}\n    }\n    packTimelineKeys(l.body);\n  }")
replace("function modal(title,render,actions){closeDialog();$('dialog-title')", "function modal(title,render,actions){closeDialog();dialogEpoch++;$('dialog-title')")
replace("const originalStyle=b.getAttribute('style');let candidate=null,finished=false,frame=null,lastX=start,lastAlt=event.altKey,delta=0,invalid=false;", "const body=b.parentElement,lane=body.parentElement,laneHeight=lane.style.height;\n    const originalStyles=[...body.querySelectorAll('[data-timeline-key]')].map(n=>[n,n.getAttribute('style')]);\n    let candidate=null,finished=false,frame=null,lastX=start,lastAlt=event.altKey,delta=0,invalid=false;")
replace("const restore=()=>{b.setAttribute('style',originalStyle);b.dataset.keyTime=String(sceneStart+clip.startMs+local);delete b.dataset.dragState;};", "const restore=()=>{for(const [n,style] of originalStyles)n.setAttribute('style',style);lane.style.height=laneHeight;b.dataset.keyTime=String(sceneStart+clip.startMs+local);delete b.dataset.dragState;};")
replace("placeTimelineKey(b,clip,{...key,atMs:key.atMs+delta},scale,sceneStart);b.dataset.dragState='valid';", "placeTimelineKey(b,clip,{...key,atMs:key.atMs+delta},scale,sceneStart);packTimelineKeys(body);b.dataset.dragState='valid';")
replace("const prior=[...nodes,...keyNodes].map(n=>({node:n,style:n.getAttribute('style'),label:n.querySelector('.clip-label')?.textContent,hidden:n.hidden,keyTime:n.dataset.keyTime}));", "const lane=b.parentElement.parentElement,laneHeight=lane.style.height;\n    const prior=[...nodes,...keyNodes].map(n=>({node:n,style:n.getAttribute('style'),label:n.querySelector('.clip-label')?.textContent,hidden:n.hidden,keyTime:n.dataset.keyTime}));")
replace("if(label)label.textContent=item.label;}};", "if(label)label.textContent=item.label;}lane.style.height=laneHeight;};")
replace("if(key)placeTimelineKey(n,c,key,scale,offsets.get(c.sceneId));}\n        const c=findClip(candidate,id).clip", "if(key)placeTimelineKey(n,c,key,scale,offsets.get(c.sceneId));}\n        packTimelineKeys(b.parentElement);\n        const c=findClip(candidate,id).clip")
replace("$('dialog-actions').lastElementChild.id='confirm-caption-edit';dialogCleanup=()=>renderInspector();", """$('dialog-actions').lastElementChild.id='confirm-caption-edit';dialogCleanup=()=>renderInspector();
  // Cleanup replaces the opener. Restore its replacement AFTER native dialog focus
  // restoration, and never steal focus from a dialog opened in the meantime.
  const epoch=dialogEpoch;
  $('dialog').addEventListener('close',()=>{
    if(disposed||$('dialog').open||dialogEpoch!==epoch)return;
    ($('caption-text')||$('add-caption')||$('delete-clip'))?.focus({preventScroll:true});
  },{once:true});""")
p.write_text(s)
p=ROOT/'studio-tests/timing_link_test.py'; s=p.read_text()
marker="if __name__ == '__main__':\n"
assert s.count(marker)==1
s=s.replace(marker,(ROOT/'.review-transfer/regressions.txt').read_text()+marker)
p.write_text(s)
for name, (before, after) in EXPECTED.items():
    assert blob((ROOT/name).read_bytes()) == after, name
subprocess.run(['node','--check','site/studio.mjs'],check=True)
subprocess.run(['python3','-m','py_compile','studio-tests/timing_link_test.py'],check=True)
subprocess.run(['git','diff','--check'],check=True)
results=[]
for name, (before, after) in EXPECTED.items():
    data=(ROOT/name).read_bytes()
    body=json.dumps({'content':base64.b64encode(data).decode(),'encoding':'base64'}).encode()
    req=urllib.request.Request('https://api.github.com/repos/natanelia/dom-director/git/blobs',data=body,method='POST',headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'})
    with urllib.request.urlopen(req,timeout=30) as response:
        result=json.load(response)
    assert result['sha']==after,name
    results.append({'path':name,'sha':after,'mode':'100644','type':'blob'})
print('VERIFIED_BLOBS='+json.dumps(results),flush=True)
