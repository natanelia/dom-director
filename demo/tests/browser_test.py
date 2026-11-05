#!/usr/bin/env python3
"""Fixture browser checks. Uses in-memory HTML; does not claim hosted/file-URL testing.
Install playwright separately. Set BROWSER_EXECUTABLE for a system browser, or install
Playwright's Chromium and leave it unset. No external requests are needed by the demo.
"""
from pathlib import Path
import json, os, unittest
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'assets/cues.json').read_text())
HTML=(ROOT/'index.html').read_text()

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p=sync_playwright().start()
        args={'headless':True}
        if os.environ.get('BROWSER_EXECUTABLE'): args['executable_path']=os.environ['BROWSER_EXECUTABLE']
        cls.browser=cls.p.chromium.launch(**args)
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.p.stop()
    def setUp(self):
        self.page=self.browser.new_page(viewport={'width':1440,'height':1100})
        self.errors=[];self.requests=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('request',lambda request:self.requests.append(request.url))
        self.page.set_content(HTML)
        self.page.wait_for_function("document.querySelectorAll('.chapter-button').length===6")
        self.page.wait_for_timeout(80)
    def tearDown(self):
        errors=self.errors[:]
        self.page.close()
        self.assertEqual(errors,[],f'Unexpected JS errors: {errors}')
    def seek(self,ms):
        self.page.locator('#seek').evaluate('(el,value)=>{el.value=String(value/1000);el.dispatchEvent(new Event("input",{bubbles:true}));}',ms)
    def test_no_external_requests_and_complete_page(self):
        self.assertEqual(self.page.locator('.chapter-button').count(),6)
        self.assertEqual(self.page.locator('#transcript button').count(),6)
        self.assertFalse([r for r in self.requests if r.startswith(('http:','https:'))])
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
    def test_play_pause_and_audio_authority(self):
        self.page.locator('#stage-play').click()
        self.page.wait_for_timeout(450)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'playing')
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'audio')
        self.assertGreater(float(self.page.locator('#seek').input_value()),.1)
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
        self.page.evaluate('() => { HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException("Test rejection","NotAllowedError"));}; }')
        self.page.locator('#stage-play').click();self.page.wait_for_timeout(250)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-clock'),'text')
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'playing')
        self.assertGreater(float(self.page.locator('#seek').input_value()),.1)
        self.assertTrue(self.page.locator('#sound').is_disabled())
    def test_pause_wins_against_stale_play_promise(self):
        self.page.evaluate('() => { HTMLMediaElement.prototype.play=function(){return new Promise(resolve=>setTimeout(resolve,300));}; }')
        self.page.locator('#stage-play').click();self.page.keyboard.press('Escape');self.page.wait_for_timeout(400)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-state'),'interactive')

if __name__=='__main__':unittest.main(verbosity=2)
