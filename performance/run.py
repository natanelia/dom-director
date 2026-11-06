#!/usr/bin/env python3
"""Synthetic benchmark evidence, not a physical-device or arbitrary-app guarantee."""
import json,os,platform,threading
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
output=ROOT/'performance-results';output.mkdir(exist_ok=True)
result={'commit':os.environ.get('GITHUB_SHA','local'),'complete':False,'budgetMet':False,'workloads':[]}
def save():
    (output/'results.json').write_text(json.dumps(result,indent=2)+'\n')
try:
    with sync_playwright() as p:
        browser=p.chromium.launch();page=browser.new_page(viewport={'width':1200,'height':900});page.set_default_timeout(300000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/performance/fixture.html');page.wait_for_function('window.performanceReady')
        result.update({'environment':{'browser':browser.version,'os':platform.platform(),'python':platform.python_version()},'method':{'warmupRuns':5,'measuredRuns':20,'framesPerRun':30,'clock':'manual presentation clock, real requestAnimationFrame scheduling','cpu':'synchronous host update plus transform/player callback; excludes paint and raster','comparison':'baseline host, direct CSS transform using identical sampler, full SDK','provisionalCpuP95BudgetMs':3}})
        result['cleanup']=page.evaluate('window.checkCleanup(100)');save()
        print('CLEANUP',json.dumps(result['cleanup']),flush=True)
        for count,updating in [(1000,False),(10000,False),(1000,True)]:
            for kind in ['baseline','direct','sdk']:
                value=page.evaluate('options=>window.measureWorkload(options)',{'count':count,'updating':updating,'kind':kind})
                result['workloads'].append(value);save();print(json.dumps({k:v for k,v in value.items() if k!='runsData'}),flush=True)
        assert not errors,errors
        result['complete']=True
        result['budgetMet']=all(w['summary']['cpuP95Ms']<3 for w in result['workloads'] if w['kind']=='sdk')
        save();print('PROVISIONAL_CPU_BUDGET_MET',result['budgetMet'])
        browser.close()
        if not result['budgetMet']:raise AssertionError('Provisional 3ms p95 synchronous CPU budget exceeded; inspect raw measurements.')
finally:
    save();server.shutdown();server.server_close();thread.join()
