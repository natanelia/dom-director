"""Native layout/error-state regressions; probes observe but do not replace geometry."""
import json
import unittest
import browser_test as baseline

PROBE = r"""() => {
  const ids=new Set(['stage','scene','metrics','route-map','review','app-review']);
  const rect=Element.prototype.getBoundingClientRect;
  const text=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
  const trace=window.canvasProbe={messages:[],zeroReads:[],events:[]};
  const sizes=()=>[...ids].map(id=>{const e=document.getElementById(id);if(!e)return {id,missing:true};const r=rect.call(e);return {id,x:r.x,y:r.y,width:r.width,height:r.height,clientWidth:e.clientWidth,clientHeight:e.clientHeight};});
  Element.prototype.getBoundingClientRect=function(...args){
    const r=rect.apply(this,args);
    if(ids.has(this.id)&&(!Number.isFinite(r.width)||!Number.isFinite(r.height)||r.width<=0||r.height<=0)&&trace.zeroReads.length<30)
      trace.zeroReads.push({id:this.id,width:r.width,height:r.height,stack:new Error().stack,sizes:sizes()});
    return r;
  };
  Object.defineProperty(Node.prototype,'textContent',{
    configurable:true,get(){return text.get.call(this);},set(value){
      if(this.id==='status'&&trace.messages.length<100)trace.messages.push({text:String(value),sizes:/bounds|geometry|surface|target/i.test(value)?sizes():null,stack:/bounds/i.test(value)?new Error().stack:null});
      return text.set.call(this,value);
    }
  });
  for(const type of ['pointerdown','click'])document.addEventListener(type,event=>{
    if(trace.events.length<50)trace.events.push({type,id:event.target.id,tag:event.target.tagName});
  },true);
}"""

class StudioCanvasTests(baseline.StudioTests):
    def setUp(self):
        self.page = self.browser.new_page(viewport={'width':1440,'height':1000})
        self.page.set_default_timeout(8000)
        self.errors=[];self.requests=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('request',lambda request:self.requests.append(request.url))
        self.page.add_init_script('('+PROBE+')()')
        self.page.goto(self.url+'?verify='+__import__('os').environ.get('DEPLOYED_SHA','local'))
        self.page.wait_for_function("document.querySelector('#studio')?.dataset.ready==='true'")
        self.assert_no_geometry_errors()

    def tearDown(self):
        try:
            trace=self.page.evaluate('({...window.canvasProbe,microphone:window.microphoneProbe||null})')
            (self.output/(self._testMethodName+'.json')).write_text(json.dumps(trace,indent=2))
            print(json.dumps({'canvasCase':self._testMethodName,'trace':trace}),flush=True)
        finally:
            super().tearDown()

    def assert_no_geometry_errors(self):
        trace=self.page.evaluate('window.canvasProbe')
        errors=[m for m in trace['messages'] if 'Bounds must be' in m['text'] or 'Studio could not start' in m['text']]
        self.assertEqual(errors,[],json.dumps(trace))

    def test_mobile_edit_preview_stop_has_no_geometry_error(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.emulate_media(reduced_motion='reduce')
        self.edit('#caption-text','Edited with a phone-sized viewport.')
        self.page.locator('#preview-tour').focus()
        self.page.keyboard.press('Enter')
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>.2")
        self.page.keyboard.press('Escape')
        self.page.wait_for_timeout(100)
        self.assert_no_geometry_errors()
        self.page.screenshot(path=str(self.output/'mobile-canvas-checked.png'),full_page=True)
        self.page.wait_for_timeout(100)
        self.assert_no_geometry_errors()
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'),'paused')

    def test_resizing_and_scrolling_keep_scene_measurements_valid(self):
        for width in [390,320,768,1024,1440,390]:
            self.page.set_viewport_size({'width':width,'height':844})
            for at in [0,9,18]:
                self.seek(at)
                self.page.locator('#caption-text').scroll_into_view_if_needed()
                self.page.wait_for_timeout(50)
                self.assert_no_geometry_errors()
        self.page.locator('#preview-tour').click()
        self.page.wait_for_function("document.querySelector('#studio').dataset.playback==='playing'")
        self.page.locator('#stop').click()
        self.assert_no_geometry_errors()

    def test_recording_denial_stays_visible_after_dialog_and_layout_changes(self):
        self.mock_recording_boundary()
        before=self.project()
        self.page.evaluate("""()=>{window.micCalls=0;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{
          configurable:true,value:()=>{micCalls++;try{const error=new DOMException('Synthetic denial','NotAllowedError');
            window.microphoneProbe={name:error.name,message:error.message,code:error.code,tag:Object.prototype.toString.call(error)};
            return Promise.reject(error);
          }catch(error){window.microphoneProbe={constructionFailure:true,name:error.name,message:error.message};throw error;}}
        });}""")
        self.choose('voice')
        self.page.locator('#record-audio').click()
        self.page.wait_for_function("window.micCalls===1")
        self.page.wait_for_function("document.querySelector('#status').textContent.includes('permission was not granted')")
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('#voice-script').scroll_into_view_if_needed()
        self.page.wait_for_timeout(100)
        self.assert_no_geometry_errors()
        self.assertIn('permission was not granted',self.page.locator('#status').inner_text())
        self.assertFalse(self.page.locator('#dialog').is_visible())
        self.assertEqual(self.project(),before)

    def test_temporary_empty_viewport_pauses_without_a_geometry_failure_and_recovers(self):
        before=self.project()
        self.page.locator('#preview-tour').click()
        self.page.wait_for_function("Number(document.querySelector('#seek').value)>.2")
        self.page.evaluate("document.querySelector('#stage').style.height='0px'")
        self.page.wait_for_timeout(120)
        self.assert_no_geometry_errors()
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'),'paused')
        self.page.evaluate("document.querySelector('#stage').style.removeProperty('height')")
        self.page.wait_for_timeout(100)
        self.assert_no_geometry_errors()
        at=float(self.page.locator('#seek').input_value())
        self.page.locator('#play').click()
        self.page.wait_for_function("at=>Number(document.querySelector('#seek').value)>at+.15",arg=at)
        self.page.locator('#stop').click()
        self.assertEqual(self.project(),before)

    def test_a_missing_focus_still_fails_instead_of_reusing_stale_measurements(self):
        self.page.evaluate("document.querySelector('#metrics').remove()")
        self.seek(9)
        self.page.wait_for_function("document.querySelector('#status').classList.contains('error')")
        self.assertIn('target',self.page.locator('#status').inner_text().lower())
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'),'paused')


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(StudioCanvasTests(name) for name in StudioCanvasTests.__dict__ if name.startswith('test_'))

if __name__=='__main__':
    unittest.main(verbosity=2)
