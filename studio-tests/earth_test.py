"""Real Earth controls, six learning checkpoints, and Studio host compatibility.

Pixel digests verify that interactions change the drawn globe, not only labels.
The fictional Earth fixture is exercised locally and on the existing verified site.
"""
import json
import os
import unittest
from browser_test import StudioTests


PIXELS = """canvas => {
  const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let hash=2166136261;
  for(let i=0;i<bytes.length;i+=4){
    hash=Math.imul(hash^bytes[i],16777619);
    hash=Math.imul(hash^bytes[i+1],16777619);
    hash=Math.imul(hash^bytes[i+2],16777619);
  }
  return hash>>>0;
}"""


class EarthAssertions:
    def pixels(self):
        self.page.wait_for_function("document.querySelector('.earth-app')?.dataset.earthRendering!=='true'")
        return self.page.locator('canvas.earth-globe').evaluate(PIXELS)

    def earth_state(self):
        return self.page.locator('.earth-app').evaluate("""root => Object.fromEntries(
          ['earthMetric','earthYear','earthRegion','earthConnections','earthNight'].map(key=>[key,root.dataset[key]]))""")

    def assert_globe_changed(self, action):
        before = self.pixels()
        action()
        after = self.pixels()
        self.assertNotEqual(after, before, 'The control must change the actual globe pixels.')

    def change_year(self, year=2025):
        # Native range keyboard input is an actual user action, including Try gates.
        self.page.locator('.earth-year').focus()
        self.page.keyboard.press('End' if year == 2025 else 'Home')

    def all_controls(self):
        self.assert_globe_changed(lambda: self.page.locator('button[data-earth-metric="energy"]').click())
        self.assert_globe_changed(self.change_year)
        self.assert_globe_changed(lambda: self.page.locator('.earth-region').select_option('asia'))
        self.assert_globe_changed(lambda: self.page.locator('[data-earth-layer="connections"]').click())
        self.assert_globe_changed(lambda: self.page.locator('[data-earth-layer="night"]').click())
        self.assertEqual(self.earth_state(), {
            'earthMetric': 'energy', 'earthYear': '2025', 'earthRegion': 'asia',
            'earthConnections': 'true', 'earthNight': 'true'})


