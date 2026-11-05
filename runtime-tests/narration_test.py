"""Narration input, caption controls, cancellation and real media checks."""
import base64
from harness import BrowserFixture, ROOT
from player_test import TOUR
class NarrationTests(BrowserFixture):
    def setUp(self):
        super().setUp()
        self.page.evaluate('''tour=>{
          window.tour=structuredClone(tour);tour=window.tour;
          tour.assets={voice:{kind:'audio',uri:'./voice.mp3'}};tour.scenes[0].narration.audioAsset='voice';
          window.mediaCreated=0;
          window.fakeMedia=()=>{
            mediaCreated++;const audio=new EventTarget();
            Object.assign(audio,{currentTime:0,readyState:4,seeking:false,ended:false,paused:true,
              play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},removeAttribute(){this.src='';},load(){}});
            window.audio=audio;return audio;
          };
          window.director=sdk.createDirector({surface:options(),targets:{'app.save':()=>document.querySelector('#target')},
            narration:{resolveAsset:()=> 'https://example.test/granted.mp3',createAudio:fakeMedia}});
          window.loadResult=director.load(tour);
        }''',TOUR)
        self.assertTrue(self.page.evaluate('loadResult.ok'))
    def test_silent_start_creates_no_media(self):
        self.page.evaluate('director.play()');self.page.wait_for_timeout(220)
        self.assertEqual(self.page.evaluate('mediaCreated'),0)
        self.assertGreater(self.page.evaluate('director.inspect().timeMs'),80)
    def test_sound_uses_media_time_and_pause_freezes(self):
        self.page.evaluate('director.setNarrationEnabled(true);director.play()');self.page.wait_for_timeout(150)
        self.page.evaluate('audio.currentTime=.1');self.page.wait_for_timeout(40)
        self.assertAlmostEqual(self.page.evaluate('director.inspect().timeMs'),100,delta=1)
        self.page.evaluate('director.pause();audio.currentTime=1');self.page.wait_for_timeout(40)
        self.assertAlmostEqual(self.page.evaluate('director.inspect().timeMs'),100,delta=1)
    def test_jump_holds_then_explicit_silent_handoff_continues(self):
        self.page.evaluate('director.setNarrationEnabled(true);director.play()');self.page.wait_for_timeout(40)
        state=self.page.evaluate('director.inspect()')
        self.page.evaluate('audio.currentTime=500');self.page.wait_for_timeout(70)
        state=self.page.evaluate('director.inspect()')
        self.assertLess(state['timeMs'],200);self.assertEqual(state['narration']['error'],'MEDIA_CLOCK_INVALID')
        self.page.evaluate('director.setNarrationEnabled(false)');self.page.wait_for_timeout(180)
        self.assertGreater(self.page.evaluate('director.inspect().timeMs'),80)
    def test_caption_toggle_preserves_transcript_and_export(self):
        self.page.evaluate('window.controls=sdk.mountControls(director,document.body);director.seek({timeMs:800})')
        self.assertEqual(self.page.locator('[data-director-caption]').inner_text(),'Find Save.')
        self.page.locator('[data-command="captions"]').click()
        self.assertFalse(self.page.locator('[data-director-caption]').is_visible())
        self.page.locator('[data-director-controls] summary').click()
        self.assertIn('Find Save.',self.page.locator('[data-director-controls] details').inner_text())
        self.assertIn('WEBVTT',self.page.evaluate('director.exportCaptions().value'))
    def test_controls_offer_explicit_audio_recovery(self):
        self.page.evaluate('window.controls=sdk.mountControls(director,document.body)')
        self.page.locator('[data-command="sound"]').click();self.page.locator('[data-command="play"]').click()
        self.page.evaluate("audio.ended=true;audio.dispatchEvent(new Event('ended'))");self.page.wait_for_timeout(40)
        self.assertIn('Continue without sound',self.page.locator('[data-director-controls] [role="status"]').inner_text())
        self.page.locator('[data-command="sound"]').click();self.page.wait_for_timeout(150)
        self.assertEqual(self.page.evaluate('director.inspect().status'),'playing');self.assertEqual(self.page.evaluate('clicks'),0)
    def test_load_detaches_old_media_events(self):
        self.page.evaluate('director.setNarrationEnabled(true);director.play()');self.page.wait_for_timeout(30)
        self.page.evaluate('window.oldAudio=audio;director.load(tour);director.play();oldAudio.ended=true;oldAudio.dispatchEvent(new Event("ended"))')
        self.page.wait_for_timeout(120)
        self.assertIsNone(self.page.evaluate('director.inspect().narration.error'))
        self.assertGreater(self.page.evaluate('director.inspect().timeMs'),60)
    def test_rejected_start_is_visible_without_finishing(self):
        self.page.evaluate('director.setNarrationEnabled(true);director.play();director.pause();audio.play=()=>Promise.reject(new Error("denied"));director.play()')
        self.page.wait_for_timeout(100)
        self.assertEqual(self.page.evaluate('director.inspect().narration.error'),'MEDIA_PLAY_REJECTED')
        self.assertLess(self.page.evaluate('director.inspect().timeMs'),200)
    def test_destroy_cancels_pending_start(self):
        self.page.evaluate('director.setNarrationEnabled(true);director.play();director.pause();audio.play=()=>new Promise(resolve=>window.resolveAudio=resolve);director.play();director.destroy();resolveAudio()')
        self.page.wait_for_timeout(50)
        self.assertTrue(self.page.evaluate('audio.paused'));self.assertEqual(self.page.locator('[data-director-overlay]').count(),0)
    def test_real_audio_sync(self):
        source='data:audio/mpeg;base64,'+base64.b64encode((ROOT/'demo/assets/narration.mp3').read_bytes()).decode()
        self.page.evaluate('''source=>{director.destroy();director=sdk.createDirector({surface:options(),targets:{'app.save':()=>document.querySelector('#target')},narration:{enabled:true,resolveAsset:()=>source}});director.load(tour);window.controls=sdk.mountControls(director,document.body);}''',source)
        self.page.locator('[data-command="play"]').click()
        try:
            self.page.wait_for_function('director.inspect().timeMs>250||director.inspect().narration.error',timeout=5000)
        except Exception as error:
            self.fail(f'Real audio did not advance: {self.page.evaluate("director.inspect()")}; {error}')
        state=self.page.evaluate('director.inspect()')
        self.assertIsNone(state['narration']['error'],state)
        self.assertGreater(state['timeMs'],250,state);self.assertLess(state['timeMs'],3000,state)
        self.assertEqual(state['narration']['authority'],'audio');self.assertGreater(state['narration']['samples'],0)
        self.assertLess(state['narration']['p95SkewMs'],100)
        print('Prepared audio clock/DOM skew:',state['narration'],flush=True)
