"""Real Earth controls, eight learning checkpoints, and Studio host compatibility.

Pixel digests verify that interactions change the drawn globe, not only labels.
The fictional Earth fixture is exercised locally and on the existing verified site.
"""
import json
import math
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

DEMO_CLICK = """() => {
  const node=document.querySelector('.earth-click-feedback[data-source="demo"]');
  const ring=node?.querySelector('.earth-click-ring'),box=ring?.getBoundingClientRect();
  const style=node?getComputedStyle(node):null,stage=document.querySelector('#stage');
  const root=document.querySelector('.earth-app');
  return {target:node?.dataset.target,progress:Number(node?.dataset.progress),
    visible:!!node&&!node.hidden&&style.display!=='none'&&Number(style.opacity)>0&&box.width>0&&box.height>0,
    opacity:style?Number(style.opacity):null,width:ring?parseFloat(ring.style.width):null,
    point:box?{x:box.x+box.width/2,y:box.y+box.height/2}:null,
    scene:stage.dataset.scene,timeMs:Number(document.querySelector('#seek').value)*1000,
    coordinates:root.querySelector('.earth-coordinates').textContent,
    state:Object.fromEntries(['earthMetric','earthYear','earthRegion','earthConnections','earthNight','earthZoom'].map(key=>[key,root.dataset[key]]))};
}"""


class EarthAssertions:
    def pixels(self):
        self.page.wait_for_function("document.querySelector('.earth-app')?.dataset.earthRendering!=='true'")
        return self.page.locator('canvas.earth-globe').evaluate(PIXELS)

    def earth_state(self):
        return self.page.locator('.earth-app').evaluate("""root => Object.fromEntries(
          ['earthMetric','earthYear','earthRegion','earthConnections','earthNight','earthZoom'].map(key=>[key,root.dataset[key]]))""")

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
        self.assert_globe_changed(lambda: self.page.locator('[data-earth-zoom="in"]').click())
        self.assert_globe_changed(lambda: self.page.locator('[data-earth-zoom="out"]').click())
        self.assert_globe_changed(lambda: self.page.locator('button[data-earth-metric="energy"]').click())
        self.assert_globe_changed(self.change_year)
        self.assert_globe_changed(lambda: self.page.locator('.earth-region').select_option('asia'))
        self.assert_globe_changed(lambda: self.page.locator('[data-earth-layer="connections"]').click())
        self.assert_globe_changed(lambda: self.page.locator('[data-earth-layer="night"]').click())
        self.assertEqual(self.earth_state(), {
            'earthMetric': 'energy', 'earthYear': '2025', 'earthRegion': 'asia',
            'earthConnections': 'true', 'earthNight': 'true', 'earthZoom': '1'})


