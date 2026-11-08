"""Timeline magnets and keyframe authoring on the real staged/public Studio."""
import unittest
import browser_test as baseline


class StudioTimelineTests(baseline.StudioTests):
    def key(self, clip='camera.overview', key='camera.to.overview'):
        return self.page.locator('[data-key-clip="' + clip + '"][data-timeline-key="' + key + '"]')

    def drag_key(self, delta_seconds, clip='camera.overview', key='camera.to.overview', alt=False):
        handle = self.key(clip, key)
        handle.scroll_into_view_if_needed()
        box = handle.bounding_box()
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        scale = float(self.page.locator('#timeline-zoom').input_value())
        if alt:
            self.page.keyboard.down('Alt')
        self.page.mouse.move(x, y)
        self.page.mouse.down()
        self.page.mouse.move(x + delta_seconds * scale, y, steps=5)
        self.page.wait_for_timeout(90)
        return handle, x, y, scale

    def time_of(self, project, clip='camera.overview', key='camera.to.overview'):
        return next(k['atMs'] for k in self.clip(project, clip)['keys'] if k['id'] == key)

    def test_key_selection_does_not_edit_and_seeks_to_its_time(self):
        before = self.project()
        revision = self.page.locator('#revision').inner_text()
        self.key().click()
        self.assertEqual(self.key().get_attribute('aria-pressed'), 'true')
        self.assertAlmostEqual(float(self.page.locator('#seek').input_value()), 1, delta=.01)
        self.assertEqual(self.page.locator('#revision').inner_text(), revision)
        self.assertEqual(self.project(), before)
        self.assertEqual(self.page.locator('button button').count(), 0)

    def test_key_drag_snaps_to_caption_boundary_without_changing_other_data(self):
        before = self.project()
        revision = self.page.locator('#revision').inner_text()
        handle, _, _, _ = self.drag_key(2.44)
        self.assertEqual(handle.get_attribute('data-drag-state'), 'valid')
        self.assertFalse(self.page.locator('#snap-guide').is_hidden())
        self.assertEqual(handle.get_attribute('data-key-time'), '3490')
        self.assertEqual(self.page.locator('#revision').inner_text(), revision)
        self.page.mouse.up()
        after = self.project()
        self.assertEqual(self.time_of(after), 3490)
        expected = before
        self.clip(expected, 'camera.overview')['keys'][1]['atMs'] = 3490
        self.assertEqual(after, expected)
        self.assertTrue(self.page.locator('#snap-guide').is_hidden())
        self.page.locator('#undo').click()
        self.assertEqual(self.time_of(self.project()), 1000)

    def test_alt_drag_bypasses_magnets_and_grid(self):
        self.drag_key(2.443, alt=True)
        self.assertTrue(self.page.locator('#snap-guide').is_hidden())
        self.page.mouse.up()
        self.page.keyboard.up('Alt')
        # Browsers may quantize pointer coordinates; still require a non-grid,
        # non-boundary result within one CSS pixel of the intended position.
        scale = float(self.page.locator('#timeline-zoom').input_value())
        at = self.time_of(self.project())
        self.assertAlmostEqual(at, 3443, delta=1000 / scale + 1)
        self.assertNotEqual(at, 3490)
        self.assertNotEqual(at % 100, 0)

    def test_escape_discards_key_preview_and_a_following_gesture_still_works(self):
        before = self.project()
        revision = self.page.locator('#revision').inner_text()
        self.drag_key(2.44)
        self.page.keyboard.press('Escape')
        self.page.mouse.up()
        self.assertEqual(self.project(), before)
        self.assertEqual(self.page.locator('#revision').inner_text(), revision)
        self.assertTrue(self.page.locator('#snap-guide').is_hidden())
        self.drag_key(2.44)
        self.page.mouse.up()
        self.assertEqual(self.time_of(self.project()), 3490)

    def test_invalid_release_never_commits_a_previous_valid_key_preview(self):
        before = self.project()
        handle, x, y, scale = self.drag_key(2.44)
        self.page.mouse.move(x + 8 * scale, y, steps=5)
        self.page.wait_for_timeout(90)
        self.assertEqual(handle.get_attribute('data-drag-state'), 'invalid')
        self.page.mouse.up()
        self.assertEqual(self.project(), before)
        self.assertTrue(self.page.locator('#snap-guide').is_hidden())

    def test_key_keyboard_nudge_and_delete_affect_only_the_selected_key(self):
        self.key().click()
        before = self.project()
        self.key().focus()
        self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.time_of(self.project()), 1010)
        self.key().focus()
        self.page.keyboard.press('Shift+ArrowRight')
        self.assertEqual(self.time_of(self.project()), 1110)
        self.key().focus()
        self.page.keyboard.press('Delete')
        after = self.project()
        self.assertEqual(len(self.clip(after, 'camera.overview')['keys']), 1)
        self.assertEqual(len(after['tracks'][0]['clips']), len(before['tracks'][0]['clips']))
        self.assertEqual(after['tracks'][1:], before['tracks'][1:])
        self.page.locator('#undo').click()
        self.assertEqual(self.time_of(self.project()), 1110)

    def test_locked_key_rejects_pointer_and_keyboard_edits(self):
        self.page.get_by_role('button', name='Lock Camera', exact=True).click()
        before = self.project()
        self.drag_key(2.44)
        self.page.mouse.up()
        self.key().focus()
        self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.project(), before)
        self.assertEqual(self.page.locator('[data-drag-state]').count(), 0)

    def test_key_to_playhead_uses_clip_local_time_in_a_later_scene(self):
        self.key('camera.signal', 'camera.to.signal').click()
        self.seek(10.001)
        self.page.locator('#key-to-playhead').click()
        self.assertEqual(self.time_of(self.project(), 'camera.signal', 'camera.to.signal'), 3021)

    def test_clip_trim_magnet_matches_caption_edge_exactly(self):
        self.page.get_by_text('Scene and clip timing', exact=True).click()
        self.edit('#clip-end', '2.0')
        before = self.project()
        clip = self.page.locator('.lane button[data-clip="cc.overview.0"]')
        clip.scroll_into_view_if_needed()
        box = clip.bounding_box()
        scale = float(self.page.locator('#timeline-zoom').input_value())
        x, y = box['x'] + box['width'] - 3, box['y'] + box['height'] / 2
        self.page.mouse.move(x, y)
        self.page.mouse.down()
        self.page.mouse.move(x + 1.44 * scale, y, steps=5)
        self.page.wait_for_timeout(90)
        self.assertFalse(self.page.locator('#snap-guide').is_hidden())
        self.assertAlmostEqual(clip.bounding_box()['width'], 3.49 * scale, delta=1)
        self.page.mouse.up()
        after = self.project()
        self.assertEqual(self.clip(after, 'cc.overview.0')['durationMs'], 3490)
        self.assertEqual(after['tracks'][:3], before['tracks'][:3])

    def test_split_cursor_key_retime_preserves_the_source_window(self):
        self.choose('cursor')
        self.seek(2)
        self.page.locator('#split').click()
        before = self.project()
        right = next(c for t in before['tracks'] if t['kind'] == 'cursor' for c in t['clips']
                     if c['sceneId'] == 'overview' and c['offsetMs'] == 2000)
        key = next(k for k in right['keys'] if k['atMs'] == 2500)
        self.page.locator('#snap').uncheck()
        self.drag_key(.7, right['id'], key['id'])
        self.page.mouse.up()
        after = self.project()
        edited = self.clip(after, right['id'])
        self.assertAlmostEqual(next(k['atMs'] for k in edited['keys'] if k['id'] == key['id']), 3200, delta=25)
        self.assertEqual(edited['offsetMs'], 2000)
        self.assertEqual(edited['keys'][0], right['keys'][0])
        self.assertEqual(edited['gestures'], right['gestures'])
        self.assertEqual(self.clip(after, 'cursor.overview'), self.clip(before, 'cursor.overview'))

    def test_capture_loss_cancels_a_keyframe_drag_without_late_commit(self):
        before = self.project()
        self.page.evaluate("document.querySelector('#lanes').addEventListener('pointerdown',e=>window.keyPointerId=e.pointerId,{once:true})")
        handle, x, y, scale = self.drag_key(2.44)
        handle.evaluate('el=>el.releasePointerCapture(window.keyPointerId)')
        self.page.mouse.move(x + 3 * scale, y)
        self.page.mouse.up()
        self.assertEqual(self.project(), before)
        self.assertEqual(self.page.locator('[data-drag-state]').count(), 0)
        self.assertTrue(self.page.locator('#snap-guide').is_hidden())

    def test_horizontal_scrolling_is_part_of_the_key_drag_delta(self):
        self.page.locator('#timeline-zoom').evaluate("el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));}")
        handle, x, y, scale = self.drag_key(.4)
        self.page.locator('#timeline-scroll').evaluate('el=>{el.scrollLeft=200}')
        self.page.wait_for_timeout(90)
        self.assertEqual(handle.get_attribute('data-key-time'), '3400')
        self.page.mouse.up()
        self.assertEqual(self.time_of(self.project()), 3400)


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(StudioTimelineTests(name) for name in StudioTimelineTests.__dict__ if name.startswith('test_'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
