"""Dense key and caption-review regressions, also run against verified public bytes."""
import unittest
from timing_link_test import StudioTimingLinkTests


class StudioTimingLinkAccessibilityTests(StudioTimingLinkTests):
    def assert_key_hit_areas(self):
        lanes = self.page.locator('.motion-lane').evaluate_all('''rows => rows.map(row => {
          const scale=Number(document.querySelector('#timeline-zoom').value);
          return [...row.querySelectorAll('[data-timeline-key]')].filter(n=>!n.hidden).map(n=>{
            const r=n.getBoundingClientRect();
            return {id:n.dataset.timelineKey,x:r.x,y:r.y,width:r.width,height:r.height,
              marker:parseFloat(n.style.left)+parseFloat(n.style.getPropertyValue('--key-center')),
              expected:Number(n.dataset.keyTime)/1000*scale};
          });
        })''')
        for keys in lanes:
            for index, key in enumerate(keys):
                self.assertGreaterEqual(key['width'], 24)
                self.assertGreaterEqual(key['height'], 24)
                self.assertAlmostEqual(key['marker'], key['expected'], delta=.001)
                for other in keys[index + 1:]:
                    dx = min(key['x'] + key['width'], other['x'] + other['width']) - max(key['x'], other['x'])
                    dy = min(key['y'] + key['height'], other['y'] + other['height']) - max(key['y'], other['y'])
                    self.assertTrue(dx <= .01 or dy <= .01, (key, other))

    def test_dense_linked_keys_keep_separate_hit_areas_at_every_zoom(self):
        self.words()
        self.link()
        before = self.project()
        for width in [1440, 390]:
            self.page.set_viewport_size({'width': width, 'height': 1000})
            for zoom in [20, 40, 180]:
                self.page.locator('#timeline-zoom').evaluate('''(n,z)=>{
                  n.value=String(z);n.dispatchEvent(new Event('input',{bubbles:true}));
                }''', zoom)
                self.assert_key_hit_areas()
                for key_id in ['camera.from.overview', 'camera.to.overview']:
                    handle = self.page.locator('[data-timeline-key="' + key_id + '"]')
                    handle.click()
                    self.assertEqual(handle.get_attribute('aria-pressed'), 'true')
        self.assertEqual(self.project(), before)

    def test_dense_key_drag_cancellation_restores_the_original_layout(self):
        self.words()
        self.link()
        before = self.project()
        before_revision = self.page.locator('#revision').inner_text()
        layout = '''()=>({height:document.querySelector('.motion-lane').style.height,
          keys:[...document.querySelectorAll('.motion-lane [data-timeline-key]')].map(n=>[n.dataset.timelineKey,n.getAttribute('style')])})'''
        original = self.page.evaluate(layout)
        self.page.locator('#snap').uncheck()
        handle = self.page.locator('[data-timeline-key="camera.to.overview"]')
        handle.scroll_into_view_if_needed()
        box = handle.bounding_box()
        scale = float(self.page.locator('#timeline-zoom').input_value())
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        self.page.mouse.move(x, y)
        self.page.mouse.down()
        self.page.mouse.move(x + 2 * scale, y, steps=5)
        self.page.wait_for_function("document.querySelector('[data-timeline-key=\"camera.to.overview\"]').dataset.dragState==='valid'")
        self.assert_key_hit_areas()
        self.assertAlmostEqual(handle.bounding_box()['y'], box['y'], delta=.01)
        self.page.keyboard.press('Escape')
        self.page.mouse.up()
        self.assertEqual(self.page.evaluate(layout), original)
        self.assertEqual(self.page.locator('#revision').inner_text(), before_revision)
        self.assert_key_hit_areas()
        self.assertEqual(self.project(), before)
        handle.click()
        handle.press('ArrowRight')
        self.assertEqual(self.key(self.project())['atMs'], self.key(before)['atMs'] + 10)
        self.assert_key_hit_areas()

    def test_split_boundary_keys_have_independent_hit_areas(self):
        self.words()
        self.link()
        before = self.project()
        at = self.key(before)['atMs']
        self.seek(at / 1000)
        self.page.locator('#split').click()
        split = self.project()
        peers = self.page.locator('[data-key-track="camera"][data-key-time="' + str(at) + '"]:not([hidden])')
        self.assertEqual(peers.count(), 2)
        self.assert_key_hit_areas()
        for index in range(2):
            key_id = peers.nth(index).get_attribute('data-timeline-key')
            self.page.locator('[data-timeline-key="' + key_id + '"]').click()
            self.assertEqual(self.page.locator('[data-timeline-key="' + key_id + '"]').get_attribute('aria-pressed'), 'true')
        self.assertEqual(self.project(), split)

    def test_delete_caption_review_cancel_and_escape_restore_field_focus(self):
        self.words()
        self.link()
        before = self.project()
        self.page.locator('#go-to-linked-caption').click()
        for dismissal in ['button', 'escape']:
            self.page.locator('#delete-clip').click()
            self.assertTrue(self.page.locator('#dialog').is_visible())
            if dismissal == 'button':
                self.page.get_by_role('button', name='Cancel', exact=True).click()
            else:
                self.page.keyboard.press('Escape')
            self.page.wait_for_function("!document.querySelector('#dialog').open && document.activeElement.id==='caption-text'")
            self.assertEqual(self.project(), before)


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(StudioTimingLinkAccessibilityTests(name)
                             for name in StudioTimingLinkAccessibilityTests.__dict__ if name.startswith('test_'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