class StudioEarthTests(EarthAssertions, StudioTests):
    example = 'earth'

    def fixture_url(self):
        # Exercise the actual default entry, not an opt-in Earth query.
        return self.url + '?verify=' + os.environ.get('DEPLOYED_SHA', 'local')

    def setUp(self):
        super().setUp()
        self.page.emulate_media(reduced_motion='reduce')

    def test_default_earth_has_six_editable_scenes_and_no_wrong_narration(self):
        self.assertEqual(self.page.locator('#studio').get_attribute('data-host'), 'earth')
        self.assertEqual(self.page.locator('#scene-list button').count(), 6)
        self.assertTrue(self.page.locator('#scene').evaluate('el=>el.inert'))
        project = self.project()
        self.assertEqual(project['id'], 'earth-studio')
        self.assertEqual(project['assets'], [])
        voice = next(t for t in project['tracks'] if t['kind'] == 'voice')
        self.assertTrue(all(clip['assetId'] is None for clip in voice['clips']))
        self.assertFalse([url for url in self.requests if '.mp3' in url])
        origin = self.url.rsplit('/', 1)[0] + '/'
        self.assertFalse([url for url in self.requests if not url.startswith(origin)])
        self.assertIn('Illustrative', self.page.locator('#scene').inner_text())
        self.page.screenshot(path=str(self.output / 'earth-studio-desktop.png'), full_page=True)

    def test_try_controls_pauses_and_each_control_changes_the_globe_without_editing_project(self):
        before = self.project()
        self.page.locator('#preview-tour').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>.15")
        self.page.locator('#try-controls').click()
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'), 'paused')
        self.assertFalse(self.page.locator('#scene').evaluate('el=>el.inert'))
        self.assertTrue(self.page.locator('#stage-overlays').is_hidden())
        self.all_controls()
        state = self.earth_state()
        self.page.locator('#try-controls').click()
        self.assertTrue(self.page.locator('#scene').evaluate('el=>el.inert'))
        self.assertEqual(self.earth_state(), state)
        self.assertEqual(self.project(), before)

    def test_seeking_and_simulated_cursor_never_reset_or_change_live_earth(self):
        self.page.locator('#try-controls').click()
        self.page.locator('button[data-earth-metric="energy"]').click()
        self.page.locator('[data-earth-layer="night"]').click()
        self.page.locator('#try-controls').click()
        state, pixels = self.earth_state(), self.pixels()
        for at in [0, 8, 19, 35, 3]:
            self.seek(at)
            self.assertEqual(self.earth_state(), state)
            self.assertEqual(self.pixels(), pixels)

    def test_mobile_keyboard_controls_and_escape_keep_the_app_reachable(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.locator('#try-controls').focus()
        self.page.keyboard.press('Enter')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        globe = self.page.locator('canvas.earth-globe')
        globe.focus()
        self.assert_globe_changed(lambda: self.page.keyboard.press('ArrowRight'))
        self.page.locator('button[data-earth-metric="energy"]').focus()
        self.assert_globe_changed(lambda: self.page.keyboard.press('Enter'))
        self.page.screenshot(path=str(self.output / 'earth-studio-mobile-controls.png'), full_page=True)
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('#try-controls').get_attribute('aria-pressed'), 'false')
        self.assertTrue(self.page.locator('#scene').evaluate('el=>el.inert'))
        self.assertTrue(self.page.locator('#try-controls').evaluate('el=>el===document.activeElement'))

    def test_saved_earth_and_orbit_projects_select_matching_hosts_and_mixed_targets_are_rejected(self):
        earth = self.bundle()
        orbit = self.page.evaluate("""async()=>{
          const {createSample}=await import('./studio-sdk/index.js');
          return JSON.stringify({format:'dom-director-studio/1',project:createSample(),files:[]})+'\\n';
        }""").encode()
        for payload, host, count in [(orbit, 'orbit', 3), (earth, 'earth', 6)]:
            self.page.locator('#project-file').set_input_files({'name': 'example.director', 'mimeType': 'application/x-dom-director', 'buffer': payload})
            self.page.get_by_role('button', name='Open project', exact=True).click()
            self.page.wait_for_function("host=>document.querySelector('#studio').dataset.host===host", arg=host)
            self.assertEqual(self.page.locator('#scene-list button').count(), count)
        mixed = json.loads(earth.splitlines()[0])
        mixed['project']['tracks'][0]['clips'][0]['keys'][0]['target'] = 'orbit.overview'
        self.page.locator('#project-file').set_input_files({'name': 'mixed.director', 'mimeType': 'application/x-dom-director', 'buffer': (json.dumps(mixed)+'\n').encode()})
        self.page.wait_for_function("document.querySelector('#status').classList.contains('error')")
        self.assertIn('separate example', self.page.locator('#status').inner_text())
        self.assertEqual(self.page.locator('#studio').get_attribute('data-host'), 'earth')
        self.assertEqual(self.bundle(), earth)

    def test_earth_video_handoff_starts_silent_and_saves_the_actual_earth_project(self):
        before = self.project()
        self.page.locator('#export-open').click()
        self.page.locator('#video-open').click()
        self.assertFalse(self.page.locator('#video-audio').is_checked())
        self.assertTrue(self.page.locator('#video-command').input_value().endswith(' --silent'))
        self.assertIn('Earth', self.page.locator('#video-summary').inner_text())
        with self.page.expect_download() as pending:
            self.page.locator('#video-save').click()
        from pathlib import Path
        saved = json.loads(Path(pending.value.path()).read_bytes().splitlines()[0])
        self.assertEqual(saved['project'], before)
        self.assertEqual(saved['project']['id'], 'earth-studio')
        self.assertEqual(saved['files'], [])
        self.assertFalse([url for url in self.requests if '.mp3' in url])


