"""Real React/core consumer tests; no mocked browser or production inputs."""
import os,threading,unittest
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
class ReactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.p=sync_playwright().start();cls.browser=getattr(cls.p,os.environ.get('BROWSER_ENGINE','chromium')).launch()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}/react-tests/dist/'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.p.stop();cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def setUp(self):
        self.page=self.browser.new_page(viewport={'width':1280,'height':1000});self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.on('console',lambda msg:self.errors.append(msg.text) if msg.type=='error' else None)
        self.page.goto(self.url);self.ready()
    def ready(self):
        self.page.wait_for_function("window.director && document.querySelector('#status')?.dataset.status==='ready'")
    def tearDown(self):
        self.page.close();self.assertEqual(self.errors,[])
    def test_strict_mode_has_one_owner_and_no_automatic_play(self):
        state=self.page.evaluate('()=>({metrics,d:director.inspect()})')
        self.assertEqual(state['metrics']['live'],1);self.assertEqual(state['metrics']['maxLive'],1)
        self.assertEqual(state['d']['timeMs'],0);self.assertEqual(state['d']['status'],'ready')
        self.assertEqual(self.page.locator('[data-director-controls]').count(),1)
    def test_stable_host_rerender_preserves_director(self):
        first=self.page.evaluate('director.sessionId')
        self.page.locator('#rerender').click();self.page.wait_for_function("document.querySelector('#count').textContent==='1'")
        self.assertEqual(self.page.evaluate('director.sessionId'),first)
        self.assertEqual(self.page.evaluate('metrics.live'),1)
    def test_frames_do_not_rerender_semantic_subscribers(self):
        self.page.locator('[data-command="play"]').click();self.page.wait_for_timeout(100)
        before=self.page.evaluate('({...metrics})');self.page.wait_for_timeout(350);after=self.page.evaluate('({...metrics})')
        self.assertGreater(after['frames'],before['frames']+2)
        self.assertEqual(after['renders'],before['renders'])
        self.page.locator('[data-command="play"]').click()
        self.assertEqual(self.page.evaluate('director.inspect().status'),'paused')
    def test_script_replacement_does_not_recreate_or_autoplay(self):
        before=self.page.evaluate('({session:director.sessionId,run:director.inspect().runId})')
        self.page.locator('#replace-script').click()
        self.page.wait_for_function("director.describe().id==='react-other'")
        after=self.page.evaluate('({session:director.sessionId,run:director.inspect().runId,status:director.inspect().status})')
        self.assertEqual(before['session'],after['session']);self.assertNotEqual(before['run'],after['run']);self.assertEqual(after['status'],'ready')
    def test_portal_keeps_context_and_live_control(self):
        self.assertEqual(self.page.locator('#portal-button').get_attribute('data-session'),self.page.evaluate('director.sessionId'))
        self.page.locator('#portal-tour').click();self.page.wait_for_function("director.describe().id==='react-portal'")
        self.page.locator('[data-command="play"]').click();self.page.wait_for_timeout(150)
        self.page.locator('#portal-button').click();self.assertEqual(self.page.evaluate('window.portalClicks'),1)
        self.assertEqual(self.page.locator('#portal-button').evaluate('el=>getComputedStyle(el).transform'),'none')
        self.assertEqual(self.page.locator('#react-error').inner_text(),'')
    def test_target_ref_registration_cleans_up_and_recovers(self):
        self.page.locator('#toggle-target').click();self.assertFalse(self.page.evaluate("registry.has('app.button')"))
        self.page.locator('#toggle-target').click();self.assertTrue(self.page.evaluate("registry.has('app.button')"))
        self.assertEqual(self.page.locator('#target').count(),1)
    def test_repeated_mount_unmount_releases_controls_and_subscriptions(self):
        for _ in range(5):
            self.page.evaluate('window.unmountFixture()')
            self.assertEqual(self.page.evaluate('metrics.live'),0);self.assertEqual(self.page.evaluate('metrics.subscriptions'),0)
            self.assertEqual(self.page.locator('[data-director-controls]').count(),0)
            self.assertEqual(self.page.locator('#portal-button').count(),0)
            self.page.evaluate('window.mountFixture()');self.ready()
        self.assertEqual(self.page.evaluate('metrics.maxLive'),1)
    def test_server_hydration_has_no_mismatch(self):
        self.page.goto(self.url+'hydration.html')
        self.page.wait_for_function("document.querySelector('#hydration-status').textContent==='ready'")
        self.assertEqual(self.page.evaluate('window.hydrationErrors'),[])
        self.assertEqual(self.page.locator('[data-director-controls]').count(),1)
if __name__=='__main__':unittest.main(verbosity=2)
