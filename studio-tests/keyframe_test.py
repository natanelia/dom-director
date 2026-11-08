"""Selecting an existing keyframe must never round its authored coordinates."""
import json
import unittest
import browser_test as baseline


class StudioKeyframeTests(baseline.StudioTests):
    def test_clicking_fractional_keyframe_handles_is_selection_not_an_edit(self):
        saved = self.bundle().splitlines()
        header = json.loads(saved[0])
        key = self.clip(header['project'], 'cursor.overview')['keys'][0]
        key['x'], key['y'] = -220.25, 90.75
        saved[0] = json.dumps(header).encode()
        self.page.locator('#project-file').set_input_files({
            'name': 'fractional.director', 'mimeType': 'application/octet-stream',
            'buffer': b'\n'.join(saved) + b'\n'})
        self.page.get_by_role('button', name='Open project', exact=True).click()
        self.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Project reopened')")
        self.choose('cursor')
        before = self.project()
        revision = self.page.locator('#revision').inner_text()
        handle = self.page.locator('#edit-handles [data-key]').first
        handle.click()
        self.assertEqual(self.page.locator('#revision').inner_text(), revision)
        self.assertNotIn('Move keyframe', self.page.locator('#status').inner_text())
        self.assertEqual(self.project(), before)
        # A tiny pointer wobble still selects; do not round fractional offsets.
        handle = self.page.locator('#edit-handles [data-key]').first
        box = handle.bounding_box()
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        self.page.mouse.move(x, y)
        self.page.mouse.down()
        self.page.mouse.move(x + 2, y + 1, steps=2)
        self.page.mouse.up()
        self.assertEqual(self.page.locator('#revision').inner_text(), revision)
        self.assertEqual(self.project(), before)


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(StudioKeyframeTests(name) for name in StudioKeyframeTests.__dict__ if name.startswith('test_'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
