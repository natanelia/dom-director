import base64, json, os
from harness import BrowserFixture, ROOT

class SharedScenarioTests(BrowserFixture):
    def setUp(self):
        super().setUp()
        if os.environ.get('RUNTIME_TRANSPORT')=='memory':
            imports={}
            for module in (ROOT/'packages/core/src').glob('*.js'):
                source=module.read_text().replace("from './", "from '@runtime/")
                imports['@runtime/'+module.name]='data:text/javascript;base64,'+base64.b64encode(source.encode()).decode()
            source=(ROOT/'examples/browser/shared-scenario.mjs').read_text().replace('../../packages/core/src/index.js','@runtime/index.js')
            html=(ROOT/'examples/browser/shared-scenario.html').read_text()
            mapping='<script type="importmap">'+json.dumps({'imports':imports})+'</script>'
            html=html.replace('<script type="module" src="./shared-scenario.mjs"></script>',mapping+'<script type="module">'+source+'</script>')
            self.page.set_content(html)
        else:
            self.page.goto(f'http://127.0.0.1:{self.server.server_port}/examples/browser/shared-scenario.html')
        self.page.wait_for_function("document.querySelector('#runtime-status').dataset.status==='ready'")
    def mode(self,mode):
        self.page.locator('[data-scenario-mode="'+mode+'"]').click()
        self.page.wait_for_function("mode=>document.querySelector('[data-scenario-mode=\"'+mode+'\"]').getAttribute('aria-pressed')==='true'",arg=mode)
        self.page.wait_for_function("!document.querySelector('[data-scenario-mode]').disabled")
    def play(self):self.page.locator('[data-command="play"]').click()
    def wait_gate(self):self.page.wait_for_function("document.querySelector('#runtime-status').dataset.waiting==='gate'")
    def approve(self):
        self.page.locator('#reviewed').check();self.page.locator('#approve-checkpoint').click()
    def test_watch_finishes_without_approving(self):
        self.play()
        self.page.wait_for_function("document.querySelector('#runtime-status').dataset.status==='completed'",timeout=15000)
        self.assertEqual(self.page.locator('#approved-count').inner_text(),'24')
        self.assertTrue(self.page.locator('#approve-checkpoint').is_disabled())
    def test_try_requires_real_input_and_reset_is_explicit(self):
        self.mode('try');self.play();self.wait_gate()
        self.assertEqual(self.page.locator('#approved-count').inner_text(),'24')
        self.assertTrue(self.page.locator('#approve-checkpoint').is_disabled())
        self.approve()
        self.page.wait_for_function("document.querySelector('#runtime-status').dataset.status==='completed'",timeout=10000)
        self.assertEqual(self.page.locator('#approved-count').inner_text(),'25')
        self.page.locator('[data-command="stop"]').click()
        self.assertEqual(self.page.locator('#approved-count').inner_text(),'25')
        self.page.locator('[data-command="reset"]').click()
        self.page.wait_for_function("document.querySelector('#approved-count').textContent==='24'")
    def test_guide_waits_at_boundaries_and_for_user_approval(self):
        self.mode('guide');self.play()
        self.page.locator('[data-command="next"]').wait_for(state='visible')
        self.assertEqual(self.page.locator('#runtime-status').get_attribute('data-scene'),'overview')
        self.page.locator('[data-command="next"]').click();self.wait_gate();self.approve()
        self.page.locator('[data-command="next"]').wait_for(state='visible')
        self.assertEqual(self.page.locator('#runtime-status').get_attribute('data-scene'),'review')
        self.page.locator('[data-command="next"]').click()
        self.page.wait_for_function("document.querySelector('#runtime-status').dataset.status==='completed'")
    def test_policy_denial_remains_denied_until_authorized_retry(self):
        self.page.locator('#allow-observation').uncheck();self.play()
        self.page.wait_for_function("document.querySelector('#runtime-status').dataset.error==='CAPABILITY_DENIED'")
        self.assertEqual(self.page.locator('#runtime-status').get_attribute('data-scene'),'review')
        self.page.locator('#allow-observation').check();self.page.locator('[data-command="retry"]').click()
        self.page.wait_for_function("document.querySelector('#runtime-status').dataset.status==='completed'",timeout=10000)
        self.assertEqual(self.page.locator('#approved-count').inner_text(),'24')
    def test_save_restore_is_paused_and_fixture_changes_invalidate(self):
        self.mode('try')
        slider=self.page.get_by_role('slider',name='Scene position')
        slider.evaluate('(el)=>{el.value="500";el.dispatchEvent(new Event("input",{bubbles:true}));}')
        self.page.locator('#save-position').click()
        self.page.wait_for_function("!document.querySelector('#restore-position').disabled")
        slider.evaluate('(el)=>{el.value="1000";el.dispatchEvent(new Event("input",{bubbles:true}));}')
        self.page.locator('#restore-position').click()
        self.page.wait_for_function("document.querySelector('#scenario-message').textContent.startsWith('Position restored')")
        self.assertEqual(float(slider.input_value()),500)
        self.assertEqual(self.page.locator('#runtime-status').get_attribute('data-status'),'paused')
        self.page.locator('#reviewed').check();self.page.locator('#restore-position').click()
        self.page.wait_for_function("document.querySelector('#scenario-message').textContent.startsWith('CHECKPOINT_INCOMPATIBLE')")
    def test_mobile_and_reduced_motion_keep_task_reachable(self):
        self.page.set_viewport_size({'width':390,'height':844});self.page.emulate_media(reduced_motion='reduce')
        self.mode('try');self.play();self.wait_gate();self.approve()
        self.assertEqual(self.page.locator('#approved-count').inner_text(),'25')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.assertTrue(self.page.locator('[data-command="stop"]').is_visible())
    def test_try_cannot_scrub_past_unresolved_gate(self):
        self.mode('try');self.play();self.wait_gate()
        self.page.get_by_role('slider',name='Scene position').evaluate('(el)=>{el.value="2900";el.dispatchEvent(new Event("input",{bubbles:true}));}')
        self.assertEqual(self.page.locator('#runtime-status').get_attribute('data-scene'),'review')
        self.assertEqual(self.page.locator('#approved-count').inner_text(),'24')
        self.assertEqual(self.page.locator('#runtime-status').get_attribute('data-waiting'),'gate')
