import test from 'node:test';
import assert from 'node:assert/strict';
import {mountControls} from '../src/controls.js';

// A small DOM boundary records text-node replacement. Real pointer dispatch and
// engine behavior are exercised separately in react-tests/browser_test.py.
function fixture(){
  const nodes=[];
  class Element {
    constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.nodeType=1;this.children=[];
      this.dataset={};this.style={};this.attributes=new Map();this.events=new Map();this.text='';this.firstChild=null;this.writes=0;}
    append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
    contains(node){return this===node||this.children.some(child=>child.contains(node));}
    replaceChildren(...children){this.children=[];this.append(...children);}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);}
    removeEventListener(type,fn){this.events.get(type)?.delete(fn);}
    click(){for(const fn of this.events.get('click')||[])fn({target:this});}
    set textContent(value){this.text=String(value);this.firstChild={data:this.text};this.writes++;}
    get textContent(){return this.text;}
  }
  const doc={createElement(tag){const node=new Element(tag,doc);nodes.push(node);return node;}};
  const scene=doc.createElement('div'),container=doc.createElement('div'),events=new Set(),frames=new Set();
  const state={status:'ready',sceneId:'one',timeMs:0,durationMs:10000,mode:'watch',rate:1,captionsEnabled:true,reducedMotion:false};
  const info={locale:'en',modes:['watch'],scenes:[{id:'one',title:'One',summary:'Explanation',transcript:''}]};
  const change=patch=>{Object.assign(state,patch);for(const fn of events)fn({});return {ok:true};};
  const director={surface:{scene},inspect:()=>({...state}),describe:()=>info,
    on(fn){events.add(fn);return()=>events.delete(fn);},onFrame(fn){frames.add(fn);return()=>frames.delete(fn);},
    play:()=>change({status:'playing'}),pause:()=>change({status:'paused'}),stop:()=>change({status:'ready',timeMs:0}),
    setCaptions:value=>change({captionsEnabled:value}),setReducedMotion:value=>change({reducedMotion:value})};
  const controls=mountControls(director,container);
  return {state,controls,events,frames,container,button:id=>nodes.find(node=>node.dataset.command===id),
    frame(){state.timeMs+=16;for(const fn of frames)fn({});}};
}

test('frame updates preserve unchanged control label nodes while playback advances',()=>{
  const f=fixture();f.button('play').click();
  const ids=['play','stop','sound','captions','motion'];
  const labels=ids.map(id=>({id,node:f.button(id).firstChild,writes:f.button(id).writes}));
  for(let i=0;i<60;i++)f.frame();
  assert.equal(f.state.timeMs,960);
  for(const {id,node,writes} of labels){assert.equal(f.button(id).firstChild,node,id+' label node replaced');assert.equal(f.button(id).writes,writes);}
  f.controls.destroy();assert.equal(f.events.size,0);assert.equal(f.frames.size,0);
});

test('actual semantic label changes update once and keep the control usable',()=>{
  const f=fixture(),play=f.button('play'),old=play.firstChild;
  play.click();assert.equal(play.textContent,'Pause');assert.notEqual(play.firstChild,old);
  const running=play.firstChild;for(let i=0;i<4;i++)f.frame();assert.equal(play.firstChild,running);
  play.click();assert.equal(f.state.status,'paused');assert.equal(play.textContent,'Play');
  assert.equal(play.attributes.get('aria-label'),'Play walkthrough');
  f.button('captions').click();assert.equal(f.button('captions').textContent,'Captions off');
  f.button('motion').click();assert.equal(f.button('motion').textContent,'Motion reduced');
  const paused=play.firstChild;f.controls.refresh();assert.equal(play.firstChild,paused);
  f.controls.destroy();f.controls.destroy();assert.equal(f.container.children.length,0);
});
