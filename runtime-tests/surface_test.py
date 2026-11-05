"""Browser surface integration regressions."""
import unittest
from harness import BrowserFixture

class SurfaceTests(BrowserFixture):
    def test_focus_hit_testing_layout_and_restore(self):
        before=self.page.locator('#scene').evaluate('(el)=>[el.offsetWidth,el.offsetHeight]')
        self.page.evaluate('window.camera=sdk.createCamera(options())')
        self.page.evaluate('camera.focus(document.querySelector("#target"),{durationMs:0})')
        self.page.locator('#target').click();self.assertEqual(self.page.evaluate('clicks'),1)
        self.assertEqual(before,self.page.locator('#scene').evaluate('(el)=>[el.offsetWidth,el.offsetHeight]'))
        self.assertFalse(self.page.locator('#overlay').evaluate('(el)=>getComputedStyle(el).transform!=="none"'))
        self.page.evaluate('camera.destroy();camera.destroy()')
        self.assertEqual(self.page.locator('#scene').evaluate('(el)=>el.style.transform'),'')
    def test_offsets_border_and_round_trip(self):
        value=self.page.evaluate('''() => {
          const c=sdk.createCamera(options());c.surface.apply({x:-90,y:-40,scale:2});
          const m=c.surface.snapshot([document.querySelector('#target')]);
          const b=m.bounds[0].rect, p=sdk.project(b,c.surface.pose,m.origin), actual=document.querySelector('#target').getBoundingClientRect();
          c.destroy();return {b,dx:p.x-actual.x,dy:p.y-actual.y};
        }''')
        self.assertAlmostEqual(value['dx'],0);self.assertAlmostEqual(value['dy'],0)
        self.assertAlmostEqual(value['b']['x'],480);self.assertAlmostEqual(value['b']['y'],240)
    def test_interruption_and_abort_leave_current_pose(self):
        self.page.evaluate('()=>{window.camera=sdk.createCamera(options());window.first=camera.focus(document.querySelector("#target"),{durationMs:700});}')
        self.page.wait_for_timeout(150)
        result=self.page.evaluate('''async()=>{const before=camera.surface.pose;window.abort=new AbortController();const next=camera.reset({durationMs:700,signal:abort.signal});const after=camera.surface.pose;abort.abort();return {before,after,first:await first,next:await next};}''')
        self.assertEqual(result['before'],result['after']);self.assertEqual(result['first']['status'],'interrupted');self.assertEqual(result['next']['status'],'interrupted')
    def test_external_portal_and_top_layer_are_overlay_targets(self):
        self.page.evaluate('window.camera=sdk.createCamera(options())')
        self.page.evaluate('camera.focus(document.querySelector("#portal"),{durationMs:0});document.querySelector("#dialog").showModal()')
        self.assertEqual(self.page.evaluate('camera.surface.snapshot([document.querySelector("#modal-target")]).bounds[0].space'),'client')
        self.page.evaluate('document.querySelector("#dialog").close();document.querySelector("#popover").showPopover()')
        self.assertEqual(self.page.evaluate('camera.surface.snapshot([document.querySelector("#popover")]).bounds[0].space'),'client')
    def test_fixed_sticky_and_transform_preflight(self):
        for css in ('position:fixed','position:sticky','transform:rotate(15deg)'):
            self.page.evaluate('(css)=>{document.querySelector("#target").style.cssText=css}',css)
            if css.startswith('transform'):
                self.page.evaluate('document.querySelector("#viewport").style.transform="rotate(15deg)"')
            self.assertEqual(self.page.evaluate('(()=>{const c=sdk.createCamera(options());const kind=c.surface.kind;c.destroy();return kind})()'),'overlay-only')
    def test_ownership_conflict_preserves_host_change(self):
        code=self.page.evaluate('''() => {const c=sdk.createCamera(options());c.surface.apply({x:1,y:2,scale:1});let error;try{sdk.createCamera(options())}catch(e){error=e.diagnostic.code}document.querySelector('#scene').style.transform='translateX(99px)';c.destroy();return error}''')
        self.assertEqual(code,'SURFACE_BUSY');self.assertEqual(self.page.locator('#scene').evaluate('(el)=>el.style.transform'),'translateX(99px)')
    def test_reduced_motion_updates_during_play(self):
        self.page.evaluate('window.camera=sdk.createCamera(options());void camera.focus(document.querySelector("#target"))')
        self.page.wait_for_timeout(100);self.page.emulate_media(reduced_motion='reduce');self.page.wait_for_timeout(50)
        self.assertEqual(self.page.evaluate('camera.surface.pose'),{'x':0,'y':0,'scale':1})
    def test_scroll_resize_invalidate_and_removed_targets_fail(self):
        self.page.evaluate('window.camera=sdk.createCamera(options());window.revision=camera.surface.revision;document.querySelector("#scroller").scrollTop=50;document.querySelector("#viewport").style.width="600px"')
        self.page.wait_for_timeout(100);self.assertGreater(self.page.evaluate('camera.surface.revision'),self.page.evaluate('revision'))
        self.assertEqual(self.page.evaluate('(()=>{document.querySelector("#target").remove();try{camera.focus(()=>document.querySelector("#target"))}catch(e){return e.diagnostic.code}})()'),'TARGET_MISSING')
    def test_missing_target_also_fails_without_motion(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.assertEqual(self.page.evaluate("(()=>{const c=sdk.createCamera(options());try{c.focus(()=>null)}catch(e){return e.diagnostic.code}finally{c.destroy()}})()"),'TARGET_MISSING')
        self.assertEqual(self.page.evaluate("(()=>{const c=sdk.createCamera({...options(),kind:'overlay-only'});try{c.focus(null)}catch(e){return e.diagnostic.code}finally{c.destroy()}})()"),'TARGET_MISSING')
    def test_continuous_invalidations_do_not_freeze_camera(self):
        self.page.evaluate("()=>{window.camera=sdk.createCamera(options());void camera.focus(document.querySelector('#target'),{durationMs:700});window.mover=setInterval(()=>camera.surface.invalidate(),16)}")
        self.page.wait_for_timeout(400);self.assertGreater(self.page.evaluate('camera.surface.pose.scale'),1.1)
        self.page.evaluate('clearInterval(mover);camera.destroy()')
    def test_clipped_scroll_target_requires_explicit_reveal(self):
        self.page.evaluate("()=>{const target=document.createElement('button');target.id='clipped';target.textContent='Hidden below fold';document.querySelector('#scroller').append(target);window.camera=sdk.createCamera(options())}")
        self.assertEqual(self.page.evaluate("(()=>{try{camera.focus(document.querySelector('#clipped'),{durationMs:0})}catch(e){return e.diagnostic.code}})()"),'TARGET_CLIPPED')
        self.page.evaluate("document.querySelector('#scroller').scrollTop=9999")
        self.assertEqual(self.page.evaluate("camera.focus(document.querySelector('#clipped'),{durationMs:0})")['status'],'completed')
    def test_bad_insets_and_observer_errors_do_not_leak_ownership(self):
        self.assertEqual(self.page.evaluate("(()=>{try{sdk.createCamera({...options(),insets:{left:-1}})}catch(e){return e.diagnostic.code}})()"),'INVALID_SAFE_AREA')
        self.page.evaluate("()=>{const c=sdk.createCamera(options());c.surface.subscribe(()=>{throw new Error('host error')});c.surface.invalidate();c.destroy();}")
    def test_scene_overview_can_fit_a_narrow_viewport(self):
        self.page.evaluate("document.querySelector('#viewport').style.width='320px';window.camera=sdk.createCamera(options())")
        result=self.page.evaluate("camera.focus(document.querySelector('#scene'),{durationMs:0,minScale:.1})")
        self.assertEqual(result['status'],'completed')
        self.assertLess(result['pose']['scale'],1)
        self.page.evaluate('camera.destroy()')
    def test_lifecycle_100_cycles_releases_lease_and_styles(self):
        self.assertTrue(self.page.evaluate('''async()=>{for(let i=0;i<100;i++){const c=sdk.createCamera(options());await c.focus(document.querySelector('#target'),{durationMs:0});c.destroy();}return document.querySelector('#scene').style.transform==='';}'''))
if __name__=='__main__':unittest.main(verbosity=2)
