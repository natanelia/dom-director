"""Selection-only styling through the actual creator UI, not a second model."""
from copy import deepcopy
import unittest
from selection_test import StudioSelectionTests


class StudioAppearanceTests(StudioSelectionTests):
    def open_appearance(self, ids, source):
        self.choose_group(ids)
        self.page.locator('#selection-appearance summary').click()
        self.page.locator('#selection-style-source').select_option(source)

    def assert_only_target_style(self, before, after, target_id):
        comparison = deepcopy(after)
        before_target = self.clip(before, target_id)
        after_target = self.clip(comparison, target_id)
        if 'style' in before_target:
            after_target['style'] = before_target['style']
        else:
            after_target.pop('style', None)
        self.assertEqual(comparison, before)

    def test_caption_matching_preserves_words_links_audio_and_has_one_undo(self):
        self.fixture(linked=True)
        self.page.locator('[data-clip="cc.signal.0"]').click()
        self.edit('#caption-size', 44)
        before = self.project()
        self.open_appearance(['cc.overview.0', 'cc.signal.0'], 'cc.signal.0')
        self.page.locator('#selection-match-style').click()
        self.assertTrue(self.page.locator('#selection-match-style').evaluate('el=>el===document.activeElement'))
        self.assertEqual(self.page.locator('#selection-style-source').input_value(), 'cc.signal.0')
        after = self.project()
        self.assertEqual(self.clip(after, 'cc.overview.0')['style']['size'], 44)
        self.assert_only_target_style(before, after, 'cc.overview.0')
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)
        self.page.locator('#redo').click()
        self.assertEqual(self.project(), after)

    def test_cursor_matching_changes_look_not_path_or_gestures(self):
        self.choose('cursor')
        self.page.locator('#cursor-shape').select_option('dot')
        self.edit('#cursor-size', 40)
        before = self.project()
        self.open_appearance(['cursor.overview', 'cursor.signal'], 'cursor.overview')
        self.page.locator('#selection-match-style').click()
        after = self.project()
        self.assertEqual(self.clip(after, 'cursor.signal')['style']['shape'], 'dot')
        self.assertEqual(self.clip(after, 'cursor.signal')['style']['size'], 40)
        self.assert_only_target_style(before, after, 'cursor.signal')
        self.assertEqual(self.page.locator('#selection-heading').inner_text(), '2 clips selected')

    def test_mixed_track_groups_do_not_offer_appearance_matching(self):
        before = self.fixture()
        self.choose_group(['cc.overview.0', 'cursor.overview'])
        self.assertEqual(self.page.locator('#selection-appearance').count(), 0)
        self.choose_group(['camera.overview', 'voice.overview'])
        self.assertEqual(self.page.locator('#selection-appearance').count(), 0)
        self.assertEqual(self.project(), before)

    def test_locked_caption_group_does_not_partially_apply(self):
        self.choose('captions')
        self.edit('#caption-size', 44)
        self.open_appearance(['cc.overview.0', 'cc.signal.0'], 'cc.overview.0')
        self.page.locator('.lane[data-kind=captions] button[aria-label="Lock CC · English"]').click()
        before = self.project()
        self.page.locator('#selection-appearance summary').click()
        self.page.locator('#selection-match-style').click()
        self.assertIn('locked', self.page.locator('#status').inner_text().lower())
        self.assertEqual(self.project(), before)

    def test_mobile_keyboard_source_choice_and_saved_project_round_trip(self):
        self.choose('cursor')
        self.page.locator('#cursor-shape').select_option('hand')
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.emulate_media(reduced_motion='reduce')
        self.open_appearance(['cursor.overview', 'cursor.signal'], 'cursor.overview')
        self.page.locator('#selection-match-style').focus()
        self.page.keyboard.press('Enter')
        after = self.project()
        self.assertEqual(self.clip(after, 'cursor.signal')['style']['shape'], 'hand')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.screenshot(path=str(self.output / 'selection-appearance-mobile.png'), full_page=True)
        payload = self.bundle()
        self.page.locator('#project-file').set_input_files({'name': 'matched.director', 'mimeType': 'application/x-dom-director', 'buffer': payload})
        self.page.get_by_role('button', name='Open project', exact=True).click()
        self.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Project reopened')")
        self.assertEqual(self.project(), after)


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(StudioAppearanceTests(name) for name in StudioAppearanceTests.__dict__ if name.startswith('test_'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
