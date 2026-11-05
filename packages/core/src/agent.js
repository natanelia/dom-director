import {DirectorError, requireValue, diagnostic} from './errors.js';
import {parseJSON, cloneData, canonical, freezeData} from './json.js';
import {schemaErrors} from './schema.js';
import {schemas} from './schema.generated.js';
import {compile, preview, SCHEMA_VERSION} from './compiler.js';

export const AGENT_PROTOCOL_VERSION = SCHEMA_VERSION;
export const AGENT_COMMANDS = Object.freeze(['getCapabilities','discoverTargets','validate','preview','inspect','load','play','pause','seek','stop']);
const mutating = new Set(['load','play','seek']);
const safety = new Set(['pause','stop']);
const ID = /^[A-Za-z][A-Za-z0-9._-]{0,79}$/u;
const validId = value => typeof value==='string' && ID.test(value);
const owners = new WeakMap();
const MAX_REPLY = 65536, RESERVATION = MAX_REPLY + 160;
const utf8Size = value => new TextEncoder().encode(JSON.stringify(value)).length;
const error = (code, message) => new DirectorError(code, message, 'agent');

async function fingerprint(value) {
  requireValue(globalThis.crypto?.subtle, 'CRYPTO_UNAVAILABLE', 'Agent commands require Web Crypto.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}
function summary(director) {
  const s = director.inspect();
  return {sessionId:director.sessionId,revision:s.revision,status:s.status,runId:s.runId||null,
    sceneId:s.sceneId||null,mode:s.mode||null,timeMs:s.timeMs??0,durationMs:s.durationMs??0,
    incomplete:!!s.incomplete,pendingOperation:s.pendingOperation||null,
    waitingFor:s.waitingFor?{cueId:s.waitingFor.cueId,kind:s.waitingFor.kind,error:s.waitingFor.error||null}:null};
}
function catalogData(input) {
  const data = cloneData(input);
  requireValue(data&&Array.isArray(data.actions)&&Array.isArray(data.conditions)&&data.actions.length<=100&&data.conditions.length<=100,
    'AGENT_OPTIONS','Capability catalogs must be bounded lists.');
  const actions=data.actions.map(a=>{
    requireValue(validId(a.id)&&typeof a.label==='string'&&a.label.length>0&&a.label.length<=200&&['read','ephemeral','persistent'].includes(a.impact),
      'AGENT_OPTIONS','Invalid action metadata.');
    return {id:a.id,label:a.label,impact:a.impact};
  });
  const conditions=data.conditions.map(c=>{
    requireValue(validId(c.id)&&typeof c.label==='string'&&c.label.length>0&&c.label.length<=200&&['acknowledgment','ui','domain','server'].includes(c.evidence),
      'AGENT_OPTIONS','Invalid condition metadata.');
    return {id:c.id,label:c.label,evidence:c.evidence};
  });
  requireValue(utf8Size({actions,conditions})<=MAX_REPLY/2,'AGENT_OPTIONS','Capability metadata exceeds its reply budget.');
  return freezeData({actions,conditions});
}

/** Host-bound, in-process JSON bridge. No transport, global install, DOM dump or arbitrary method dispatch. */
export function createAgentBridge(director, {
  clientId, authorize=()=>false, commands=AGENT_COMMANDS, targetIds=[], capabilities={actions:[],conditions:[]},
  maxRequests=128, maxPending=8, maxRetainedBytes=4194304, timeoutMs=5000,
}={}) {
  requireValue(director&&validId(director.sessionId)&&['inspect','load','play','pause','seek','stop'].every(key=>typeof director[key]==='function')&&
    typeof director.registry?.catalog==='function','AGENT_OPTIONS','A director with semantic targets is required.');
  requireValue(validId(clientId)&&typeof authorize==='function'&&Array.isArray(commands)&&commands.every(c=>AGENT_COMMANDS.includes(c))&&
    Array.isArray(targetIds)&&targetIds.length<=1000&&targetIds.every(validId)&&
    Number.isInteger(maxRequests)&&maxRequests>0&&maxRequests<=512&&Number.isInteger(maxPending)&&maxPending>0&&maxPending<=16&&
    Number.isSafeInteger(maxRetainedBytes)&&maxRetainedBytes>=RESERVATION&&maxRetainedBytes<=33554432&&
    Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=30000,'AGENT_OPTIONS','Invalid bounded agent policy.');
  const catalog=catalogData(capabilities), offered=new Set(commands), grantedTargets=new Set(targetIds);
  const clients=owners.get(director)||new Set();
  requireValue(!clients.has(clientId),'AGENT_CLIENT_EXISTS','This client already has a bridge for this director.');
  clients.add(clientId);owners.set(director,clients);
  const records=new Map(),active=new Set();let revoked=false,disposed=false,retainedBytes=0;
  function live(){requireValue(!revoked,'AGENT_REVOKED','The host revoked this agent bridge.');}
  function targets(){return director.registry.catalog().filter(t=>grantedTargets.has(t.id)).map(({id,label,kind})=>({id,label,kind}));}
  function check(signal){live();if(signal.aborted)throw signal.reason instanceof DirectorError?signal.reason:error('CANCELLED','Agent command was cancelled.');}
  function reply(request, result){
    let value={requestId:typeof request?.requestId==='string'&&ID.test(request.requestId)?request.requestId:null,sessionId:director.sessionId,revision:director.inspect().revision,...result};
    if(utf8Size(value)>MAX_REPLY)value={requestId:typeof request?.requestId==='string'&&ID.test(request.requestId)?request.requestId:null,sessionId:director.sessionId,revision:director.inspect().revision,
      ok:false,diagnostics:[error('AGENT_REPLY_LIMIT','The bounded reply is too large; narrow the request.').diagnostic]};
    return freezeData(value);
  }
  function raced(promise,signal){
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(fn,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);fn(value);};
      const abort=()=>finish(reject,signal.reason||error('CANCELLED','Agent command was cancelled.'));
      signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted)abort();
      Promise.resolve(promise).then(value=>finish(resolve,value),failure=>finish(reject,failure));
    });
  }
  function revoke(){if(revoked)return;revoked=true;for(const controller of active)controller.abort(error('AGENT_REVOKED','The host revoked this agent bridge.'));}
  async function grant(request, hash, signal, phase){
    check(signal);
    const req=freezeData({clientId,phase,requestHash:hash,...request});
    requireValue(await authorize(req,signal)===true,'CAPABILITY_DENIED','The host denied this agent command.');check(signal);
  }
  function binding(script){
    const allowed=new Set(targets().map(t=>t.id));
    requireValue(Object.values(script.targets).every(t=>allowed.has(t.ref)), 'TARGET_DENIED', 'The script references a target outside the agent grant.');
  }
  function dispatch(request){
    const {command,params}=request;
    switch(command){
      case 'getCapabilities':return {ok:true,value:{protocolVersion:AGENT_PROTOCOL_VERSION,offeredCommands:[...offered],
        authorizationRequired:true,capabilities:catalog,transport:'in-process',contentIsData:true}};
      case 'discoverTargets':{
        const query=(params.query||'').toLocaleLowerCase(),limit=params.limit||25;
        const found=targets().filter(t=>t.id.toLocaleLowerCase().includes(query)||t.label.toLocaleLowerCase().includes(query));
        return {ok:true,value:{targets:found.slice(0,limit),truncated:found.length>limit,registryRevision:director.registry.revision??0,contentIsData:true}};
      }
      case 'inspect':return {ok:true,value:summary(director)};
      case 'validate':{
        const result=compile(params.script);return result.ok?{ok:true,value:{valid:true,binding:'unchecked',schemaVersion:SCHEMA_VERSION}}:result;
      }
      case 'preview':{
        const result=preview(params.script);return result.ok?{ok:true,value:{...result.preview,binding:'unchecked',static:true}}:result;
      }
      case 'load':binding(params.script);break;
      default:break;
    }
    // A closed switch, not director[untrustedCommand](...). Portable scripts are never code.
    let result;
    switch(command){
      case 'load':result=director.load(params.script);break;
      case 'play':result=director.play();break;
      case 'pause':result=director.pause();break;
      case 'seek':result=director.seek(params);break;
      case 'stop':result=director.stop();break;
      default:throw error('COMMAND_UNAVAILABLE','Command is not implemented.');
    }
    return result.ok?{ok:true,value:summary(director)}:{ok:false,diagnostics:result.diagnostics};
  }
  return Object.freeze({
    clientId,sessionId:director.sessionId,
    async handle(json,{signal}={}){
      let request,controller,timer,abort;
      try{
        live();requireValue(!signal||(typeof signal.addEventListener==='function'&&typeof signal.removeEventListener==='function'),
          'AGENT_OPTIONS','Cancellation requires an AbortSignal.');
        request=freezeData(parseJSON(json));
        const errors=schemaErrors(request,schemas['agent-command'],schemas);
        if(errors.length)return reply(request,{ok:false,diagnostics:errors});
        requireValue(active.size<maxPending+(safety.has(request.command)?2:0),
          'AGENT_BUSY','Too many pending agent commands.');
        controller=new AbortController();active.add(controller);
        abort=()=>controller.abort(error('CANCELLED','Agent command was cancelled.'));
        signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
        timer=setTimeout(()=>controller.abort(error('AGENT_TIMEOUT','Agent authorization exceeded its deadline.')),timeoutMs);
        const work=async()=>{
          check(controller.signal);
          requireValue(request.sessionId===director.sessionId,'SESSION_MISMATCH','Command belongs to a different director.');
          requireValue(request.expectedRevision===undefined||Number.isSafeInteger(request.expectedRevision),'REVISION_INVALID','Revision must be a safe integer.');
          requireValue(offered.has(request.command),'COMMAND_DENIED','The host did not offer this command.');
          const hash=await fingerprint(request);check(controller.signal);
          const previous=records.get(request.requestId);
          if(previous){
            requireValue(previous.hash===hash,'REQUEST_ID_REUSED','A request ID was reused with different content.');
            const result=await raced(previous.promise,controller.signal);
            await grant(request,hash,controller.signal,'cached-result');
            return freezeData({...result,cached:true});
          }
          requireValue(records.size<maxRequests&&retainedBytes+RESERVATION<=maxRetainedBytes,'AGENT_LEDGER_FULL','The bounded request ledger is full. Start a new authorized session.');
          const record={hash,promise:null,bytes:RESERVATION};records.set(request.requestId,record);retainedBytes+=RESERVATION;
          record.promise=raced((async()=>{
            await grant(request,hash,controller.signal,'execute');
            if(mutating.has(request.command))requireValue(request.expectedRevision===director.inspect().revision,'REVISION_CONFLICT','Session changed; inspect it before issuing a new command.');
            check(controller.signal);
            return reply(request,dispatch(request));
          })(),controller.signal).catch(failure=>reply(request,{ok:false,diagnostics:[diagnostic(failure,'agent')]})).then(result=>{
            if(!revoked){const bytes=utf8Size(result)+hash.length+request.requestId.length;retainedBytes+=bytes-record.bytes;record.bytes=bytes;}
            return result;
          });
          return record.promise;
        };
        return await raced(work(),controller.signal);
      }catch(failure){return reply(request,{ok:false,diagnostics:[diagnostic(failure,'agent')]});}
      finally{clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);if(controller)active.delete(controller);}
    },
    inspect(){return {clientId,sessionId:director.sessionId,revoked,pending:active.size,retainedRequests:records.size,retainedBytes};},
    revoke,
    destroy(){if(disposed)return;disposed=true;revoke();records.clear();retainedBytes=0;clients.delete(clientId);},
  });
}

