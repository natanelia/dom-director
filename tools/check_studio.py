#!/usr/bin/env python3
"""Test real local candidate tarballs; never publish or execute consumer install scripts."""
from pathlib import Path
import json,subprocess,tempfile,tarfile
ROOT=Path(__file__).resolve().parents[1]
def run(args,**kw):return subprocess.run(args,check=True,text=True,**kw)
with tempfile.TemporaryDirectory(prefix='director-studio-') as temp:
    temp=Path(temp);archives=[]
    for name in ['core','studio']:
        result=run(['npm','pack','--json','--pack-destination',str(temp)],cwd=ROOT/'packages'/name,capture_output=True)
        archive=temp/json.loads(result.stdout)[0]['filename'];archives.append(str(archive))
        with tarfile.open(archive,'r:gz') as tar:
            for member in tar.getmembers():
                relative=member.name.removeprefix('package/')
                assert member.isfile() and member.name.startswith('package/') and '..' not in Path(relative).parts
                assert relative in ['package.json','README.md','LICENSE','prepare.mjs'] or (relative.startswith('src/') and relative.endswith(('.js','.d.ts')))
            manifest=json.load(tar.extractfile('package/package.json'));assert manifest['private'] is True
            assert tar.extractfile('package/LICENSE').read()==(ROOT/'LICENSE').read_bytes()
    consumer=temp/'consumer';consumer.mkdir();(consumer/'package.json').write_text('{"private":true,"type":"module"}')
    run(['npm','install','--ignore-scripts','--no-audit','--no-fund',*archives,'typescript@5.8.3'],cwd=consumer)
    (consumer/'smoke.mjs').write_text("import {createSample,validateProject,exportSubtitles} from '@dom-director/studio'; import {cloneData} from '@dom-director/core/data'; import {setAppearance,distributeCaptionWords} from '@dom-director/studio/editing'; import {saveProjectBundle,readProjectBundle} from '@dom-director/studio/media'; const p=createSample();if(!validateProject(cloneData(p)).ok||!exportSubtitles(p).text.startsWith('WEBVTT'))throw Error('Invalid installed consumer');const bundle=await saveProjectBundle(p,{bytes(){throw Error('Unexpected audio access')}});if((await readProjectBundle(bundle)).project.id!==p.id)throw Error('Media subpath failed');if(setAppearance(p,'cc.overview.0',{size:42}).tracks[3].clips[0].style.size!==42)throw Error('Editing subpath failed');if(!distributeCaptionWords(p,'cc.overview.0').tracks[3].clips[0].words.length)throw Error('Word timing subpath failed');console.log('Installed Studio, editing and media consumers passed');")
    run(['node','smoke.mjs'],cwd=consumer)
    (consumer/'smoke.ts').write_text("import {createSample,editProject,createEvaluator,type Project} from '@dom-director/studio'; import {setAppearance,addKeyframe,distributeCaptionWords} from '@dom-director/studio/editing'; import {createMediaBank,createTransport,generateVoiceTake,type VoiceProvider} from '@dom-director/studio/media'; const p:Project=createSample();const q=editProject(p,d=>{d.title='Typed edit';});createEvaluator(q);const bank=createMediaBank();const transport=createTransport({bank,onFrame:t=>{const n:number=t;void n;}});transport.load(p);const provider:VoiceProvider={capabilities:{name:'Local host',voices:[{id:'a',styles:['calm']}]},generate:async request=>({bytes:new ArrayBuffer(1),mime:'audio/wav'})};void generateVoiceTake(provider,{text:'Text',voiceId:'a',style:'calm',revision:0,clipId:'voice'});\n// @ts-expect-error snapshots are immutable\np.title='unsafe';\n// @ts-expect-error unsupported timeline coordinate type\ncreateEvaluator(p).sample('1',{});\n// @ts-expect-error audio must be bytes, not a URL\nvoid bank.ingest('a','A','audio/wav','https://example.invalid');\n")
    (consumer/'editing.ts').write_text("import {createSample} from '@dom-director/studio'; import {setAppearance,addKeyframe,distributeCaptionWords} from '@dom-director/studio/editing'; const p=createSample(); distributeCaptionWords(p,'cc.overview.0'); setAppearance(p,'cc.overview.0',{size:42},{scope:'track'}); addKeyframe(p,'camera.overview',2000,{zoom:2});\n// @ts-expect-error unknown scope\nsetAppearance(p,'cc.overview.0',{}, {scope:'all-scenes'});\n// @ts-expect-error stable key IDs cannot be supplied\naddKeyframe(p,'camera.overview',2000,{id:'different'});\n")
    run([str(consumer/'node_modules/.bin/tsc'),'--noEmit','--strict','--module','NodeNext','--target','ES2022','smoke.ts','editing.ts'],cwd=consumer)
