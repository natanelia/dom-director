"""End-to-end checks against the staged public SDK site, not the old prototype."""
import os,json,threading,unittest,time,math
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
class PublicSDKTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'site-dist')))
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.p=sync_playwright().start();cls.browser=getattr(cls.p,os.environ.get('BROWSER_ENGINE','chromium')).launch()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}/'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.p.stop();cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def setUp(self):
        self.page=self.browser.new_page(viewport={'width':1440,'height':1100});self.errors=[];self.requests=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('request',lambda r:self.requests.append(r.url))
        self.page.add_init_script("""(()=>{const Original=window.Audio;window.testAudio=[];window.Audio=function(...args){const a=new Original(...args);testAudio.push(a);return a;};})();""")
        self.page.goto(self.url);self.page.wait_for_function("document.querySelector('#stage').dataset.runtime==='sdk'")
    def tearDown(self):
        self.page.close();self.assertEqual(self.errors,[])
    def position(self):return float(self.page.locator('#seek').input_value())
    def progress(self,entry):
        self.page.locator(entry).click();start=time.monotonic();previous=0;first=None
        while time.monotonic()-start<2.5:
            self.page.wait_for_timeout(50);position=self.position();elapsed=time.monotonic()-start
            state=self.page.locator('#stage').get_attribute('data-status')
            self.assertTrue(math.isfinite(position));self.assertGreaterEqual(position,previous-.02)
            self.assertLessEqual(position,elapsed+.35,'Playback outran elapsed time')
            self.assertLess(position,3);self.assertIn(state,('playing','buffering'))
            self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'),'overview')
            if first is None and position>.1:first=position
            elif first is not None and position>first+.2:return position
            previous=position
        self.fail(f'Playback did not sustain progress within 2.5s: {position}, {state}')
    def mode(self,value):
        self.page.locator('[data-mode="'+value+'"]').click()
        self.page.wait_for_function("mode=>document.querySelector('#stage').dataset.mode===mode",arg=value)
        self.page.wait_for_function("!document.querySelector('[data-mode]').disabled")
    def handoff(self):
        self.page.locator('[data-scene="handoff"]').click()
        self.page.wait_for_function("document.querySelector('#stage').dataset.state==='waiting'",timeout=6000)
    def test_default_is_network_silent_except_same_origin_modules(self):
        self.assertFalse([r for r in self.requests if not r.startswith(self.url)])
        self.assertFalse([r for r in self.requests if '.mp3' in r])
        self.assertEqual(self.page.locator('.chapter-button').count(),6)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-status'),'ready')
    def test_every_play_entry_advances_without_jumping(self):
        for entry in ['#hero-play','#stage-play','#play','#footer-play']:
            self.page.goto(self.url);self.page.wait_for_function("document.querySelector('#stage').dataset.runtime==='sdk'")
            self.progress(entry)
            self.page.locator('#play').click();before=self.position();self.page.wait_for_timeout(200);self.assertAlmostEqual(self.position(),before,delta=.03)
    def test_complete_watch_traverses_all_scenes_without_approving(self):
        self.page.locator('#stage-play').click()
        self.page.wait_for_function("document.querySelector('#stage').dataset.status==='completed'",timeout=70000)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'),'outro')
        self.assertGreater(self.position(),45);self.assertLess(self.position(),46)
        self.assertEqual(self.page.locator('#flag-count').inner_text(),'01')
    def test_opted_in_audio_continues_across_scene_boundary(self):
        self.page.locator('#sound').click();self.page.locator('#stage-play').click()
        self.page.wait_for_function("document.querySelector('#stage').dataset.scene==='signal'",timeout=15000)
        self.page.wait_for_timeout(600)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'audio')
        self.assertEqual(self.page.evaluate('testAudio.length'),1)
        self.assertLess(self.position(),11)
    def test_camera_animates_without_changing_scene_layout(self):
        before=self.page.locator('#scene').evaluate('el=>[el.offsetWidth,el.offsetHeight]')
        self.page.locator('[data-scene="signal"]').click();self.page.wait_for_timeout(200)
        first=self.page.locator('#scene').evaluate('el=>el.style.transform');self.page.wait_for_timeout(500)
        second=self.page.locator('#scene').evaluate('el=>el.style.transform')
        self.assertNotEqual(first,second);self.assertEqual(before,self.page.locator('#scene').evaluate('el=>[el.offsetWidth,el.offsetHeight]'))
        self.assertEqual(self.page.locator('#flag-count').inner_text(),'01')
    def test_try_waits_for_actual_user_and_does_not_undo_approval(self):
        self.mode('try');self.handoff();self.assertEqual(self.page.locator('#flag-count').inner_text(),'01')
        self.page.locator('#approve-route').click();self.page.wait_for_function("document.querySelector('#stage').dataset.state==='playing'")
        self.assertEqual(self.page.locator('#flag-count').inner_text(),'00')
        self.page.locator('#restart').click();self.assertEqual(self.page.locator('#flag-count').inner_text(),'00')
        self.page.locator('#reset-fixture').click();self.page.wait_for_function("document.querySelector('#flag-count').textContent==='01'")
    def test_guide_requires_explicit_continuation(self):
        self.mode('guide')
        self.page.locator('#seek').evaluate('(el)=>{el.value="6.8";el.dispatchEvent(new Event("input",{bubbles:true}));}')
        self.page.locator('#play').click();self.page.locator('#next-step').wait_for(state='visible')
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'),'overview')
        self.page.locator('#next-step').click();self.page.wait_for_function("document.querySelector('#stage').dataset.scene==='signal'")
    def test_scrubbing_cannot_skip_an_unresolved_checkpoint(self):
        self.mode('try');self.page.locator('#seek').evaluate('(el)=>{el.value="44";el.dispatchEvent(new Event("input",{bubbles:true}));}')
        self.assertNotEqual(self.page.locator('#stage').get_attribute('data-scene'),'outro')
        self.assertEqual(self.page.locator('#flag-count').inner_text(),'01')
    def test_media_is_opt_in_and_bad_end_does_not_finish_tour(self):
        self.page.locator('#sound').click();before=self.progress('#stage-play')
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'audio')
        self.assertTrue(any('.mp3' in r for r in self.requests))
        self.page.evaluate("""()=>{const a=testAudio.at(-1);Object.defineProperty(a,'ended',{get:()=>true});Object.defineProperty(a,'duration',{get:()=>0});a.dispatchEvent(new Event('ended'));}""")
        self.page.wait_for_timeout(250);self.assertLess(self.position(),before+.8)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'text')
    def test_mobile_reduced_motion_keeps_real_task_reachable(self):
        self.page.set_viewport_size({'width':390,'height':844});self.page.emulate_media(reduced_motion='reduce');self.mode('try');self.handoff()
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.locator('#approve-route').click();self.assertEqual(self.page.locator('#flag-count').inner_text(),'00')
        self.assertEqual(self.page.locator('#stage').get_attribute('data-reduced-motion'),'true')
        self.page.keyboard.press('Escape');self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'paused')
    def test_canonical_export_and_transcript_remain_accessible(self):
        self.page.locator('#script-open').click();script=json.loads(self.page.locator('#script-json').inner_text())
        self.assertEqual(script['schemaVersion'],'0.1.0-draft.1');self.assertEqual(len(script['scenes']),6)
        self.page.keyboard.press('Escape');self.assertTrue(self.page.locator('#script-open').evaluate('el=>el===document.activeElement'))
        self.page.locator('#transcript-toggle').click();self.assertEqual(self.page.locator('#transcript button').count(),6)
    def test_persisted_navigation_keeps_orbit_paused_and_usable(self):
        self.progress('#stage-play')
        self.page.evaluate("dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))")
        self.page.wait_for_function("document.querySelector('#stage').dataset.status==='paused'")
        before=self.position()
        self.page.evaluate("dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
        self.page.wait_for_timeout(200)
        self.assertAlmostEqual(self.position(),before,delta=.03)
        self.page.locator('#play').click()
        self.page.wait_for_function("p=>Number(document.querySelector('#seek').value)>p+.15",arg=before)
    def test_browser_back_returns_a_working_demo(self):
        self.page.locator('a[href="./agent.html"]').click()
        self.page.wait_for_function("document.querySelector('#catalog')?.textContent.includes('app.reports')")
        self.page.go_back()
        self.page.wait_for_function("document.querySelector('#stage')?.dataset.runtime==='sdk'")
        self.progress('#hero-play')
    def agent(self):
        self.page.goto(self.url+'agent.html');self.page.wait_for_function("document.querySelector('#catalog').textContent.includes('app.reports')")
    def validate_review_load(self):
        self.page.locator('#validate').click();self.page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('Valid static plan')")
        self.page.locator('#reviewed-script').check();self.page.locator('#load-script').click()
        self.page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('Reviewed script loaded')")
    def wait_for_agent_play(self):
        self.page.wait_for_function("JSON.parse(document.querySelector('#command-log').textContent).at(-1)?.command==='play'")
        last=json.loads(self.page.locator('#command-log').inner_text())[-1]
        self.assertTrue(last['ok'],last)
    def test_agent_drafts_from_catalog_and_requires_review(self):
        self.agent();self.page.locator('#private-title').fill('SYNTHETIC_PRIVATE_VALUE');self.page.locator('#secret').fill('SYNTHETIC_SECRET')
        self.page.locator('#discover').click()
        self.page.wait_for_function("JSON.parse(document.querySelector('#command-log').textContent).at(-1)?.command==='discoverTargets'")
        catalog=self.page.locator('#catalog').inner_text();self.assertNotIn('app.secret',catalog);self.assertNotIn('SYNTHETIC_',catalog)
        self.page.locator('#draft').click();self.page.wait_for_function("document.querySelector('#agent-script').value.includes('catalog-authored-tour')")
        self.page.locator('#load-script').click();self.page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('CAPABILITY_DENIED')")
        self.validate_review_load();self.page.locator('#agent-play').click();self.wait_for_agent_play()
        self.assertEqual(self.page.locator('#action-count').inner_text(),'0 clicks')
    def test_agent_review_never_grants_application_actions(self):
        self.agent();self.page.locator('#denied-action').click();self.validate_review_load();self.page.locator('#agent-play').click()
        self.page.wait_for_function("document.querySelector('#agent-message').textContent.includes('CAPABILITY_DENIED')")
        self.assertEqual(self.page.locator('#action-count').inner_text(),'0 clicks')
    def test_agent_missing_target_is_not_replaced_automatically(self):
        self.agent();self.page.locator('#draft').click();self.page.wait_for_function("document.querySelector('#agent-script').value.includes('catalog-authored-tour')")
        self.page.locator('#validate').click();self.page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('Valid static plan')")
        self.page.locator('#reviewed-script').check();self.page.locator('#remove-target').click();self.page.locator('#load-script').click()
        self.page.wait_for_function("document.querySelector('#agent-message').textContent.includes('PREPARE_FAILED')")
        self.assertEqual(self.page.locator('#reports').count(),0);self.assertEqual(self.page.locator('#action-count').inner_text(),'0 clicks')
    def test_persisted_agent_navigation_requires_fresh_review(self):
        self.agent();self.page.locator('#draft').click()
        self.page.wait_for_function("document.querySelector('#agent-script').value.includes('catalog-authored-tour')")
        self.validate_review_load();self.page.locator('#agent-play').click();self.wait_for_agent_play()
        self.page.evaluate("dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
        self.assertFalse(self.page.locator('#reviewed-script').is_checked())
        self.page.locator('#agent-play').click()
        self.page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('CAPABILITY_DENIED')")
        self.validate_review_load();self.page.locator('#agent-play').click();self.wait_for_agent_play()
        self.page.locator('#agent-stop').click()
        self.page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('Agent stopped')")
if __name__=='__main__':unittest.main(verbosity=2)
