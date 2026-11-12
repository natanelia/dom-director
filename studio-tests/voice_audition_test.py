"""Non-destructive A/B listening in the actual staged or verified public Studio."""
import json
from browser_test import StudioTests, wav
import unittest


class StudioVoiceAuditionTests(StudioTests):
    def instrument(self):
        # Observe real Web Audio nodes; clocks, decoding and playback are not replaced.
        self.page.evaluate("""()=>{
          window.auditionNodes=[];
          const original=AudioContext.prototype.createBufferSource;
          AudioContext.prototype.createBufferSource=function(...args){
            const source=original.apply(this,args),record={stopped:false,disconnected:false,ended:false,args:null};
            auditionNodes.push(record);
            const start=source.start.bind(source),stop=source.stop.bind(source),disconnect=source.disconnect.bind(source);
            source.start=(...args)=>{record.args=args;return start(...args);};
            source.stop=(...args)=>{record.stopped=true;return stop(...args);};
            source.disconnect=(...args)=>{record.disconnected=true;return disconnect(...args);};
            source.addEventListener('ended',()=>{record.ended=true;});return source;
          };
        }""")

    def take(self, seconds=2):
        self.choose('voice')
        self.page.locator('#audio-file').set_input_files({'name':'Comparison take.wav','mimeType':'audio/wav','buffer':wav(seconds)})
        self.page.locator('#take-comparison').wait_for()

    def listen(self, kind):
        self.page.locator('#audition-'+kind).click()
        self.page.wait_for_function("kind=>{const p=document.querySelector('#take-comparison');return p?.dataset.state==='playing'&&p.dataset.choice===kind;}",arg=kind)

    def silent(self):
        self.assertTrue(self.page.evaluate('auditionNodes.every(n=>!n.args||n.stopped||n.ended)'))
        self.assertTrue(self.page.evaluate('auditionNodes.every(n=>n.disconnected)'))

    def cancel(self):
        self.page.locator('#dialog-actions').get_by_role('button',name='Cancel',exact=True).click()

    def test_opening_available_take_is_silent_and_cancel_preserves_project(self):
        self.instrument();before=self.project();self.choose('voice')
        self.page.get_by_text('Available takes',exact=True).click()
        self.page.locator('#inspector details').filter(has=self.page.get_by_text('Available takes',exact=True)).locator('.clip-list-item').nth(1).click()
        self.assertEqual(self.page.locator('#take-comparison').get_attribute('data-state'),'idle')
        self.assertFalse([r for r in self.requests if '.mp3' in r])
        self.assertEqual(self.page.evaluate('auditionNodes.length'),0)
        self.cancel();self.assertEqual(self.project(),before)

    def test_a_b_switch_uses_one_source_and_keeps_playhead_and_project_unchanged(self):
        self.instrument();before=self.project();self.seek(1.25);self.take(4)
        at=self.page.locator('#seek').input_value();version=self.page.locator('#revision').inner_text()
        self.listen('current');self.assertEqual(self.page.locator('#audition-current').get_attribute('aria-pressed'),'true')
        self.listen('new')
        self.assertEqual(self.page.locator('#audition-current').get_attribute('aria-pressed'),'false')
        self.assertEqual(self.page.evaluate('auditionNodes.filter(n=>n.args&&!n.stopped&&!n.ended).length'),1)
        self.assertEqual(self.page.locator('#seek').input_value(),at);self.assertEqual(self.page.locator('#revision').inner_text(),version)
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'),'paused')
        self.assertEqual(self.page.locator('#sound').inner_text(),'Sound off')
        self.page.locator('#audition-stop').click();self.silent();self.cancel();self.assertEqual(self.project(),before)

    def test_escape_during_pending_load_cannot_start_audio_later(self):
        self.instrument();held=[]
        self.page.route('**/assets/voice.overview.mp3',lambda route:held.append(route))
        self.take();self.page.locator('#audition-current').click()
        self.page.wait_for_function("document.querySelector('#take-comparison').dataset.state==='loading'")
        self.page.keyboard.press('Escape');self.page.locator('#dialog').wait_for(state='hidden')
        for route in held:
            try:route.fulfill(status=200,content_type='audio/wav',body=wav(8))
            except Exception:pass  # Aborted requests may already be closed by the browser.
        self.page.wait_for_timeout(100);self.silent()
        self.assertEqual(self.page.evaluate('auditionNodes.length'),0)

    def test_accepting_a_listened_take_is_one_undoable_edit(self):
        self.instrument();before=self.project();self.take();self.listen('new')
        self.page.locator('#dialog-actions').get_by_role('button',name='Keep scene timing',exact=True).click()
        self.page.locator('#dialog').wait_for(state='hidden');self.silent();after=self.project()
        self.assertNotEqual(self.clip(after,'voice.overview')['assetId'],self.clip(before,'voice.overview')['assetId'])
        for kind in ['camera','cursor','captions']:
            self.assertEqual([t for t in before['tracks'] if t['kind']==kind],[t for t in after['tracks'] if t['kind']==kind])
        self.page.locator('#undo').click();self.assertEqual(self.project(),before)

    def test_failed_replacement_keeps_audition_usable_and_retime_review_stops_it(self):
        self.instrument();before=self.project();self.take(9);self.listen('new')
        self.page.locator('#dialog-actions').get_by_role('button',name='Keep scene timing',exact=True).click()
        self.assertIn('longer than',self.page.locator('#dialog-body .error').inner_text());self.silent()
        self.listen('new');self.page.locator('#dialog-actions').get_by_role('button',name='Fit scene to voice',exact=True).click()
        self.assertEqual(self.page.locator('#dialog-title').inner_text(),'Review timing changes');self.silent()
        self.cancel();self.assertEqual(self.project(),before)

    def test_short_take_finishes_and_replay_creates_a_fresh_source(self):
        self.instrument();self.take(.3);self.page.locator('#audition-new').click()
        self.page.wait_for_function("document.querySelector('#take-comparison').dataset.state==='ended'")
        self.assertTrue(self.page.locator('#audition-stop').is_disabled());self.silent()
        self.page.locator('#audition-new').click()
        self.page.wait_for_function("document.querySelector('#take-comparison').dataset.state==='ended'")
        self.assertEqual(self.page.evaluate('auditionNodes.length'),2);self.cancel()

    def test_failure_to_load_current_does_not_prevent_listening_to_imported_take(self):
        self.instrument();self.page.route('**/assets/voice.overview.mp3',lambda route:route.fulfill(status=404,body='Missing test voice'))
        self.take();self.page.locator('#audition-current').click()
        self.page.wait_for_function("document.querySelector('#take-comparison').dataset.state==='error'")
        self.assertTrue(self.page.locator('#audition-stop').is_disabled())
        self.listen('new');self.cancel();self.silent()

    def test_mobile_keyboard_listening_and_escape_leave_the_tour_paused(self):
        self.instrument();self.page.set_viewport_size({'width':390,'height':844});self.take(4)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.locator('#audition-new').focus();self.page.keyboard.press('Enter')
        self.page.wait_for_function("document.querySelector('#take-comparison').dataset.state==='playing'")
        self.page.screenshot(path=str(self.output/'voice-audition-mobile.png'),full_page=True)
        self.page.keyboard.press('Escape');self.page.locator('#dialog').wait_for(state='hidden');self.silent()
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'),'paused')
        self.assertEqual(self.page.locator('#sound').inner_text(),'Sound off')

    def test_native_dialog_close_also_releases_listening(self):
        self.instrument();self.take(4);self.listen('new')
        self.page.locator('#dialog').evaluate('dialog=>dialog.close()')
        self.page.wait_for_function('auditionNodes.every(n=>n.disconnected)')
        self.silent();self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'),'paused')

    def test_persisted_page_exit_stops_listening_without_resuming_on_return(self):
        self.instrument();self.take(4);self.listen('new')
        self.page.evaluate("dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));")
        self.silent();self.assertEqual(self.page.locator('#take-comparison').get_attribute('data-state'),'idle')
        self.listen('new');self.cancel();self.silent()


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(StudioVoiceAuditionTests(name) for name in StudioVoiceAuditionTests.__dict__ if name.startswith('test_'))

if __name__=='__main__':unittest.main(verbosity=2)
