#!/usr/bin/env python3
"""Pack both candidates, inspect the archive boundary, then test a clean consumer.
Never publishes packages; installation scripts are disabled in the consumer.
"""
from pathlib import Path
import json,subprocess,tempfile,tarfile,shutil,hashlib
ROOT=Path(__file__).resolve().parents[1]
def run(args,**kw):
    return subprocess.run(args,check=True,text=True,**kw)
def main():
    with tempfile.TemporaryDirectory(prefix='dom-director-pack-') as temp:
        temp=Path(temp);archives=[];reports=[]
        for name in ['core','react']:
            package=ROOT/'packages'/name
            packed=run(['npm','pack','--json','--pack-destination',str(temp)],cwd=package,capture_output=True)
            metadata=json.loads(packed.stdout)[0];archive=temp/metadata['filename'];archives.append(archive)
            with tarfile.open(archive,'r:gz') as tar:
                files={member.name:member for member in tar.getmembers()}
                for path,member in files.items():
                    if not member.isfile() or not path.startswith('package/') or '..' in Path(path).parts:
                        raise ValueError('Unexpected archive member '+path)
                    relative=path.removeprefix('package/')
                    if relative not in ['package.json','README.md','LICENSE','prepare.mjs'] and not (relative.startswith('src/') and relative.endswith(('.js','.d.ts'))):
                        raise ValueError('Unexpected packaged path '+path)
                required=['package/package.json','package/src/index.js','package/src/index.d.ts','package/LICENSE']
                if name=='core':required+=['package/src/schema.generated.js','package/src/script.generated.d.ts','package/src/surface.d.ts','package/src/storyboard.js','package/src/storyboard.d.ts']
                for path in required:
                    if path not in files:raise ValueError('Missing package file '+path)
                manifest=json.load(tar.extractfile('package/package.json'))
                assert manifest['private'] is True and manifest['version']=='0.1.0-rc.0'
                assert manifest.get('dependencies',{})=={},'Runtime dependencies must remain explicit peers'
                assert tar.extractfile('package/LICENSE').read()==(ROOT/'LICENSE').read_bytes()
                for path,member in files.items():
                    rel=path.removeprefix('package/')
                    assert tar.extractfile(member).read()==(package/rel).read_bytes(),rel
            reports.append({'name':manifest['name'],'files':len(files),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()})
        consumer=temp/'consumer';consumer.mkdir();(consumer/'package.json').write_text('{"private":true,"type":"module"}')
        for name in ['authoring.ts','react-authoring.tsx','installed.test.mjs','storyboard-authoring.ts','storyboard-installed.test.mjs']:
            shutil.copyfile(ROOT/'package-tests'/name,consumer/name)
        run(['npm','install','--ignore-scripts','--no-package-lock','--no-audit','--no-fund',*[str(p) for p in archives],
             'react@19.3.1','react-dom@19.3.1','scheduler@0.28.0','@types/react@19.0.0','@types/react-dom@19.0.0','csstype@3.1.3','typescript@5.8.3'],cwd=consumer)
        run(['node','--test','installed.test.mjs','storyboard-installed.test.mjs'],cwd=consumer)
        run([str(consumer/'node_modules/.bin/tsc'),'--noEmit','--strict','--module','NodeNext','--moduleResolution','NodeNext',
             '--target','ES2022','--lib','ES2022,DOM','--jsx','react-jsx','authoring.ts','react-authoring.tsx','storyboard-authoring.ts'],cwd=consumer)
        print(json.dumps({'node':run(['node','--version'],capture_output=True).stdout.strip(),'packages':reports,'consumer':'PASS','published':False},indent=2))
if __name__=='__main__':main()
