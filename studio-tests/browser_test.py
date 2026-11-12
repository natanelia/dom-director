"""Exercise real creator workflows in the staged or hash-verified public Studio.
No real microphone, external provider, persistent application state or user data is used.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import base64
import io
import json
import math
import os
import threading
import time
import unittest
import wave
from playwright.sync_api import sync_playwright
from startup import navigate_studio

ROOT = Path(__file__).resolve().parents[1]


def wav(seconds=2):
    stream = io.BytesIO()
    with wave.open(stream, 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(8000)
        output.writeframes(b'\0\0' * round(8000 * seconds))
    return stream.getvalue()


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class StudioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        public = os.environ.get('STUDIO_PUBLIC_URL')
        if public and public != 'https://natanelia.github.io/dom-director/studio.html':
            raise ValueError('Only the authorized synthetic Studio can be tested remotely.')
        cls.server = None
        if not public:
            cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT / 'site-dist')))
            cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
            cls.thread.start()
        cls.p = sync_playwright().start()
        cls.engine = os.environ.get('BROWSER_ENGINE', 'chromium')
        cls.browser = getattr(cls.p, cls.engine).launch()
        cls.url = public or f'http://127.0.0.1:{cls.server.server_port}/studio.html'
        cls.output = ROOT / 'studio-results' / cls.engine
        cls.output.mkdir(parents=True, exist_ok=True)
        print(json.dumps({'engine': cls.engine, 'version': cls.browser.version, 'base': cls.url}), flush=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.p.stop()
        if cls.server:
            cls.server.shutdown()
            cls.server.server_close()
            cls.thread.join()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1440, 'height': 1000})
        self.addCleanup(lambda: self.page.close() if not self.page.is_closed() else None)
        self.page.set_default_timeout(8000)
        self.errors = []
        self.requests = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('request', lambda request: self.requests.append(request.url))
        navigate_studio(self.page, self.url + '?verify=' + os.environ.get('DEPLOYED_SHA', 'local'),
                        self.output / (self.__class__.__name__ + '-' + self._testMethodName + '-startup.json'))

    def tearDown(self):
        try:
            if self.errors:
                self.page.screenshot(path=str(self.output / (self._testMethodName + '.png')), full_page=True)
            self.assertEqual(self.errors, [])
        finally:
            self.page.close()

    def choose(self, kind):
        self.page.locator('.inspector-tabs [data-kind="' + kind + '"]').click()

    def edit(self, selector, value):
        self.page.locator(selector).fill(str(value))
        self.page.locator(selector).press('Tab')

    def seek(self, seconds):
        self.page.locator('#seek').evaluate('(el, value) => {el.value=String(value);el.dispatchEvent(new Event("input",{bubbles:true}));}', seconds)

    def bundle(self):
        with self.page.expect_download() as pending:
            self.page.locator('#save-project').click()
        return Path(pending.value.path()).read_bytes()

    def project(self):
        return json.loads(self.bundle().splitlines()[0])['project']

    def clip(self, project, identifier):
        return next(c for t in project['tracks'] for c in t['clips'] if c['id'] == identifier)

    def test_ready_has_four_tracks_one_canvas_and_no_audio_or_external_requests(self):
        for kind in ['camera', 'cursor', 'voice', 'captions']:
            self.assertEqual(self.page.locator('.lane[data-kind="' + kind + '"]').count(), 1)
        self.assertEqual(self.page.locator('#scene-list button').count(), 3)
        self.assertTrue(self.page.locator('#scene').evaluate('el=>el.inert'))
        self.assertFalse([u for u in self.requests if '.mp3' in u])
        origin = self.url.rsplit('/', 1)[0] + '/'
        self.assertFalse([u for u in self.requests if not u.startswith(origin)])
        self.page.screenshot(path=str(self.output / 'studio-desktop.png'), full_page=True)

    def test_play_advances_in_real_time_and_pause_is_stable(self):
        self.page.locator('#preview-tour').click()
        started = time.monotonic()
        previous = 0
        while time.monotonic() - started < 3:
            self.page.wait_for_timeout(60)
            at = float(self.page.locator('#seek').input_value())
            self.assertGreaterEqual(at, previous - .02)
            self.assertLessEqual(at, time.monotonic() - started + .5)
            self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'), 'overview')
            if at > .35:
                break
            previous = at
        else:
            self.fail('Playback did not progress.')
        self.page.locator('#play').click()
        paused = float(self.page.locator('#seek').input_value())
        self.page.wait_for_timeout(180)
        self.assertAlmostEqual(float(self.page.locator('#seek').input_value()), paused, delta=.02)

    def test_caption_edits_preview_immediately_and_preserve_voice(self):
        before = self.project()
        self.page.locator('#caption-text').fill('A caption, not a changed voice recording.')
        self.assertIn('not a changed voice', self.page.locator('#caption-overlay').inner_text())
        self.page.locator('#caption-text').press('Tab')
        self.page.locator('#preset-contrast').click()
        after = self.project()
        self.assertEqual(self.clip(after, 'cc.overview.0')['text'], 'A caption, not a changed voice recording.')
        self.assertEqual(self.clip(after, 'cc.overview.0')['style']['background'], '#000000')
        self.assertEqual(next(t for t in after['tracks'] if t['kind'] == 'voice'), next(t for t in before['tracks'] if t['kind'] == 'voice'))
        self.page.locator('#undo').click()
        self.assertNotIn('style', self.clip(self.project(), 'cc.overview.0'))

    def test_invalid_field_blocks_preview_without_discarding_text(self):
        self.edit('#caption-size', '999')
        self.assertEqual(self.page.locator('#caption-size').get_attribute('aria-invalid'), 'true')
        self.page.locator('#preview-tour').click()
        self.assertNotEqual(self.page.locator('#studio').get_attribute('data-playback'), 'playing')
        self.assertEqual(self.page.locator('#caption-size').input_value(), '999')
        self.page.locator('#caption-size').press('Escape')
        self.assertNotEqual(self.page.locator('#caption-size').input_value(), '999')
        self.page.locator('#preview-tour').click()
        self.page.wait_for_function("document.querySelector('#studio').dataset.playback==='playing'")

    def test_word_timing_requires_review_when_caption_text_changes(self):
        self.page.get_by_text('Word highlighting', exact=True).click()
        self.page.locator('#add-word-timing').click()
        self.assertTrue(self.clip(self.project(), 'cc.overview.0').get('words'))
        self.edit('#caption-text', 'Corrected caption with new words.')
        self.assertTrue(self.page.locator('#dialog').is_visible())
        self.page.get_by_role('button', name='Update caption', exact=True).click()
        changed = self.clip(self.project(), 'cc.overview.0')
        self.assertEqual(changed['text'], 'Corrected caption with new words.')
        self.assertNotIn('words', changed)

    def test_camera_keyframe_zoom_and_editor_zoom_are_separate(self):
        before = self.project()
        self.choose('camera')
        self.page.locator('.key-list button').nth(1).click()
        layout = self.page.locator('#scene').evaluate('el=>[el.offsetWidth,el.offsetHeight]')
        original = self.page.locator('#scene').evaluate('el=>el.style.transform')
        self.edit('#camera-zoom', '1.4')
        self.assertNotEqual(self.page.locator('#scene').evaluate('el=>el.style.transform'), original)
        self.assertEqual(self.page.locator('#scene').evaluate('el=>[el.offsetWidth,el.offsetHeight]'), layout)
        after = self.project()
        self.assertEqual(self.clip(after, 'camera.overview')['keys'][1]['zoom'], 1.4)
        self.assertEqual(self.clip(after, 'voice.overview'), self.clip(before, 'voice.overview'))
        self.page.locator('#canvas-zoom').select_option('1.5')
        self.assertEqual(self.project(), after)
        self.seek(2)
        self.page.locator('#add-key').click()
        self.assertEqual(len(self.clip(self.project(), 'camera.overview')['keys']), 3)

    def test_cursor_styles_and_gestures_do_not_run_app_actions(self):
        before = self.project()
        self.choose('cursor')
        self.page.locator('#cursor-shape').select_option('dot')
        self.edit('#cursor-size', '42')
        self.page.locator('#cursor-trail').check()
        self.seek(2)
        self.page.get_by_role('button', name='＋ double-click', exact=True).click()
        after = self.project()
        clip = self.clip(after, 'cursor.overview')
        self.assertEqual(clip['style']['shape'], 'dot')
        self.assertEqual(clip['keys'], self.clip(before, 'cursor.overview')['keys'])
        self.assertEqual(clip['gestures'][-1]['kind'], 'double-click')
        self.assertEqual(self.page.locator('#app-review').inner_text(), 'Review checkpoint ↗')
        self.page.screenshot(path=str(self.output / 'studio-cursor.png'), full_page=True)

    def test_clip_split_and_undo_preserve_the_other_tracks(self):
        before = self.project()
        self.seek(1)
        self.page.locator('#split').click()
        after = self.project()
        self.assertEqual(len(after['tracks'][3]['clips']), len(before['tracks'][3]['clips']) + 1)
        self.assertEqual(after['tracks'][:3], before['tracks'][:3])
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)

    def test_locked_track_rejects_caption_edit(self):
        before = self.project()
        self.page.get_by_role('button', name='Lock CC · English', exact=True).click()
        self.edit('#caption-text', 'Do not change this locked caption.')
        self.assertEqual(self.page.locator('#caption-text').get_attribute('aria-invalid'), 'true')
        self.page.locator('#caption-text').press('Escape')
        after = self.project()
        self.assertEqual(self.clip(after, 'cc.overview.0'), self.clip(before, 'cc.overview.0'))

    def test_scene_add_and_delete_keep_existing_media(self):
        before = self.project()
        self.page.locator('#add-scene').click()
        self.page.get_by_role('button', name='Review panel', exact=True).click()
        self.assertEqual(self.page.locator('#scene-list button').count(), 4)
        self.page.locator('#scene-delete').click()
        self.assertEqual(self.project(), before)

    def import_voice(self, seconds):
        self.choose('voice')
        self.page.locator('#audio-file').set_input_files({'name': 'Synthetic test.wav', 'mimeType': 'audio/wav', 'buffer': wav(seconds)})
        self.page.get_by_text('Use this voice take?', exact=True).wait_for()

    def test_local_audio_import_bundle_and_reopen_preserve_bytes_and_styles(self):
        self.import_voice(2)
        self.page.get_by_role('button', name='Keep scene timing', exact=True).click()
        self.choose('captions')
        self.page.locator('#preset-minimal').click()
        saved = self.bundle()
        before = json.loads(saved.splitlines()[0])['project']
        self.assertTrue(any(a['source'] == 'local' for a in before['assets']))
        self.edit('#caption-text', 'Temporary edit not in the saved file.')
        self.page.locator('#project-file').set_input_files({'name': 'sample.director', 'mimeType': 'application/octet-stream', 'buffer': saved})
        self.page.get_by_role('button', name='Open project', exact=True).click()
        self.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Project reopened')")
        self.assertEqual(self.project(), before)
        self.choose('voice')
        self.assertTrue(self.page.locator('.waveform polygon').count())

    def test_longer_voice_requires_review_and_retiming_is_undoable(self):
        before = self.project()
        self.import_voice(9)
        self.page.get_by_role('button', name='Keep scene timing', exact=True).click()
        self.assertIn('longer', self.page.locator('#dialog-body').inner_text())
        self.page.get_by_role('button', name='Fit scene to voice', exact=True).click()
        self.page.get_by_text('Review timing changes', exact=True).wait_for()
        self.page.get_by_role('button', name='Use take and retime', exact=True).click()
        after = self.project()
        self.assertEqual(after['scenes'][0]['durationMs'], 9000)
        self.assertEqual(self.clip(after, 'cc.overview.0')['text'], self.clip(before, 'cc.overview.0')['text'])
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)

    def test_corrupt_project_does_not_replace_the_draft(self):
        before = self.project()
        self.page.locator('#project-file').set_input_files({'name': 'broken.director', 'mimeType': 'application/octet-stream', 'buffer': b'{"format":"nope"}\n'})
        self.page.wait_for_function("document.querySelector('#status').classList.contains('error')")
        self.assertEqual(self.project(), before)

    def test_subtitle_import_is_explicit_and_export_does_not_promise_style(self):
        self.page.locator('#subtitle-file').set_input_files({'name': 'captions.srt', 'mimeType': 'text/plain', 'buffer': b'1\n00:00:06,000 --> 00:00:08,000\nNew language text.\n'})
        self.page.get_by_text('Import caption track?', exact=True).wait_for()
        self.assertIn('split', self.page.locator('#dialog-body').inner_text())
        self.page.get_by_role('button', name='Import track', exact=True).click()
        after = self.project()
        self.assertEqual(len(after['tracks']), 5)
        self.assertEqual(len(after['tracks'][-1]['clips']), 2)
        self.page.locator('#export-open').click()
        self.assertIn('not the visual theme', self.page.locator('#dialog-body').inner_text())
        with self.page.expect_download() as pending:
            self.page.get_by_role('button', name='VTT', exact=True).click()
        self.assertTrue(Path(pending.value.path()).read_text().startswith('WEBVTT'))

    def mock_recording_boundary(self):
        # Permission ownership is tested with an explicit synthetic boundary, not
        # a native microphone or codec. Pin the complete boundary to the navigator
        # rather than relying on an expando of a platform-owned wrapper.
        self.page.evaluate("""() => {
          const devices={getUserMedia(){throw Error('Set an explicit synthetic microphone outcome.');}};
          Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:devices});
          Object.defineProperty(window,'MediaRecorder',{configurable:true,value:function SyntheticRecorder(){
            throw Error('A cancelled or rejected permission must not construct a recorder.');
          }});
          window.syntheticMediaDevices=devices;
        }""")
        self.assertTrue(self.page.evaluate('navigator.mediaDevices===window.syntheticMediaDevices'))

    def test_unavailable_recording_is_explicit_without_requesting_a_microphone(self):
        capability = self.page.evaluate("({mediaRecorder:typeof MediaRecorder, microphone:typeof navigator.mediaDevices?.getUserMedia})")
        print(json.dumps({'nativeRecordingCapability': capability, 'engine': self.engine}), flush=True)
        before = self.project()
        self.mock_recording_boundary()
        self.page.evaluate("""() => {
          window.micCalls=0;
          Object.defineProperty(window,'MediaRecorder',{configurable:true,value:undefined});
          Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>{window.micCalls++;throw Error('Must not request microphone');}});
        }""")
        self.choose('voice')
        self.page.locator('#record-audio').click()
        self.assertIn('Recording is unavailable', self.page.locator('#status').inner_text())
        self.assertEqual(self.page.evaluate('window.micCalls'), 0)
        self.assertFalse(self.page.locator('#dialog').evaluate('el=>el.open'))
        self.assertEqual(self.project(), before)

    def test_record_permission_denial_is_explicit_and_preserves_draft(self):
        self.mock_recording_boundary()
        before = self.project()
        self.page.evaluate("""() => {window.micCalls=0;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>{window.micCalls++;return Promise.reject(new DOMException('Synthetic denial','NotAllowedError'));}});} """)
        self.choose('voice')
        self.assertEqual(self.page.evaluate('window.micCalls'), 0)
        self.page.locator('#record-audio').click()
        self.page.wait_for_function("document.querySelector('#status').textContent.includes('permission was not granted')")
        self.assertEqual(self.page.evaluate('window.micCalls'), 1)
        self.assertEqual(self.project(), before)

    def test_cancel_recording_releases_a_late_permission_stream(self):
        self.mock_recording_boundary()
        self.page.evaluate("""() => {window.micStopped=0;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>new Promise(resolve=>{window.grantMicrophone=()=>resolve({getTracks:()=>[{stop(){window.micStopped++;}}]});})});}""")
        self.choose('voice')
        self.page.locator('#record-audio').click()
        self.page.get_by_role('button', name='Cancel', exact=True).click()
        self.page.evaluate('window.grantMicrophone()')
        self.page.wait_for_function('window.micStopped===1')
        self.assertFalse(self.page.locator('#dialog').is_visible())

    def test_voice_provider_style_selection_needs_explicit_confirmation(self):
        # A local fake provider verifies the integration; it is not a production AI voice.
        encoded = base64.b64encode(wav(2)).decode()
        self.page.evaluate("""async encoded=>{window.generated=[];const {connectVoiceProvider}=await import('./studio.mjs');connectVoiceProvider({capabilities:{name:'Synthetic test provider',voices:[{id:'test',label:'Test voice',styles:['calm','bright']}]},generate:async request=>{window.generated.push({text:request.text,style:request.style,voice:request.voiceId});return {bytes:Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)).buffer,mime:'audio/wav'};}});}""", encoded)
        self.choose('voice')
        self.page.locator('#voice-style').select_option('bright')
        self.page.locator('#generate-voice').click()
        self.assertEqual(self.page.evaluate('window.generated.length'), 0)
        self.page.get_by_role('button', name='Generate', exact=True).click()
        self.page.get_by_text('Use this voice take?', exact=True).wait_for()
        self.assertEqual(self.page.evaluate('window.generated[0].style'), 'bright')
        self.page.get_by_role('button', name='Cancel', exact=True).click()
        self.assertFalse(any(a['source'] == 'local' for a in self.project()['assets']))

    def test_mobile_layout_and_keyboard_preview_remain_usable(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.emulate_media(reduced_motion='reduce')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.edit('#caption-text', 'Edited with a phone-sized viewport.')
        self.page.locator('#preview-tour').focus()
        self.page.keyboard.press('Enter')
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>.2")
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'), 'paused')
        self.page.screenshot(path=str(self.output / 'studio-mobile.png'), full_page=True)

    def test_playback_keeps_scene_layout_and_never_changes_the_application(self):
        before = self.page.locator('#scene').evaluate('el=>[el.offsetWidth,el.offsetHeight,el.textContent]')
        self.page.locator('#preview-tour').click()
        self.seek(9)
        self.assertEqual(self.page.locator('#scene').evaluate('el=>[el.offsetWidth,el.offsetHeight,el.textContent]'), before)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'), 'signal')


if __name__ == '__main__':
    unittest.main(verbosity=2)
