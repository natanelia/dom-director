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
    (consumer/'smoke.mjs').write_text("import {createSample,createEvaluator,validateProject,exportSubtitles} from '@dom-director/studio'; import {cloneData} from '@dom-director/core/data'; const p=createSample();if(!validateProject(cloneData(p)).ok||!exportSubtitles(p).text.startsWith('WEBVTT'))throw Error('Invalid installed consumer');console.log('Installed Studio consumer passed');")
    run(['node','smoke.mjs'],cwd=consumer)
    (consumer/'smoke.ts').write_text("import {createSample,editProject,createEvaluator,type Project} from '@dom-director/studio'; const p:Project=createSample();const q=editProject(p,d=>{d.title='Typed edit';});createEvaluator(q);\n// @ts-expect-error snapshots are immutable\np.title='unsafe';\n// @ts-expect-error unsupported timeline coordinate type\ncreateEvaluator(p).sample('1',{});\n")
    run([str(consumer/'node_modules/.bin/tsc'),'--noEmit','--strict','--module','NodeNext','--target','ES2022','smoke.ts'],cwd=consumer)
