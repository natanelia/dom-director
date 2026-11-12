"""Multi-clip creator journeys. Run in all three engines, staged and public."""
import json
import unittest
from browser_test import StudioTests

IDS = ['camera.overview', 'cursor.overview', 'voice.overview', 'cc.overview.0']


class StudioSelectionTests(StudioTests):
    def fixture(self, linked=False):
        # Build a synthetic, supported file through the actual public package API.
        # No test-only globals, credentials, application effects or downloaded media.
        text = self.page.evaluate('''async linked=>{
          const {createSample,editProject,findClip}=await import('./studio-sdk/index.js');
          const {saveProjectBundle}=await import('./studio-sdk/media.js');
          const {linkKeyframeToCaptionWord}=await import('./studio-sdk/timing-links.js');
          const ids=['camera.overview','cursor.overview','voice.overview','cc.overview.0'];
          let p=editProject(createSample(),p=>{p.title='Selection fixture';
            for(const t of p.tracks){t.clips=t.clips.filter(c=>c.sceneId!=='overview'||ids.includes(c.id));
              for(const c of t.clips)if(c.sceneId==='overview'){
                c.startMs=500;c.durationMs=2000;
                if(c.keys)c.keys.forEach((k,i)=>k.atMs=i*1200);
                if(c.gestures)c.gestures[0].atMs=1400;
              }
            }
            if(linked){const c=findClip(p,'cc.overview.0').clip;c.text='Review route.';
              c.words=[{text:'Review',startMs:200,endMs:600},{text:'route.',startMs:800,endMs:1400}];}
          });
          if(linked){p=linkKeyframeToCaptionWord(p,'camera.overview','camera.to.overview',{captionId:'cc.overview.0',wordIndex:1});
            p=linkKeyframeToCaptionWord(p,'cursor.overview','cursor.to.overview',{captionId:'cc.overview.0',wordIndex:1,offsetMs:200});}
          return saveProjectBundle(p,{bytes(){throw Error('Unexpected media access');}});
        }''', linked)
        self.page.locator('#project-file').set_input_files({'name': 'selection.director', 'mimeType': 'application/x-dom-director', 'buffer': text.encode()})
        self.page.get_by_role('button', name='Open project', exact=True).click()
        self.page.wait_for_function("document.querySelector('#project-title').value==='Selection fixture'")
        self.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Project reopened')")
        return json.loads(text.splitlines()[0])['project']

    def choose_group(self, ids=IDS):
        self.page.locator('#clip-list').click()
        self.page.locator('#selection-none').click()
        for identifier in ids:
            self.page.locator('[data-selection-clip="' + identifier + '"]').check()
        self.page.locator('#selection-apply').click()
        self.page.wait_for_function("!document.querySelector('#dialog').open")
        self.assertEqual(self.page.locator('#selection-heading').inner_text(), str(len(ids)) + ' clips selected')

    def drag_start(self, identifier='camera.overview'):
        handle = self.page.locator('[data-clip="' + identifier + '"]')
        handle.scroll_into_view_if_needed()
        box = handle.bounding_box()
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        self.page.mouse.move(x, y)
        self.page.mouse.down()
        return x, y, float(self.page.locator('#timeline-zoom').input_value())

    def assert_starts(self, before, after, delta, ids=IDS):
        for identifier in ids:
            original = self.clip(before, identifier)
            result = dict(self.clip(after, identifier))
            self.assertEqual(result['startMs'], original['startMs'] + delta)
            result['startMs'] = original['startMs']
            self.assertEqual(result, original)

    def test_modifier_selection_and_checkbox_selection_do_not_edit_project(self):
        before = self.fixture()
        self.page.locator('[data-clip="camera.overview"]').click()
        for identifier in IDS[1:]:
            self.page.locator('[data-clip="' + identifier + '"]').click(modifiers=['Shift'])
        self.assertEqual(self.page.locator('#selection-heading').inner_text(), '4 clips selected')
        self.assertEqual(self.page.locator('button[data-clip][aria-pressed=true]').count(), 4)
        self.assertEqual(self.project(), before)
        self.page.locator('[data-clip="voice.overview"]').click(modifiers=['Control'])
        self.assertEqual(self.page.locator('#selection-heading').inner_text(), '3 clips selected')
        self.page.locator('#clip-list').click()
        self.page.locator('#selection-none').click()
        self.assertTrue(self.page.locator('#selection-apply').is_disabled())
        self.page.get_by_role('button', name='Cancel', exact=True).click()
        self.assertEqual(self.page.locator('#selection-heading').inner_text(), '3 clips selected')
        self.assertEqual(self.project(), before)

    def test_exact_move_preserves_sources_and_is_one_undo_step(self):
        before = self.fixture()
        self.choose_group()
        self.page.locator('#selection-offset').fill('0.333')
        self.page.locator('#selection-move').click()
        after = self.project()
        self.assert_starts(before, after, 333)
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)
        self.page.locator('#redo').click()
        self.assertEqual(self.project(), after)

    def test_group_drag_updates_all_tracks_then_commits_once(self):
        before = self.fixture()
        self.choose_group()
        self.page.locator('#snap').uncheck()
        x, y, scale = self.drag_start()
        self.page.mouse.move(x + scale, y, steps=5)
        self.page.wait_for_function("document.querySelectorAll('button[data-clip][data-selection-drag=valid]').length===4")
        self.page.mouse.up()
        self.assert_starts(before, self.project(), 1000)
        self.assertEqual(self.page.locator('#selection-heading').inner_text(), '4 clips selected')
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)

    def test_group_drag_escape_and_invalid_release_never_apply_last_valid_position(self):
        before = self.fixture()
        self.choose_group()
        self.page.locator('#snap').uncheck()
        for cancel in [True, False]:
            x, y, scale = self.drag_start()
            self.page.mouse.move(x + scale, y, steps=4)
            self.page.wait_for_function("document.querySelectorAll('button[data-clip][data-selection-drag=valid]').length===4")
            if cancel:
                self.page.keyboard.press('Escape')
            else:
                self.page.mouse.move(x - scale, y, steps=4)
                self.page.wait_for_function("!!document.querySelector('[data-selection-drag=invalid]')")
            self.page.mouse.up()
            self.assertEqual(self.project(), before)
            self.assertEqual(self.page.locator('#selection-heading').inner_text(), '4 clips selected')
            self.assertEqual(self.page.locator('[data-selection-drag]').count(), 0)

    def test_collisions_locked_tracks_and_ripple_refuse_all_changes(self):
        before = self.fixture()
        self.choose_group()
        self.page.locator('#selection-offset').fill('8')
        self.page.locator('#selection-move').click()
        self.assertEqual(self.project(), before)
        self.page.locator('.lane[data-kind=voice] button[aria-label="Lock Voiceover"]').click()
        locked = self.project()
        self.page.locator('#selection-offset').fill('0.25')
        self.page.locator('#selection-move').click()
        self.assertIn('locked', self.page.locator('#status').inner_text().lower())
        self.assertEqual(self.project(), locked)
        self.page.locator('.lane[data-kind=voice] button[aria-label="Unlock Voiceover"]').click()
        self.page.locator('#ripple').check()
        self.page.locator('#selection-move').click()
        self.assertIn('Ripple off', self.page.locator('#status').inner_text())
        self.assertEqual(self.project(), before)

    def test_linked_dependencies_are_explicit_and_move_with_caption_words(self):
        before = self.fixture(linked=True)
        self.choose_group(['camera.overview', 'voice.overview'])
        self.page.locator('#selection-move').click()
        self.assertIn('Include linked', self.page.locator('#status').inner_text())
        self.assertEqual(self.project(), before)
        self.page.locator('#selection-linked').click()
        self.assertEqual(self.page.locator('#selection-heading').inner_text(), '4 clips selected')
        self.page.locator('#selection-move').click()
        self.assert_starts(before, self.project(), 250)

    def test_group_duplicate_remaps_links_and_delete_has_one_undo(self):
        before = self.fixture(linked=True)
        self.choose_group()
        self.page.locator('#selection-offset').fill('2.5')
        self.page.locator('#duplicate').click()
        after = self.project()
        originals = {c['id'] for t in before['tracks'] for c in t['clips']}
        copies = [c for t in after['tracks'] for c in t['clips'] if c['id'] not in originals]
        self.assertEqual(len(copies), 4)
        caption = next(c for c in copies if 'words' in c)
        links = [k['timing'] for c in copies for k in c.get('keys', []) if 'timing' in k]
        self.assertEqual(len(links), 2)
        self.assertTrue(all(link['captionId'] == caption['id'] for link in links))
        copied_word_ids = {w['id'] for w in caption['words'] if 'id' in w}
        original_word_ids = {w['id'] for w in self.clip(before, 'cc.overview.0')['words'] if 'id' in w}
        self.assertTrue(all(link['wordId'] in copied_word_ids for link in links))
        self.assertTrue(copied_word_ids.isdisjoint(original_word_ids))
        self.assertNotIn('id', caption['words'][0])
        self.page.locator('#delete-clip').click()
        self.assertEqual(self.project(), before)
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), after)

    def test_keyboard_nudges_group_and_single_selection_returns_to_normal_inspector(self):
        before = self.fixture()
        self.choose_group()
        self.page.locator('[data-clip="camera.overview"]').focus()
        self.page.keyboard.press('ArrowRight')
        self.assert_starts(before, self.project(), 10)
        self.page.locator('[data-clip="camera.overview"]').focus()
        self.page.keyboard.press('Shift+ArrowLeft')
        self.assert_starts(before, self.project(), -90)
        self.page.locator('[data-timeline-key="camera.to.overview"]').click()
        self.assertEqual(self.page.locator('#selection-heading').count(), 0)
        self.assertEqual(self.page.locator('button[data-clip][aria-pressed=true]').count(), 1)
        self.assertTrue(self.page.locator('#key-time').is_visible())

    def test_group_split_and_trim_leave_the_project_unchanged(self):
        before = self.fixture()
        self.choose_group()
        self.seek(1.5)
        self.page.locator('#split').click()
        self.assertIn('Select one clip', self.page.locator('#status').inner_text())
        self.assertEqual(self.project(), before)
        edge = self.page.locator('[data-clip="camera.overview"] [data-trim=end]')
        edge.scroll_into_view_if_needed()
        box = edge.bounding_box()
        self.page.mouse.move(box['x'] + 2, box['y'] + 10)
        self.page.mouse.down()
        self.page.mouse.move(box['x'] + 40, box['y'] + 10)
        self.page.mouse.up()
        self.assertEqual(self.project(), before)

    def test_loop_uses_group_bounding_range_and_new_project_clears_selection(self):
        self.fixture()
        self.choose_group()
        self.page.locator('#loop').click()
        self.seek(2.4)
        self.page.locator('#play').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)<1.5")
        self.assertTrue(self.page.locator('#loop').get_attribute('aria-pressed') == 'true')
        self.page.locator('#stop').click()
        self.fixture()
        self.assertEqual(self.page.locator('#selection-heading').count(), 0)
        self.assertEqual(self.page.locator('button[data-clip][aria-pressed=true]').count(), 1)

    def test_mobile_checkbox_selection_and_key_access_without_modifier_keys(self):
        before = self.fixture()
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.emulate_media(reduced_motion='reduce')
        self.page.locator('#clip-list').click()
        self.page.locator('#selection-scene').focus()
        self.page.keyboard.press('Enter')
        actions = self.page.locator('#dialog-actions').bounding_box()
        self.assertGreaterEqual(actions['y'], 0)
        self.assertLessEqual(actions['y'] + actions['height'], self.page.viewport_size['height'])
        self.page.screenshot(path=str(self.output / 'selection-mobile-dialog.png'), full_page=True)
        self.page.locator('#selection-apply').click()
        self.assertEqual(self.page.locator('#selection-heading').inner_text(), '4 clips selected')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.locator('#selection-offset').fill('0.125')
        self.page.locator('#selection-move').focus()
        self.page.keyboard.press('Enter')
        self.assert_starts(before, self.project(), 125)

    def test_selection_magnets_use_playhead_and_cancellation_keeps_their_styles(self):
        before = self.fixture()
        self.choose_group()
        self.seek(1.267)
        self.page.locator('#timeline-zoom').evaluate("el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));}")
        original = self.page.locator('[data-clip="camera.overview"]').get_attribute('style')
        x, y, scale = self.drag_start()
        self.page.mouse.move(x + .74 * scale, y, steps=4)
        self.page.wait_for_function("document.querySelector('#snap-guide').dataset.time==='1267' && !document.querySelector('#snap-guide').hidden")
        self.page.keyboard.press('Escape')
        self.page.mouse.up()
        self.assertEqual(self.page.locator('[data-clip="camera.overview"]').get_attribute('style'), original)
        self.assertEqual(self.project(), before)


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(StudioSelectionTests(name) for name in StudioSelectionTests.__dict__ if name.startswith('test_'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
