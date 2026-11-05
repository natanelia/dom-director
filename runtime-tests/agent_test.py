from harness import BrowserFixture

SETUP = """() => {
  window.allowed=true;window.secretReads=0;window.serial=0;
  window.registry=sdk.createTargetRegistry({
    'app.button':{label:'Review checkpoint',resolve:()=>document.querySelector('#target')},
    'app.secret':{label:'Secret field',sensitivity:'secret',resolve:()=>{secretReads++;return document.querySelector('#input');}},
    'app.private':{label:'Private field',sensitivity:'private',resolve:()=>document.querySelector('#input')}
  });
  window.director=sdk.createDirector({surface:options(),registry});
  window.script={schemaVersion:'0.1.0-draft.1',id:'agent-browser',title:'Agent browser',locale:'en',entryScene:'one',modes:['watch'],capabilities:[],
    targets:{button:{ref:'app.button'}},scenes:[{id:'one',title:'Review',summary:'Look at the registered button.',durationMs:5000,
      cues:[{id:'shot',kind:'camera',at:0,durationMs:500,target:'button'}]}]};
  window.bridge=sdk.createAgentBridge(director,{clientId:'browser-agent',targetIds:['app.button','app.secret','app.private'],authorize:()=>allowed});
  window.request=(command,params={},extra={})=>({protocolVersion:sdk.AGENT_PROTOCOL_VERSION,requestId:'request.'+(++serial),sessionId:director.sessionId,
    ...(['load','play','seek'].includes(command)?{expectedRevision:director.inspect().revision}:{}),command,params,...extra});
  window.send=(command,params={},extra={})=>bridge.handle(JSON.stringify(request(command,params,extra)));
}"""

class AgentTests(BrowserFixture):
    def setUp(self):
        super().setUp()
        self.page.evaluate(SETUP)
    def test_catalog_does_not_read_or_expose_private_dom(self):
        result=self.page.evaluate("""async()=>{
          document.querySelector('#target').textContent='SECRET_RUNTIME_VALUE';
          return {catalog:await send('discoverTargets'),inspection:await send('inspect'),secretReads};
        }""")
        self.assertEqual([t['id'] for t in result['catalog']['value']['targets']],['app.button'])
        self.assertEqual(result['secretReads'],0)
        self.assertNotIn('SECRET_RUNTIME_VALUE',str(result))
    def test_agent_validates_previews_loads_plays_and_pauses(self):
        result=self.page.evaluate("""async()=>{
          const valid=await send('validate',{script}),preview=await send('preview',{script}),before=director.inspect();
          const loaded=await send('load',{script}),played=await send('play');
          await new Promise(r=>setTimeout(r,180));const paused=await send('pause');
          return {valid,preview,before,loaded,played,paused,clicks};
        }""")
        for key in ['valid','preview','loaded','played','paused']:self.assertTrue(result[key]['ok'],result)
        self.assertEqual(result['before']['status'],'idle')
        self.assertEqual(result['paused']['value']['status'],'paused')
        self.assertGreater(result['paused']['value']['timeMs'],20)
        self.assertLess(result['paused']['value']['timeMs'],2000)
        self.assertEqual(result['clicks'],0)
    def test_load_cannot_promote_secret_target(self):
        result=self.page.evaluate("""async()=>{script.targets.button.ref='app.secret';return {load:await send('load',{script}),secretReads};}""")
        self.assertEqual(result['load']['diagnostics'][0]['code'],'TARGET_DENIED')
        self.assertEqual(result['secretReads'],0)
    def test_duplicate_play_and_stale_seek_never_repeat_execution(self):
        result=self.page.evaluate("""async()=>{
          await send('load',{script});let starts=0;const off=director.on(e=>{if(e.type==='playback-started')starts++;});
          const message=JSON.stringify(request('play'));const first=await bridge.handle(message),second=await bridge.handle(message);
          const seek=await send('seek',{sceneId:'one',timeMs:800},{expectedRevision:0});off();director.stop();
          return {first,second,seek,starts,clicks};
        }""")
        self.assertTrue(result['first']['ok'])
        self.assertTrue(result['second']['cached'])
        self.assertEqual(result['starts'],1)
        self.assertEqual(result['seek']['diagnostics'][0]['code'],'REVISION_CONFLICT')
        self.assertEqual(result['clicks'],0)
    def test_missing_target_fails_without_guessing_or_clicking(self):
        result=self.page.evaluate("""async()=>{
          document.querySelector('#target').remove();const loaded=await send('load',{script});
          const stopped=await send('stop');return {loaded,stopped,clicks,secretReads};
        }""")
        self.assertFalse(result['loaded']['ok'])
        self.assertEqual(result['clicks'],0)
        self.assertEqual(result['secretReads'],0)
    def test_agent_play_grant_does_not_grant_host_effects(self):
        result=self.page.evaluate("""async()=>{
          bridge.destroy();director.destroy();window.executions=0;
          const guidance=sdk.createGuidance({authorize:()=>false,actions:{'host.approve':{
            impact:'ephemeral',validate:()=>true,execute:async()=>{executions++;return {completed:true};}}}});
          director=sdk.createDirector({surface:options(),guidance});
          bridge=sdk.createAgentBridge(director,{clientId:'policy-agent',authorize:()=>true});
          const actionScript={schemaVersion:'0.1.0-draft.1',id:'denied-action',title:'Denied action',locale:'en',entryScene:'one',modes:['watch'],
            capabilities:['action:host.approve'],targets:{},scenes:[{id:'one',title:'One',summary:'Host permission is separate.',durationMs:1000,
              cues:[{id:'approval',kind:'action',at:0,actionRef:'host.approve',args:{},timeoutMs:1000}]}]};
          const loaded=await send('load',{script:actionScript});const played=await send('play');
          await new Promise(r=>setTimeout(r,80));return {loaded,played,state:await send('inspect'),executions};
        }""")
        self.assertTrue(result['loaded']['ok'],result)
        self.assertTrue(result['played']['ok'],result)
        self.assertEqual(result['state']['value']['waitingFor']['error'],'CAPABILITY_DENIED')
        self.assertEqual(result['executions'],0)
    def test_repair_is_reviewable_data_not_an_automatic_target_change(self):
        result=self.page.evaluate("""async()=>{
          script.targets.button.ref='app.old';const before=JSON.stringify(script);
          const catalog=await send('discoverTargets');const proposal=await sdk.proposeTargetRepair(script,
            {alias:'button',replacement:'app.button',reason:'Host explicitly selected the replacement.'},catalog.value.targets);
          return {proposal,unchanged:JSON.stringify(script)===before,state:director.inspect(),clicks};
        }""")
        self.assertTrue(result['proposal']['ok'],result)
        self.assertTrue(result['proposal']['value']['requiresHostReview'])
        self.assertTrue(result['unchanged'])
        self.assertEqual(result['state']['status'],'idle')
        self.assertEqual(result['clicks'],0)
