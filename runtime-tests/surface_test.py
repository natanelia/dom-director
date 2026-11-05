"""Synthetic real-browser surface tests. No production DOM or credentials."""
import os, threading, unittest, base64, json
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
class SurfaceTests(unittest.TestCase):
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
    def test_focus_hit_testing_layout_and_restore(self):
        before=self.page.locator('#scene').evaluate('(el)=>[el.offsetWidth,el.offsetHeight]')
        self.page.evaluate('window.camera=sdk.createCamera(options())')
        self.page.evaluate('camera.focus(document.querySelector("#target"),{durationMs:0})')
        self.page.locator('#target').click();self.assertEqual(self.page.evaluate('clicks'),1)
        self.assertEqual(before,self.page.locator('#scene').evaluate('(el)=>[el.offsetWidth,el.offsetHeight]'))
        self.assertFalse(self.page.locator('#overlay').evaluate('(el)=>getComputedStyle(el).transform!=="none"'))
        self.page.evaluate('camera.destroy();camera.destroy()')
        self.assertEqual(self.page.locator('#scene').evaluate('(el)=>el.style.transform'),'')
    def test_offsets_border_and_round_trip(self):
        value=self.page.evaluate('''() => {
          const c=sdk.createCamera(options());c.surface.apply({x:-90,y:-40,scale:2});
          const m=c.surface.snapshot([document.querySelector('#target')]);
          const b=m.bounds[0].rect, p=sdk.project(b,c.surface.pose,m.origin), actual=document.querySelector('#target').getBoundingClientRect();
          c.destroy();return {b,dx:p.x-actual.x,dy:p.y-actual.y};
        }''')
        self.assertAlmostEqual(value['dx'],0);self.assertAlmostEqual(value['dy'],0)
        self.assertAlmostEqual(value['b']['x'],480);self.assertAlmostEqual(value['b']['y'],240)
    def test_interruption_and_abort_leave_current_pose(self):
        self.page.evaluate('()=>{window.camera=sdk.createCamera(options());window.first=camera.focus(document.querySelector("#target"),{durationMs:700});}')
        self.page.wait_for_timeout(150)
        result=self.page.evaluate('''async()=>{const before=camera.surface.pose;window.abort=new AbortController();const next=camera.reset({durationMs:700,signal:abort.signal});const after=camera.surface.pose;abort.abort();return {before,after,first:await first,next:await next};}''')
        self.assertEqual(result['before'],result['after']);self.assertEqual(result['first']['status'],'interrupted');self.assertEqual(result['next']['status'],'interrupted')
    def test_external_portal_and_top_layer_are_overlay_targets(self):
        self.page.evaluate('window.camera=sdk.createCamera(options())')
        self.page.evaluate('camera.focus(document.querySelector("#portal"),{durationMs:0});document.querySelector("#dialog").showModal()')
        self.assertEqual(self.page.evaluate('camera.surface.snapshot([document.querySelector("#modal-target")]).bounds[0].space'),'client')
        self.page.evaluate('document.querySelector("#dialog").close();document.querySelector("#popover").showPopover()')
        self.assertEqual(self.page.evaluate('camera.surface.snapshot([document.querySelector("#popover")]).bounds[0].space'),'client')
    def test_fixed_sticky_and_transform_preflight(self):
        for css in ('position:fixed','position:sticky','transform:rotate(15deg)'):
            self.page.evaluate('(css)=>{document.querySelector("#target").style.cssText=css}',css)
            if css.startswith('transform'):
                self.page.evaluate('document.querySelector("#viewport").style.transform="rotate(15deg)"')
            self.assertEqual(self.page.evaluate('(()=>{const c=sdk.createCamera(options());const kind=c.surface.kind;c.destroy();return kind})()'),'overlay-only')
    def test_ownership_conflict_preserves_host_change(self):
        code=self.page.evaluate('''() => {const c=sdk.createCamera(options());c.surface.apply({x:1,y:2,scale:1});let error;try{sdk.createCamera(options())}catch(e){error=e.diagnostic.code}document.querySelector('#scene').style.transform='translateX(99px)';c.destroy();return error}''')
        self.assertEqual(code,'SURFACE_BUSY');self.assertEqual(self.page.locator('#scene').evaluate('(el)=>el.style.transform'),'translateX(99px)')
    def test_reduced_motion_updates_during_play(self):
        self.page.evaluate('window.camera=sdk.createCamera(options());void camera.focus(document.querySelector("#target"))')
        self.page.wait_for_timeout(100);self.page.emulate_media(reduced_motion='reduce');self.page.wait_for_timeout(50)
        self.assertEqual(self.page.evaluate('camera.surface.pose'),{'x':0,'y':0,'scale':1})
    def test_scroll_resize_invalidate_and_removed_targets_fail(self):
        self.page.evaluate('window.camera=sdk.createCamera(options());window.revision=camera.surface.revision;document.querySelector("#scroller").scrollTop=50;document.querySelector("#viewport").style.width="600px"')
        self.page.wait_for_timeout(100);self.assertGreater(self.page.evaluate('camera.surface.revision'),self.page.evaluate('revision'))
        self.assertEqual(self.page.evaluate('(()=>{document.querySelector("#target").remove();try{camera.focus(()=>document.querySelector("#target"))}catch(e){return e.diagnostic.code}})()'),'TARGET_MISSING')
    def test_missing_target_also_fails_without_motion(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.assertEqual(self.page.evaluate("(()=>{const c=sdk.createCamera(options());try{c.focus(()=>null)}catch(e){return e.diagnostic.code}finally{c.destroy()}})()"),'TARGET_MISSING')
        self.assertEqual(self.page.evaluate("(()=>{const c=sdk.createCamera({...options(),kind:'overlay-only'});try{c.focus(null)}catch(e){return e.diagnostic.code}finally{c.destroy()}})()"),'TARGET_MISSING')
    def test_lifecycle_100_cycles_releases_lease_and_styles(self):
        self.assertTrue(self.page.evaluate('''async()=>{for(let i=0;i<100;i++){const c=sdk.createCamera(options());await c.focus(document.querySelector('#target'),{durationMs:0});c.destroy();}return document.querySelector('#scene').style.transform==='';}'''))
if __name__=='__main__':unittest.main(verbosity=2)
