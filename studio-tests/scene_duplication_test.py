"""Whole-scene reuse through real Studio controls, including copied word dependencies."""
import json
from browser_test import StudioTests


class StudioSceneDuplicationTests(StudioTests):
    def copy_scene(self):
        self.page.locator('#scene-duplicate').click()
        self.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Scene duplicated.')")
        return self.page.locator('#scene-list [aria-current=\"step\"]').get_attribute('data-scene')

    def fixture(self, kind):
        payload = self.page.evaluate("""async kind => {
          const {createSample,editProject} = await import('./studio-sdk/index.js');
          const {distributeCaptionWords} = await import('./studio-sdk/editing.js');
          const {linkKeyframeToCaptionWord} = await import('./studio-sdk/timing-links.js');
          const {saveProjectBundle} = await import('./studio-sdk/media.js');
          let p=createSample();
          if(kind==='linked') {
            p=distributeCaptionWords(p,'cc.overview.0');
            p=linkKeyframeToCaptionWord(p,'camera.overview','camera.to.overview',{captionId:'cc.overview.0',wordIndex:1,offsetMs:200});
            p=linkKeyframeToCaptionWord(p,'cursor.overview','cursor.to.overview',{captionId:'cc.overview.0',wordIndex:1,offsetMs:300});
          }
          if(kind==='hidden')p=editProject(p,n=>n.tracks.push({id:'cc.fr',kind:'captions',name:'French',language:'fr',enabled:false,locked:false,clips:[{id:'fr.one',sceneId:'overview',startMs:0,durationMs:1500,text:'Bonjour.'}]}));
          if(kind==='locked')p=editProject(p,n=>n.tracks[2].locked=true);
          if(kind==='later-locked')p=editProject(p,n=>{n.tracks[2].clips=n.tracks[2].clips.filter(c=>c.sceneId==='story');n.tracks[2].locked=true;});
          if(kind==='limit')p=editProject(p,n=>{n.scenes=Array.from({length:60},(_,i)=>({id:'s'+i,title:'Scene '+i,durationMs:1000}));for(const t of n.tracks)t.clips=[];});
          return saveProjectBundle(p,{bytes(){throw Error('No local media expected');}});
        }""", kind)
        self.page.locator('#project-file').set_input_files({'name':'scene-fixture.director','mimeType':'application/x-dom-director','buffer':payload.encode()})
        self.page.get_by_role('button', name='Open project', exact=True).click()
        self.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Project reopened')")

    def test_copy_all_tracks_select_new_scene_and_undo_as_one_edit(self):
        before=self.project();identifier=self.copy_scene()
        self.assertTrue(self.page.locator('#scene-list [aria-current=\"step\"]').evaluate('el=>el===document.activeElement'))
        self.assertAlmostEqual(float(self.page.locator('#seek').input_value()),6.98,places=3)
        after=self.project();self.assertEqual(after['scenes'][1]['id'],identifier)
        self.assertEqual(after['assets'],before['assets'])
        for a,b in zip(after['tracks'],before['tracks']):
            copies=[c for c in a['clips'] if c['sceneId']==identifier]
            self.assertEqual(len(copies),len([c for c in b['clips'] if c['sceneId']=='overview']))
            self.assertEqual([c for c in a['clips'] if c['sceneId']!=identifier],b['clips'])
        self.page.locator('#undo').click();self.assertEqual(self.project(),before)
        self.page.locator('#redo').click();self.assertEqual(self.project(),after)

    def test_caption_edit_in_copy_is_independent_and_does_not_load_audio(self):
        before=self.project();identifier=self.copy_scene()
        self.edit('#caption-text','Only this copied scene says this.')
        after=self.project();self.assertEqual(self.clip(after,'cc.overview.0'),self.clip(before,'cc.overview.0'))
        clone=next(c for t in after['tracks'] if t['kind']=='captions' for c in t['clips'] if c['sceneId']==identifier)
        self.assertEqual(clone['text'],'Only this copied scene says this.')
        self.assertFalse([u for u in self.requests if '.mp3' in u])
        self.assertTrue(self.page.locator('#scene').evaluate('el=>el.inert'))

    def test_linked_copy_retains_links_to_its_own_words(self):
        self.fixture('linked');before=self.project();identifier=self.copy_scene();after=self.project()
        captions=[c for t in after['tracks'] if t['kind']=='captions' for c in t['clips'] if c['sceneId']==identifier]
        linked=next(c for c in captions if 'words' in c)
        for t in after['tracks']:
            for c in t['clips']:
                if c['sceneId']!=identifier:continue
                for k in c.get('keys',[]):
                    if 'timing' not in k:continue
                    self.assertEqual(k['timing']['captionId'],linked['id'])
                    self.assertIn(k['timing']['wordId'],[w.get('id') for w in linked['words']])
        self.assertEqual(self.clip(after,'camera.overview'),self.clip(before,'camera.overview'))
        self.choose('camera');self.page.locator('#inspector .key-list button').last.click()
        self.assertTrue(self.page.locator('#go-to-linked-caption').is_visible())
        self.page.locator('#go-to-linked-caption').click()
        self.assertEqual(self.page.locator('#scene-list [aria-current=\"step\"]').get_attribute('data-scene'),identifier)
        self.page.screenshot(path=str(self.output/'scene-copy-linked.png'),full_page=True)

    def test_disabled_language_is_copied_without_becoming_active(self):
        self.fixture('hidden');identifier=self.copy_scene();after=self.project()
        french=next(t for t in after['tracks'] if t['id']=='cc.fr')
        self.assertFalse(french['enabled']);self.assertEqual(after['captionTrack'],'cc.en')
        self.assertEqual(len(french['clips']),2);self.assertEqual(french['clips'][1]['sceneId'],identifier)
        self.assertEqual(french['clips'][1]['text'],'Bonjour.')

    def test_locks_and_later_locked_scene_movement_reject_without_partial_copy(self):
        for kind in ['locked','later-locked']:
            self.fixture(kind);before=self.project();self.page.locator('#scene-duplicate').click()
            self.assertIn('locked',self.page.locator('#status').inner_text())
            self.assertEqual(self.project(),before);self.assertEqual(self.page.locator('#scene-list button').count(),3)

    def test_invalid_pending_field_blocks_copy_and_keeps_typed_input(self):
        self.page.get_by_text('Scene and clip timing',exact=True).click()
        self.page.locator('#clip-end').fill('-1');self.page.locator('#scene-duplicate').click()
        self.assertEqual(self.page.locator('#scene-list button').count(),3)
        self.assertEqual(self.page.locator('#clip-end').input_value(),'-1')
        self.assertTrue(self.page.locator('#clip-end').evaluate('el=>el===document.activeElement'))
        self.page.locator('#clip-end').press('Escape');self.copy_scene()

    def test_copy_while_playing_stops_at_copied_scene_and_remains_paused(self):
        self.page.locator('#play').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>.12")
        identifier=self.copy_scene()
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'),'paused')
        position=float(self.page.locator('#seek').input_value());self.page.wait_for_timeout(180)
        self.assertAlmostEqual(float(self.page.locator('#seek').input_value()),position,places=3)
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'),identifier)

    def test_mobile_keyboard_copy_focus_and_save_reopen(self):
        self.page.set_viewport_size({'width':390,'height':844});self.page.emulate_media(reduced_motion='reduce')
        self.page.locator('#scene-duplicate').focus();self.page.keyboard.press('Enter')
        self.page.wait_for_function("document.querySelectorAll('#scene-list button').length===4")
        self.assertTrue(self.page.locator('#scene-list [aria-current=\"step\"]').evaluate('el=>el===document.activeElement'))
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.screenshot(path=str(self.output/'scene-copy-mobile.png'),full_page=True)
        bundle=self.bundle();before=json.loads(bundle.splitlines()[0])['project']
        self.page.locator('#project-file').set_input_files({'name':'copy.director','mimeType':'application/x-dom-director','buffer':bundle})
        self.page.get_by_role('button',name='Open project',exact=True).click()
        self.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Project reopened')")
        self.assertEqual(self.project(),before)

    def test_scene_limit_reports_error_without_changing_the_project(self):
        self.fixture('limit');before=self.project();self.page.locator('#scene-duplicate').click()
        self.assertIn('1–60',self.page.locator('#status').inner_text());self.assertEqual(self.project(),before)

    def test_multi_selection_does_not_turn_a_scene_copy_into_a_partial_clip_copy(self):
        before=self.project();self.page.locator('#clip-list').click();self.page.locator('#selection-scene').click()
        self.page.locator('#selection-apply').click();identifier=self.copy_scene();after=self.project()
        self.assertEqual(len([c for t in after['tracks'] for c in t['clips'] if c['sceneId']==identifier]),5)
        self.assertEqual(after['assets'],before['assets']);self.assertTrue(self.page.locator('#caption-text').is_visible())
