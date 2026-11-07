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



def load_tests(loader, tests, pattern):
    # The original suite runs separately; inherit only its fixture and helpers here.
    return unittest.TestSuite(StudioReviewTests(name) for name in StudioReviewTests.__dict__ if name.startswith('test_'))

if __name__ == '__main__':
    unittest.main(verbosity=2)