class StudioEarthTests(EarthAssertions, StudioTests):
    example = 'earth'

    def fixture_url(self):
        # Exercise the actual default entry, not an opt-in Earth query.
        return self.url + '?verify=' + os.environ.get('DEPLOYED_SHA', 'local')

    def setUp(self):
        super().setUp()
        self.page.emulate_media(reduced_motion='reduce')

    def test_default_earth_has_eight_editable_scenes_and_no_wrong_narration(self):
        self.assertEqual(self.page.locator('#studio').get_attribute('data-host'), 'earth')
        self.assertEqual(self.page.locator('#scene-list button').count(), 8)
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
        def video_audio(expected, override=None, configure=False):
            self.page.locator('#export-open').click()
            self.page.locator('#video-open').click()
            if configure:
                self.page.locator('#video-format').select_option('webm')
                self.page.locator('#video-fps').select_option('24')
            self.assertEqual(self.page.locator('#video-format').input_value(), 'webm')
            self.assertEqual(self.page.locator('#video-fps').input_value(), '24')
            audio = self.page.locator('#video-audio')
            self.assertEqual(audio.is_checked(), expected)
            self.assertEqual('--silent' in self.page.locator('#video-command').input_value().split(), not expected)
            if override is not None:
                audio.set_checked(override)
                self.assertEqual(audio.is_checked(), override)
                self.assertEqual('--silent' in self.page.locator('#video-command').input_value().split(), not override)
            self.page.locator('#video-close').click()
            self.assertTrue(self.page.locator('#dialog').is_hidden())

        video_audio(False, configure=True)
        for payload, host, count, audio, override in [
                (orbit, 'orbit', 3, True, False), (earth, 'earth', 8, False, True),
                (orbit, 'orbit', 3, False, None), (earth, 'earth', 8, True, None)]:
            self.page.locator('#project-file').set_input_files({'name': 'example.director', 'mimeType': 'application/x-dom-director', 'buffer': payload})
            self.page.get_by_role('button', name='Open project', exact=True).click()
            self.page.wait_for_function("host=>document.querySelector('#studio').dataset.host===host", arg=host)
            self.assertEqual(self.page.locator('#scene-list button').count(), count)
            video_audio(audio, override)
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

    def assert_tutorial_healthy(self):
        toast = self.page.locator('#toast')
        status = self.page.locator('#stage').get_attribute('data-status')
        if status != 'error' and toast.is_hidden():
            return
        geometry = self.page.evaluate("""()=>Object.fromEntries(
          ['#stage','#scene','.earth-visual','.earth-metric-control','.earth-year-control',
           '.earth-region-control','[data-earth-layer="connections"]','[data-earth-layer="night"]'].map(selector=>{
            const el=document.querySelector(selector),r=el.getBoundingClientRect();
            return [selector,{x:r.x,y:r.y,width:r.width,height:r.height,
              clientWidth:el.clientWidth,clientHeight:el.clientHeight,transform:getComputedStyle(el).transform}];
          }))""")
        self.fail('Unexpected walkthrough diagnostic: ' + json.dumps({
            'status': status, 'scene': self.page.locator('#stage').get_attribute('data-scene'),
            'time': self.page.locator('#seek').input_value(), 'notice': toast.text_content(), 'geometry': geometry}))

    def demo_click(self):
        return self.page.evaluate(DEMO_CLICK)

    def wait_for_demo_click(self, target):
        return self.page.wait_for_function(
            'target=>{const sample=(' + DEMO_CLICK + ')();return sample.visible&&sample.progress>0&&sample.target===target?sample:false;}',
            arg=target, timeout=12000).json_value()

    def test_default_homepage_is_earth_and_same_origin_without_audio(self):
        self.assertEqual(self.page.locator('#chapter-strip [data-scene]').count(), 8)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'), 'earth.overview')
        self.assertEqual(self.page.locator('#stage').get_attribute('data-mode'), 'watch')
        self.assertEqual(self.page.locator('button[data-mode="watch"]').get_attribute('aria-pressed'), 'true')
        self.assertEqual(self.page.locator('button[data-mode]').count(), 3)
        self.assertIsNone(self.page.locator('#stage').get_attribute('aria-pressed'),
                          'Application state metadata must not make the stage a toggle button.')
        self.assertFalse([url for url in self.requests if not url.startswith(self.url)])
        self.assertFalse([url for url in self.requests if '.mp3' in url])
        self.assertIn('Illustrative', self.page.locator('.earth-app').inner_text())
        self.page.screenshot(path=str(self.output / 'earth-demo-desktop.png'), full_page=True)

    def test_watch_cursor_moves_from_globe_to_zoom_during_the_camera_push_in(self):
        self.page.emulate_media(reduced_motion='no-preference')
        self.mode('watch')
        self.page.wait_for_function("document.querySelector('#stage').dataset.reducedMotion==='false'")
        initial_pixels = self.pixels()
        # Resolve the first Watch gate normally before seeking near the boundary.
        self.page.locator('#play').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>4.2 && document.querySelector('#stage').dataset.status==='playing'")
        self.page.locator('#play').click()
        self.assert_tutorial_healthy()
        state, pixels = self.earth_state(), self.pixels()
        self.assertNotEqual(pixels, initial_pixels, 'Watch must demonstrate the first globe rotation.')
        self.assertEqual(self.page.locator('.earth-coordinates').text_content(), '16° N / 65° W')
        self.seek(6.9)
        self.page.evaluate("""() => {
          window.readEarthCursor=()=>{
            const stage=document.querySelector('#stage'),box=stage.getBoundingClientRect();
            const nodes=document.querySelectorAll('[data-director-overlay] [data-kind="cursor"]');
            const node=nodes[0],r=node?.getBoundingClientRect(),style=node?getComputedStyle(node):null;
            const matrix=style?new DOMMatrix(style.transform):null;
            const camera=new DOMMatrix(getComputedStyle(document.querySelector('#scene')).transform);
            const target=document.querySelector('[data-earth-zoom="in"]').getBoundingClientRect();
            return {scene:stage.dataset.scene,status:stage.dataset.status,timeMs:Number(document.querySelector('#seek').value)*1000,
              camera:{x:camera.e,y:camera.f,scale:camera.a},
              count:nodes.length,cue:node?.dataset.cue||null,point:matrix?{x:matrix.e-box.left,y:matrix.f-box.top}:null,
              target:{x:target.x+target.width/2-box.left,y:target.y+target.height/2-box.top},
              visible:!!r&&r.width>0&&r.height>0&&style.visibility==='visible'&&Number(style.opacity)>0,
              inside:!!r&&r.left>=box.left-2&&r.right<=box.right+2&&r.top>=box.top-2&&r.bottom<=box.bottom+2};
          };
          const run=window.earthCursorRun={done:false,error:null,frames:[]},deadline=performance.now()+6000;
          function observe(){
            const frame=readEarthCursor();
            if(frame.status==='error'||performance.now()>deadline){run.error=frame;run.done=true;return;}
            if(frame.scene==='earth.zoom-in'&&frame.status==='playing'){
              run.frames.push(frame);if(frame.timeMs>=7850){run.done=true;return;}
            }
            requestAnimationFrame(observe);
          }
          requestAnimationFrame(observe);
        }""")
        self.page.locator('#play').click()
        self.page.wait_for_function('window.earthCursorRun.done', timeout=8000)
        observed = self.page.evaluate('window.earthCursorRun')
        self.assertIsNone(observed['error'], observed)
        self.page.locator('#play').click()

        def distance(a, b):
            return math.hypot(a['point']['x']-b['point']['x'], a['point']['y']-b['point']['y'])

        def assert_pointer(frame):
            self.assertEqual(frame['count'], 1, frame)
            self.assertTrue(frame['visible'] and frame['inside'], frame)
            self.assertTrue(all(math.isfinite(value) for value in frame['point'].values()), frame)

        for frame in observed['frames']:
            assert_pointer(frame)
        # Cue identity is frame-exact even though the public time display is throttled.
        early = [frame for frame in observed['frames'] if frame['cue'] == 'cursor.travel.earth.zoom-in']
        self.assertGreater(len(early), 2, observed)
        self.assertGreater(max(distance(early[0], frame) for frame in early), 5,
                           'The live cursor waited for the 700 ms arrival cue.')
        self.assertGreater(max(frame['camera']['scale'] for frame in early)-min(frame['camera']['scale'] for frame in early), .03,
                           'The camera must already be zooming while the cursor moves to the zoom control.')
        frames = []
        for at in [7, 7.15, 7.35, 7.55, 7.69, 7.7, 8, 7.35]:
            self.seek(at)
            self.assert_tutorial_healthy()
            frame = self.page.evaluate('readEarthCursor()')
            self.assertEqual(frame['scene'], 'earth.zoom-in', frame)
            self.assertEqual(frame['status'], 'paused', frame)
            self.assertAlmostEqual(frame['timeMs'], at*1000, delta=.01)
            assert_pointer(frame)
            frames.append(frame)
        self.assertGreater(distance(frames[0], frames[2]), 5)
        self.assertLess(distance(frames[4], frames[5]), 5)
        self.assertLess(distance(frames[5], {'point': frames[5]['target']}), 1)
        self.assertLess(distance(frames[2], frames[-1]), .2)
        self.assertEqual(self.earth_state(), state)
        self.assertEqual(self.pixels(), pixels)
        self.assertTrue(self.page.locator('#earth-progress').text_content().startswith('1 / 8'))
        # Watching a visual journey never supplies proof for an unfinished Try gate.
        self.mode('try')
        self.seek(7.35)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'), 'earth.overview')
        self.assertNotEqual(self.page.locator('#stage').get_attribute('data-status'), 'error')
        self.assertEqual(self.earth_state(), state)
        self.assertEqual(self.pixels(), initial_pixels)
        self.assertEqual(self.page.locator('.earth-coordinates').text_content(), '12° N / 28° E')
        self.assertTrue(self.page.locator('#earth-progress').text_content().startswith('0 / 8'))

    def test_default_watch_demonstrates_all_eight_controls_with_clocked_clicks_and_fresh_replay(self):
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.wait_for_function("document.querySelector('#stage').dataset.reducedMotion==='false'")
        self.assertEqual(self.page.locator('#stage').get_attribute('data-mode'), 'watch')
        script = json.loads(self.page.locator('#script-json').text_content())
        self.assertEqual(sum(scene['durationMs'] for scene in script['scenes']), 56000)
        initial_state, initial_pixels = self.earth_state(), self.pixels()
        self.page.evaluate("""()=>{
          window.earthDemoInputs=[];
          for(const type of ['click','input','change','pointerdown','keydown'])
            document.querySelector('#scene').addEventListener(type,event=>
              window.earthDemoInputs.push({type,trusted:event.isTrusted}),true);
          window.earthDemoCursor={samples:0,failures:[]};
          function observe(){
            const stage=document.querySelector('#stage'),record=window.earthDemoCursor;
            if(stage.dataset.status==='playing'){
              const viewport=stage.getBoundingClientRect();
              const nodes=document.querySelectorAll('[data-director-overlay] [data-kind="cursor"]');
              const cursor=nodes[0],box=cursor?.getBoundingClientRect(),style=cursor?getComputedStyle(cursor):null;
              record.samples++;
              const visible=nodes.length===1&&box.width>0&&box.height>0&&style.visibility==='visible'&&Number(style.opacity)>0;
              const inside=visible&&box.left>=viewport.left-2&&box.right<=viewport.right+2&&box.top>=viewport.top-2&&box.bottom<=viewport.bottom+2;
              if(!inside&&record.failures.length<10)record.failures.push({scene:stage.dataset.scene,
                time:Number(document.querySelector('#seek').value),count:nodes.length,visible,inside});
            }
            if(stage.dataset.status!=='completed')requestAnimationFrame(observe);
          }
          requestAnimationFrame(observe);
        }""")
        expected, previous_pixels, start_ms = dict(initial_state), initial_pixels, 0
        changes = [
            ('earth.globe', {}, '16° N / 65° W'),
            ('earth.zoomIn', {'earthZoom': '1.65'}, '16° N / 65° W'),
            ('earth.zoomOut', {'earthZoom': '0.8'}, '16° N / 65° W'),
            ('earth.metric', {'earthMetric': 'energy'}, '16° N / 65° W'),
            ('earth.year', {'earthYear': '2025'}, '16° N / 65° W'),
            ('earth.region', {'earthRegion': 'asia'}, '24° N / 105° E'),
            ('earth.connections', {'earthConnections': 'true'}, '24° N / 105° E'),
            ('earth.lighting', {'earthNight': 'true'}, '24° N / 105° E'),
        ]
        self.page.locator('#hero-play').click()
        for index, (scene, (target, patch, coordinates)) in enumerate(zip(script['scenes'], changes)):
            action = next(cue for cue in scene['cues'] if cue['kind'] == 'action')
            click = self.wait_for_demo_click(target)
            expected.update(patch)
            self.assertEqual(click['scene'], scene['id'], click)
            self.assertEqual(click['state'], expected, click)
            self.assertEqual(click['coordinates'], coordinates, click)
            self.assertGreaterEqual(click['progress'], 0, click)
            self.assertLess(click['progress'], 1, click)
            # The public clock is throttled; the pulse still belongs to this action's 700 ms window.
            self.assertGreaterEqual(click['timeMs'], start_ms + action['at'] - 120, click)
            self.assertLessEqual(click['timeMs'], start_ms + action['at'] + 820, click)
            self.assertAlmostEqual(click['width'], 14 + 56 * click['progress'], delta=.1)
            self.assertAlmostEqual(click['opacity'], 1 - click['progress'], delta=.01)
            self.assertTrue(all(math.isfinite(value) for value in click['point'].values()), click)
            # A click can be observed on the action's zero-progress frame. Wait
            # for an actual rendered change within this scene's bounded transition.
            pixels = self.page.wait_for_function(
                'previous=>{const value=(' + PIXELS + ')(document.querySelector("canvas.earth-globe"));return value!==previous?{pixels:value}:false;}',
                arg=previous_pixels, timeout=2100).json_value()['pixels']
            self.assertNotEqual(pixels, previous_pixels, scene['id'] + ' must change the drawn globe.')
            previous_pixels = pixels
            self.assert_tutorial_healthy()
            self.assertTrue(self.page.locator('#earth-progress').text_content().startswith(f'{index+1} / 8'))
            start_ms += scene['durationMs']
        self.page.wait_for_function("document.querySelector('#stage').dataset.status==='completed'", timeout=12000)
        self.assertEqual(float(self.page.locator('#seek').input_value()), 56)
        self.assertEqual(self.page.locator('#chapter-strip [data-complete="true"]').count(), 8)
        self.assertEqual(self.page.evaluate('window.earthDemoInputs'), [],
                         'Automatic actions must call the host adapter without dispatching DOM input.')
        cursor = self.page.evaluate('window.earthDemoCursor')
        self.assertGreater(cursor['samples'], 30)
        self.assertEqual(cursor['failures'], [], 'The cursor must stay visible through every camera shot.')
        self.assertFalse(self.demo_click()['visible'])
        self.assert_tutorial_healthy()
        self.page.screenshot(path=str(self.output / 'earth-demo-watch-completed.png'), full_page=True)

        # Presentation replay deliberately starts a fresh Watch run and resets only its world.
        self.page.locator('#restart').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)===0 && !document.querySelector('#play').disabled")
        self.assertEqual(self.earth_state(), initial_state)
        self.assertEqual(self.pixels(), initial_pixels)
        self.assertTrue(self.page.locator('#earth-progress').text_content().startswith('0 / 8'))
        self.page.locator('#play').click()
        self.wait_for_demo_click('earth.globe')
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>2.6")
        self.page.locator('#play').click()
        self.assertEqual(self.page.locator('.earth-coordinates').text_content(), '16° N / 65° W')
        self.assertNotEqual(self.pixels(), initial_pixels)
        self.assertEqual(self.earth_state(), initial_state)
        self.mode('try')
        self.assertEqual(self.pixels(), initial_pixels)
        self.assertTrue(self.page.locator('#earth-progress').text_content().startswith('0 / 8'))
        self.seek(40)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'), 'earth.overview')
        self.assertEqual(self.pixels(), initial_pixels)

    def test_watch_pause_seek_and_repeated_crossing_sample_feedback_without_repeating_actions(self):
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.wait_for_function("document.querySelector('#stage').dataset.reducedMotion==='false'")
        self.page.locator('#play').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>2.6")
        self.page.locator('#play').click()
        self.page.locator('canvas.earth-globe').press('ArrowRight')
        state, pixels = self.earth_state(), self.pixels()
        coordinates = self.page.locator('.earth-coordinates').text_content()
        self.assertEqual(coordinates, '16° N / 53° W')
        self.seek(2.1)
        first = self.demo_click()
        self.assertTrue(first['visible'], first)
        self.assertEqual(first['target'], 'earth.globe')
        self.assertAlmostEqual(first['progress'], 300 / 700, delta=.001)
        self.page.wait_for_timeout(400)
        second = self.demo_click()
        for key in ['target', 'progress', 'visible', 'width', 'opacity', 'point']:
            self.assertEqual(second[key], first[key], key + ' must freeze with the presentation clock.')
        self.assertEqual(self.earth_state(), state)
        self.assertEqual(self.pixels(), pixels)
        self.assertEqual(self.page.locator('.earth-coordinates').text_content(), coordinates)
        self.seek(1.7)
        self.assertFalse(self.demo_click()['visible'])
        self.page.locator('#play').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>2.6")
        self.page.locator('#play').click()
        self.assertEqual(self.earth_state(), state)
        self.assertEqual(self.pixels(), pixels)
        self.assertEqual(self.page.locator('.earth-coordinates').text_content(), coordinates,
                         'A consumed Watch action must not overwrite a later manual change in the same run.')
        self.assert_tutorial_healthy()

    def test_cinematic_push_in_pullback_and_globe_transition_freeze_with_the_player(self):
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.wait_for_function("document.querySelector('#stage').dataset.reducedMotion==='false'")
        camera = """()=>{
          const matrix=new DOMMatrix(getComputedStyle(document.querySelector('#scene')).transform);
          return {scale:matrix.a,x:matrix.e,y:matrix.f};
        }"""
        initial_camera = self.page.evaluate(camera)
        self.page.locator('#play').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>2.1")
        close_camera = self.page.evaluate(camera)
        self.assertGreater(close_camera['scale'], initial_camera['scale']*1.3,
                           'The authored close-up must visibly magnify the real application.')
        moving_pixels = self.pixels()
        self.page.wait_for_timeout(180)
        self.assertNotEqual(self.pixels(), moving_pixels,
                            'The globe should turn through intermediate frames, not snap at the action.')
        self.page.locator('#play').click()
        self.page.wait_for_function("document.querySelector('#stage').dataset.status==='paused'")
        paused_pixels, paused_camera = self.pixels(), self.page.evaluate(camera)
        paused_time, committed = self.page.locator('#seek').input_value(), self.earth_state()
        self.page.wait_for_timeout(350)
        self.assertEqual(self.pixels(), paused_pixels, 'A paused Director must freeze the globe too.')
        self.assertEqual(self.page.evaluate(camera), paused_camera)
        self.assertEqual(self.page.locator('#seek').input_value(), paused_time)
        self.assertEqual(self.earth_state(), committed)
        self.page.screenshot(path=str(self.output / 'earth-demo-cinematic-closeup.png'), full_page=True)
        self.page.locator('#play').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>6.75")
        wide_camera = self.page.evaluate(camera)
        self.assertLess(wide_camera['scale'], close_camera['scale']*.8,
                        'Playback must pull back from the close-up before the next checkpoint.')
        self.assertLess(wide_camera['scale'], 1.1)
        self.page.locator('#play').click()
        self.assert_tutorial_healthy()

    def test_reduced_motion_watch_changes_the_globe_without_a_demo_pulse_and_manual_input_pauses_it(self):
        before = self.pixels()
        self.page.locator('#play').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>2.1")
        self.assertEqual(self.page.locator('.earth-coordinates').text_content(), '16° N / 65° W')
        self.assertNotEqual(self.pixels(), before)
        self.assertFalse(self.demo_click()['visible'])
        self.page.locator('canvas.earth-globe').press('ArrowRight')
        self.page.wait_for_function("document.querySelector('#stage').dataset.status==='paused'")
        self.assertEqual(self.page.locator('.earth-coordinates').text_content(), '16° N / 53° W')
        state, pixels = self.earth_state(), self.pixels()
        self.seek(2.1)
        self.assertFalse(self.demo_click()['visible'])
        self.assertEqual(self.earth_state(), state)
        self.assertEqual(self.pixels(), pixels)
        self.assert_tutorial_healthy()

    def test_same_value_manual_control_takes_over_watch_without_completing_a_checkpoint(self):
        initial, pixels = self.earth_state(), self.pixels()
        selected = self.page.locator('button[data-earth-metric="population"]')
        self.assertEqual(selected.get_attribute('aria-pressed'), 'true')
        self.page.locator('#play').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>.25")
        selected.click()
        self.page.wait_for_function("document.querySelector('#stage').dataset.status==='paused'")
        position = self.page.locator('#seek').input_value()
        self.assertLess(float(position), 1.8, 'Manual input must stop the tour before its automatic action.')
        self.page.wait_for_timeout(200)
        self.assertEqual(self.page.locator('#seek').input_value(), position)
        self.assertEqual(self.earth_state(), initial)
        self.assertEqual(self.pixels(), pixels)
        self.assertEqual(self.page.locator('#earth-progress').text_content(), '0 / 8 controls demonstrated')
        self.assert_tutorial_healthy()

    def test_manual_pointer_and_keyboard_click_feedback_is_bounded_and_respects_motion_preference(self):
        self.page.evaluate("""()=>{
          window.earthManualClicks=[];
          new MutationObserver(records=>{
            for(const record of records)for(const node of record.addedNodes){
              if(node.nodeType!==1||node.dataset.source!=='manual'||!node.isConnected)continue;
              const ring=node.querySelector('.earth-click-ring');
              window.earthManualClicks.push({static:node.dataset.static,width:parseFloat(getComputedStyle(ring).width),
                pointerEvents:getComputedStyle(node).pointerEvents,hidden:node.closest('.earth-click-layer').getAttribute('aria-hidden'),
                count:document.querySelectorAll('.earth-click-feedback[data-source="manual"]').length});
            }
          }).observe(document.querySelector('.earth-click-layer'),{childList:true});
        }""")
        for preference in ['no-preference', 'reduce']:
            self.page.emulate_media(reduced_motion=preference)
            reduced = preference == 'reduce'
            self.page.wait_for_function("value=>document.querySelector('.earth-app').dataset.earthReducedMotion===String(value)", arg=reduced)
            before = self.page.evaluate('window.earthManualClicks.length')
            self.assert_globe_changed(lambda: self.page.locator('canvas.earth-globe').press('ArrowRight'))
            self.assert_globe_changed(lambda: self.page.locator('[data-earth-layer="night"]').click())
            self.page.locator('canvas.earth-globe').focus()
            for _ in range(4):
                self.page.keyboard.press('ArrowLeft')
            self.page.wait_for_function('before=>window.earthManualClicks.length>=before+6', arg=before)
            clicks = self.page.evaluate('before=>window.earthManualClicks.slice(before)', before)
            for click in clicks:
                self.assertEqual(click['static'], str(reduced).lower(), click)
                self.assertEqual(click['pointerEvents'], 'none', click)
                self.assertEqual(click['hidden'], 'true', click)
                self.assertGreater(click['width'], 0, click)
                self.assertLessEqual(click['count'], 3, click)
                if reduced:
                    self.assertEqual(click['width'], 28, click)
            self.page.wait_for_function("document.querySelectorAll('.earth-click-feedback[data-source=manual]').length===0", timeout=2000)
        self.assert_tutorial_healthy()

    def test_all_eight_try_checkpoints_require_real_controls_and_change_globe_pixels(self):
        self.mode('try')
        self.assert_tutorial_healthy()
        actions = [
            ('earth.overview', lambda: self.page.locator('canvas.earth-globe').press('ArrowRight')),
            ('earth.zoom-in', lambda: self.page.locator('[data-earth-zoom="in"]').click()),
            ('earth.zoom-out', lambda: self.page.locator('[data-earth-zoom="out"]').click()),
            ('earth.metric', lambda: self.page.locator('button[data-earth-metric="energy"]').click()),
            ('earth.year', self.change_year),
            ('earth.region', lambda: self.page.locator('.earth-region').select_option('asia')),
            ('earth.connections', lambda: self.page.locator('[data-earth-layer="connections"]').click()),
            ('earth.lighting', lambda: self.page.locator('[data-earth-layer="night"]').click()),
        ]
        for index, (scene, action) in enumerate(actions):
            self.gate(scene)
            self.assert_tutorial_healthy()
            self.assert_globe_changed(action)
            self.page.wait_for_function("document.querySelector('#stage').dataset.state!=='waiting'")
            self.assert_tutorial_healthy()
            self.assertEqual(self.page.locator('#earth-progress').text_content(), f'{index+1} / 8 controls explored')
        state, pixels = self.earth_state(), self.pixels()
        self.page.locator('#restart').click()
        self.assert_tutorial_healthy()
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'), 'earth.overview')
        self.assertEqual(self.page.locator('#current-time').inner_text(), '00:00')
        self.assertEqual(float(self.page.locator('#seek').input_value()), 0)
        self.assertEqual(self.earth_state(), state)
        self.assertEqual(self.pixels(), pixels)
        self.page.screenshot(path=str(self.output / 'earth-demo-completed-controls.png'), full_page=True)
        self.page.locator('#play').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>.25 && document.querySelector('#stage').dataset.state==='playing'")
        self.assert_tutorial_healthy()
        self.page.locator('#play').click()
        self.page.locator('#earth-reset').click()
        self.page.wait_for_function("document.querySelector('#earth-progress').textContent.startsWith('0 / 8')")
        self.page.wait_for_function("!document.querySelector('#earth-reset').disabled")
        self.assertNotEqual(self.page.locator('#stage').get_attribute('data-status'), 'error')
        self.assertEqual(self.page.locator('#toast').text_content(), 'Practice reset. Start again whenever you are ready.')
        self.assertEqual(self.earth_state(), {
            'earthMetric': 'population', 'earthYear': '2000', 'earthRegion': 'world',
            'earthConnections': 'false', 'earthNight': 'false', 'earthZoom': '1'})

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
        self.page.wait_for_function("document.querySelector('#stage').dataset.scene==='earth.zoom-in'")
        self.page.locator('button[data-earth-metric="energy"]').click()
        self.mode('watch')
        self.assertEqual(self.earth_state()['earthMetric'], 'population')
        self.mode('guide')
        self.assertEqual(self.earth_state()['earthMetric'], 'energy')

    def test_canonical_earth_export_and_transcript_contain_all_eight_controls_without_audio(self):
        self.page.locator('#script-open').click()
        script = json.loads(self.page.locator('#script-json').inner_text())
        self.assertEqual(script['schemaVersion'], '0.1.0-draft.1')
        self.assertEqual(script['id'], 'earth-statistics')
        self.assertEqual(script['assets'], {})
        self.assertEqual(len(script['scenes']), 8)
        self.assertTrue(all(any(cue['kind']=='gate' for cue in scene['cues']) for scene in script['scenes']))
        for scene in script['scenes']:
            actions = [cue for cue in scene['cues'] if cue['kind'] == 'action']
            self.assertEqual(len(actions), 1)
            self.assertEqual(actions[0]['actionRef'], scene['id'])
            gate = next(cue for cue in scene['cues'] if cue['kind'] == 'gate')
            self.assertEqual(actions[0]['at'], gate['at'])
            self.assertLess(scene['cues'].index(actions[0]), scene['cues'].index(gate))
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#script-open').evaluate('el=>el===document.activeElement'))
        self.page.locator('#transcript-toggle').click()
        self.assertEqual(self.page.locator('#transcript button').count(), 8)

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
            self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'), 'earth.overview')
            self.assertLessEqual(float(self.page.locator('#seek').input_value()), 1.8)
            self.assertEqual(self.earth_state(), state)
            self.assertEqual(self.pixels(), pixels)
        self.assertTrue(self.page.locator('#earth-progress').text_content().startswith('0 / 8'))

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
            'earthConnections': 'false', 'earthNight': 'false', 'earthZoom': '1'})
        self.assertEqual(self.pixels(), before)

    def test_mobile_reduced_motion_has_keyboard_controls_captions_and_exit(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.mode('try')
        self.gate('earth.overview')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.assertFalse(self.page.locator('#caption').is_hidden())
        self.assertEqual(self.page.locator('#stage').get_attribute('data-reduced-motion'), 'true')
        self.assert_globe_changed(lambda: self.page.locator('canvas.earth-globe').press('ArrowRight'))
        self.gate('earth.zoom-in')
        self.assert_globe_changed(lambda: self.page.locator('[data-earth-zoom="in"]').press('Enter'))
        self.gate('earth.zoom-out')
        self.assert_globe_changed(lambda: self.page.locator('canvas.earth-globe').press('-'))
        for direction in ['in', 'out']:
            button = self.page.locator('[data-earth-zoom="'+direction+'"]')
            box = button.bounding_box()
            self.assertGreaterEqual(box['width'], 38)
            self.assertGreaterEqual(box['height'], 38)
            self.assertTrue(button.is_visible())
        self.assertEqual(self.earth_state()['earthZoom'], '1')
        self.assertEqual(self.page.locator('#earth-progress').text_content(), '3 / 8 controls explored')
        self.page.screenshot(path=str(self.output / 'earth-demo-mobile.png'), full_page=True)
        self.page.locator('#exit-tour').click()
        self.assertNotEqual(self.page.locator('#stage').get_attribute('data-state'), 'playing')

    def test_mobile_cinematic_framing_fills_the_stage_and_keeps_zoom_controls_visible(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.wait_for_function("document.querySelector('#stage').dataset.reducedMotion==='false'")
        geometry = """()=>{
          const stage=document.querySelector('#stage'),scene=document.querySelector('#scene');
          const rectangle=element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
          const matrix=new DOMMatrix(getComputedStyle(scene).transform);
          return {scale:matrix.a,stage:rectangle(stage),scene:rectangle(scene),
            zoom:rectangle(document.querySelector('[data-earth-zoom="in"]'))};
        }"""
        self.page.locator('#play').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>=1.65 && document.querySelector('#stage').dataset.scene==='earth.overview'")
        opening = self.page.evaluate(geometry)
        self.assertGreater(opening['scale'], 1.5, 'Mobile playback must visibly push into the planet.')
        for edge in ['left', 'top']:
            self.assertLessEqual(opening['scene'][edge], opening['stage'][edge]+2, opening)
        for edge in ['right', 'bottom']:
            self.assertGreaterEqual(opening['scene'][edge], opening['stage'][edge]-2, opening)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        # Resolve the first host action through playback before seeking to the
        # next control's completed close-up, just before its own action barrier.
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>2.1 && document.querySelector('#earth-progress').textContent.startsWith('1 / 8')")
        self.page.locator('#play').click()
        self.page.locator('#stage').screenshot(path=str(self.output / 'earth-demo-mobile-cinematic-planet.png'))
        self.seek(8.6)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'), 'earth.zoom-in')
        self.assertEqual(self.page.locator('#stage').get_attribute('data-status'), 'paused')
        focus = self.page.evaluate(geometry)
        self.assertGreater(focus['scale'], 1.5)
        for edge in ['left', 'top']:
            self.assertGreaterEqual(focus['zoom'][edge], focus['stage'][edge]-2, focus)
        for edge in ['right', 'bottom']:
            self.assertLessEqual(focus['zoom'][edge], focus['stage'][edge]+2, focus)
        self.assertEqual(self.earth_state()['earthZoom'], '1', 'Seeking to a zoom control must not activate it.')
        self.page.locator('#stage').screenshot(path=str(self.output / 'earth-demo-mobile-cinematic-zoom-control.png'))
        self.page.locator('#play').click()
        self.page.wait_for_function("document.querySelector('.earth-app').dataset.earthZoom==='1.65' && Number(document.querySelector('#seek').value)>9")
        self.page.locator('#play').click()
        self.assertTrue(self.page.locator('#earth-progress').text_content().startswith('2 / 8'))
        self.assert_tutorial_healthy()

    def test_empty_viewport_pauses_cleanly_and_resumes_after_layout_recovers(self):
        self.mode('try')
        state = self.earth_state()
        self.page.locator('#chapter-strip [data-scene="earth.overview"]').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>.2")
        self.page.locator('#stage').evaluate("el=>el.style.width='0px'")
        self.page.wait_for_function("document.querySelector('#stage').clientWidth===0 && document.querySelector('#stage').dataset.state!=='playing'")
        self.assert_tutorial_healthy()
        self.page.locator('#stage').evaluate("el=>el.style.removeProperty('width')")
        self.page.wait_for_function("document.querySelector('#stage').clientWidth>0")
        self.assert_tutorial_healthy()
        self.assertNotEqual(self.page.locator('#stage').get_attribute('data-state'), 'playing')
        before = float(self.page.locator('#seek').input_value())
        self.page.locator('#play').click()
        self.page.wait_for_function("before=>Number(document.querySelector('#seek').value)>before+.15 && document.querySelector('#stage').dataset.state==='playing'", arg=before)
        self.assert_tutorial_healthy()
        self.assertEqual(self.earth_state(), state)

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
        self.assertEqual(result['bounded']['zoom'], 1.75)
        self.assertGreaterEqual(result['bounded']['rotation'], -180)
        self.assertLess(result['bounded']['rotation'], 180)
        for flag in ['resets', 'inert', 'destroyed']:
            self.assertTrue(result[flag], flag)
        self.assertEqual(result['calls'], 0)

    def test_click_feedback_api_is_a_pure_sample_with_validation_and_cleanup(self):
        result = self.page.evaluate("""async()=>{
          const {createEarthApp}=await import('./earth.mjs');
          const pixels=""" + PIXELS + """;
          const root=document.createElement('div');root.inert=true;document.body.append(root);
          const calls=[],events=[];
          const app=createEarthApp({root,interactive:false,onChange:(_state,event)=>calls.push(event)});
          for(const type of ['click','input','change','pointerdown','keydown'])root.addEventListener(type,()=>events.push(type));
          const canvas=root.querySelector('canvas'),initial=JSON.stringify(app.getState()),initialPixels=pixels(canvas);
          const node=root.querySelector('.earth-click-feedback[data-source="demo"]'),ring=node.querySelector('.earth-click-ring');
          const sample=()=>({target:node.dataset.target,progress:node.dataset.progress,hidden:node.hidden,
            width:parseFloat(ring.style.width),opacity:Number(node.style.opacity),static:node.dataset.static});
          app.setReducedMotion(false);app.setClickFeedback({target:'earth.metric',progress:.5});
          const normal=sample();let rejected=0;
          const observer=new MutationObserver(()=>{});
          observer.observe(root.querySelector('.earth-click-layer'),{subtree:true,attributes:true,childList:true});
          for(let i=0;i<3;i++)app.setClickFeedback({target:'earth.metric',progress:.5});
          const sameSampleMutations=observer.takeRecords().length;
          for(const invalid of [undefined,[],{},'earth.metric',{target:'unknown',progress:.5},
            {target:['earth.metric'],progress:.5},{target:'earth.metric',progress:-.1},
            {target:'earth.metric',progress:1.1},{target:'earth.metric',progress:NaN},
            {target:'earth.metric',progress:Infinity},{target:'earth.metric',progress:'0.5'}]){
            try{app.setClickFeedback(invalid);}catch{rejected++;}
          }
          const retained=JSON.stringify(sample())===JSON.stringify(normal);
          await new Promise(resolve=>setTimeout(resolve,100));
          const frozen=JSON.stringify(sample())===JSON.stringify(normal);
          app.setClickFeedback({target:'earth.metric',progress:1});
          const ended=node.hidden&&node.dataset.progress==='1';
          app.setClickFeedback(null);
          const cleared=node.hidden&&!node.hasAttribute('data-target')&&!node.hasAttribute('data-progress');
          observer.takeRecords();
          for(let i=0;i<3;i++)app.setClickFeedback(null);
          const repeatedClearMutations=observer.takeRecords().length;observer.disconnect();
          app.setReducedMotion(true);app.setClickFeedback({target:'earth.year',progress:.75});
          const reduced=sample(),pure=JSON.stringify(app.getState())===initial&&pixels(canvas)===initialPixels;
          const inert=app.getState().metric==='population'&&root.querySelectorAll('[data-source="manual"]').length===0;
          app.destroy();app.destroy();
          const destroyed=root.childElementCount===0&&root.inert&&root.style.position===''&&!root.classList.contains('earth-app');
          root.remove();return {normal,rejected,retained,frozen,ended,cleared,reduced,pure,inert,destroyed,calls,events,sameSampleMutations,repeatedClearMutations};
        }""")
        self.assertEqual(result['normal'], {'target': 'earth.metric', 'progress': '0.5', 'hidden': False,
                                           'width': 42, 'opacity': .5, 'static': 'false'})
        self.assertEqual(result['rejected'], 11)
        self.assertEqual(result['sameSampleMutations'], 0, 'An unchanged sample must not re-trigger the scene observer.')
        self.assertEqual(result['repeatedClearMutations'], 0, 'Repeated clearing must not re-trigger the scene observer.')
        self.assertEqual(result['reduced'], {'target': 'earth.year', 'progress': '0.75', 'hidden': False,
                                            'width': 28, 'opacity': .9, 'static': 'true'})
        for flag in ['retained', 'frozen', 'ended', 'cleared', 'pure', 'inert', 'destroyed']:
            self.assertTrue(result[flag], flag)
        self.assertEqual(result['calls'], [])
        self.assertEqual(result['events'], [])

    def test_presentation_frames_change_only_pixels_and_stay_frozen_without_a_clock_tick(self):
        result = self.page.evaluate("""async()=>{
          const {createEarthApp}=await import('./earth.mjs');
          const pixels=""" + PIXELS + """;
          const root=document.createElement('div');document.body.append(root);
          const events=[],app=createEarthApp({root,interactive:false,onChange:(_state,event)=>events.push(event)});
          app.setReducedMotion(false);
          const from=app.getState(),to={...from,rotation:-65,tilt:16,zoom:1.65,year:2025};
          app.setState(to,{animate:false});
          const committed=JSON.stringify(app.getState()),canvas=root.querySelector('canvas');
          const finalPixels=pixels(canvas),labels=root.innerText;
          app.setPresentationFrame({from,to,progress:.25});const quarter=pixels(canvas);
          app.setPresentationFrame({from,to,progress:.75});const threeQuarters=pixels(canvas);
          await new Promise(resolve=>setTimeout(resolve,120));
          const frozen=pixels(canvas)===threeQuarters;
          const observer=new MutationObserver(()=>{});observer.observe(root,{subtree:true,attributes:true,childList:true,characterData:true});
          app.setPresentationFrame({from,to,progress:.75});app.setPresentationFrame({from,to,progress:.75});
          const mutations=observer.takeRecords().length;observer.disconnect();
          const pure=JSON.stringify(app.getState())===committed&&root.innerText===labels;
          app.setPresentationFrame(null);const cleared=pixels(canvas)===finalPixels;
          app.setReducedMotion(true);app.setPresentationFrame({from,to,progress:.25});
          const reduced=pixels(canvas)===finalPixels;
          const idle=root.dataset.earthRendering==='false';
          app.destroy();root.remove();
          return {quarter,threeQuarters,finalPixels,frozen,mutations,pure,cleared,reduced,idle,events};
        }""")
        self.assertNotEqual(result['quarter'], result['threeQuarters'])
        self.assertNotEqual(result['quarter'], result['finalPixels'])
        self.assertNotEqual(result['threeQuarters'], result['finalPixels'])
        for flag in ['frozen', 'pure', 'cleared', 'reduced', 'idle']:
            self.assertTrue(result[flag], flag)
        self.assertEqual(result['mutations'], 0)
        self.assertEqual(result['events'], [])


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(case(name) for case in (StudioEarthTests, EarthDemoTests)
                              for name in case.__dict__ if name.startswith('test_'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
