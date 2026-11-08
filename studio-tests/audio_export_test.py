"""Real offline audio and WAV downloads; no microphone or external voice provider."""
import io
import json
import wave
from pathlib import Path
from browser_test import StudioTests


class StudioAudioExportTests(StudioTests):
    def open_mix(self):
        self.page.locator('#export-open').click()
        self.page.get_by_role('button', name='Voice WAV…', exact=True).click()
        self.page.locator('#mix-render').wait_for()

    def render_mix(self):
        self.page.locator('#mix-render').click()
        self.page.locator('#mix-download').wait_for(timeout=15000)

    def download_mix(self):
        with self.page.expect_download() as pending:
            self.page.locator('#mix-download').click()
        self.assertEqual(pending.value.suggested_filename, 'walkthrough-voice.wav')
        return Path(pending.value.path()).read_bytes()

    def test_full_mix_is_pcm_wav_and_preserves_all_editable_tracks(self):
        before = self.project()
        self.open_mix()
        self.assertIn('3 voice clips', self.page.locator('#mix-summary').inner_text())
        self.render_mix()
        data = self.download_mix()
        with wave.open(io.BytesIO(data)) as audio:
            self.assertEqual(audio.getnchannels(), 2)
            self.assertEqual(audio.getsampwidth(), 2)
            self.assertEqual(audio.getframerate(), 48000)
            self.assertEqual(audio.getnframes(), sum(s['durationMs'] for s in before['scenes']) * 48)
        self.assertEqual(before, self.project())
        self.assertEqual(self.page.locator('#sound').get_attribute('aria-pressed'), 'false')
        self.assertFalse([u for u in self.requests if not u.startswith(self.url.rsplit('/', 1)[0]) and not u.startswith('blob:')])

    def test_scene_only_mono_export_and_mobile_controls(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.open_mix()
        self.page.locator('#mix-range').select_option('scene')
        self.page.locator('#mix-channels').select_option('1')
        self.assertIn('1 voice clips', self.page.locator('#mix-summary').inner_text())
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.render_mix()
        with wave.open(io.BytesIO(self.download_mix())) as audio:
            self.assertEqual(audio.getnchannels(), 1)
            self.assertEqual(audio.getnframes(), 6980 * 48)

    def test_escape_cancels_render_and_does_not_download_or_close_new_dialog(self):
        self.page.evaluate("""() => {
          window.mixRenderEntered=false;
          OfflineAudioContext.prototype.startRendering=function(){window.mixRenderEntered=true;return new Promise(()=>{});};
        }""")
        downloads = []
        self.page.on('download', lambda d: downloads.append(d.suggested_filename))
        self.open_mix();self.page.locator('#mix-render').click()
        self.page.wait_for_function('window.mixRenderEntered', timeout=15000)
        self.page.keyboard.press('Escape')
        self.page.locator('#shortcuts').click()
        self.assertEqual(self.page.locator('#dialog-title').inner_text(), 'Editing shortcuts')
        self.page.wait_for_timeout(150)
        self.assertTrue(self.page.locator('#dialog').is_visible())
        self.assertEqual(downloads, [])
        self.page.keyboard.press('Escape')
        self.page.locator('#preview-tour').click()
        self.page.wait_for_function("document.querySelector('#studio').dataset.playback==='playing'")

    def test_failed_source_is_not_exported_as_silent_audio(self):
        self.page.route('**/assets/*.mp3', lambda route: route.fulfill(status=404, body='missing'))
        downloads = []
        self.page.on('download', lambda d: downloads.append(d.suggested_filename))
        self.open_mix();self.page.locator('#mix-render').click()
        self.page.wait_for_function("document.querySelector('#status').textContent.includes('could not be loaded')")
        self.assertFalse(self.page.locator('#dialog').is_visible())
        self.assertEqual(downloads, [])

    def test_real_offline_mix_respects_gain_trim_fades_stereo_and_overlapping_tracks(self):
        result = self.page.evaluate("""async () => {
          const {createSample,editProject}=await import('./studio-sdk/index.js');
          const {renderVoiceMix}=await import('./studio-sdk/audio-export.js');
          const project=editProject(createSample(),p=>{
            p.scenes=[p.scenes[0]];p.scenes[0].durationMs=1000;
            for(const t of p.tracks){t.clips=t.clips.filter(c=>c.sceneId==='overview');for(const c of t.clips){c.startMs=0;c.durationMs=1000;}}
            p.tracks[3].clips=[p.tracks[3].clips[0]];
            Object.assign(p.tracks[2].clips[0],{sourceInMs:100,gain:.5,fadeInMs:200,fadeOutMs:200});
            const second=structuredClone(p.tracks[2]);second.id='second-voice';second.clips[0].id='second-clip';p.tracks.push(second);
          });
          const buffer=new AudioBuffer({numberOfChannels:2,length:96000,sampleRate:48000});
          buffer.getChannelData(0).fill(.5);buffer.getChannelData(1).fill(.25);
          // Distinct source content proves sourceInMs is honored, not just placement.
          buffer.getChannelData(0).fill(0,0,4800);buffer.getChannelData(1).fill(0,0,4800);
          const mix=await renderVoiceMix(project,{load:async()=>buffer},{range:{startMs:100,endMs:900}});
          const v=new DataView(mix.wav),at=ms=>[0,1].map(c=>v.getInt16(44+(Math.round(ms*48)*2+c)*2,true)/32768);
          return {start:at(0),middle:at(300),end:at(799),frames:mix.frames,clipped:mix.clippedSamples};
        }""")
        self.assertEqual(result['frames'], 38400)
        self.assertAlmostEqual(result['start'][0], .25, delta=.002)
        self.assertAlmostEqual(result['start'][1], .125, delta=.002)
        self.assertAlmostEqual(result['middle'][0], .5, delta=.002)
        self.assertAlmostEqual(result['middle'][1], .25, delta=.002)
        self.assertAlmostEqual(result['end'][0], .2525, delta=.003)
        self.assertEqual(result['clipped'], 0)

    def test_real_offline_overload_is_reported_not_normalized(self):
        result = self.page.evaluate("""async()=>{
          const {createSample,editProject}=await import('./studio-sdk/index.js');
          const {renderVoiceMix}=await import('./studio-sdk/audio-export.js');
          const p=editProject(createSample(),p=>{p.tracks[2].clips[0].gain=2;p.tracks[2].clips[0].fadeInMs=0;p.tracks[2].clips[0].fadeOutMs=0;});
          const b=new AudioBuffer({length:480000,sampleRate:48000,numberOfChannels:1});b.getChannelData(0).fill(.75);
          const r=await renderVoiceMix(p,{load:async()=>b},{range:{startMs:0,endMs:100},channels:1});
          return {peak:r.peak,clipped:r.clippedSamples,sample:new DataView(r.wav).getInt16(44,true)};
        }""")
        self.assertEqual(result['peak'], 1.5)
        self.assertEqual(result['clipped'], 4800)
        self.assertEqual(result['sample'], 32767)
