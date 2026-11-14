"""Review actual voice-replacement timing changes in staged/public Studio.

Fixtures use the public project APIs and native .director import. Candidate audio
is a local, synthetic WAV; no provider, microphone or application action is used.
"""
import unittest
from browser_test import StudioTests, wav


def load_voice_impact_fixture(case, kind):
    payload = case.page.evaluate("""async kind => {
      const {createSample,editProject,findClip,splitClip} = await import('./studio-sdk/index.js');
      const {distributeCaptionWords} = await import('./studio-sdk/editing.js');
      const {linkKeyframeToCaptionWord} = await import('./studio-sdk/timing-links.js');
      const {saveProjectBundle} = await import('./studio-sdk/media.js');
      let p=createSample();
      if(kind==='hidden-linked-split') {
        p=distributeCaptionWords(p,'cc.overview.0');
        p=linkKeyframeToCaptionWord(p,'camera.overview','camera.to.overview',
          {captionId:'cc.overview.0',wordIndex:1,offsetMs:37});
        p=linkKeyframeToCaptionWord(p,'cursor.overview','cursor.to.overview',
          {captionId:'cc.overview.0',wordIndex:1,boundary:'end',offsetMs:51});
        p=splitClip(p,'camera.overview',200);
        p=editProject(p,n=>{n.tracks.find(t=>t.id==='cc.en').enabled=false;});
      }
      if(kind==='source-trim')p=editProject(p,n=>{
        Object.assign(findClip(n,'voice.overview').clip,{sourceInMs:100,fadeInMs:500,fadeOutMs:500});
      });
      if(kind==='pages')p=editProject(p,n=>{
        n.tracks.find(t=>t.kind==='captions').clips=Array.from({length:25},(_,i)=>({
          id:'cc.page'+i,sceneId:'overview',startMs:i*200,durationMs:200,text:'Review caption '+i,
        }));
      });
      if(kind==='inactive-without-language')p=editProject(p,n=>{
        n.tracks.push({id:'cc.alternative',kind:'captions',name:'Alternative captions',enabled:true,locked:false,
          clips:[{id:'cc.alternative.0',sceneId:'overview',startMs:0,durationMs:1000,text:'An inactive caption.'}]});
      });
      if(kind==='locked')p=editProject(p,n=>{n.tracks.find(t=>t.kind==='camera').locked=true;});
      if(kind==='multiple-voices')p=splitClip(p,'voice.overview',3000);
      if(kind==='collision') {
        p=editProject(p,n=>{
          const c=findClip(n,'cc.overview.0').clip;
          c.text='first second';c.words=[{text:'first',startMs:0,endMs:999},{text:'second',startMs:1000,endMs:3490}];
        });
        p=linkKeyframeToCaptionWord(p,'camera.overview','camera.to.overview',
          {captionId:'cc.overview.0',wordIndex:1,offsetMs:-500});
      }
      if(kind==='markup')p=editProject(p,n=>{
        findClip(n,'cc.overview.0').clip.text='<img src=x onerror=window.injected=1> & <b>literal caption</b>';
      });
      return saveProjectBundle(p,{bytes(){throw Error('No local media expected');}});
    }""", kind)
    case.page.locator('#project-file').set_input_files({
        'name': 'voice-impact-fixture.director', 'mimeType': 'application/x-dom-director', 'buffer': payload.encode(),
    })
    case.page.locator('#dialog-actions').get_by_role('button', name='Open project', exact=True).click()
    case.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Project reopened')")


