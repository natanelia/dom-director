#!/usr/bin/env python3
"""Stage an allowlisted SDK-powered site; never uploads a repository tree."""
from pathlib import Path
import hashlib,json,os,re,shutil,subprocess,argparse
ROOT=Path(__file__).resolve().parents[1]

def replace_once(text,old,new):
    if text.count(old)!=1:raise ValueError(f'Expected one template marker: {old[:70]}')
    return text.replace(old,new)

def render_html(template,css,revision):
    html=replace_once(template,'<body>','<body class="sdk-site">')
    html=replace_once(html,'<aside class="app-sidebar">','<nav class="app-sidebar" aria-label="Orbit workspace">')
    html=replace_once(html,'</aside>','</nav>')
    html=replace_once(html,'id="chapter-strip" aria-label=','id="chapter-strip" role="group" aria-label=')
    html=replace_once(html,'class="mode-picker" aria-label=','class="mode-picker" role="group" aria-label=')
    html=replace_once(html,'<style>/*__CSS__*/</style>','<style>'+css+'</style>')
    html=replace_once(html,'<script>/*__DATA__*/</script>\n<script>/*__MODEL__*/\n/*__APP__*/</script>',
        '<div id="sdk-overlay"></div><script type="module" src="./app.mjs"></script>')
    for id in ['focus-frame','demo-cursor']:
        html,count=re.subn(r'^.*id="'+id+r'".*\n','',html,flags=re.M)
        if count!=1:raise ValueError('Unexpected legacy overlay marker')
    caption=next(line for line in html.splitlines() if 'id="caption"' in line)
    html=html.replace(caption+'\n','')
    html=replace_once(html,'    <div class="transport">',caption+'\n    <div class="transport">')
    html=replace_once(html,'<button class="takeover" id="takeover">',
        '<button class="transport-chip" id="exit-tour">Exit</button><button class="takeover" id="takeover">')
    tools='<div class="sdk-tools wrap"><button id="retry-step" hidden>Retry step</button><button id="extend-step" hidden>More time</button><button id="hint-step" hidden>Show hint</button><button id="save-position">Save position</button><button id="restore-position" disabled>Restore position</button><a href="./agent.html">Agent playground ↗</a><a href="./prototype/">Original prototype ↗</a></div>'
    html=replace_once(html,'<section class="behind wrap"',tools+'\n<section class="behind wrap"')
    html=html.replace('LIVE PROTOTYPE','LIVE SDK').replace('Prototype notes ↗','Implementation notes ↗')
    html=replace_once(html,'A handcrafted concept prototype.<br>Not the published DOM Director SDK.',
        'Powered by the reusable SDK.<br>Implementation candidate · not yet on npm.')
    html=replace_once(html,'These six scenes drive the prototype. This is a demo-local format, not the proposed SDK schema or an AI-generated response.',
        'These six scenes use the canonical SDK schema. The camera, narration, captions and condition gate are interpreted by the reusable core. This is prepared content, not a live AI response.')
    html=html.replace('Working in this prototype','Working in this SDK demo')
    html=replace_once(html,'The reusable SDK, arbitrary-app compatibility, production agent integration, full action permissions, video export, or completion of the library milestones.',
        'Arbitrary-app compatibility, production model integration, video export, physical-device certification or accessibility conformance. The isolated host explicitly grants condition observation and Try reset; scripts do not grant themselves permissions.')
    html=replace_once(html,'No external fonts, libraries, tracking, AI services, or account connection. The download is a self-contained HTML file with its own audio.',
        'Only same-origin SDK modules and prepared audio are served. No tracking, external fonts, AI provider, account connection or persistent storage. Sound is opt-in. The original self-contained prototype remains linked separately.')
    html=html.replace('value="cinematic">Cinematic — slow in, smooth out','value="gentle">Cinematic — smooth in and out')
    html=html.replace('value="gentle">Gentle — a softer landing','value="overview">Overview — a softer landing')
    html=html.replace('value="linear">Linear — see the mechanics','value="direct">Direct — see the mechanics')
    html=html.replace('real-DOM concept demo','real-DOM SDK demo')
    html=replace_once(html,'</head>',f'<meta name="dom-director-revision" content="{revision}"></head>')
    if any(marker in html for marker in ['/*__CSS__*/','/*__DATA__*/','/*__APP__*/','/*__MODEL__*/']):raise ValueError('Unresolved template marker')
    return html

