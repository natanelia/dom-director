"""Motion stays continuous while selection preserves authored coordinates."""
import json
import math
import unittest
import browser_test as baseline


class StudioKeyframeTests(baseline.StudioTests):
    def test_sample_cursor_flows_across_scene_boundaries_and_seeks_exactly(self):
        project = self.project()
        boundary = 0

        def position():
            return self.page.locator('#cursor-layer > g').evaluate('''node => {
                const matrix = node.transform.baseVal.consolidate().matrix;
                return {x: matrix.e, y: matrix.f};
            }''')

        def distance(a, b):
            return math.hypot(a['x'] - b['x'], a['y'] - b['y'])

        for index, scene in enumerate(project['scenes'][:-1]):
            boundary += scene['durationMs']
            self.seek((boundary - 1) / 1000)
            before = position()
            self.seek(boundary / 1000)
            at = position()
            self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'),
                             project['scenes'][index + 1]['id'])
            self.assertLess(distance(before, at), .01,
                            'The cursor must not reset at the next scene.')
            self.seek((boundary + 1) / 1000)
            self.assertLess(distance(at, position()), .01)
            self.seek((boundary + 1200) / 1000)
            moving = position()
            self.assertGreater(distance(at, moving), 1)
            self.seek((boundary + 2500) / 1000)
            self.assertGreater(distance(moving, position()), 1)
            self.seek(0)
            self.seek((boundary + 1200) / 1000)
            self.assertLess(distance(moving, position()), .01)

        self.page.locator('#motion').click()
        self.assertEqual(self.page.locator('#cursor-layer > g').count(), 0)
        self.assertTrue(self.page.locator('#caption-overlay').is_visible())

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