class StudioVoiceImpactTests(StudioTests):
    def take(self, seconds=9, name='Timing review.wav'):
        self.choose('voice')
        self.page.locator('#import-audio').focus()
        self.page.locator('#audio-file').set_input_files({'name': name, 'mimeType': 'audio/wav', 'buffer': wav(seconds)})
        self.page.locator('#take-comparison').wait_for()

    def review(self):
        self.page.locator('#dialog-actions').get_by_role('button', name='Fit scene to voice', exact=True).click()
        self.page.locator('#voice-impact-summary').wait_for()
        self.assertEqual(self.page.locator('#dialog-title').inner_text(), 'Review timing changes')

    def group(self, kind):
        group = self.page.locator('details[data-impact-kind="' + kind + '"]')
        if not group.evaluate('el=>el.open'):
            group.locator('summary').click()
        return group

    def row(self, identifier, kind=None):
        root = self.group(kind) if kind else self.page
        return root.locator('[data-impact-entity-id="' + identifier + '"]')

    def cancel(self):
        self.page.locator('#dialog-actions').get_by_role('button', name='Cancel', exact=True).click()
        self.page.locator('#dialog').wait_for(state='hidden')

    def accept(self):
        self.page.locator('#dialog-actions').get_by_role('button', name='Use take and retime', exact=True).click()
        self.page.locator('#dialog').wait_for(state='hidden')

    def assert_times(self, text, *times):
        for value in times:
            self.assertIn(f'{value / 1000:.3f}', text)

    def test_longer_review_names_exact_changes_and_cancel_preserves_timing_history(self):
        before = self.project()
        self.take(9)
        at = self.page.locator('#seek').input_value()
        revision = self.page.locator('#revision').inner_text()
        self.review()
        summary = self.page.locator('#voice-impact-summary').inner_text()
        self.assert_times(summary, 6980, 9000, 2020)
        self.assertIn('2 later scenes', summary)
        for kind in ['captions', 'camera', 'cursor', 'voice']:
            self.assertEqual(self.page.locator('details[data-impact-kind="' + kind + '"]').count(), 1)
        self.assert_times(self.row('cc.overview.0', 'captions').inner_text(), 0, 3490, 4500)
        self.assert_times(self.row('camera.to.overview', 'camera').inner_text(), 1000, 1289)
        self.assert_times(self.row('click.overview', 'cursor').inner_text(), 3300, 4255)
        self.assertIn('Timing review.wav', self.row('voice.overview', 'voice').inner_text())
        self.assertEqual(self.page.locator('#seek').input_value(), at)
        self.assertEqual(self.page.locator('#revision').inner_text(), revision)
        self.assertFalse([url for url in self.requests if '.mp3' in url])
        self.assertTrue(self.page.locator('#scene').evaluate('el=>el.inert'))
        self.page.screenshot(path=str(self.output / 'voice-impact-details.png'), full_page=True)
        self.cancel()
        self.assertEqual(self.project(), before)
        self.assertEqual(self.page.locator('#revision').inner_text(), revision)

    def test_same_duration_still_reviews_selected_voice_source_without_moving_other_tracks(self):
        before = self.project()
        self.take(6.98)
        self.review()
        summary = self.page.locator('#voice-impact-summary').inner_text()
        self.assert_times(summary, 6980, 0)
        self.assertIn('0 later scenes', summary)
        for kind in ['captions', 'camera', 'cursor']:
            self.assertIn('No timing changes', self.group(kind).inner_text())
        self.assertIn('Timing review.wav', self.row('voice.overview', 'voice').inner_text())
        self.accept()
        after = self.project()
        self.assertEqual(after['scenes'], before['scenes'])
        for a, b in zip(after['tracks'], before['tracks']):
            if a['kind'] != 'voice':
                self.assertEqual(a, b)
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)

    def test_shorter_accept_matches_review_and_is_one_undoable_saved_playable_edit(self):
        before = self.project()
        self.take(3)
        self.review()
        self.assert_times(self.page.locator('#voice-impact-summary').inner_text(), 6980, 3000, -3980)
        self.assert_times(self.row('cc.overview.1', 'captions').inner_text(), 3490, 6980, 1500, 3000)
        self.assert_times(self.row('camera.signal', 'camera').inner_text(), 6980, 15188, 3000, 11208)
        self.accept()
        after = self.project()
        self.assertEqual(after['scenes'][0]['durationMs'], 3000)
        self.assertEqual(self.clip(after, 'cc.overview.1')['startMs'], 1500)
        self.assertEqual(self.clip(after, 'cc.overview.1')['durationMs'], 1500)
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)
        self.page.locator('#redo').click()
        self.assertEqual(self.project(), after)
        saved = self.bundle()
        self.page.locator('#project-file').set_input_files({'name': 'retimed.director', 'mimeType': 'application/x-dom-director', 'buffer': saved})
        self.page.get_by_role('button', name='Open project', exact=True).click()
        self.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Project reopened')")
        self.assertEqual(self.project(), after)
        self.page.locator('#preview-tour').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>.12")
        self.assertEqual(self.page.locator('#stage').get_attribute('data-scene'), 'overview')
        self.page.locator('#play').click()
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'), 'paused')

    def test_hidden_language_and_split_source_keys_are_visible_with_exact_link_positions(self):
        load_voice_impact_fixture(self, 'hidden-linked-split')
        before = self.project()
        self.take(9)
        self.review()
        cc = self.group('captions')
        self.assertIn('hidden', cc.inner_text().lower())
        self.assertIn('English', cc.inner_text())
        word_rows = {}
        for word in self.clip(before, 'cc.overview.0')['words']:
            if word.get('id'):
                row = cc.locator('[data-impact-entity-id="' + word['id'] + '"]')
                self.assertEqual(row.get_attribute('data-impact-type'), 'word')
                word_rows[word['id']] = row.inner_text()
                self.assertIn(word['text'], word_rows[word['id']])
                self.assert_times(word_rows[word['id']], word['startMs'], word['endMs'])
        camera_text = self.group('camera').inner_text()
        self.assertIn('outside the visible clip', camera_text)
        self.assertIn('linked', camera_text.lower())
        linked_rows = {}
        for track in before['tracks']:
            if track['kind'] not in ['camera', 'cursor']:
                continue
            group = self.group(track['kind'])
            for clip in track['clips']:
                if clip['sceneId'] != 'overview':
                    continue
                for key in clip['keys']:
                    if 'timing' in key:
                        linked_rows[key['id']] = group.locator('[data-impact-entity-id="' + key['id'] + '"]').inner_text()
                        self.assert_times(linked_rows[key['id']], clip['startMs'] + key['atMs'] - clip['offsetMs'])
        self.accept()
        after = self.project()
        for word in self.clip(after, 'cc.overview.0')['words']:
            if word.get('id') in word_rows:
                self.assert_times(word_rows[word['id']], word['startMs'], word['endMs'])
        for track in after['tracks']:
            for clip in track['clips']:
                for key in clip.get('keys', []):
                    if key['id'] in linked_rows:
                        self.assert_times(linked_rows[key['id']], clip['startMs'] + key['atMs'] - clip['offsetMs'])
                        previous = next(k for t in before['tracks'] for c in t['clips'] for k in c.get('keys', []) if k['id'] == key['id'])
                        self.assertEqual(key['timing'], previous['timing'])
        self.assertFalse(next(t for t in after['tracks'] if t['id'] == 'cc.en')['enabled'])
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)

    def test_voice_source_trim_and_clamped_fades_are_explained_before_acceptance(self):
        load_voice_impact_fixture(self, 'source-trim')
        before = self.project()
        self.take(.3)
        self.review()
        voice = self.row('voice.overview', 'voice').inner_text()
        self.assert_times(voice, 100, 7080, 0, 300, 500)
        self.assertIn('fade', voice.lower())
        self.accept()
        result = self.clip(self.project(), 'voice.overview')
        self.assertEqual((result['sourceInMs'], result['durationMs'], result['fadeInMs'], result['fadeOutMs']), (0, 300, 300, 0))
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)

    def test_inactive_caption_track_is_labeled_hidden_without_language_metadata(self):
        load_voice_impact_fixture(self, 'inactive-without-language')
        before = self.project()
        track = next(t for t in before['tracks'] if t['id'] == 'cc.alternative')
        self.assertTrue(track['enabled'])
        self.assertNotIn('language', track)
        self.assertNotEqual(before['captionTrack'], track['id'])
        self.take(9)
        self.review()
        row = self.row('cc.alternative.0', 'captions')
        self.assertIn('Alternative captions', row.inner_text())
        self.assertIn('hidden caption track', row.inner_text())
        self.assert_times(row.inner_text(), 0, 1000, 1289)
        self.cancel()
        self.assertEqual(self.project(), before)

    def test_all_changes_remain_reachable_through_bounded_keyboard_pages(self):
        load_voice_impact_fixture(self, 'pages')
        before = self.project()
        self.take(9)
        self.review()
        group = self.group('captions')
        first = group.locator('[data-impact-items] > li')
        self.assertEqual(first.count(), 20)
        ids = first.evaluate_all('rows=>rows.map(row=>row.dataset.impactEntityId)')
        self.assertIn('25', group.locator('[data-impact-page-status]').inner_text())
        group.locator('[data-impact-next]').focus()
        self.page.keyboard.press('Enter')
        last = group.locator('[data-impact-items] > li')
        self.assertEqual(last.count(), 5)
        ids += last.evaluate_all('rows=>rows.map(row=>row.dataset.impactEntityId)')
        self.assertEqual(set(ids), {'cc.page' + str(index) for index in range(25)})
        self.assertIn('Review caption 24', group.inner_text())
        self.assertTrue(group.evaluate('el=>el.contains(document.activeElement)'))
        self.assertTrue(group.locator('[data-impact-next]').is_disabled())
        self.assertTrue(group.locator('[data-impact-prev]').is_enabled())
        group.locator('[data-impact-prev]').click()
        self.assertEqual(group.locator('[data-impact-items] > li').count(), 20)
        self.page.keyboard.press('Escape')
        self.page.locator('#dialog').wait_for(state='hidden')
        self.assertEqual(self.project(), before)

    def test_locked_multiple_voice_and_colliding_key_rejections_do_not_discard_the_draft(self):
        for kind, seconds, message in [('locked', 9, 'locked'), ('multiple-voices', 9, 'one voice clip'), ('collision', 3.49, 'increase')]:
            with self.subTest(kind=kind):
                load_voice_impact_fixture(self, kind)
                before = self.project()
                self.take(seconds)
                self.page.locator('#dialog-actions').get_by_role('button', name='Fit scene to voice', exact=True).click()
                self.assertIn(message, self.page.locator('#dialog-body .error').inner_text())
                self.assertEqual(self.page.locator('#voice-impact-summary').count(), 0)
                self.assertTrue(self.page.locator('#audition-new').is_enabled())
                self.cancel()
                self.assertEqual(self.project(), before)
        load_voice_impact_fixture(self, 'sample')
        self.take(9)
        self.review()
        self.accept()
        self.assertEqual(self.project()['scenes'][0]['durationMs'], 9000)

    def test_stale_acceptance_reports_inside_dialog_without_overwriting_newer_revision(self):
        original = self.project()
        self.edit('#caption-size', '42')
        self.take(9)
        self.review()
        # An external host history change while native modal blocks normal input.
        self.page.locator('#undo').evaluate('el=>el.click()')
        self.page.locator('#dialog-actions').get_by_role('button', name='Use take and retime', exact=True).click()
        error = self.page.locator('#voice-impact-error')
        self.assertTrue(error.is_visible())
        self.assertRegex(error.inner_text().lower(), r'changed|stale|revision')
        self.assertEqual(error.get_attribute('role'), 'alert')
        self.assertTrue(self.page.locator('#dialog').is_visible())
        self.cancel()
        self.assertEqual(self.project(), original)

    def test_escape_restores_available_take_trigger_after_reusing_the_native_dialog(self):
        self.choose('voice')
        self.page.get_by_text('Available takes', exact=True).click()
        trigger = self.page.locator('details[data-section="Available takes"] .clip-list-item').nth(1)
        before = self.project()
        self.seek(1.234)
        trigger.focus()
        self.page.keyboard.press('Enter')
        at = self.page.locator('#seek').input_value()
        self.review()
        self.assertTrue(self.page.locator('#dialog-actions').get_by_role('button', name='Cancel', exact=True).evaluate('el=>el===document.activeElement'))
        self.page.keyboard.press('Escape')
        self.page.locator('#dialog').wait_for(state='hidden')
        self.page.wait_for_function("document.activeElement?.matches('details[data-section=\"Available takes\"] .clip-list-item')")
        self.assertTrue(trigger.evaluate('el=>el===document.activeElement'))
        self.assertEqual(self.page.locator('#seek').input_value(), at)
        self.assertEqual(self.project(), before)

    def test_mobile_reduced_motion_review_keeps_dialog_keyboard_access_and_import_focus(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.emulate_media(reduced_motion='reduce')
        before = self.project()
        self.take(9)
        self.review()
        self.assertTrue(self.page.locator('#voice-impact-summary').evaluate("""el=>{
          const summary=el.getBoundingClientRect(),body=document.querySelector('#dialog-body').getBoundingClientRect();
          return Math.max(summary.top,body.top)<Math.min(summary.bottom,body.bottom)&&
            Math.max(summary.left,body.left)<Math.min(summary.right,body.right);
        }"""), 'Opening the review must show its summary, even when Cancel receives focus.')
        self.page.screenshot(path=str(self.output / 'voice-impact-mobile-summary.png'), full_page=True)
        self.group('captions')
        self.group('voice')
        body = self.page.locator('#dialog-body')
        self.assertTrue(body.evaluate('el=>el.scrollHeight>el.clientHeight'))
        body.evaluate('el=>{el.scrollTop=el.scrollHeight;}')
        for selector in ['#dialog-title', '#dialog-actions']:
            self.assertTrue(self.page.locator(selector).evaluate("""el=>{
              const box=el.getBoundingClientRect();
              return box.width>0&&box.height>0&&box.top>=0&&box.left>=0&&
                box.bottom<=innerHeight&&box.right<=innerWidth;
            }"""), 'The title and review actions must stay visible while details scroll.')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.assertFalse(self.page.locator('#dialog').evaluate('el=>el.scrollWidth>el.clientWidth+1'))
        self.page.screenshot(path=str(self.output / 'voice-impact-mobile.png'), full_page=True)
        self.page.keyboard.press('Escape')
        self.page.locator('#dialog').wait_for(state='hidden')
        self.page.wait_for_function("document.activeElement?.id==='import-audio'")
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'), 'paused')
        self.assertEqual(self.project(), before)

    def test_authored_markup_is_literal_in_caption_and_voice_review_rows(self):
        load_voice_impact_fixture(self, 'markup')
        before = self.project()
        self.take(9, name='<img src=x onerror=window.injected=1>.wav')
        self.review()
        caption = self.row('cc.overview.0', 'captions')
        voice = self.row('voice.overview', 'voice')
        self.assertIn('<img src=x', caption.inner_text())
        self.assertIn('<b>literal caption</b>', caption.inner_text())
        self.assertIn('<img src=x', voice.inner_text())
        self.assertEqual(self.page.locator('#dialog-body img, #dialog-body b').count(), 0)
        self.assertFalse(self.page.evaluate('!!window.injected'))
        self.cancel()
        self.assertEqual(self.project(), before)


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(StudioVoiceImpactTests(name) for name in StudioVoiceImpactTests.__dict__ if name.startswith('test_'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