def build(output,revision):
    if not re.fullmatch(r'[a-f0-9]{40}|development',revision):raise ValueError('Invalid build revision')
    output=Path(output).resolve()
    if output.exists():raise ValueError('Output must be a new directory; remove the previous build explicitly.')
    output.mkdir(parents=True)
    tour=json.loads((ROOT/'site/orbit.tour.json').read_text())
    sdk=output/'sdk';sdk.mkdir()
    modules=sorted((ROOT/'packages/core/src').glob('*.js'))
    if not any(p.name=='schema.generated.js' for p in modules):raise ValueError('Run tools/build_runtime.py first')
    for module in modules:
        if module.is_symlink():raise ValueError('Source symlink is not allowed')
        for reference in re.findall(r"^(?:import|export)[^\n]*?from ['\"]([^'\"]+)['\"]",module.read_text(),flags=re.M):
            if not reference.startswith('./') or not (module.parent/reference).is_file():raise ValueError('Unresolved/non-local SDK import: '+reference)
        shutil.copyfile(module,sdk/module.name)
    for name in ['app.mjs','model.mjs','agent.html','agent.mjs']:
        source=ROOT/'site'/name
        if source.is_symlink():raise ValueError('Source symlink is not allowed')
        shutil.copyfile(source,output/name)
    css=(ROOT/'demo/src/style.css').read_text()+'\n'+(ROOT/'site/style.css').read_text()
    html=render_html((ROOT/'demo/src/index.html').read_text(),css,revision)
    (output/'index.html').write_text(html)
    (output/'tour.generated.js').write_text('export const ORBIT_TOUR = '+json.dumps(tour,ensure_ascii=True).replace('<','\\u003c')+';\n')
    shutil.copyfile(ROOT/'site/orbit.tour.json',output/'orbit.tour.json')
    shutil.copyfile(ROOT/'LICENSE',output/'LICENSE.txt');(output/'.nojekyll').write_text('')
    prototype=output/'prototype';prototype.mkdir();shutil.copyfile(ROOT/'demo/index.html',prototype/'index.html')
    assets=output/'assets';assets.mkdir();start=0
    for scene in tour['scenes']:
        name=scene['narration']['audioAsset']+'.mp3'
        subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-ss',str(start/1000),'-i',str(ROOT/'demo/assets/narration.mp3'),
            '-t',str(scene['durationMs']/1000),'-vn','-c:a','libmp3lame','-b:a','64k','-ar','22050','-ac','1','-map_metadata','-1',str(assets/name)],check=True,timeout=30)
        start+=scene['durationMs']
    files={str(path.relative_to(output)):hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(output.rglob('*')) if path.is_file()}
    allowed={'.nojekyll','index.html','LICENSE.txt','tour.generated.js','orbit.tour.json','app.mjs','model.mjs','agent.html','agent.mjs','prototype/index.html'}
    if any(name not in allowed and not re.fullmatch(r'sdk/[A-Za-z0-9.-]+\.js|assets/voice\.[A-Za-z0-9.-]+\.mp3',name) for name in files):raise ValueError('Unexpected public artifact path')
    (output/'_build.json').write_text(json.dumps({'revision':revision,'runtime':'@dom-director/core','schemaVersion':tour['schemaVersion'],'files':files},indent=2)+'\n')
    print(json.dumps({'revision':revision,'files':len(files)+1,'bytes':sum(path.stat().st_size for path in output.rglob('*') if path.is_file())}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'site-dist'));parser.add_argument('--revision',default=os.environ.get('GITHUB_SHA','development'))
    args=parser.parse_args();build(args.output,args.revision)
