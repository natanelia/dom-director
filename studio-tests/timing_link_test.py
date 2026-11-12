"""Creator journeys for persistent word links; no microphone or provider calls.

The same cases run through review_test.py against staged and verified public bytes.
"""
import json
import unittest
from browser_test import StudioTests


class StudioTimingLinkTests(StudioTests):
    caption_id = 'cc.overview.0'

    def words(self):
        self.choose('captions')
        details = self.page.locator('details[data-section="Word highlighting"]')
        if not details.evaluate('el=>el.open'):
            details.locator('summary').click()
        if self.page.locator('#add-word-timing').count():
            self.page.locator('#add-word-timing').click()

    def motion_key(self, kind='camera'):
        self.choose(kind)
        self.page.locator('.key-list [data-key="' + kind + '.to.overview"]').click()

    def link(self, kind='camera', word='1', boundary='start', offset=0):
        self.motion_key(kind)
        self.page.locator('#link-word-open').click()
        self.page.locator('#link-word').select_option(word)
        self.page.locator('#link-boundary').select_option(boundary)
        self.page.locator('#link-offset').fill(str(offset))
        self.assertEqual(self.page.locator('#link-result').get_attribute('data-state'), 'ready')
        self.page.locator('#link-apply').click()
        self.assertFalse(self.page.locator('#dialog').is_visible())

    def key(self, project, kind='camera'):
        return next(k for k in self.clip(project, kind + '.overview')['keys'] if k['id'] == kind + '.to.overview')

    def test_link_is_explicit_and_preserves_voice_and_other_keys(self):
        self.words()
        before = self.project()
        self.motion_key()
        self.page.locator('#link-word-open').click()
        self.page.locator('#link-word').select_option('1')
        self.assertEqual(self.page.locator('#link-result').get_attribute('data-state'), 'ready')
        self.page.get_by_role('button', name='Cancel', exact=True).click()
        self.assertEqual(self.project(), before)
        self.link(offset=17)
        after = self.project()
        word = self.clip(after, self.caption_id)['words'][1]
        self.assertEqual(after['studioVersion'], '0.1.0-draft.2')
        self.assertEqual(self.key(after)['timing'], {'captionId': self.caption_id, 'wordId': word['id'], 'boundary': 'start', 'offsetMs': 17})
        self.assertEqual(self.key(after)['atMs'], word['startMs'] + 17)
        self.assertEqual(after['assets'], before['assets'])
        for kind in ['voice', 'cursor']:
            self.assertEqual(self.clip(after, kind + '.overview'), self.clip(before, kind + '.overview'))
        self.assertEqual(self.clip(after, 'camera.overview')['keys'][0], self.clip(before, 'camera.overview')['keys'][0])
        self.assertIn('persistent link', self.page.locator('#motion-sync').inner_text())
        self.assertEqual(self.page.locator('[data-timeline-key="camera.to.overview"]').get_attribute('data-word-linked'), 'true')
        self.assertFalse([u for u in self.requests if '.mp3' in u])

    def test_word_edit_moves_camera_and_cursor_in_one_undoable_step(self):
        self.words()
        self.link('camera')
        self.link('cursor')
        before = self.project()
        original = self.clip(before, self.caption_id)['words'][1]['startMs']
        self.page.locator('#go-to-linked-caption').click()
        self.assertEqual(self.page.locator('#caption-links [data-inspect-link]').count(), 2)
        self.edit('#word-1-startMs', f'{(original + 101) / 1000:.3f}')
        after = self.project()
        for kind in ['camera', 'cursor']:
            self.assertEqual(self.key(after, kind)['atMs'], original + 101)
            self.assertEqual(self.key(after, kind)['timing'], self.key(before, kind)['timing'])
        self.assertEqual(self.clip(after, 'voice.overview'), self.clip(before, 'voice.overview'))
        self.assertIn(f'{(original + 101) / 1000:.3f}s', self.page.locator('#caption-links').inner_text())
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)
        self.page.locator('#redo').click()
        self.assertEqual(self.project(), after)

    def test_edit_delay_absolute_time_and_detach_keep_precise_milliseconds(self):
        self.words()
        self.link(offset=37)
        self.page.locator('#link-word-open').click()
        self.assertEqual(self.page.locator('#link-word').input_value(), 'current')
        self.page.locator('#link-offset').fill('137')
        self.page.locator('#link-apply').click()
        linked = self.project()
        self.assertEqual(self.key(linked)['timing']['offsetMs'], 137)
        absolute = self.key(linked)['atMs'] + 3
        self.edit('#key-time', f'{absolute / 1000:.3f}')
        precise = self.project()
        self.assertEqual(self.key(precise)['atMs'], absolute)
        self.assertEqual(self.key(precise)['timing']['offsetMs'], 140)
        self.assertIn('+140 ms', self.page.locator('#timing-link-info').inner_text())
        self.page.locator('#detach-timing-link').click()
        detached = self.project()
        self.assertNotIn('timing', self.key(detached))
        self.assertEqual(self.key(detached)['atMs'], absolute)
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), precise)

    def test_no_timed_words_has_a_clear_cc_recovery(self):
        self.motion_key()
        self.assertTrue(self.page.locator('#link-word-open').is_disabled())
        self.assertIn('No timed words', self.page.locator('#motion-sync').inner_text())
        self.page.locator('#go-to-caption-timing').click()
        self.assertTrue(self.page.locator('#caption-text').is_visible())
        self.words()
        self.motion_key()
        self.assertTrue(self.page.locator('#link-word-open').is_enabled())

    def test_locked_dependency_rejects_source_edit_and_detach_atomically(self):
        self.words()
        self.link()
        self.page.get_by_role('button', name='Lock Camera', exact=True).click()
        before = self.project()
        self.assertTrue(self.page.locator('#detach-timing-link').is_disabled())
        self.page.locator('#go-to-linked-caption').click()
        at = self.clip(before, self.caption_id)['words'][1]['startMs']
        self.edit('#word-1-startMs', f'{(at + 100) / 1000:.3f}')
        self.assertEqual(self.page.locator('#word-1-startMs').get_attribute('aria-invalid'), 'true')
        self.page.locator('#word-1-startMs').press('Escape')
        self.page.locator('#use-plain-caption').click()
        self.assertIn('locked', self.page.locator('#status').inner_text())
        self.assertFalse(self.page.locator('#dialog').is_visible())
        self.assertEqual(self.project(), before)

    def test_invalid_or_colliding_link_never_changes_the_draft(self):
        self.words()
        before = self.project()
        self.motion_key()
        self.page.locator('#link-word-open').click()
        self.page.locator('#link-word').select_option('0')  # Start at 0 collides with the first key.
        self.assertEqual(self.page.locator('#link-result').get_attribute('data-state'), 'invalid')
        self.assertTrue(self.page.locator('#link-apply').is_disabled())
        self.page.locator('#link-word').select_option('1')
        for bad in ['0.5', '180000']:
            self.page.locator('#link-offset').fill(bad)
            self.assertEqual(self.page.locator('#link-result').get_attribute('data-state'), 'invalid')
            self.assertTrue(self.page.locator('#link-apply').is_disabled())
        self.page.keyboard.press('Escape')
        self.assertEqual(self.project(), before)

    def test_caption_replacement_reviews_dependencies_and_undo_restores_them(self):
        self.words()
        self.link()
        self.link('cursor')
        before = self.project()
        self.page.locator('#go-to-linked-caption').click()
        self.edit('#caption-text', 'Replacement caption with corrected text.')
        self.assertEqual(self.page.locator('#caption-link-review li').count(), 2)
        self.page.get_by_role('button', name='Cancel', exact=True).click()
        self.assertEqual(self.project(), before)
        self.edit('#caption-text', 'Replacement caption with corrected text.')
        self.page.locator('#confirm-caption-edit').click()
        after = self.project()
        caption = self.clip(after, self.caption_id)
        self.assertEqual(caption['text'], 'Replacement caption with corrected text.')
        self.assertNotIn('words', caption)
        for kind in ['camera', 'cursor']:
            self.assertNotIn('timing', self.key(after, kind))
            self.assertEqual(self.key(after, kind)['atMs'], self.key(before, kind)['atMs'])
        self.assertEqual(self.clip(after, 'voice.overview'), self.clip(before, 'voice.overview'))
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)

    def test_cancel_and_escape_restore_caption_focus_without_stealing_new_dialog_focus(self):
        self.words()
        self.link()
        self.page.locator('#go-to-linked-caption').click()
        before = self.project()
        for plain in [False, True]:
            for escape in [False, True]:
                if plain:
                    self.page.locator('#use-plain-caption').click()
                else:
                    self.edit('#caption-text', 'An uncommitted text correction.')
                self.assertTrue(self.page.locator('#dialog').is_visible())
                if escape:
                    self.page.keyboard.press('Escape')
                else:
                    self.page.get_by_role('button', name='Cancel', exact=True).click()
                self.page.wait_for_function("document.querySelector('#caption-text')===document.activeElement")
                self.assertEqual(self.project(), before)
        self.page.locator('#use-plain-caption').click()
        # A host opens another modal before the old queued close event is dispatched.
        self.page.evaluate("""()=>{
            [...document.querySelectorAll('#dialog-actions button')].find(b=>b.textContent==='Cancel').click();
            document.querySelector('#export-open').click();
        }""")
        self.assertTrue(self.page.locator('#dialog').is_visible())
        self.page.wait_for_timeout(50)
        self.assertTrue(self.page.locator('#dialog').evaluate('el=>el.contains(document.activeElement)'))
        self.page.keyboard.press('Escape')
        self.assertEqual(self.project(), before)

    def test_plain_caption_requires_review_and_keeps_resolved_key_time(self):
        self.words()
        self.link()
        before = self.project()
        self.page.locator('#go-to-linked-caption').click()
        self.page.locator('#use-plain-caption').click()
        self.assertIn('Detach links', self.page.locator('#confirm-caption-edit').inner_text())
        self.page.locator('#confirm-caption-edit').click()
        after = self.project()
        self.assertNotIn('words', self.clip(after, self.caption_id))
        self.assertNotIn('timing', self.key(after))
        self.assertEqual(self.key(after)['atMs'], self.key(before)['atMs'])
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)

    def test_delete_linked_caption_keeps_motion_and_undo_restores_source(self):
        self.words()
        self.link()
        before = self.project()
        self.page.locator('#go-to-linked-caption').click()
        self.page.locator('#delete-clip').click()
        self.assertIn('Delete linked caption', self.page.locator('#dialog-title').inner_text())
        self.page.locator('#confirm-caption-edit').click()
        after = self.project()
        self.assertFalse(any(c['id'] == self.caption_id for t in after['tracks'] for c in t['clips']))
        self.assertEqual(self.key(after)['atMs'], self.key(before)['atMs'])
        self.assertNotIn('timing', self.key(after))
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)

    def test_save_reopen_and_hidden_language_preserve_exact_link_identity(self):
        self.words()
        self.link()
        saved = self.bundle()
        expected = json.loads(saved.splitlines()[0])['project']
        self.page.locator('#detach-timing-link').click()
        self.page.locator('#project-file').set_input_files({'name': 'links.director', 'mimeType': 'application/octet-stream', 'buffer': saved})
        self.page.get_by_role('button', name='Open project', exact=True).click()
        self.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Project reopened')")
        self.assertEqual(self.project(), expected)
        self.page.get_by_role('button', name='Hide CC · English', exact=True).click()
        self.motion_key()
        self.assertIn('source language hidden', self.page.locator('#timing-link-info').inner_text())
        self.page.locator('#link-word-open').click()
        self.assertEqual(self.page.locator('#link-word').input_value(), 'current')
        self.page.locator('#link-boundary').select_option('end')
        self.page.locator('#link-offset').fill('17')
        self.page.locator('#link-apply').click()
        result = self.project()
        key = self.key(result)
        self.assertEqual(key['timing']['wordId'], self.key(expected)['timing']['wordId'])
        self.assertEqual(key['timing']['captionId'], self.caption_id)
        self.assertEqual(key['atMs'], self.clip(expected, self.caption_id)['words'][1]['endMs'] + 17)

    def test_split_motion_uses_source_coordinates_without_changing_the_other_half(self):
        self.words()
        self.link()
        self.seek(.2)
        self.page.locator('#split').click()
        split = self.project()
        right = next(c for t in split['tracks'] if t['kind'] == 'camera' for c in t['clips'] if c['sceneId'] == 'overview' and c['startMs'] == 200)
        self.page.locator('.clip[data-clip="' + right['id'] + '"]').click()
        key_id = next(k['id'] for k in right['keys'] if k.get('timing'))
        self.page.locator('.key-list [data-key="' + key_id + '"]').click()
        self.page.locator('#link-word-open').click()
        self.page.locator('#link-offset').fill('17')
        self.page.locator('#link-apply').click()
        after = self.project()
        new = next(k for k in self.clip(after, right['id'])['keys'] if k['id'] == key_id)
        self.assertEqual(new['atMs'], self.clip(after, self.caption_id)['words'][1]['startMs'] + 17)
        self.assertEqual(self.clip(after, 'camera.overview'), self.clip(split, 'camera.overview'))
        self.assertIn(f"{(new['atMs'] - 200) / 1000:.3f}s", self.page.locator('#timing-link-info').inner_text())

    def test_link_review_rejects_an_external_revision_change(self):
        self.words()
        self.motion_key()
        self.page.locator('#link-word-open').click()
        self.page.locator('#link-word').select_option('1')
        # Synthetic concurrent host edit while the native modal blocks normal pointer input.
        self.page.locator('#undo').evaluate('el=>el.click()')
        self.page.locator('#link-apply').click()
        self.assertIn('project changed', self.page.locator('#link-result').inner_text().lower())
        self.assertTrue(self.page.locator('#link-apply').is_disabled())
        self.page.keyboard.press('Escape')
        current = self.project()
        self.assertNotIn('words', self.clip(current, self.caption_id))
        self.assertNotIn('timing', self.key(current))

    def test_new_key_does_not_inherit_the_selected_keys_caption_link(self):
        self.words()
        self.link()
        self.edit('#camera-zoom', '1.4')
        before = self.project()
        self.seek(2)
        self.page.locator('#add-key').click()
        after = self.project()
        keys = self.clip(after, 'camera.overview')['keys']
        self.assertEqual(len(keys), 3)
        new = next(k for k in keys if k['id'] not in {k['id'] for k in self.clip(before, 'camera.overview')['keys']})
        self.assertNotIn('timing', new)
        self.assertEqual(self.key(after), self.key(before))

    def test_crowded_key_targets_remain_separate_at_their_exact_time_positions(self):
        self.words()
        self.link()
        self.seek(.01)
        self.page.locator('#add-key').click()
        before = self.project()
        ids = [k['id'] for k in self.clip(before, 'camera.overview')['keys']]
        self.assertEqual(len(ids), 3)
        for zoom in [20, 40, 180]:
            self.page.locator('#timeline-zoom').evaluate(
                '(el,value)=>{el.value=String(value);el.dispatchEvent(new Event("input",{bubbles:true}));}', zoom)
            boxes = self.page.locator('.lane[data-kind="camera"] [data-timeline-key]:not([hidden])').evaluate_all("""keys=>keys.map(el=>{
                const b=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();
                return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height,
                    point:b.left-parent.left+parseFloat(el.style.getPropertyValue('--key-center')),time:Number(el.dataset.keyTime)};
            })""")
            for i, box in enumerate(boxes):
                self.assertGreaterEqual(box['width'], 24)
                self.assertGreaterEqual(box['height'], 24)
                self.assertAlmostEqual(box['point'], box['time'] / 1000 * zoom, delta=.06)
                for other in boxes[:i]:
                    self.assertTrue(box['right'] <= other['left'] or box['left'] >= other['right'] or
                                    box['bottom'] <= other['top'] or box['top'] >= other['bottom'])
            for key_id in ids:
                button = self.page.locator('[data-timeline-key="' + key_id + '"]')
                button.click()
                self.assertEqual(button.get_attribute('aria-pressed'), 'true')
            self.assertEqual(self.project(), before, 'Reflowing or selecting keys must not change timing.')

    def test_keyboard_mobile_and_dependency_navigation_are_usable(self):
        self.words()
        self.motion_key()
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.emulate_media(reduced_motion='reduce')
        self.page.locator('#link-word-open').focus()
        self.page.keyboard.press('Enter')
        self.assertTrue(self.page.locator('#link-word').evaluate('el=>el===document.activeElement'))
        self.page.locator('#link-word').select_option('1')
        self.page.locator('#link-apply').focus()
        self.page.keyboard.press('Enter')
        self.assertTrue(self.page.locator('#link-word-open').evaluate('el=>el===document.activeElement'))
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.screenshot(path=str(self.output / 'word-link-mobile.png'), full_page=True)
        self.page.locator('#go-to-linked-caption').click()
        self.page.locator('#caption-links [data-inspect-link]').first.click()
        self.assertTrue(self.page.locator('#key-time').evaluate('el=>el===document.activeElement'))
        self.assertTrue(self.page.locator('#scene').evaluate('el=>el.inert'))


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(StudioTimingLinkTests(name) for name in StudioTimingLinkTests.__dict__ if name.startswith('test_'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
