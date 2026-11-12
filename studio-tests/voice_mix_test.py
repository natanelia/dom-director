"""Batch voice settings through the creator UI, including actual offline sample values."""
from copy import deepcopy
import unittest
from selection_test import StudioSelectionTests

VOICE_IDS = ['voice.overview', 'voice.signal']


class StudioVoiceMixTests(StudioSelectionTests):
    def open_mix(self, ids=VOICE_IDS):
        self.choose_group(ids)
        self.page.locator('#selection-voice-mix summary').click()

    def load_project(self, project):
        payload = self.page.evaluate('''async project=>{
          const {saveProjectBundle}=await import('./studio-sdk/media.js');
          return saveProjectBundle(project,{bytes(){throw Error('Unexpected media access');}});
        }''', project)
        self.page.locator('#project-file').set_input_files({'name': 'voice-mix.director', 'mimeType': 'application/x-dom-director', 'buffer': payload.encode()})
        self.page.get_by_role('button', name='Open project', exact=True).click()
        self.page.wait_for_function("document.querySelector('#status').textContent.startsWith('Project reopened')")

    def test_group_controls_are_contextual_and_unapplied_fields_do_not_edit(self):
        before = self.project()
        self.open_mix()
        self.assertTrue(self.page.locator('#selection-mix-apply').is_disabled())
        self.assertTrue(self.page.locator('#selection-voice-mix').evaluate('el => !!(el.compareDocumentPosition(document.querySelector("#selection-offset")) & Node.DOCUMENT_POSITION_FOLLOWING)'))
        self.page.locator('#selection-mix-volume').fill('65')
        self.assertEqual(self.project(), before)
        self.assertNotEqual(self.page.locator('#studio').get_attribute('data-playback'), 'playing')
        self.assertFalse([url for url in self.requests if '.mp3' in url])
        self.choose_group(['voice.overview', 'cc.overview.0'])
        self.assertEqual(self.page.locator('#selection-voice-mix').count(), 0)
        self.open_mix()
        self.assertEqual(self.page.locator('#selection-mix-volume').input_value(), '')
        self.assertEqual(self.project(), before)

    def test_mix_preserves_content_and_is_one_undoable_saved_edit(self):
        before = self.fixture(linked=True)
        self.open_mix()
        for field, value in [('volume', '65'), ('fade-in', '0.125'), ('fade-out', '0.333')]:
            self.page.locator('#selection-mix-' + field).fill(value)
        self.page.locator('#selection-mix-apply').click()
        self.assertTrue(self.page.locator('#selection-mix-apply').evaluate('el=>el===document.activeElement'))
        after = self.project()
        comparison = deepcopy(after)
        for identifier in VOICE_IDS:
            changed = self.clip(after, identifier)
            self.assertAlmostEqual(changed['gain'], .65)
            self.assertEqual(changed['fadeInMs'], 125)
            self.assertEqual(changed['fadeOutMs'], 333)
            for field in ['gain', 'fadeInMs', 'fadeOutMs']:
                self.clip(comparison, identifier)[field] = self.clip(before, identifier)[field]
        self.assertEqual(comparison, before)
        revision = self.page.locator('#revision').inner_text().split(' · ')[0]
        self.page.locator('#selection-mix-apply').click()
        self.assertEqual(self.page.locator('#revision').inner_text().split(' · ')[0], revision)
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)
        self.page.locator('#redo').click()
        self.assertEqual(self.project(), after)
        self.load_project(after)
        self.assertEqual(self.project(), after)

    def test_blank_fields_retain_individual_fades_and_zero_is_explicit(self):
        p = self.project()
        self.clip(p, VOICE_IDS[0]).update(gain=.4, fadeInMs=100, fadeOutMs=200)
        self.clip(p, VOICE_IDS[1]).update(gain=1.3, fadeInMs=20, fadeOutMs=60)
        self.load_project(p)
        self.open_mix()
        self.page.locator('#selection-mix-volume').fill('0')
        self.page.locator('#selection-mix-apply').click()
        muted = self.project()
        for identifier in VOICE_IDS:
            self.assertEqual(self.clip(muted, identifier)['gain'], 0)
            for field in ['fadeInMs', 'fadeOutMs', 'sourceInMs', 'script']:
                self.assertEqual(self.clip(muted, identifier)[field], self.clip(p, identifier)[field])
        self.page.locator('#selection-mix-volume').fill('')
        self.page.locator('#selection-mix-fade-in').fill('0')
        self.page.locator('#selection-mix-apply').click()
        after = self.project()
        for identifier in VOICE_IDS:
            self.assertEqual(self.clip(after, identifier)['gain'], 0)
            self.assertEqual(self.clip(after, identifier)['fadeInMs'], 0)
            self.assertEqual(self.clip(after, identifier)['fadeOutMs'], self.clip(p, identifier)['fadeOutMs'])

    def test_invalid_fades_or_volume_leave_entire_group_unchanged_and_can_be_repaired(self):
        before = self.project()
        self.clip(before, VOICE_IDS[0]).update(durationMs=500, fadeInMs=100, fadeOutMs=100)
        self.load_project(before)
        self.open_mix()
        self.page.locator('#selection-mix-volume').fill('75')
        self.page.locator('#selection-mix-fade-in').fill('0.401')
        self.page.locator('#selection-mix-apply').click()
        self.assertIn('fit every selected clip', self.page.locator('#selection-mix-status').inner_text())
        self.assertEqual(self.project(), before)
        self.assertEqual(self.page.locator('#selection-mix-fade-in').input_value(), '0.401')
        self.page.locator('#selection-mix-fade-in').fill('')
        self.page.locator('#selection-mix-volume').fill('201')
        self.page.locator('#selection-mix-apply').click()
        self.assertEqual(self.page.locator('#selection-mix-volume').get_attribute('aria-invalid'), 'true')
        self.assertEqual(self.project(), before)
        self.page.locator('#selection-mix-volume').fill('75')
        self.page.locator('#selection-mix-apply').click()
        after = self.project()
        for identifier in VOICE_IDS:
            self.assertEqual(self.clip(after, identifier)['gain'], .75)
            self.assertEqual(self.clip(after, identifier)['fadeInMs'], self.clip(before, identifier)['fadeInMs'])

    def test_locked_group_is_not_partially_edited_or_unmuted(self):
        before = self.project()
        voice = next(track for track in before['tracks'] if track['kind'] == 'voice')
        voice.update(locked=True, enabled=False)
        self.load_project(before)
        self.open_mix()
        self.page.locator('#selection-mix-volume').fill('50')
        self.page.locator('#selection-mix-apply').click()
        self.assertIn('locked', self.page.locator('#selection-mix-status').inner_text())
        self.assertEqual(self.project(), before)

    def test_mobile_keyboard_mix_is_reachable_and_undo_restores_values(self):
        before = self.project()
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.emulate_media(reduced_motion='reduce')
        self.open_mix()
        self.page.locator('#selection-mix-volume').fill('80')
        self.page.locator('#selection-mix-fade-out').fill('0.250')
        self.page.locator('#selection-mix-fade-out').press('Enter')
        after = self.project()
        self.assertAlmostEqual(self.clip(after, VOICE_IDS[0])['gain'], .8)
        self.assertEqual(self.clip(after, VOICE_IDS[1])['fadeOutMs'], 250)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.screenshot(path=str(self.output / 'selection-voice-mix-mobile.png'), full_page=True)
        self.page.locator('#undo').click()
        self.assertEqual(self.project(), before)

    def test_committed_mix_controls_real_offline_gain_and_fade_samples(self):
        self.open_mix()
        self.page.locator('#selection-mix-volume').fill('50')
        self.page.locator('#selection-mix-fade-in').fill('0.200')
        self.page.locator('#selection-mix-fade-out').fill('0.200')
        self.page.locator('#selection-mix-apply').click()
        project = self.project()
        result = self.page.evaluate('''async project=>{
          const {renderVoiceMix}=await import('./studio-sdk/audio-export.js');
          const ctx=new OfflineAudioContext(1,1,48000);
          const bank={async load(asset){const buffer=ctx.createBuffer(1,Math.ceil(asset.durationMs*48),48000);
            buffer.getChannelData(0).fill(.4);return buffer;}};
          const end=project.scenes[0].durationMs;
          const result=await renderVoiceMix(project,bank,{range:{startMs:0,endMs:end},channels:1});
          const view=new DataView(result.wav);
          const sample=ms=>view.getInt16(44+Math.round(ms*48)*2,true)/32768;
          return {early:sample(50),middle:sample(500),late:sample(end-100)};
        }''', project)
        self.assertAlmostEqual(result['early'], .05, delta=.002)
        self.assertAlmostEqual(result['middle'], .2, delta=.002)
        self.assertAlmostEqual(result['late'], .1, delta=.002)
        self.assertEqual(self.project(), project)
        self.assertEqual(self.page.locator('#sound').get_attribute('aria-pressed'), 'false')


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(StudioVoiceMixTests(name) for name in StudioVoiceMixTests.__dict__ if name.startswith('test_'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