/** Proposes a narrow, reviewable JSON Patch. Does not apply it, resolve DOM, or guess a replacement. */
export async function proposeTargetRepair(input,options={},approvedCatalog=[]){
  try{
    const {alias,replacement,reason}=cloneData(options);
    const result=compile(input);if(!result.ok)return result;
    const script=result.plan.script;
    requireValue(validId(alias)&&Object.hasOwn(script.targets,alias)&&validId(replacement)&&typeof reason==='string'&&reason.length>0&&reason.length<=1000,
      'REPAIR_INVALID','A declared alias, replacement ID and bounded reason are required.');
    const catalog=cloneData(approvedCatalog);
    requireValue(Array.isArray(catalog)&&catalog.length<=1000&&catalog.filter(t=>t.id===replacement&&(!t.sensitivity||t.sensitivity==='public')).length===1&&catalog.filter(t=>t.id===replacement).length===1,
      'TARGET_DENIED','Select exactly one explicitly approved target.');
    const from=script.targets[alias].ref;requireValue(from!==replacement,'REPAIR_UNCHANGED','The target binding is unchanged.');
    return {ok:true,value:freezeData({scriptId:script.id,baseHash:await fingerprint(script),requiresHostReview:true,
      reason,affectedCues:script.scenes.flatMap(scene=>scene.cues.filter(c=>c.target===alias||c.fromTarget===alias).map(c=>({sceneId:scene.id,cueId:c.id}))),
      patch:[{op:'test',path:'/targets/'+alias+'/ref',value:from},{op:'replace',path:'/targets/'+alias+'/ref',value:replacement}]})};
  }catch(failure){return {ok:false,diagnostics:[diagnostic(failure,'agent')]};}
}