class EarthDemoTests(EarthAssertions, StudioTests):
    """Public tutorial uses the default homepage; Orbit stays a separate fixture."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.url = cls.url.removesuffix('studio.html')

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1440, 'height': 1100})
        self.addCleanup(lambda: self.page.close() if not self.page.is_closed() else None)
        self.page.set_default_timeout(8000)
        self.errors, self.requests = [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('request', lambda request: self.requests.append(request.url))
        self.page.emulate_media(reduced_motion='reduce')
        self.page.goto(self.url + '?verify=' + os.environ.get('DEPLOYED_SHA', 'local'))
        self.page.wait_for_function("document.querySelector('#stage')?.dataset.runtime==='sdk' && !!document.querySelector('canvas.earth-globe')")

    def mode(self, mode):
        self.page.locator('button[data-mode="'+mode+'"]').click()
        self.page.wait_for_function("mode=>document.querySelector('#stage').dataset.mode===mode", arg=mode)
        self.page.wait_for_function("!document.querySelector('button[data-mode]').disabled")

    def gate(self, scene):
        self.page.locator('#chapter-strip [data-scene="'+scene+'"]').click()
        self.page.wait_for_function("scene=>document.querySelector('#stage').dataset.scene===scene && document.querySelector('#stage').dataset.state==='waiting'", arg=scene)

    def test_default_homepage_is_earth_and_same_origin_without_audio(self):
        self.assertEqual(self.page.locator('#chapter-strip [data-scene]').count(), 6)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'), 'earth.overview')
        self.assertIsNone(self.page.locator('#stage').get_attribute('aria-pressed'),
                          'Application state metadata must not make the stage a toggle button.')
        self.assertFalse([url for url in self.requests if not url.startswith(self.url)])
        self.assertFalse([url for url in self.requests if '.mp3' in url])
        self.assertIn('Illustrative', self.page.locator('.earth-app').inner_text())
        self.page.screenshot(path=str(self.output / 'earth-demo-desktop.png'), full_page=True)

    def test_all_six_try_checkpoints_require_real_controls_and_change_globe_pixels(self):
        self.mode('try')
        actions = [
            ('earth.overview', lambda: self.page.locator('canvas.earth-globe').press('ArrowRight')),
            ('earth.metric', lambda: self.page.locator('button[data-earth-metric="energy"]').click()),
            ('earth.year', self.change_year),
            ('earth.region', lambda: self.page.locator('.earth-region').select_option('asia')),
            ('earth.connections', lambda: self.page.locator('[data-earth-layer="connections"]').click()),
            ('earth.lighting', lambda: self.page.locator('[data-earth-layer="night"]').click()),
        ]
        for index, (scene, action) in enumerate(actions):
            self.gate(scene)
            self.assert_globe_changed(action)
            self.page.wait_for_function("document.querySelector('#stage').dataset.state!=='waiting'")
            self.assertIn(str(index+1), self.page.locator('#earth-progress').inner_text())
        state, pixels = self.earth_state(), self.pixels()
        self.page.locator('#restart').click()
        self.assertEqual(self.earth_state(), state)
        self.assertEqual(self.pixels(), pixels)
        self.page.screenshot(path=str(self.output / 'earth-demo-completed-controls.png'), full_page=True)
        self.page.locator('#earth-reset').click()
        self.page.wait_for_function("document.querySelector('#earth-progress').textContent.startsWith('0 / 6')")
        self.assertEqual(self.earth_state(), {
            'earthMetric': 'population', 'earthYear': '2000', 'earthRegion': 'world',
            'earthConnections': 'false', 'earthNight': 'false'})

    def test_guide_waits_at_the_scene_boundary_and_modes_keep_their_own_globe(self):
        self.mode('guide')
        self.gate('earth.overview')
        self.page.locator('canvas.earth-globe').press('ArrowRight')
        self.page.wait_for_function("document.querySelector('#stage').dataset.state!=='waiting'")
        self.seek(6.8)
        self.page.locator('#play').click()
        self.page.locator('#next-step').wait_for(state='visible')
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'), 'earth.overview')
        self.page.locator('#next-step').click()
        self.page.wait_for_function("document.querySelector('#stage').dataset.scene==='earth.metric'")
        self.page.locator('button[data-earth-metric="energy"]').click()
        self.mode('watch')
        self.assertEqual(self.earth_state()['earthMetric'], 'population')
        self.mode('guide')
        self.assertEqual(self.earth_state()['earthMetric'], 'energy')

    def test_canonical_earth_export_and_transcript_contain_all_six_controls_without_audio(self):
        self.page.locator('#script-open').click()
        script = json.loads(self.page.locator('#script-json').inner_text())
        self.assertEqual(script['schemaVersion'], '0.1.0-draft.1')
        self.assertEqual(script['id'], 'earth-statistics')
        self.assertEqual(script['assets'], {})
        self.assertEqual(len(script['scenes']), 6)
        self.assertTrue(all(any(cue['kind']=='gate' for cue in scene['cues']) for scene in script['scenes']))
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#script-open').evaluate('el=>el===document.activeElement'))
        self.page.locator('#transcript-toggle').click()
        self.assertEqual(self.page.locator('#transcript button').count(), 6)

    def test_unfinished_checkpoint_cannot_be_skipped_and_seek_never_changes_earth(self):
        state, pixels = self.earth_state(), self.pixels()
        self.mode('try')
        self.seek(40)
        self.assertNotEqual(self.page.locator('#stage').get_attribute('data-scene'), 'earth.lighting')
        self.assertEqual(self.earth_state(), state)
        self.assertEqual(self.pixels(), pixels)
        self.mode('watch')
        for at in [12, 22, 38, 0]:
            self.seek(at)
            self.assertEqual(self.earth_state(), state)
            self.assertEqual(self.pixels(), pixels)

    def test_real_globe_drag_and_explicit_reset_change_only_the_demo(self):
        self.page.locator('#takeover').click()
        globe = self.page.locator('canvas.earth-globe')
        globe.scroll_into_view_if_needed()
        box = globe.bounding_box()
        before = self.pixels()
        x, y = box['x']+box['width']*.5, box['y']+box['height']*.5
        self.page.mouse.move(x, y)
        self.page.mouse.down()
        self.page.mouse.move(x+70, y+20, steps=5)
        self.page.mouse.up()
        self.assertNotEqual(self.pixels(), before)
        self.all_controls()
        self.page.locator('.earth-reset').click()
        self.assertEqual(self.earth_state(), {
            'earthMetric': 'population', 'earthYear': '2000', 'earthRegion': 'world',
            'earthConnections': 'false', 'earthNight': 'false'})
        self.assertEqual(self.pixels(), before)

    def test_mobile_reduced_motion_has_keyboard_controls_captions_and_exit(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.mode('try')
        self.gate('earth.overview')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.assertFalse(self.page.locator('#caption').is_hidden())
        self.assertEqual(self.page.locator('#stage').get_attribute('data-reduced-motion'), 'true')
        self.assert_globe_changed(lambda: self.page.locator('canvas.earth-globe').press('ArrowRight'))
        self.page.screenshot(path=str(self.output / 'earth-demo-mobile.png'), full_page=True)
        self.page.locator('#exit-tour').click()
        self.assertNotEqual(self.page.locator('#stage').get_attribute('data-state'), 'playing')

    def test_renderer_api_is_bounded_silent_and_cleans_up_its_instance(self):
        result = self.page.evaluate("""async()=>{
          const {createEarthApp,EARTH_DEFAULT_STATE}=await import('./earth.mjs');
          const root=document.createElement('div');root.inert=true;document.body.append(root);
          const calls=[];const app=createEarthApp({root,onChange:(state,event)=>calls.push(event),interactive:false});
          const initial=app.getState(),copy=app.getState();copy.metric='energy';
          const isolated=app.getState().metric==='population';
          let rejected=0;
          for(const patch of [{metric:'invalid'},{metric:['energy']},{region:{}},{year:NaN},{zoom:Infinity},{night:'true'},{unknown:1}]){
            try{app.setState(patch,{animate:false});}catch{rejected++;}
          }
          const unchanged=JSON.stringify(initial)===JSON.stringify(app.getState());
          app.setState({year:9999,tilt:200,zoom:99,rotation:999},{animate:false});
          const bounded=app.getState();
          app.setState({...EARTH_DEFAULT_STATE},{animate:false});
          const resets=JSON.stringify(app.getState())===JSON.stringify(initial);
          root.querySelector('button[data-earth-metric="energy"]').click();
          const inert=app.getState().metric==='population';
          app.destroy();app.destroy();
          const destroyed=root.childElementCount===0&&root.inert&&!root.classList.contains('earth-app');root.remove();
          return {isolated,rejected,unchanged,bounded,resets,inert,destroyed,calls:calls.length};
        }""")
        self.assertTrue(result['isolated'])
        self.assertEqual(result['rejected'], 7)
        self.assertTrue(result['unchanged'])
        self.assertEqual(result['bounded']['year'], 2025)
        self.assertEqual(result['bounded']['tilt'], 65)
        self.assertEqual(result['bounded']['zoom'], 1.35)
        self.assertGreaterEqual(result['bounded']['rotation'], -180)
        self.assertLess(result['bounded']['rotation'], 180)
        for flag in ['resets', 'inert', 'destroyed']:
            self.assertTrue(result[flag], flag)
        self.assertEqual(result['calls'], 0)


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(case(name) for case in (StudioEarthTests, EarthDemoTests)
                              for name in case.__dict__ if name.startswith('test_'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
