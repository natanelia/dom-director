"""Regression journeys found during Studio review, using the same browser fixture."""
import base64
import unittest
import browser_test as baseline
from browser_test import wav

class StudioReviewTests(baseline.StudioTests):
    def test_word_timing_uses_a_caption_edited_without_reselecting(self):
        text = 'A much longer explanation.'
        self.edit('#caption-text', text)
        self.page.get_by_text('Word highlighting', exact=True).click()
        self.page.locator('#add-word-timing').click()
        self.assertNotIn('error', self.page.locator('#status').get_attribute('class') or '')
        caption = self.clip(self.project(), 'cc.overview.0')
        self.assertEqual(caption['text'], text)
        self.assertEqual([word['text'] for word in caption['words']], text.split())

    def test_sequential_clip_start_and_end_edits_keep_the_current_start(self):
        self.page.get_by_text('Scene and clip timing', exact=True).click()
        self.edit('#clip-end', '2.0')
        self.edit('#clip-start', '0.5')
        self.edit('#clip-end', '2.2')
        caption = self.clip(self.project(), 'cc.overview.0')
        self.assertEqual(caption['startMs'], 500)
        self.assertEqual(caption['durationMs'], 1700)

    def test_responsive_widths_keep_page_controls_in_bounds_and_timeline_scrollable(self):
        for width in [320, 390, 768, 1024, 1440]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': 1000})
                self.page.wait_for_timeout(100)
                report = self.page.evaluate("""() => ({
                    page: document.documentElement.scrollWidth, viewport: innerWidth,
                    controls: [...document.querySelectorAll('.top-actions button')].map(b => {
                        const r=b.getBoundingClientRect();return {id:b.id,left:r.left,right:r.right};
                    }),
                    timeline: (()=>{const e=document.querySelector('#timeline-scroll');return {width:e.clientWidth,scroll:e.scrollWidth};})()
                })""")
                self.assertLessEqual(report['page'], report['viewport'], report)
                self.assertTrue(all(c['left'] >= 0 and c['right'] <= width for c in report['controls']), report)
                if width <= 390:
                    self.assertGreater(report['timeline']['scroll'], report['timeline']['width'])
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.locator('#timeline-scroll').evaluate('el=>el.scrollLeft=el.scrollWidth')
        self.assertGreater(self.page.locator('#timeline-scroll').evaluate('el=>el.scrollLeft'), 0)

    def test_voice_provider_style_selection_needs_explicit_confirmation(self):
        # A local fake provider verifies the integration; it is not a production AI voice.
        encoded = base64.b64encode(wav(2)).decode()
        self.page.evaluate("""async encoded=>{window.generated=[];const {connectVoiceProvider}=await import('./studio.mjs');connectVoiceProvider({capabilities:{name:'Synthetic test provider',voices:[{id:'test',label:'Test voice',styles:['calm','bright']}]},generate:async request=>{window.generated.push({text:request.text,style:request.style,voice:request.voiceId});return {bytes:Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)).buffer,mime:'audio/wav'};}});}""", encoded)
        self.choose('voice')
        self.edit('#voice-script', 'This is the revised narration, not the sample.')
        self.page.locator('#voice-style').select_option('bright')
        self.page.locator('#generate-voice').click()
        self.assertEqual(self.page.evaluate('window.generated.length'), 0)
        self.page.get_by_role('button', name='Generate', exact=True).click()
        self.page.get_by_text('Use this voice take?', exact=True).wait_for()
        self.assertEqual(self.page.evaluate('window.generated[0].style'), 'bright')
        self.assertEqual(self.page.evaluate('window.generated[0].text'), 'This is the revised narration, not the sample.')
        self.page.get_by_role('button', name='Cancel', exact=True).click()
        self.assertFalse(any(a['source'] == 'local' for a in self.project()['assets']))

    def test_cancelled_microphone_rejection_does_not_close_another_dialog(self):
        self.mock_recording_boundary()
        self.page.evaluate("""() => Object.defineProperty(navigator.mediaDevices,'getUserMedia',{
            configurable:true,value:()=>new Promise((resolve,reject)=>{window.rejectOldMicrophone=reject;})
        })""")
        self.choose('voice')
        self.page.locator('#record-audio').click()
        self.page.get_by_role('button', name='Cancel', exact=True).click()
        self.page.locator('#shortcuts').click()
        self.page.evaluate("window.rejectOldMicrophone(new DOMException('Synthetic late denial','NotAllowedError'))")
        self.page.wait_for_timeout(100)
        self.assertTrue(self.page.locator('#dialog').is_visible())
        self.assertEqual(self.page.locator('#dialog-title').inner_text(), 'Editing shortcuts')
        self.assertNotIn('permission was not granted', self.page.locator('#status').inner_text())

    def test_space_keeps_native_button_activation_and_modifiers_do_not_split(self):
        self.page.locator('#play').focus()
        self.page.keyboard.press('Space')
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>.15")
        self.page.keyboard.press('Space')
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'), 'paused')
        self.edit('#caption-text', 'Edited before undo.')
        self.page.locator('#undo').focus()
        self.page.keyboard.press('Space')
        self.assertNotEqual(self.page.locator('#caption-text').input_value(), 'Edited before undo.')
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'), 'paused')
        self.seek(1)
        before = self.project()
        # Exercise the handler without opening a real browser Save As dialog.
        self.page.evaluate("""()=>{for(const modifier of ['ctrlKey','metaKey','altKey'])
          document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'s',code:'KeyS',[modifier]:true,bubbles:true,cancelable:true}));}""")
        self.assertEqual(self.project(), before)
        self.assertEqual(self.page.locator('#timecode').get_attribute('aria-live'), 'off')

    def test_audible_preview_advances_with_real_web_audio_and_pause_is_stable(self):
        # Preserve the native clock/decoder; retain the instance only for observation.
        self.page.evaluate("""()=>{
          const Native=window.AudioContext;window.nativeContexts=[];
          window.AudioContext=class extends Native{constructor(...args){super(...args);nativeContexts.push(this);}};
        }""")
        self.import_voice(2)
        self.page.get_by_role('button', name='Keep scene timing', exact=True).click()
        self.page.locator('#sound').click()
        self.page.locator('#preview-tour').click()
        self.page.wait_for_function("document.querySelector('#studio').dataset.playback==='playing' && Number(document.querySelector('#seek').value)>.2")
        self.assertEqual(self.page.evaluate('nativeContexts[0].state'), 'running')
        self.assertEqual(self.page.locator('#status').inner_text(), 'Playing with voiceover.')
        before = self.page.evaluate('({audio:nativeContexts[0].currentTime,visual:Number(document.querySelector("#seek").value)})')
        self.page.wait_for_timeout(250)
        after = self.page.evaluate('({audio:nativeContexts[0].currentTime,visual:Number(document.querySelector("#seek").value)})')
        self.assertGreater(after['visual'] - before['visual'], .1)
        self.assertAlmostEqual(after['visual'] - before['visual'], after['audio'] - before['audio'], delta=.12)
        self.page.locator('#play').click()
        self.assertEqual(self.page.locator('#status').inner_text(), 'Preview paused.')
        at = float(self.page.locator('#seek').input_value())
        self.page.wait_for_timeout(150)
        self.assertAlmostEqual(float(self.page.locator('#seek').input_value()), at, delta=.02)

    def test_dragging_a_caption_changes_its_time_without_changing_other_tracks(self):
        self.page.get_by_text('Scene and clip timing', exact=True).click()
        self.edit('#clip-end', '2.0')
        before = self.project()
        clip = self.page.locator('.lane button[data-clip="cc.overview.0"]')
        clip.scroll_into_view_if_needed()
        box = clip.bounding_box()
        scale = float(self.page.locator('#timeline-zoom').input_value())
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        self.page.mouse.move(x, y)
        self.page.mouse.down()
        self.page.mouse.move(x + scale * .5, y, steps=5)
        self.page.mouse.up()
        after = self.project()
        self.assertEqual(self.clip(after, 'cc.overview.0')['startMs'], 500)
        self.assertEqual(self.clip(after, 'cc.overview.0')['durationMs'], 2000)
        self.assertEqual(after['tracks'][:3], before['tracks'][:3])


    def prepare_drag_caption(self):
        self.page.get_by_text('Scene and clip timing', exact=True).click()
        self.edit('#clip-end', '2.0')
        return self.project()

    def drag_caption(self, seconds, edge=None):
        clip = self.page.locator('.lane button[data-clip="cc.overview.0"]')
        clip.scroll_into_view_if_needed()
        box = clip.bounding_box()
        x = box['x'] + (3 if edge == 'start' else box['width'] - 3 if edge == 'end' else box['width'] / 2)
        y = box['y'] + box['height'] / 2
        scale = float(self.page.locator('#timeline-zoom').input_value())
        self.page.mouse.move(x, y)
        self.page.mouse.down()
        self.page.mouse.move(x + seconds * scale, y, steps=5)
        self.page.wait_for_timeout(80)
        return clip, box, scale

    def test_trim_end_previews_the_boundary_and_commits_one_undo_step(self):
        before = self.prepare_drag_caption()
        rev = self.page.locator('#revision').inner_text()
        clip, box, scale = self.drag_caption(.5, 'end')
        preview = clip.bounding_box()
        self.assertAlmostEqual(preview['x'], box['x'], delta=1)
        self.assertAlmostEqual(preview['width'], box['width'] + scale * .5, delta=1)
        self.assertEqual(self.page.locator('#revision').inner_text(), rev)
        self.page.mouse.up()
        after = self.project()
        self.assertEqual(self.clip(after, 'cc.overview.0')['durationMs'], 2500)
        self.assertEqual(after['tracks'][:3], before['tracks'][:3])
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)

    def test_trim_start_previews_shortening_without_moving_the_end(self):
        self.prepare_drag_caption()
        clip, box, scale = self.drag_caption(.5, 'start')
        preview = clip.bounding_box()
        self.assertAlmostEqual(preview['x'], box['x'] + scale * .5, delta=1)
        self.assertAlmostEqual(preview['x'] + preview['width'], box['x'] + box['width'], delta=1)
        self.page.mouse.up()
        caption = self.clip(self.project(), 'cc.overview.0')
        self.assertEqual((caption['startMs'], caption['durationMs']), (500, 1500))

    def test_escape_cancels_timeline_preview_without_consuming_undo(self):
        before = self.prepare_drag_caption()
        rev = self.page.locator('#revision').inner_text()
        clip, box, scale = self.drag_caption(.5, 'end')
        self.page.keyboard.press('Escape')
        self.page.mouse.up()
        self.assertAlmostEqual(clip.bounding_box()['width'], box['width'], delta=1)
        self.assertEqual(self.page.locator('#revision').inner_text(), rev)
        self.assertEqual(self.project(), before)
        self.assertEqual(self.page.locator('[data-drag-state]').count(), 0)
        # A new gesture must still work after cancelling the previous one.
        self.drag_caption(.5)
        self.page.mouse.up()
        self.assertEqual(self.clip(self.project(), 'cc.overview.0')['startMs'], 500)

    def test_invalid_drop_restores_geometry_and_never_applies_last_valid_preview(self):
        before = self.prepare_drag_caption()
        clip, box, scale = self.drag_caption(.5, 'end')
        # Continue into the next caption rather than dropping on the earlier valid point.
        self.page.mouse.move(box['x'] + box['width'] - 3 + 4 * scale, box['y'] + box['height'] / 2, steps=5)
        self.page.wait_for_timeout(80)
        self.assertEqual(clip.get_attribute('data-drag-state'), 'invalid')
        self.page.mouse.up()
        self.assertAlmostEqual(clip.bounding_box()['width'], box['width'], delta=1)
        self.assertEqual(self.project(), before)

    def test_ripple_drag_previews_the_following_clip_and_escape_restores_both(self):
        before = self.prepare_drag_caption()
        # Create room at the scene end so a ripple move can be legal.
        second = next(c for t in before['tracks'] if t['kind'] == 'captions' for c in t['clips']
                      if c['sceneId'] == 'overview' and c['id'] != 'cc.overview.0')
        self.page.locator('.lane button[data-clip="' + second['id'] + '"]').click()
        self.edit('#clip-end', '6.0')
        self.page.locator('.lane button[data-clip="cc.overview.0"]').click()
        self.page.locator('#ripple').check()
        before = self.project()
        neighbor = self.page.locator('.lane button[data-clip="' + second['id'] + '"]')
        original = neighbor.bounding_box()['x']
        clip, box, scale = self.drag_caption(.5)
        self.assertAlmostEqual(neighbor.bounding_box()['x'], original + scale * .5, delta=1)
        self.page.keyboard.press('Escape')
        self.page.mouse.up()
        self.assertAlmostEqual(neighbor.bounding_box()['x'], original, delta=1)
        self.assertEqual(self.project(), before)

    def test_pointer_capture_loss_cancels_without_late_commit(self):
        before = self.prepare_drag_caption()
        self.page.evaluate("document.querySelector('#lanes').addEventListener('pointerdown',e=>window.dragPointerId=e.pointerId,{once:true})")
        clip, box, scale = self.drag_caption(.5, 'end')
        clip.evaluate('el=>el.releasePointerCapture(window.dragPointerId)')
        # Force delivery of the queued native capture transition with another pointer event.
        self.page.mouse.move(box['x'] + box['width'] + scale, box['y'] + box['height'] / 2)
        self.page.mouse.up()
        self.assertEqual(self.project(), before)
        self.assertEqual(self.page.locator('[data-drag-state]').count(), 0)

    def test_escape_cancels_a_canvas_keyframe_drag(self):
        self.choose('cursor')
        before = self.project()
        handle = self.page.locator('#edit-handles [data-key]').first
        handle.scroll_into_view_if_needed()
        box = handle.bounding_box()
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        self.page.mouse.move(x, y)
        self.page.mouse.down()
        self.page.mouse.move(x + 30, y + 20, steps=5)
        self.page.keyboard.press('Escape')
        self.page.mouse.up()
        self.assertEqual(self.project(), before)
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'), 'paused')

    def test_locked_track_rejects_drag_without_preview_or_history_change(self):
        self.prepare_drag_caption()
        self.page.get_by_role('button', name='Lock CC · English', exact=True).click()
        before = self.project()
        clip, box, scale = self.drag_caption(.5)
        self.page.mouse.up()
        self.assertAlmostEqual(clip.bounding_box()['x'], box['x'], delta=1)
        self.assertEqual(self.page.locator('[data-drag-state]').count(), 0)
        self.assertEqual(self.project(), before)


def load_tests(loader, tests, pattern):
    # The original suite runs separately; inherit only its fixture and helpers here.
    return unittest.TestSuite(StudioReviewTests(name) for name in StudioReviewTests.__dict__ if name.startswith('test_'))

if __name__ == '__main__':
    unittest.main(verbosity=2)
