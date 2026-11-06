"""Non-geometric host changes must not restart the camera trajectory."""
import unittest
from harness import BrowserFixture

class GeometryInvalidationTests(BrowserFixture):
    def test_text_and_explicit_invalidations_preserve_authored_camera(self):
        result=self.page.evaluate("""async()=>{
          const target=document.querySelector('#target');let now=0;
          const script={schemaVersion:'0.1.0-draft.1',id:'geometry',title:'Geometry',locale:'en',entryScene:'one',modes:['watch'],capabilities:[],targets:{target:{ref:'app.target'}},scenes:[{id:'one',title:'One',summary:'Camera trajectory.',durationMs:3000,cues:[{id:'camera',kind:'camera',at:0,durationMs:1000,target:'target',maxScale:2}]}]};
          const d=sdk.createDirector({surface:options(),targets:{'app.target':()=>target},scheduler:{now:()=>now,request:()=>1,cancel:()=>{}}});
          if(!d.load(script).ok)throw Error('load failed');
          await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
          const measurement=d.surface.snapshot([target]),plan=sdk.compile(script).plan;
          const errors=[];d.play();
          for(let i=1;i<=30;i++){
            if(i%4===0){document.querySelector('#scroller').firstElementChild.textContent='Update '+i;d.registry.invalidate();}
            await new Promise(requestAnimationFrame);now=i*16;
            // play() samples the current clock without changing its running state.
            d.setRate(1);
            const expected=sdk.sampleVisual(plan.scenes.one,now,{target:measurement.bounds[0]},measurement.box).camera;
            const actual=d.surface.pose;errors.push(Math.max(...['x','y','scale'].map(k=>Math.abs(actual[k]-expected[k]))));
          }
          const state=d.inspect();d.destroy();return {maxError:Math.max(...errors),status:state.status,timeMs:state.timeMs};
        }""")
        self.assertEqual(result['status'],'playing',result)
        self.assertEqual(result['timeMs'],480,result)
        self.assertLess(result['maxError'],0.01,result)

    def test_real_position_changes_still_invalidate_geometry(self):
        result=self.page.evaluate("""async()=>{
          const target=document.querySelector('#target');
          const script={schemaVersion:'0.1.0-draft.1',id:'move',title:'Move',locale:'en',entryScene:'one',modes:['watch'],capabilities:[],targets:{target:{ref:'app.target'}},scenes:[{id:'one',title:'One',summary:'Actual movement.',durationMs:3000,cues:[{id:'camera',kind:'camera',at:0,durationMs:1000,target:'target',maxScale:2}]}]};
          const d=sdk.createDirector({surface:options(),targets:{'app.target':()=>target}});d.load(script);d.seek({timeMs:1500});
          const before=d.surface.pose;target.style.left='600px';d.registry.invalidate();
          const after=d.surface.pose;d.destroy();return {before,after};
        }""")
        self.assertGreater(abs(result['after']['x']-result['before']['x']),100,result)

if __name__=='__main__':unittest.main(verbosity=2)
