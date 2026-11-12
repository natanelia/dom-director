"""Caption proofreading journeys on staged and verified public synthetic Studio."""
import json
from browser_test import StudioTests


class StudioCaptionSearchTests(StudioTests):
    def find(self, query='product', replacement='walkthrough'):
        self.page.locator('#find-captions').click()
        self.page.locator('#caption-query').fill(query)
        self.page.locator('#caption-replacement').fill(replacement)
        self.page.locator('#caption-search-submit').click()

    def close_search(self):
        self.page.locator('#dialog-actions').get_by_role('button', name='Close', exact=True).click()

    def load_fixture(self, kind):
        payload = self.page.evaluate("""async kind => {
          const {createSample,editProject,findClip} = await import('./studio-sdk/index.js');
          const {distributeCaptionWords} = await import('./studio-sdk/editing.js');
          const {linkKeyframeToCaptionWord} = await import('./studio-sdk/timing-links.js');
          const {saveProjectBundle} = await import('./studio-sdk/media.js');
          let p=createSample();
          if(['linked','locked-camera','locked-caption'].includes(kind)) {
            p=distributeCaptionWords(p,'cc.overview.0');
            p=linkKeyframeToCaptionWord(p,'camera.overview','camera.to.overview',{captionId:'cc.overview.0',wordIndex:1,offsetMs:200});
            if(kind!=='linked')p=editProject(p,n=>{n.tracks.find(t=>t.id===(kind==='locked-camera'?'camera':'cc.en')).locked=true;});
          }
          if(kind==='languages')p=editProject(p,n=>{n.tracks.push({id:'cc.fr',kind:'captions',name:'French',language:'fr',enabled:false,locked:false,
            clips:[{id:'fr.1',sceneId:'overview',startMs:0,durationMs:1000,text:'product'}]});});
          if(kind==='pages')p=editProject(p,n=>{n.tracks.find(t=>t.kind==='captions').clips=Array.from({length:25},(_,i)=>({id:'cc.page'+i,sceneId:'overview',startMs:i*200,durationMs:200,text:'Repeated product '+i}));});
          return saveProjectBundle(p,{bytes(){throw Error('No local media expected');}});
        }""", kind)
        self.page.locator('#project-file').set_input_files({'name':'caption-fixture.director','mimeType':'application/x-dom-director','buffer':payload.encode()})
        self.page.locator('#dialog-actions').get_by_role('button',name='Open project',exact=True).click()
        self.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Project reopened')")

    def test_find_marks_literal_matches_and_opens_caption_without_starting_audio(self):
        self.find('product')
        self.assertEqual(self.page.locator('#caption-search-results mark').inner_text(), 'product')
        self.assertIn('1 occurrence in 1 caption', self.page.locator('#caption-search-status').inner_text())
        self.page.locator('[data-caption-open="cc.overview.0"]').click()
        self.page.wait_for_function("!document.querySelector('#dialog').open && document.activeElement.id==='caption-text'")
        self.assertIn('product', self.page.locator('#caption-text').input_value())
        self.assertFalse([u for u in self.requests if '.mp3' in u])
        self.assertNotEqual(self.page.locator('#studio').get_attribute('data-playback'), 'playing')

    def test_review_replace_then_undo_preserves_voice_and_other_tracks(self):
        before=self.project();self.find()
        self.page.locator('#caption-replace-review').click()
        self.assertIn('walkthrough',self.page.locator('#caption-replacement-diff').inner_text())
        self.page.screenshot(path=str(self.output/'caption-replacement-review.png'),full_page=True)
        self.page.locator('#caption-replace-review').click()
        after=self.project()
        self.assertIn('walkthrough',self.clip(after,'cc.overview.0')['text'])
        self.assertEqual(after['tracks'][:3],before['tracks'][:3])
        self.page.locator('#undo').click();self.assertEqual(self.project(),before)
        self.page.locator('#redo').click();self.assertEqual(self.project(),after)

    def test_search_changes_invalidate_results_and_selection_restricts_replace(self):
        self.find('the','THE');self.page.locator('#caption-select-none').click()
        self.assertTrue(self.page.locator('#caption-replace-review').is_disabled())
        self.page.locator('[data-caption-choice="cc.story.1"]').check()
        self.page.locator('#caption-replace-review').click()
        self.assertEqual(self.page.locator('#caption-replacement-diff > li').count(),1)
        self.page.locator('#caption-search-back').click()
        self.page.locator('#caption-query').fill('missing phrase')
        self.assertEqual(self.page.locator('#caption-search-results > li').count(),0)
        self.assertTrue(self.page.locator('#caption-replace-review').is_disabled())
        self.page.locator('#caption-query').press('Enter')
        self.assertIn('0 occurrences',self.page.locator('#caption-search-status').inner_text())

    def test_linked_caption_requires_explicit_timing_review_and_undo_restores_links(self):
        self.load_fixture('linked');before=self.project();self.find()
        self.page.locator('#caption-replace-review').click()
        self.assertIn('1 camera/cursor timing link',self.page.locator('#caption-replace-warning').inner_text())
        self.assertTrue(self.page.locator('#caption-replace-review').is_disabled())
        self.assertLessEqual(self.page.locator('#caption-replace-review').evaluate('el=>Number(getComputedStyle(el).opacity)'), .5)
        self.assertEqual(self.page.locator('#caption-detached-links li').count(),1)
        self.close_search();self.assertEqual(self.project(),before)
        self.find();self.page.locator('#caption-replace-review').click();self.page.locator('#caption-clear-timing').check()
        self.page.locator('#caption-replace-review').click();after=self.project()
        self.assertNotIn('words',self.clip(after,'cc.overview.0'))
        old=self.clip(before,'camera.overview')['keys'][1].copy();del old['timing']
        self.assertEqual(self.clip(after,'camera.overview')['keys'][1],old)
        self.page.locator('#undo').click();self.assertEqual(self.project(),before)

    def test_locked_caption_and_dependent_motion_fail_without_partial_edit(self):
        for fixture in ['locked-caption','locked-camera']:
            self.load_fixture(fixture);before=self.project();self.find()
            self.page.locator('#caption-replace-review').click()
            self.assertIn('locked',self.page.locator('#caption-search-error').inner_text())
            self.close_search();self.assertEqual(self.project(),before)

    def test_language_scope_includes_hidden_tracks_only_when_requested(self):
        self.load_fixture('languages');before=self.project();self.find()
        self.assertEqual(self.page.locator('#caption-search-results > li').count(),1)
        self.page.locator('#caption-search-track').select_option('')
        self.assertTrue(self.page.locator('#caption-replace-review').is_disabled())
        self.page.locator('#caption-search-submit').click()
        self.assertEqual(self.page.locator('#caption-search-results > li').count(),2)
        self.page.locator('[data-caption-choice="cc.overview.0"]').uncheck()
        self.page.locator('#caption-replace-review').click();self.page.locator('#caption-replace-review').click()
        after=self.project();self.assertEqual(self.clip(after,'fr.1')['text'],'walkthrough')
        self.assertEqual(self.clip(after,'cc.overview.0'),self.clip(before,'cc.overview.0'))
        self.assertEqual(after['captionTrack'],before['captionTrack'])
        self.assertFalse(after['tracks'][-1]['enabled'])

    def test_pagination_tracks_all_selected_results_and_only_applies_selected_caption(self):
        self.load_fixture('pages');self.find()
        self.assertEqual(self.page.locator('#caption-search-results > li').count(),20)
        self.assertIn('25 matching captions selected',self.page.locator('#caption-selected-count').inner_text())
        self.page.locator('#caption-select-none').click();self.page.locator('#caption-page-next').click()
        self.assertEqual(self.page.locator('#caption-search-results > li').count(),5)
        self.page.locator('[data-caption-choice="cc.page24"]').check()
        self.page.locator('#caption-replace-review').click();self.page.locator('#caption-replace-review').click()
        after=self.project()
        self.assertEqual(self.clip(after,'cc.page24')['text'],'Repeated walkthrough 24')
        self.assertEqual(self.clip(after,'cc.page0')['text'],'Repeated product 0')

    def test_search_markup_and_replacement_tokens_are_never_html_or_regex(self):
        self.edit('#caption-text','[a.*] <img src=x onerror=window.injected=1>')
        self.find('[a.*]','$& <b>safe</b>');self.assertEqual(self.page.locator('#caption-search-results mark').inner_text(),'[a.*]')
        self.assertEqual(self.page.locator('#caption-search-results img').count(),0)
        self.page.locator('#caption-replace-review').click()
        self.assertEqual(self.page.locator('#caption-replacement-diff b').count(),0)
        self.page.locator('#caption-replace-review').click()
        self.assertTrue(self.clip(self.project(),'cc.overview.0')['text'].startswith('$& <b>safe</b>'))
        self.assertFalse(self.page.evaluate('!!window.injected'))

    def test_empty_replacement_cannot_erase_a_whole_caption(self):
        self.edit('#caption-text','erase');before=self.project();self.find('erase','')
        self.page.locator('#caption-replace-review').click()
        self.assertIn('blank',self.page.locator('#caption-search-error').inner_text())
        self.close_search();self.assertEqual(self.project(),before)

    def test_mobile_keyboard_search_and_escape_preserve_project_and_focus(self):
        self.page.set_viewport_size({'width':390,'height':844});self.page.emulate_media(reduced_motion='reduce')
        self.page.locator('#find-captions').focus();self.page.keyboard.press('Enter')
        self.assertTrue(self.page.locator('#caption-query').evaluate('el=>el===document.activeElement'))
        self.page.locator('#caption-query').fill('product');self.page.locator('#caption-query').press('Enter')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.screenshot(path=str(self.output/'caption-search-mobile.png'),full_page=True)
        self.page.keyboard.press('Escape');self.page.wait_for_function("!document.querySelector('#dialog').open")
        self.assertTrue(self.page.locator('#find-captions').evaluate('el=>el===document.activeElement'))
        self.assertTrue(self.page.locator('#scene').evaluate('el=>el.inert'))

    def test_host_edit_invalidates_a_prepared_replacement(self):
        self.edit('#caption-size','42');self.find();self.page.locator('#caption-replace-review').click()
        self.page.locator('#undo').evaluate('el=>el.click()')
        self.page.locator('#caption-replace-review').click()
        self.assertIn('project changed',self.page.locator('#caption-search-error').inner_text())
        self.close_search();self.assertIn('product',self.clip(self.project(),'cc.overview.0')['text'])

    def test_review_pages_do_not_reuse_hidden_search_ids_or_lose_keyboard_focus(self):
        self.load_fixture('pages');self.find()
        self.page.locator('#caption-replace-review').click()
        self.assertEqual(self.page.locator('#caption-replacement-diff > li').count(),20)
        self.page.locator('#caption-review-page-next').focus();self.page.keyboard.press('Enter')
        self.assertEqual(self.page.locator('#caption-replacement-diff > li').count(),5)
        self.assertTrue(self.page.locator('#caption-replacement-diff strong').first.evaluate('el=>el===document.activeElement'))
        self.assertTrue(self.page.evaluate("(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.length===new Set(ids).size})()"))
        self.page.locator('#caption-search-back').click()
        self.assertIn('25 matching captions selected',self.page.locator('#caption-selected-count').inner_text())

    def test_review_lists_word_timing_loss_per_caption_without_motion_links(self):
        self.choose('captions')
        self.page.get_by_text('Word highlighting', exact=True).click()
        self.page.locator('#add-word-timing').click()
        before = self.project()
        expected = len(self.clip(before, 'cc.overview.0')['words'])
        self.find(' ', ' / ')
        self.page.locator('#caption-replace-review').click()
        rows = self.page.locator('#caption-replacement-diff > li')
        self.assertGreater(rows.count(), 1)
        loss = self.page.locator('[data-cleared-word-timings]')
        self.assertEqual(loss.count(), 1)
        self.assertEqual(loss.get_attribute('data-cleared-word-timings'), str(expected))
        self.assertEqual(loss.inner_text(), f'{expected} word timings will be cleared.')
        self.assertIn('product video.', rows.first.inner_text())
        self.assertIn('0 camera/cursor timing links', self.page.locator('#caption-replace-warning').inner_text())
        self.assertEqual(self.page.locator('#caption-detached-links').count(), 0)
        self.assertTrue(self.page.locator('#caption-replace-review').is_disabled())
        self.close_search()
        self.assertEqual(self.project(), before)
