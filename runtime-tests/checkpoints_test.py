from harness import BrowserFixture

SETUP = """() => {
  window.director=sdk.createDirector({surface:options()});
  window.tour={schemaVersion:'0.1.0-draft.1',id:'checkpoint-test',title:'Checkpoint test',locale:'en',entryScene:'one',modes:['watch','guide'],capabilities:[],targets:{},scenes:[
    {id:'one',title:'One',summary:'A visual scene',durationMs:10000,cues:[],next:'two'},
    {id:'two',title:'Two',summary:'Another visual scene',durationMs:10000,cues:[]}]};
  const loaded=director.load(tour);if(!loaded.ok)throw Error(JSON.stringify(loaded));
  window.versions={script:'1',host:'1',fixture:'1'};
  window.store=sdk.createCheckpointStore(director,{versions:()=>versions,verify:()=>true,authorize:()=>true});
}"""

class CheckpointTests(BrowserFixture):
    def setUp(self):
        super().setUp()
        self.page.evaluate(SETUP)
    def test_real_director_restore_is_visual_only_and_paused(self):
        result=self.page.evaluate("""async()=>{
          director.seek({sceneId:'one',timeMs:800});const saved=await store.capture();
          director.seek({sceneId:'two',timeMs:200});
          const restored=await store.restore(saved.value.id);
          return {saved,restored,clicks,caption:director.inspect().captionsEnabled};
        }""")
        self.assertTrue(result['saved']['ok'])
        self.assertTrue(result['restored']['ok'],result)
        self.assertEqual(result['restored']['value']['timeMs'],800)
        self.assertEqual(result['restored']['value']['sceneId'],'one')
        self.assertEqual(result['restored']['value']['status'],'paused')
        self.assertEqual(result['clicks'],0)
    def test_reloaded_script_rejects_previous_checkpoint(self):
        result=self.page.evaluate("""async()=>{const s=await store.capture();director.load(tour);return store.restore(s.value.id);}""")
        self.assertEqual(result['diagnostics'][0]['code'],'CHECKPOINT_INCOMPATIBLE')
    def test_user_preferences_are_not_rewound(self):
        result=self.page.evaluate("""async()=>{const s=await store.capture();director.setReducedMotion(true);director.setCaptions(false);const r=await store.restore(s.value.id);return {r,state:director.inspect()};}""")
        self.assertTrue(result['r']['ok'],result)
        self.assertTrue(result['state']['reducedMotion'])
        self.assertFalse(result['state']['captionsEnabled'])
    def test_stop_cancels_host_verification(self):
        result=self.page.evaluate("""async()=>{
          store.destroy();window.finish=null;
          store=sdk.createCheckpointStore(director,{versions:()=>versions,authorize:()=>true,verify:()=>new Promise(r=>finish=r)});
          const pending=store.capture();await new Promise(r=>setTimeout(r,0));director.stop();
          const result=await pending;finish(true);await new Promise(r=>setTimeout(r,0));
          return {result,state:director.inspect(),records:store.list()};
        }""")
        self.assertEqual(result['result']['diagnostics'][0]['code'],'CANCELLED')
        self.assertEqual(result['state']['status'],'ready')
        self.assertEqual(result['records'],[])
    def test_real_host_version_change_is_rejected(self):
        result=self.page.evaluate("""async()=>{const s=await store.capture();versions.fixture='2';return store.restore(s.value.id);}""")
        self.assertEqual(result['diagnostics'][0]['code'],'CHECKPOINT_INCOMPATIBLE')
