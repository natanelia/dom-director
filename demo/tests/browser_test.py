#!/usr/bin/env python3
"""Fixture checks via a local HTTP server, with controllable media fault injection.
BROWSER_ENGINE selects chromium (default), webkit or firefox. BROWSER_EXECUTABLE
optionally selects a compatible system browser. Mobile viewport tests are not a
physical iPhone test. DEMO_HTML_PATH permits before/after regression runs.
DEMO_TRANSPORT=memory is an explicit fallback for environments blocking HTTP.
"""
from pathlib import Path
import json, os, unittest, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'assets/cues.json').read_text())
HTML=Path(os.environ.get('DEMO_HTML_PATH',str(ROOT/'index.html'))).read_text()

class FixtureHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] != '/dom-director/':
            self.send_response(404);self.end_headers();return
        payload=HTML.encode('utf-8')
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8')
        self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
    def log_message(self,*args):pass

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p=sync_playwright().start()
        args={'headless':True}
        if os.environ.get('BROWSER_EXECUTABLE'): args['executable_path']=os.environ['BROWSER_EXECUTABLE']
        engine=os.environ.get('BROWSER_ENGINE','chromium')
        if engine not in ('chromium','webkit','firefox'):raise ValueError('Unsupported BROWSER_ENGINE')
        cls.browser=getattr(cls.p,engine).launch(**args)
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),FixtureHandler)
        cls.server_thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.server_thread.start()
        cls.base_url=f'http://127.0.0.1:{cls.server.server_port}/dom-director/'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.p.stop();cls.server.shutdown();cls.server.server_close();cls.server_thread.join()
    def setUp(self):
        self.page=self.browser.new_page(viewport={'width':1440,'height':1100})
        self.errors=[];self.requests=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('request',lambda request:self.requests.append(request.url))
        # Expose only the test's media instance, without production test hooks.
        self.page.add_init_script("""(() => {
            const OriginalAudio=window.Audio;
            window.Audio=function(...args){const audio=new OriginalAudio(...args);window.testAudio=audio;return audio;};
        })();""")
        self.load_fixture(self.page)
        self.page.wait_for_function("document.querySelectorAll('.chapter-button').length===6")
        self.page.wait_for_timeout(80)
    def load_fixture(self,page):
        if os.environ.get('DEMO_TRANSPORT')=='memory':
            page.goto('about:blank')
            page.set_content(HTML)
        else:page.goto(self.base_url)
    def tearDown(self):
        errors=self.errors[:]
        self.page.close()
        self.assertEqual(errors,[],f'Unexpected JS errors: {errors}')
    def seek(self,ms):
        self.page.locator('#seek').evaluate('(el,value)=>{el.value=String(value/1000);el.dispatchEvent(new Event("input",{bubbles:true}));}',ms)
    def test_no_external_requests_and_complete_page(self):
        self.assertEqual(self.page.locator('.chapter-button').count(),6)
        self.assertEqual(self.page.locator('#transcript button').count(),6)
        self.assertFalse([r for r in self.requests if r.startswith(('http:','https:')) and not r.startswith(self.base_url)])
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
    def test_play_pause_and_audio_authority(self):
        self.page.locator('#sound').click()
        self.page.locator('#stage-play').click()
        self.page.wait_for_timeout(450)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'playing')
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'audio')
        self.assertGreater(float(self.page.locator('#seek').input_value()),.1)
        self.assertLess(float(self.page.locator('#seek').input_value()),2)
        self.page.locator('#play').click()
        before=float(self.page.locator('#seek').input_value());self.page.wait_for_timeout(220)
        self.assertAlmostEqual(float(self.page.locator('#seek').input_value()),before,delta=.02)
    def test_camera_does_not_change_scene_layout(self):
        before=self.page.locator('#scene').evaluate('(el)=>[el.offsetWidth,el.offsetHeight,document.querySelector("#review-target").offsetWidth,document.querySelector("#review-target").offsetHeight]')
        self.seek(DATA['scenes'][3]['startMs']+1900)
        after=self.page.locator('#scene').evaluate('(el)=>[el.offsetWidth,el.offsetHeight,document.querySelector("#review-target").offsetWidth,document.querySelector("#review-target").offsetHeight]')
        self.assertEqual(before,after)
        self.assertIn('scale(',self.page.locator('#scene').evaluate('(el)=>el.style.transform'))
    def test_seek_is_deterministic_and_does_not_approve(self):
        moment=DATA['scenes'][3]['startMs']+1900
        self.seek(moment);a=self.page.locator('#scene').get_attribute('style')
        self.seek(0);self.seek(moment);b=self.page.locator('#scene').get_attribute('style')
        self.assertEqual(a,b)
        self.assertEqual(self.page.locator('#flag-count').inner_text(),'01')
        self.assertFalse(self.page.locator('#approve-route').is_disabled())
    def test_try_gate_and_actual_button_handoff(self):
        self.page.locator('[data-mode="try"]').click()
        self.seek(DATA['durationMs'])
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'waiting')
        self.assertTrue(self.page.locator('#play').is_disabled())
        self.page.locator('#approve-route').click()
        self.assertEqual(self.page.locator('#flag-count').inner_text(),'00')
        self.assertTrue(self.page.locator('#approve-route').is_disabled())
        self.page.wait_for_timeout(100)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'playing')
        self.seek(0);self.seek(DATA['durationMs'])
        self.assertEqual(self.page.locator('#flag-count').inner_text(),'00')
        self.assertNotEqual(self.page.locator('#stage').get_attribute('data-state'),'waiting')
    def test_guide_holds_at_scene_end(self):
        self.page.locator('[data-mode="guide"]').click()
        self.seek(DATA['scenes'][1]['startMs']-200)
        self.page.locator('#play').click();self.page.wait_for_timeout(500)
        self.assertIn('Your pace',self.page.locator('#player-state').inner_text())
        self.assertEqual(self.page.locator('#shot-title').inner_text(),DATA['scenes'][0]['title'])
        self.page.locator('#next-step').click();self.page.wait_for_timeout(70)
        self.assertEqual(self.page.locator('#shot-title').inner_text(),DATA['scenes'][1]['title'])
    def test_takeover_and_escape_are_immediate(self):
        self.page.locator('#stage-play').click();self.page.wait_for_timeout(70)
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'interactive')
        self.assertFalse(self.page.locator('#play').is_disabled())
    def test_reduced_motion_caption_and_transcript(self):
        self.page.emulate_media(reduced_motion='reduce');self.page.wait_for_timeout(70)
        before=self.page.locator('#scene').get_attribute('style')
        self.seek(DATA['scenes'][3]['startMs']+1900)
        self.assertEqual(before,self.page.locator('#scene').get_attribute('style'))
        self.assertEqual(self.page.locator('#stage').get_attribute('data-reduced-motion'),'true')
        self.assertTrue(self.page.locator('#caption').is_visible())
        self.page.locator('#captions').click();self.assertFalse(self.page.locator('#caption').is_visible())
        self.page.locator('#transcript-toggle').click();self.assertTrue(self.page.locator('#transcript').is_visible())
    def test_mobile_framing_and_interaction(self):
        self.page.set_viewport_size({'width':390,'height':844});self.page.wait_for_timeout(90)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.locator('[data-mode="try"]').click();self.seek(DATA['durationMs'])
        stage=self.page.locator('#stage').bounding_box();target=self.page.locator('#approve-route').bounding_box()
        self.assertGreater(target['width'],250)
        self.assertGreaterEqual(target['x'],stage['x'])
        self.assertLessEqual(target['x']+target['width'],stage['x']+stage['width'])
        self.page.locator('#approve-route').click();self.assertEqual(self.page.locator('#flag-count').inner_text(),'00')
    def test_dialog_keyboard_and_data_export_content(self):
        self.page.locator('#script-open').click()
        self.assertTrue(self.page.locator('#script-dialog').is_visible())
        parsed=json.loads(self.page.locator('#script-json').inner_text())
        self.assertEqual(len(parsed['scenes']),6)
        self.page.keyboard.press('Escape');self.assertFalse(self.page.locator('#script-dialog').is_visible())
        self.assertTrue(self.page.locator('#script-open').evaluate('(el)=>el===document.activeElement'))
    def test_speed_easing_and_live_code(self):
        self.page.locator('#rate').click();self.assertEqual(self.page.locator('#rate').inner_text(),'1.25×')
        self.page.locator('#easing').select_option('linear')
        self.assertEqual(json.loads(self.page.locator('#live-code').inner_text())['easing'],'linear')
    def test_approval_requires_checked_input(self):
        self.seek(DATA['scenes'][3]['startMs']+1700)
        self.page.locator('#review-check').uncheck()
        self.assertTrue(self.page.locator('#approve-route').is_disabled())
        self.page.locator('#review-check').check()
        self.assertFalse(self.page.locator('#approve-route').is_disabled())
    def test_audio_rejection_falls_back_to_text_clock(self):
        self.page.locator('#sound').click()
        self.page.evaluate('() => { HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException("Test rejection","NotAllowedError"));}; }')
        self.page.locator('#stage-play').click();self.page.wait_for_timeout(250)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'text')
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'playing')
        self.assertGreater(float(self.page.locator('#seek').input_value()),.1)
        self.assertTrue(self.page.locator('#sound').is_disabled())
    def test_pause_wins_against_stale_play_promise(self):
        self.page.locator('#sound').click()
        self.page.evaluate('() => { HTMLMediaElement.prototype.play=function(){return new Promise(resolve=>setTimeout(resolve,300));}; }')
        self.page.locator('#stage-play').click();self.page.keyboard.press('Escape');self.page.wait_for_timeout(400)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'interactive')

    def progress(self):
        return float(self.page.locator('#seek').input_value())*1000
    def assert_progress(self,low=100,high=2000):
        self.assertGreater(self.progress(),low)
        self.assertLess(self.progress(),high)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'playing')
    def inject_media_fault(self,fault):
        self.page.evaluate("""fault => {
            HTMLMediaElement.prototype.play=function(){
                if(fault==='ended'){
                    Object.defineProperty(this,'ended',{configurable:true,get:()=>true});
                    setTimeout(()=>this.dispatchEvent(new Event('ended')),10);
                }else if(fault==='jump'){
                    Object.defineProperty(this,'currentTime',{configurable:true,get:()=>45.367,set:()=>{}});
                }else if(fault==='nan'){
                    Object.defineProperty(this,'currentTime',{configurable:true,get:()=>NaN,set:()=>{}});
                }
                return Promise.resolve();
            };
        }""",fault)
    def test_all_play_buttons_start_at_real_time_without_audio(self):
        for selector in ['#hero-play','#stage-play','#play','#footer-play']:
            with self.subTest(selector=selector):
                self.load_fixture(self.page)
                self.page.evaluate("""() => {window.mediaPlayCalls=0;HTMLMediaElement.prototype.play=function(){window.mediaPlayCalls++;return Promise.resolve();};}""")
                self.page.locator(selector).click();self.page.wait_for_timeout(400)
                self.assert_progress()
                self.assertEqual(self.page.locator('#shot-title').inner_text(),DATA['scenes'][0]['title'])
                self.assertEqual(self.page.evaluate('window.mediaPlayCalls'),0)
    def test_early_audio_end_does_not_finish_tour(self):
        self.page.locator('#sound').click();self.inject_media_fault('ended')
        self.page.locator('#stage-play').click();self.page.wait_for_timeout(400)
        self.assert_progress()
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'text')
        self.assertEqual(self.page.locator('#shot-title').inner_text(),DATA['scenes'][0]['title'])
    def test_audio_clock_jump_does_not_skip_scenes(self):
        self.page.locator('#sound').click();self.inject_media_fault('jump')
        self.page.locator('#stage-play').click();self.page.wait_for_timeout(400)
        self.assert_progress()
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'text')
    def test_nonfinite_audio_clock_falls_back_without_corrupting_state(self):
        self.page.locator('#sound').click();self.inject_media_fault('nan')
        self.page.locator('#stage-play').click();self.page.wait_for_timeout(400)
        self.assert_progress()
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'text')
    def test_muted_playback_ignores_media_end_events(self):
        self.page.locator('#stage-play').click();self.page.wait_for_timeout(150)
        self.page.evaluate("window.testAudio.dispatchEvent(new Event('ended'))")
        self.page.wait_for_timeout(200);self.assert_progress()
        self.assertEqual(self.page.locator('#shot-title').inner_text(),DATA['scenes'][0]['title'])
    def test_paused_playback_ignores_late_media_end_events(self):
        self.page.locator('#sound').click();self.page.locator('#stage-play').click()
        self.page.wait_for_timeout(150);self.page.locator('#play').click();before=self.progress()
        self.page.evaluate("""() => {Object.defineProperty(window.testAudio,'ended',{get:()=>true});window.testAudio.dispatchEvent(new Event('ended'));}""")
        self.page.wait_for_timeout(100)
        self.assertAlmostEqual(self.progress(),before,delta=20)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'paused')
    def test_pending_audio_start_times_out_to_captioned_playback(self):
        self.page.locator('#sound').click()
        self.page.evaluate("""() => {HTMLMediaElement.prototype.play=function(){return new Promise(()=>{});};}""")
        self.page.locator('#stage-play').click();self.page.wait_for_timeout(2900)
        self.assert_progress(100,1500)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'text')
    def test_silent_pause_resume_and_rate_change_do_not_jump(self):
        self.page.locator('#stage-play').click();self.page.wait_for_timeout(350)
        self.page.locator('#play').click();before=self.progress();self.page.wait_for_timeout(250)
        self.assertAlmostEqual(self.progress(),before,delta=20)
        self.page.locator('#play').click();self.page.wait_for_timeout(300)
        self.assert_progress(before+100,before+1200)
        before=self.progress();self.page.locator('#rate').click();self.page.wait_for_timeout(300)
        self.assert_progress(before+100,before+1400)
    def test_sound_handoff_preserves_position(self):
        self.seek(10000);self.page.locator('#play').click();self.page.wait_for_timeout(200)
        before=self.progress();self.page.locator('#sound').click();self.page.wait_for_timeout(300)
        self.assert_progress(before-50,before+1500)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'audio')
        before=self.progress();self.page.locator('#sound').click();self.page.wait_for_timeout(300)
        self.assert_progress(before-50,before+1500)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'text')
    def test_scene_camera_transitions_over_time(self):
        start=DATA['scenes'][1]['startMs']
        self.seek(start);first=self.page.locator('#scene').get_attribute('style')
        self.page.locator('#play').click();self.page.wait_for_timeout(500)
        self.assert_progress(start+100,start+1400)
        middle=self.page.locator('#scene').get_attribute('style')
        self.assertNotEqual(first,middle)
        self.seek(start+1500);end=self.page.locator('#scene').get_attribute('style')
        self.assertNotEqual(middle,end)
    def test_replay_after_completion_starts_at_zero(self):
        self.seek(DATA['durationMs']-200);self.page.locator('#play').click();self.page.wait_for_timeout(450)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'paused')
        self.page.locator('#play').click();self.page.wait_for_timeout(300);self.assert_progress()
        self.assertEqual(self.page.locator('#shot-title').inner_text(),DATA['scenes'][0]['title'])
    def test_mobile_tap_plays_in_real_time(self):
        context=self.browser.new_context(viewport={'width':390,'height':844},has_touch=True)
        page=context.new_page()
        try:
            self.load_fixture(page);page.locator('#stage-play').tap();page.wait_for_timeout(400)
            position=float(page.locator('#seek').input_value())
            self.assertGreater(position,.1);self.assertLess(position,2)
            self.assertEqual(page.locator('#stage').get_attribute('data-state'),'playing')
        finally:context.close()
    def test_early_audio_end_cannot_bypass_try_gate(self):
        self.page.locator('[data-mode="try"]').click()
        gate=DATA['scenes'][3]['startMs']+1700
        self.seek(gate-150);self.page.locator('#sound').click();self.inject_media_fault('ended')
        self.page.locator('#play').click();self.page.wait_for_timeout(450)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'waiting')
        self.assertAlmostEqual(self.progress(),gate,delta=20)
        self.assertEqual(self.page.locator('#flag-count').inner_text(),'01')

if __name__=='__main__':unittest.main(verbosity=2)
