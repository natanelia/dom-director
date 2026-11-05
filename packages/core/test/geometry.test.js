import test from 'node:test';
import assert from 'node:assert/strict';
import {fit,interpolate,project,IDENTITY,union} from '../src/geometry.js';
import {StyleJournal} from '../src/journal.js';
test('safe area reserves captions, controls and padding',()=>{
  const bounds={x:20,y:40,width:100,height:50}, safe={x:10,y:20,width:400,height:200};
  const result=fit(bounds,safe,{paddingPx:20});assert.equal(result.clipped,false);
  const p=project(bounds,result.pose);assert.ok(p.x>=30);assert.ok(p.y>=40);
  assert.ok(p.x+p.width<=390);assert.ok(p.y+p.height<=200);
});
test('scale clipping is explicit and malformed bounds fail closed',()=>{
  assert.equal(fit({x:0,y:0,width:2000,height:2000},{x:0,y:0,width:100,height:100},{minScale:1}).clipped,true);
  for(const bad of [NaN,Infinity,-1,0])assert.throws(()=>fit({x:0,y:0,width:bad,height:1},{x:0,y:0,width:2,height:2}));
  assert.throws(()=>fit({x:0,y:0,width:1,height:1},{x:0,y:0,width:2,height:2},{paddingPx:2}));
  assert.throws(()=>fit({x:0,y:0,width:1,height:1},{x:0,y:0,width:100,height:100},{minScale:4,maxScale:2}));
});
test('easing endpoints, logarithmic scale and deterministic sampling',()=>{
  for(const easing of ['gentle','direct','overview']){
    assert.deepEqual(interpolate(IDENTITY,{x:10,y:20,scale:4},0,easing),IDENTITY);
    assert.deepEqual(interpolate(IDENTITY,{x:10,y:20,scale:4},1,easing),{x:10,y:20,scale:4});
  }
  assert.equal(interpolate(IDENTITY,{x:0,y:0,scale:4},.5).scale,2);
  assert.throws(()=>interpolate(IDENTITY,IDENTITY,.5,'unknown'));
  assert.throws(()=>interpolate(IDENTITY,IDENTITY,NaN));
});
test('seeded projection round trips for 2,000 supported poses',()=>{
  let seed=1762434;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
  for(let i=0;i<2000;i++){
    const r={x:random()*1000-500,y:random()*1000-500,width:1+random()*300,height:1+random()*300};
    const c={x:random()*400,y:random()*400,scale:.1+random()*15};const o={x:random()*100,y:random()*100};
    const p=project(r,c,o);assert.ok(Math.abs((p.x-o.x-c.x)/c.scale-r.x)<1e-9);
    assert.ok(Math.abs(p.width/c.scale-r.width)<1e-9);
  }
});
test('union respects separated targets',()=>assert.deepEqual(union([{x:0,y:2,width:2,height:3},{x:8,y:1,width:4,height:5}]),{x:0,y:1,width:12,height:5}));
test('journal restores priorities and preserves later host ownership',()=>{
  const values=new Map([['transform',['translateX(1px)','important']]]);
  const el={style:{getPropertyValue:k=>values.get(k)?.[0]||'',getPropertyPriority:k=>values.get(k)?.[1]||'',
    setProperty:(k,v,p='')=>values.set(k,[v,p]),removeProperty:k=>values.delete(k)}};
  const journal=new StyleJournal();journal.write(el,'transform','scale(2)');journal.write(el,'color','red');
  el.style.setProperty('color','blue');assert.throws(()=>journal.write(el,'color','red'));
  journal.restore();journal.restore();assert.deepEqual(values.get('transform'),['translateX(1px)','important']);assert.equal(values.get('color')[0],'blue');
});
test('server import does not access document or window',async()=>{
  const sdk=await import('../src/index.js');assert.equal(typeof sdk.createCamera,'function');
});
