"""Synthetic real-browser surface tests. No production DOM or credentials."""
import os, threading, unittest, base64, json
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
class BrowserFixture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.p=sync_playwright().start();engine=os.environ.get('BROWSER_ENGINE','chromium')
        args={'headless':True}
        if os.environ.get('BROWSER_EXECUTABLE'):args['executable_path']=os.environ['BROWSER_EXECUTABLE']
        cls.browser=getattr(cls.p,engine).launch(**args)
        print('Runtime browser:',engine,cls.browser.version,flush=True)
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.p.stop();cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def setUp(self):
        self.page=self.browser.new_page(viewport={'width':1200,'height':900});self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        if os.environ.get('RUNTIME_TRANSPORT')=='memory':
            imports={}
            for module in (ROOT/'packages/core/src').glob('*.js'):
                source=module.read_text().replace("from './", "from '@runtime/")
                imports['@runtime/'+module.name]='data:text/javascript;base64,'+base64.b64encode(source.encode()).decode()
            html=(ROOT/'runtime-tests/fixture.html').read_text().replace('../packages/core/src/index.js','@runtime/index.js')
            mapping='<script type="importmap">'+json.dumps({'imports':imports})+'</script>'
            self.page.set_content(html.replace('<script type="module">',mapping+'<script type="module">'))
        else:
            self.page.goto(f'http://127.0.0.1:{self.server.server_port}/runtime-tests/fixture.html')
        self.page.wait_for_function('window.ready===true')
    def tearDown(self):
        self.page.close();self.assertEqual(self.errors,[])
