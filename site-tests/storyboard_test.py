"""Visual-authoring acceptance, run against the staged site and the verified public demo."""
import json
import os
from pathlib import Path
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietStoryboardServer(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class StoryboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        public = os.environ.get('STORYBOARD_PUBLIC_URL')
        if public and public != 'https://natanelia.github.io/dom-director/agent.html':
            raise ValueError('Only the authorized synthetic public demo may be tested remotely.')
        cls.server = None
        if not public:
            cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietStoryboardServer, directory=str(ROOT / 'site-dist')))
            cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
            cls.thread.start()
        cls.p = sync_playwright().start()
        options = {}
        if os.environ.get('PLAYWRIGHT_EXECUTABLE_PATH'):
            options['executable_path'] = os.environ['PLAYWRIGHT_EXECUTABLE_PATH']
        cls.browser = getattr(cls.p, os.environ.get('BROWSER_ENGINE', 'chromium')).launch(**options)
        cls.url = public or f'http://127.0.0.1:{cls.server.server_port}/agent.html'

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.p.stop()
        if cls.server:
            cls.server.shutdown()
            cls.server.server_close()
            cls.thread.join()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1440, 'height': 1100})
        self.addCleanup(self.page.close)
        self.errors = []
        self.requests = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('request', lambda request: self.requests.append(request.url))
        self.page.goto(self.url + '?verify=' + os.environ.get('DEPLOYED_SHA', 'local'))
        self.page.wait_for_function("document.querySelector('#catalog').textContent.includes('app.reports')")
        self.page.locator('#draft').click()
        self.page.wait_for_function("document.querySelectorAll('#storyboard-scenes button').length===3")

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def script(self):
        return json.loads(self.page.locator('#agent-script').input_value())

    def review_load(self):
        self.page.locator('#validate').click()
        self.page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('Valid static plan')")
        self.page.locator('#reviewed-script').check()
        self.page.locator('#load-script').click()
        self.page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('Reviewed script loaded')")

    def test_edit_caption_timing_target_and_export_without_private_values(self):
        self.page.locator('#private-title').fill('PRIVATE_TITLE_DO_NOT_EXPORT')
        self.page.locator('#secret').fill('PRIVATE_PASSWORD_DO_NOT_EXPORT')
        self.assertEqual(self.page.locator('#storyboard-target option').count(), 3)
        self.assertNotIn('app.secret', self.page.locator('#storyboard-target').inner_text())
        self.page.locator('#storyboard-title').fill('Review the report')
        self.page.locator('#storyboard-description').fill('A caption written in the visual editor.')
        self.page.locator('#storyboard-duration').fill('4200')
        self.page.locator('#storyboard-transition').fill('700')
        self.page.locator('#storyboard-target').select_option('app.publish')
        self.page.locator('#storyboard-cursor').uncheck()
        self.page.locator('#storyboard-apply').click()
        script = self.script()
        first = script['scenes'][0]
        self.assertEqual(first['title'], 'Review the report')
        self.assertEqual(first['durationMs'], 4200)
        self.assertEqual(first['narration']['cues'][0]['endMs'], 4200)
        self.assertEqual(first['narration']['transcript'], 'A caption written in the visual editor.')
        self.assertEqual(script['targets']['target.scene0']['ref'], 'app.publish')
        self.assertFalse(any(cue['kind'] == 'cursor' for cue in first['cues']))
        with self.page.expect_download() as download:
            self.page.locator('#storyboard-download').click()
        exported = Path(download.value.path()).read_text()
        self.assertEqual(json.loads(exported), script)
        self.assertNotIn('PRIVATE_', exported)
        self.assertFalse([url for url in self.requests if not url.startswith(self.url.rsplit('/', 1)[0]) and not url.startswith('blob:')])

    def test_reorder_duplicate_remove_and_history_preserve_stable_ids(self):
        original = self.script()
        self.page.locator('#storyboard-down').click()
        moved = self.script()
        self.assertEqual(moved['entryScene'], 'scene1')
        self.assertEqual(moved['scenes'][1]['cues'], original['scenes'][0]['cues'])
        self.page.locator('#storyboard-undo').click()
        self.assertEqual(self.script(), original)
        self.page.locator('#storyboard-redo').click()
        self.assertEqual(self.script(), moved)
        self.page.locator('#storyboard-duplicate').click()
        duplicated = self.script()
        self.assertEqual(len(duplicated['scenes']), 4)
        ids = [cue['id'] for scene in duplicated['scenes'] for cue in scene['cues']]
        self.assertEqual(len(ids), len(set(ids)))
        self.page.locator('#storyboard-remove').click()
        self.assertEqual(self.script(), moved)
        self.page.locator('#storyboard-undo').click()
        self.assertEqual(self.script(), duplicated)
        self.page.locator('#storyboard-add').click()
        self.assertTrue(self.page.locator('#storyboard-redo').is_disabled())

    def test_dirty_fields_pause_playback_and_block_previous_approval(self):
        self.review_load()
        self.page.locator('#agent-play').click()
        self.page.wait_for_function("Number(document.querySelector('[aria-label=\"Scene position\"]').value)>100")
        self.page.locator('#storyboard-title').fill('Changed while playing')
        self.assertFalse(self.page.locator('#reviewed-script').is_checked())
        self.assertEqual(self.page.locator('[data-command="play"]').inner_text(), 'Play')
        self.page.locator('#reviewed-script').check()
        self.page.locator('#agent-play').click()
        self.page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('CAPABILITY_DENIED')")
        self.page.locator('#validate').click()
        self.assertIn('Apply or discard', self.page.locator('#agent-message').inner_text())
        self.page.locator('#storyboard-apply').click()
        self.page.locator('#agent-play').click()
        self.page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('CAPABILITY_DENIED')")
        self.review_load()
        self.page.locator('#agent-play').click()
        self.page.wait_for_function("document.querySelector('[data-command=play]').textContent==='Pause'")
        self.assertEqual(self.page.locator('#action-count').inner_text(), '0 clicks')

    def test_invalid_timing_is_not_written_and_can_be_discarded(self):
        before = self.page.locator('#agent-script').input_value()
        self.page.locator('#storyboard-transition').fill('5000')
        self.page.locator('#storyboard-apply').click()
        self.assertIn('Invalid storyboard', self.page.locator('#storyboard-status').inner_text())
        self.assertEqual(self.page.locator('#agent-script').input_value(), before)
        self.page.locator('#storyboard-discard').click()
        self.assertEqual(self.page.locator('#storyboard-transition').input_value(), '900')
        self.assertEqual(self.page.locator('#agent-script').input_value(), before)

    def test_advanced_json_is_preserved_and_history_cannot_overwrite_it(self):
        self.page.locator('#storyboard-add').click()
        self.page.locator('#denied-action').click()
        advanced = self.page.locator('#agent-script').input_value()
        self.page.locator('#storyboard-import').click()
        self.assertIn('without losing data', self.page.locator('#storyboard-status').inner_text())
        self.assertEqual(self.page.locator('#agent-script').input_value(), advanced)
        self.assertTrue(self.page.locator('#storyboard-undo').is_disabled())
        self.assertTrue(self.page.locator('#storyboard-apply').is_disabled())
        self.review_load()
        self.page.locator('#agent-play').click()
        self.page.wait_for_function("document.querySelector('#agent-message').textContent.includes('CAPABILITY_DENIED')")
        self.assertEqual(self.page.locator('#action-count').inner_text(), '0 clicks')

    def test_raw_json_reimport_is_explicit_and_unknown_targets_are_refused(self):
        script = self.script()
        script['targets']['target.scene0']['ref'] = 'app.secret'
        raw = json.dumps(script)
        self.page.locator('#agent-script').fill(raw)
        self.assertTrue(self.page.locator('#storyboard-apply').is_disabled())
        self.page.locator('#storyboard-import').click()
        self.assertIn('outside the approved catalog', self.page.locator('#storyboard-status').inner_text())
        self.assertEqual(self.page.locator('#agent-script').input_value(), raw)
        script['targets']['target.scene0']['ref'] = 'app.reports'
        self.page.locator('#agent-script').fill(json.dumps(script))
        self.page.locator('#storyboard-import').click()
        self.assertFalse(self.page.locator('#storyboard-apply').is_disabled())
        self.assertEqual(self.script(), script)

    def test_text_is_not_interpreted_as_markup(self):
        self.page.locator('#storyboard-title').fill('<img src=x onerror="window.injected=1">')
        self.page.locator('#storyboard-description').fill('<script>window.injected=1</script>')
        self.page.locator('#storyboard-apply').click()
        self.assertEqual(self.page.locator('#storyboard-scenes img').count(), 0)
        self.assertFalse(self.page.evaluate('!!window.injected'))
        self.assertIn('<img', self.page.locator('#storyboard-scenes button').first.inner_text())
        self.review_load()
        self.assertFalse(self.page.evaluate('!!window.injected'))

    def test_keyboard_mobile_and_history_bound(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.emulate_media(reduced_motion='reduce')
        self.page.locator('#storyboard-add').focus()
        self.page.keyboard.press('Enter')
        self.assertEqual(len(self.script()['scenes']), 4)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        for _ in range(35):
            self.page.locator('#storyboard-add').click()
        count = 0
        while self.page.locator('#storyboard-undo').is_enabled():
            self.page.locator('#storyboard-undo').click()
            count += 1
            self.assertLessEqual(count, 29)
        self.assertEqual(count, 29)
        self.assertGreater(len(self.script()['scenes']), 3)


if __name__ == '__main__':
    unittest.main(verbosity=2)
