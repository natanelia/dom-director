"""Actual host-state gates, explicit mode changes and fixture-reset integration."""
from harness import BrowserFixture
from player_test import TOUR

class GuidanceTests(BrowserFixture):
    def setUp(self):
        super().setUp()
        self.page.evaluate('''tour=>{
          window.tour=structuredClone(tour);tour=window.tour;
          tour.modes=['watch','try','guide'];tour.capabilities=['condition:saved','fixture:reset'];
          tour.scenes[0].cues.push({id:'saved-gate',kind:'gate',at:300,conditionRef:'saved',timeoutMs:1000,instruction:'Wait for server confirmation.'});
          window.saved=false;window.revision=0;window.observers=new Set();window.resets=0;window.granted=true;
          window.commitSave=()=>{saved=true;revision++;for(const notify of [...observers])notify();};
          window.guidance=sdk.createGuidance({authorize:()=>granted,
            conditions:{saved:{evidence:'server',hints:['Check whether the server acknowledged the save.'],read:()=>({satisfied:saved,revision}),subscribe:fn=>{observers.add(fn);return()=>observers.delete(fn);}}},
            fixture:{isolated:true,reset:()=>{saved=false;resets++;return {completed:true};}}});
          window.director=sdk.createDirector({surface:options(),targets:{'app.save':()=>document.querySelector('#target')},guidance});
          window.loaded=director.load(tour);window.controls=sdk.mountControls(director,document.body);
        }''',TOUR)
        self.assertTrue(self.page.evaluate('loaded.ok'))
    def gate(self):
        self.page.evaluate('director.play()')
        self.page.wait_for_function('director.inspect().waitingFor?.kind==="gate"')
        self.page.wait_for_function('observers.size===1')
    def test_real_click_is_not_a_server_outcome(self):
        self.gate();self.page.locator('#target').click();self.page.wait_for_timeout(80)
        self.assertEqual(self.page.evaluate('clicks'),1)
        self.assertIsNotNone(self.page.evaluate('director.inspect().waitingFor'))
        self.page.evaluate('commitSave()');self.page.wait_for_function('director.inspect().waitingFor===null')
        self.assertEqual(self.page.evaluate('observers.size'),0)
    def test_authored_hint_is_plain_text_and_not_an_action(self):
        self.gate();self.page.locator('[data-command="hint"]').click()
        self.assertIn('server acknowledged',self.page.locator('[data-director-hint]').inner_text())
        self.assertEqual(self.page.evaluate('clicks'),0)
    def test_user_pause_survives_late_condition_success(self):
        self.gate();self.page.evaluate('director.pause();commitSave()')
        self.page.wait_for_function('director.inspect().waitingFor===null')
        self.assertEqual(self.page.evaluate('director.inspect().status'),'paused')
    def test_seek_does_not_bypass_a_required_outcome(self):
        result=self.page.evaluate('director.seek({timeMs:900})')
        self.assertFalse(result['ok']);self.assertEqual(result['diagnostics'][0]['code'],'SEEK_BARRIER')
        self.assertEqual(self.page.evaluate('clicks'),0)
    def test_mode_and_fixture_reset_are_explicit_and_pause(self):
        result=self.page.evaluate('director.setMode("try")');self.assertTrue(result['ok'],result)
        self.assertEqual(self.page.evaluate('director.inspect().mode'),'try')
        self.page.evaluate('commitSave()');run=self.page.evaluate('director.inspect().runId')
        self.page.locator('[data-command="reset"]').click()
        self.page.wait_for_function('resets===1&&director.inspect().pendingOperation===null')
        self.assertFalse(self.page.evaluate('saved'));self.assertNotEqual(run,self.page.evaluate('director.inspect().runId'))
        self.assertEqual(self.page.evaluate('director.inspect().status'),'ready')
    def test_denied_mode_does_not_commit(self):
        self.page.evaluate('granted=false');result=self.page.evaluate('director.setMode("guide")')
        self.assertFalse(result['ok']);self.assertEqual(self.page.evaluate('director.inspect().mode'),'watch')
    def test_stop_cancels_async_mode_preparation(self):
        self.page.evaluate('''director.destroy();guidance=sdk.createGuidance({authorize:()=>new Promise(resolve=>window.approveMode=resolve)});
          const clean=structuredClone(tour);clean.scenes[0].cues=clean.scenes[0].cues.filter(c=>c.kind!=='gate');
          director=sdk.createDirector({surface:options(),targets:{'app.save':()=>document.querySelector('#target')},guidance});director.load(clean);
          window.result=director.setMode('guide');''')
        self.page.wait_for_function('!!window.approveMode')
        self.page.evaluate('director.stop();approveMode(true)')
        result=self.page.evaluate('result');self.assertFalse(result['ok'])
        self.assertEqual(self.page.evaluate('director.inspect().mode'),'watch')
    def test_gate_timeout_can_be_extended_without_faking_completion(self):
        self.gate();self.page.wait_for_function('director.inspect().waitingFor?.error==="TIMEOUT"')
        self.page.locator('[data-command="extend"]').click();self.page.wait_for_function('observers.size===1')
        self.assertIsNone(self.page.evaluate('director.inspect().waitingFor.error'))
        self.page.evaluate('commitSave()');self.page.wait_for_function('director.inspect().waitingFor===null')
        self.assertEqual(self.page.evaluate('director.inspect().status'),'playing')
    def test_destroy_removes_active_host_condition_subscriptions(self):
        self.gate();self.page.evaluate('controls.destroy();director.destroy()');self.page.wait_for_timeout(30)
        self.assertEqual(self.page.evaluate('observers.size'),0)
    def test_foreground_gate_deadline_pauses_when_document_is_hidden(self):
        self.gate();self.page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        self.page.wait_for_timeout(1200)
        self.assertIsNone(self.page.evaluate('director.inspect().waitingFor.error'))
        self.page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));commitSave()")
        self.page.wait_for_function('director.inspect().waitingFor===null')
        self.assertNotEqual(self.page.evaluate('director.inspect().status'),'playing')
    def test_pause_control_and_escape_work_while_waiting(self):
        self.gate();self.page.locator('[data-command="play"]').click()
        self.assertEqual(self.page.evaluate('director.inspect().status'),'paused')
        self.page.evaluate('commitSave()');self.page.wait_for_function('director.inspect().waitingFor===null')
        self.assertEqual(self.page.evaluate('director.inspect().status'),'paused')
    def test_stop_preserves_unknown_action_and_retry_requires_host_reconciliation(self):
        self.page.evaluate('''director.destroy();window.effects=0;window.finish=null;
          guidance=sdk.createGuidance({authorize:()=>true,actions:{save:{impact:'persistent',idempotent:true,validate:()=>true,
            execute:()=>{effects++;return new Promise(resolve=>finish=resolve);},reconcile:()=> 'succeeded'}}});
          const scripted=structuredClone(tour);scripted.capabilities=['action:save'];scripted.scenes[0].cues=[{id:'save-effect',kind:'action',at:0,actionRef:'save',args:{},timeoutMs:1000}];
          director=sdk.createDirector({surface:options(),targets:{'app.save':()=>document.querySelector('#target')},guidance,mode:'guide'});director.load(scripted);director.play();''')
        self.page.wait_for_function('effects===1');self.page.evaluate('director.stop();finish({completed:true})')
        self.page.wait_for_function('guidance.inspect()[0].state==="unknown"')
        self.page.evaluate('director.play()');self.page.wait_for_function('director.inspect().waitingFor?.error==="ACTION_OUTCOME_UNKNOWN"')
        self.assertEqual(self.page.evaluate('effects'),1)
        self.page.evaluate('guidance.reconcile(guidance.inspect()[0].key)');self.page.evaluate('director.retryBarrier()')
        self.page.wait_for_function('director.inspect().waitingFor===null');self.assertEqual(self.page.evaluate('effects'),1)
    def test_pause_observer_can_cancel_mode_change_before_authorization(self):
        self.page.evaluate("window.unsubscribeTest=director.on(event=>{if(event.type==='paused'){window.unsubscribeTest();director.stop();}});true")
        result=self.page.evaluate('director.setMode("guide")')
        self.assertFalse(result['ok']);self.assertEqual(self.page.evaluate('director.inspect().mode'),'watch')
