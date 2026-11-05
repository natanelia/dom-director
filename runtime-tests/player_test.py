"""Real-DOM player checks. Default transport is HTTP; memory fallback is explicit."""
import unittest
from harness import BrowserFixture

TOUR={
    'schemaVersion':'0.1.0-draft.1','id':'browser-tour','title':'Browser tour','locale':'en',
    'entryScene':'intro','modes':['watch','guide'],'capabilities':[],
    'targets':{'save':{'ref':'app.save'}},
    'scenes':[{'id':'intro','title':'Introduction','summary':'Find the real save control.','durationMs':5000,
        'narration':{'transcript':'Find Save.','cues':[{'id':'words','startMs':0,'endMs':4000,'text':'Find Save.'}]},
        'cues':[
            {'id':'focus-save','kind':'camera','at':0,'durationMs':500,'target':'save','maxScale':2},
            {'id':'ring','kind':'highlight','at':100,'durationMs':4000,'target':'save'},
            {'id':'point','kind':'cursor','at':100,'durationMs':4000,'target':'save','gesture':'click'},
            {'id':'label','kind':'annotation','at':100,'durationMs':4000,'target':'save','text':'<img src=x onerror=alert(1)> is plain text'}
        ]}]
}
class PlayerTests(BrowserFixture):
    def setUp(self):
        super().setUp()
        self.page.evaluate('(tour)=>{window.tour=tour;window.create=()=>sdk.createDirector({surface:options(),targets:{"app.save":()=>document.querySelector("#target")}})}',TOUR)
    def prepare(self):
        result=self.page.evaluate('()=>{window.director=create();return director.load(tour)}')
        self.assertTrue(result['ok'],result)
    def test_real_time_play_pause_seek_and_no_simulated_clicks(self):
        self.prepare();self.page.evaluate('director.play()');self.page.wait_for_timeout(250)
        state=self.page.evaluate('director.inspect()');self.assertEqual(state['status'],'playing');self.assertGreater(state['timeMs'],100);self.assertLess(state['timeMs'],1500)
        self.assertEqual(self.page.evaluate('clicks'),0)
        self.page.evaluate('director.pause()');before=self.page.evaluate('director.inspect().timeMs');self.page.wait_for_timeout(80);self.assertEqual(self.page.evaluate('director.inspect().timeMs'),before)
        self.page.evaluate('director.seek({timeMs:800})');a=self.page.evaluate('director.surface.pose')
        self.page.evaluate('director.seek({timeMs:0});director.seek({timeMs:800})');b=self.page.evaluate('director.surface.pose')
        for k in a:self.assertAlmostEqual(a[k],b[k],delta=.02)
        self.assertEqual(self.page.evaluate('clicks'),0)
        self.page.locator('#target').click();self.assertEqual(self.page.evaluate('clicks'),1)
    def test_annotations_never_interpret_markup(self):
        self.prepare();self.page.evaluate('director.seek({timeMs:800})')
        note=self.page.locator('[data-director-overlay] [data-kind="annotation"]')
        self.assertIn('<img src=x',note.inner_text());self.assertEqual(note.locator('img').count(),0)
        self.assertEqual(self.page.locator('[data-director-overlay] [data-kind="cursor"]').get_attribute('aria-hidden'),'true')
    def test_pointer_and_keyboard_takeover_pause_at_current_position(self):
        self.prepare();self.page.evaluate('director.play()');self.page.wait_for_timeout(600)
        self.page.locator('#target').click();self.assertEqual(self.page.evaluate('director.inspect().status'),'paused')
        self.page.evaluate('director.play()');self.page.wait_for_timeout(80);self.page.keyboard.press('Escape');self.assertEqual(self.page.evaluate('director.inspect().status'),'paused')
    def test_missing_ambiguous_private_and_secret_targets_fail_closed(self):
        for definition in ["()=>null", "()=>[document.querySelector('#target')]", "{label:'Private',sensitivity:'private',resolve:()=>document.querySelector('#target')}", "{label:'Secret',sensitivity:'secret',resolve:()=>document.querySelector('#target')}"]:
            result=self.page.evaluate("(()=>{const d=sdk.createDirector({surface:options(),targets:{'app.save':"+definition+"}});const result=d.load(tour);d.destroy();return result})()")
            self.assertFalse(result['ok'],result)
        self.assertEqual(self.page.evaluate("sdk.createTargetRegistry({'app.save':{label:'Secret',sensitivity:'secret',resolve:()=>document.querySelector('#target')}}).catalog().length"),0)
    def test_hidden_target_is_not_silently_focused(self):
        self.page.locator('#target').evaluate("el=>el.style.visibility='hidden'")
        result=self.page.evaluate('()=>{const d=create();const r=d.load(tour);d.destroy();return r}')
        self.assertFalse(result['ok'])
    def test_target_replacement_and_explicit_invalidation_remeasure(self):
        self.prepare();self.page.evaluate('director.seek({timeMs:900})')
        original=self.page.evaluate('director.surface.pose')
        self.page.evaluate("()=>{const old=document.querySelector('#target'),next=old.cloneNode(true);next.style.left='620px';old.replaceWith(next);director.registry.invalidate();}")
        self.page.wait_for_timeout(60)
        updated=self.page.evaluate('director.surface.pose');self.assertNotEqual(original['x'],updated['x'])
        self.assertEqual(self.page.evaluate('director.inspect().status'),'paused')
    def test_reduced_motion_preserves_explanation_without_cursor_or_zoom(self):
        self.page.emulate_media(reduced_motion='reduce');self.prepare();self.page.evaluate('director.seek({timeMs:1000})')
        self.assertEqual(self.page.evaluate('director.surface.pose'),{'x':0,'y':0,'scale':1})
        self.assertEqual(self.page.locator('[data-kind="cursor"]').count(),0)
        self.assertEqual(self.page.evaluate('director.inspect().caption'),'Find Save.')
        self.assertEqual(self.page.locator('[data-kind="annotation"]').count(),1)
    def test_hidden_page_does_not_auto_resume_or_fast_forward(self):
        self.prepare();self.page.evaluate('director.play()');self.page.wait_for_timeout(80)
        self.page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
        self.assertFalse(self.page.evaluate('director.play().ok'));position=self.page.evaluate('director.inspect().timeMs')
        self.page.wait_for_timeout(100);self.page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
        self.assertEqual(self.page.evaluate('director.inspect().timeMs'),position)
        self.assertNotEqual(self.page.evaluate('director.inspect().status'),'playing')
    def test_stop_destroy_and_recreate_remove_owned_overlays(self):
        self.prepare();self.page.evaluate('director.seek({timeMs:1000});director.stop()')
        self.assertEqual(self.page.locator('[data-cue]').count(),0)
        self.page.evaluate('director.destroy();director.destroy()');self.assertEqual(self.page.locator('[data-director-overlay]').count(),0)
        self.assertEqual(self.page.locator('#scene').evaluate('(el)=>el.style.transform'),'')
        self.page.evaluate('()=>{for(let i=0;i<30;i++){const d=create();if(!d.load(tour).ok)throw new Error("prepare failed");d.seek({timeMs:800});d.destroy();}}')
        self.assertEqual(self.page.locator('[data-director-overlay]').count(),0)
    def test_geometry_is_cached_between_steady_frames(self):
        self.prepare();self.page.evaluate('director.play()');self.page.wait_for_timeout(700)
        before=self.page.evaluate('director.inspect().geometryReads');self.page.wait_for_timeout(250)
        after=self.page.evaluate('director.inspect().geometryReads');self.assertLessEqual(after-before,1)
    def test_dynamic_target_keeps_camera_advancing_and_completion_cleans_up(self):
        self.prepare()
        self.page.evaluate("window.diagnostics=[];director.on(event=>{if(event.detail?.diagnostic)window.diagnostics.push(event.detail.diagnostic)})")
        result=self.page.evaluate('director.play()')
        self.assertTrue(result['ok'],result)
        self.page.evaluate("window.mover=setInterval(()=>{document.querySelector('#target').style.left=(480+Math.sin(performance.now()/100)*10)+'px';director.registry.invalidate()},16)")
        self.page.wait_for_timeout(320)
        state=self.page.evaluate('director.inspect()')
        details={'play':result,'state':state,'diagnostics':self.page.evaluate('window.diagnostics')}
        pose=self.page.evaluate('director.surface.pose')
        self.assertEqual(state['status'],'playing',details)
        self.assertGreater(state['timeMs'],150,details)
        self.assertGreater(pose['scale'],1.01,details)
        self.page.evaluate('clearInterval(mover);director.pause()')
        result=self.page.evaluate("async()=>{const pending=director.waitForCompletion(director.inspect().runId);director.stop();return await pending}")
        self.assertEqual(result['status'],'cancelled')
    def test_native_controls_keyboard_transcript_and_cleanup(self):
        self.prepare();self.page.evaluate("window.controls=sdk.mountControls(director,document.querySelector('#controls'))")
        self.page.locator('[data-command="play"]').press('Space');self.page.wait_for_timeout(120)
        self.assertEqual(self.page.evaluate('director.inspect().status'),'playing')
        self.page.locator('[data-command="play"]').press('Enter');self.assertEqual(self.page.evaluate('director.inspect().status'),'paused')
        self.page.locator('[data-director-controls] summary').click()
        self.assertIn('Find Save.',self.page.locator('[data-director-controls] details').inner_text())
        self.page.locator('#input').focus();self.page.keyboard.type('A space remains input');self.assertEqual(self.page.locator('#input').input_value(),'A space remains input')
        self.page.evaluate('controls.destroy();controls.destroy()');self.assertEqual(self.page.locator('[data-director-controls]').count(),0)
    def test_controls_are_not_allowed_inside_transformed_scene(self):
        self.prepare();self.assertEqual(self.page.evaluate("(()=>{try{sdk.mountControls(director,document.querySelector('#scene'))}catch(e){return e.diagnostic.code}})()"),'CONTROLS_SURFACE')
    def test_transcript_remains_readable_when_initial_target_is_missing(self):
        self.page.evaluate("window.director=create();document.querySelector('#target').remove();director.load(tour);window.controls=sdk.mountControls(director,document.querySelector('#controls'))")
        self.page.locator('[data-director-controls] summary').click();self.assertIn('Find Save.',self.page.locator('[data-director-controls] details').inner_text())
    def test_prior_route_targets_can_unmount_after_scene_completion(self):
        self.page.evaluate("""() => {
          const second=document.createElement('button');second.id='second';second.textContent='New route';
          second.style.cssText='position:absolute;left:240px;top:160px;width:100px;height:60px';
          document.querySelector('#scene').append(second);
          const script=structuredClone(tour);script.targets.second={ref:'app.second'};
          script.scenes[0].durationMs=150;script.scenes[0].next='second';
          script.scenes[0].cues=[{id:'first-focus',kind:'camera',at:0,durationMs:100,target:'save',maxScale:2}];delete script.scenes[0].narration;
          script.scenes.push({id:'second',title:'Second',summary:'New route',durationMs:2000,cues:[{id:'second-focus',kind:'camera',at:0,durationMs:100,target:'second',maxScale:2}]});
          window.director=sdk.createDirector({surface:options(),targets:{'app.save':()=>document.querySelector('#target'),'app.second':()=>document.querySelector('#second')}});
          if(!director.load(script).ok)throw new Error('load failed');
          director.on(event=>{if(event.type==='scene-completed'&&event.sceneId==='intro')document.querySelector('#target').remove()});
          director.play();
        }""")
        self.page.wait_for_timeout(500)
        state=self.page.evaluate('director.inspect()')
        self.assertEqual(state['sceneId'],'second',state)
        self.assertEqual(state['status'],'playing',state)
    def test_unsupported_mode_preserves_current_script(self):
        self.prepare()
        result=self.page.evaluate("()=>{const bad=structuredClone(tour);bad.modes=['guide'];return director.load(bad)}")
        self.assertFalse(result['ok'])
        self.assertTrue(self.page.evaluate('director.play().ok'))
    def test_unregistered_reference_preserves_current_script(self):
        self.prepare();result=self.page.evaluate("()=>{const bad=structuredClone(tour);bad.targets.save.ref='missing';return director.load(bad)}")
        self.assertFalse(result['ok']);self.assertEqual(self.page.evaluate('director.inspect().sceneId'),'intro')

if __name__=='__main__':unittest.main(verbosity=2)
